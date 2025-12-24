
import { GoogleGenAI } from "@google/genai";

// Helper for consistent JSON responses with proper headers
function jsonResponse(data: any, status: number = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

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
            return jsonResponse({ success: false, error: "Image not found in database" }, 404);
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
                return jsonResponse({ success: false, error: "Source image missing in storage" }, 404);
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

        // Determine model - use gemini-2.5-flash-image for image editing
        const modelName = model || 'gemini-2.5-flash-image';
        console.log("[Process API] Using model:", modelName);

        // Build the prompt
        const fullPrompt = `${systemPrompt}\n\n${userPrompt || ''}`.trim();
        console.log("[Process API] Prompt length:", fullPrompt.length);

        // 4. Call Gemini API with responseModalities for image generation
        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    { text: fullPrompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: b64Data
                        }
                    }
                ]
            },
            config: {
                responseModalities: ['image', 'text']
            }
        });



        console.log("[Process API] Gemini response received");

        // 5. Extract generated image from response.candidates[0].content.parts
        let imageBytes = null;
        let textResponse = null;

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    imageBytes = part.inlineData.data;
                    console.log("[Process API] Found image in response, length:", imageBytes.length);
                    break;
                }
                if (part.text) {
                    textResponse = part.text;
                    console.log("[Process API] Text response:", part.text.substring(0, 200));
                }
            }
        }

        if (!imageBytes) {
            // Log full response for debugging
            console.error("[Process API] Full response structure:", JSON.stringify(response.candidates?.[0]?.content).substring(0, 1000));
            const errorMsg = textResponse
                ? `Model returned text instead of image: ${textResponse.substring(0, 150)}`
                : "Model returned no image data - check if prompt is compatible with image editing";
            console.error("[Process API] No image in response:", errorMsg);
            throw new Error(errorMsg);
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
        return jsonResponse({ success: true, imageBytes });

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

        return jsonResponse({
            success: false,
            error: errorMessage.substring(0, 500),
            isRetryable: isRateLimited,
            retryAfterSeconds: retryAfterSeconds
        }, isRateLimited ? 429 : 500);
    }
}
