
import { GoogleGenAI } from "@google/genai";

// Helper function to convert ArrayBuffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
}

export async function onRequestPost(context) {
    let jobId: string | null = null;

    try {
        const body = await context.request.json();
        jobId = body.jobId;
        const { model, systemPrompt, userPrompt, compressedImageData } = body;

        console.log("[Process API] Starting job:", jobId, "Model:", model);

        // 1. Get Image Info from DB (still needed for result storage)
        const imageRecord = await context.env.DB.prepare("SELECT * FROM images WHERE id = ?").bind(jobId).first();
        if (!imageRecord) {
            console.log("[Process API] Image not found in DB:", jobId);
            return new Response(JSON.stringify({ success: false, error: "Image not found in database" }), { status: 404 });
        }
        console.log("[Process API] Found image record:", imageRecord.r2_key_original);

        // 2. Use compressed image data if provided (reduces tokens by ~90%)
        // Otherwise fall back to R2
        let b64Data: string;
        let mimeType = 'image/jpeg'; // Default for compressed data

        if (compressedImageData) {
            console.log("[Process API] Using client-compressed image, length:", compressedImageData.length);
            b64Data = compressedImageData;
            mimeType = 'image/jpeg';
        } else {
            console.log("[Process API] No compressed data, loading from R2...");
            const obj = await context.env.STORAGE.get(imageRecord.r2_key_original);
            if (!obj) {
                console.log("[Process API] Source image missing in R2");
                return new Response(JSON.stringify({ success: false, error: "Source image missing in storage" }), { status: 404 });
            }

            const arrayBuffer = await obj.arrayBuffer();
            console.log("[Process API] Image loaded from R2, size:", arrayBuffer.byteLength);
            
            if (obj.httpMetadata && obj.httpMetadata.contentType) {
                mimeType = obj.httpMetadata.contentType;
            } else {
                // Fallback inference
                if (imageRecord.filename.toLowerCase().endsWith('.png')) mimeType = 'image/png';
                else if (imageRecord.filename.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
            }
            console.log("[Process API] R2 Image MimeType:", mimeType);

            // Convert to base64 safely (chunked to avoid stack overflow)
            b64Data = arrayBufferToBase64(arrayBuffer);
        }

        console.log("[Process API] Base64 length for AI:", b64Data.length);

        // 3. Initialize Gemini AI
        const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });

        // Determine model - default to gemini-2.5-flash-image
        const modelName = model || 'gemini-2.5-flash-image';
        console.log("[Process API] Using model:", modelName);

        // Build the prompt
        const fullPrompt = `${systemPrompt}\n\n${userPrompt || ''}`.trim();
        console.log("[Process API] Prompt length:", fullPrompt.length);

        // 4. Call Gemini API - using generateContent for image editing
        // Per official docs: https://ai.google.dev/gemini-api/docs/image-generation
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [
                { text: fullPrompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: b64Data
                    }
                }
            ]
        });

        console.log("[Process API] Gemini response received");

        // 5. Extract generated image from response.candidates[0].content.parts
        let imageBytes = null;

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    imageBytes = part.inlineData.data;
                    console.log("[Process API] Found image in response");
                    break;
                }
                if (part.text) {
                    console.log("[Process API] Text response:", part.text.substring(0, 200));
                }
            }
        }

        if (!imageBytes) {
            // Check if there was a text refusal or error message
            const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
            const errorMsg = textPart ? textPart.text : "Model returned no image data";
            console.error("[Process API] No image in response:", errorMsg.substring(0, 500));
            throw new Error(errorMsg.substring(0, 200)); // Truncate for cleaner error
        }

        // 6. Save Result to R2
        const resultKey = `result-${jobId}.png`;
        const binaryString = atob(imageBytes);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        await context.env.STORAGE.put(resultKey, bytes, {
            httpMetadata: { contentType: 'image/png' }
        });
        console.log("[Process API] Result saved to R2:", resultKey);

        // 7. Update DB
        await context.env.DB.prepare("UPDATE images SET status = ?, r2_key_result = ? WHERE id = ?")
            .bind('completed', resultKey, jobId).run();

        // Return bytes to frontend for immediate display
        console.log("[Process API] Job completed successfully");
        return new Response(JSON.stringify({ success: true, imageBytes }));

    } catch (e) {
        const errorMessage = e.message || 'Unknown error';
        console.error("[Process API] Error:", errorMessage);

        // Parse retry delay from Google's rate limit error
        let retryAfterSeconds = 0;
        let isRateLimited = false;

        // Check if it's a rate limit error (429)
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('retryDelay')) {
            isRateLimited = true;
            // Try to extract retry delay from error message
            const retryMatch = errorMessage.match(/retryDelay[":]+\s*(\d+)s/i);
            if (retryMatch) {
                retryAfterSeconds = parseInt(retryMatch[1], 10);
            } else {
                retryAfterSeconds = 30; // Default to 30 seconds
            }
            console.log("[Process API] Rate limited, retry after:", retryAfterSeconds, "seconds");
        }

        // Update DB status
        try {
            if (jobId) {
                const displayError = isRateLimited
                    ? `Rate limited. Retry in ${retryAfterSeconds}s`
                    : errorMessage.substring(0, 200);
                await context.env.DB.prepare("UPDATE images SET status = ?, error_msg = ? WHERE id = ?")
                    .bind('error', displayError, jobId).run();
            }
        } catch (dbError) {
            console.error("[Process API] Failed to update DB:", dbError);
        }

        return new Response(JSON.stringify({
            success: false,
            error: errorMessage.substring(0, 500),
            isRetryable: isRateLimited,
            retryAfterSeconds: retryAfterSeconds
        }));
    }
}

