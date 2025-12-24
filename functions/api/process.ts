
import { GoogleGenAI } from "@google/genai";

// Helper for consistent JSON responses with proper headers
function jsonResponse(data: any, status: number = 200, extraHeaders?: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) }
    });
}

function parseRetryDelaySeconds(errorMessage: string, retryAfterHeader?: string | null): number | undefined {
    // Header wins if present
    if (retryAfterHeader) {
        const headerSeconds = Number.parseInt(retryAfterHeader, 10);
        if (Number.isFinite(headerSeconds)) return headerSeconds;
    }

    // Common format from Google APIs: retryDelay: "20s" (may be quoted)
    const retryDelayMatch = errorMessage.match(/retryDelay[^0-9]*"?(\d+)s"?/i);
    if (retryDelayMatch) {
        const seconds = Number.parseInt(retryDelayMatch[1], 10);
        return Number.isFinite(seconds) ? seconds : undefined;
    }

    // Some stacks include Retry-After style hints
    const retryAfterMatch = errorMessage.match(/retry[- ]after[^0-9]*(\d+)/i);
    if (retryAfterMatch) {
        const seconds = Number.parseInt(retryAfterMatch[1], 10);
        return Number.isFinite(seconds) ? seconds : undefined;
    }

    return undefined;
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
    let requestId: string | null = null;

    try {
        const body = await context.request.json();
        requestId = body.requestId || null;
        jobId = body.jobId;
        const { model, systemPrompt, userPrompt, compressedImageData } = body;

        const cfRay = context.request.headers.get('cf-ray');
        const cfColo = context.request.headers.get('cf-connecting-ip')
            ? context.request.cf?.colo
            : context.request.cf?.colo;
        console.log("[Process API] Starting job:", { requestId, jobId, model, cfRay, cfColo });

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

        // Guardrail: avoid oversized inline payloads (> ~18MB raw bytes) to stay under 20MB request cap and cost surprises
        const approximateBytes = Math.floor(b64Data.length * 0.75);
        if (approximateBytes > 18 * 1024 * 1024) {
            return jsonResponse({
                success: false,
                error: "Image too large to send inline. Please compress further or retry after resizing."
            }, 413);
        }

        // 3. Initialize Gemini AI
        const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });

        // Determine model - use gemini-2.5-flash-image for image editing
        const modelName = model || 'gemini-2.5-flash-image';
        console.log("[Process API] Using model:", modelName);

        // Build the prompt
        const fullPrompt = `${systemPrompt}\n\n${userPrompt || ''}`.trim();
        console.log("[Process API] Prompt length:", fullPrompt.length);

        // 4. Call Gemini API with correct structure as per Research PDF
        console.log("[Process API] Calling Gemini API...");
        const requestPayload = {
            // The SDK accepts bare model names, but prefixing avoids regional aliasing edge cases
            model: modelName.startsWith('models/') ? modelName : `models/${modelName}`,
            contents: [{
                role: 'user',
                parts: [
                    { text: fullPrompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: b64Data
                        }
                    }
                ]
            }],
            // As of 2025-12 docs, response_modalities sits inside GenerateContentConfig for image models
            config: {
                responseModalities: ['IMAGE']
            },
            generationConfig: {
                temperature: 1
            }
        };

        console.log("[Process API] Gemini request payload", { model: requestPayload.model, responseModalities: requestPayload.config.responseModalities });

        const response = await ai.models.generateContent(requestPayload);

        console.log("[Process API] Gemini response received");
        if (response?.usage) {
            console.log("[Process API] Usage:", response.usage);
        }

        // 5. Extract generated image from response candidates
        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find(p => p.inlineData);

        if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
            // Log full response for debugging
            console.error("[Process API] Full response structure:", JSON.stringify(response, null, 2));

            // Check if we got text instead
            const textPart = parts.find(p => p.text);
            const errorMsg = textPart
                ? `Model returned text instead of image: ${textPart.text.substring(0, 150)}`
                : "Model returned no image data";

            throw new Error(errorMsg);
        }

        // 6. Save Result to R2
        const imageBytes = imagePart.inlineData.data;

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
        return jsonResponse({ success: true, imageBytes, requestId });

    } catch (e) {
        const errorMessage = e?.message || 'Unknown error';
        console.error("[Process API] Error:", errorMessage);

        const retryAfterHeader = e?.response?.headers?.get?.('Retry-After') ?? null;

        // Parse retry delay from Google's rate limit error
        let retryAfterSeconds = 0;
        let isRateLimited = false;

        // Check if it's a rate limit error (429)
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('retryDelay')) {
            isRateLimited = true;
            retryAfterSeconds = parseRetryDelaySeconds(errorMessage, retryAfterHeader) ?? 30;
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

        const retryHeaders = isRateLimited && retryAfterSeconds > 0
            ? { 'Retry-After': String(retryAfterSeconds) }
            : undefined;

        return jsonResponse({
            success: false,
            error: errorMessage.substring(0, 500),
            isRetryable: isRateLimited,
            retryAfterSeconds: retryAfterSeconds,
            requestId
        }, isRateLimited ? 429 : 500, retryHeaders);
    }
}
