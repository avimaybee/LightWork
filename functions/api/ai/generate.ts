
import { GoogleGenAI } from "@google/genai";

// Parse retry delay from Google's rate limit error
function parseRetryDelay(errorMessage: string): number {
    const retryMatch = errorMessage.match(/retryDelay[":]+\s*(\d+)s/i);
    if (retryMatch) {
        return parseInt(retryMatch[1], 10);
    }
    return 30; // Default to 30 seconds
}

// Check if error is rate limit related
function isRateLimitError(errorMessage: string): boolean {
    return errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('retryDelay');
}

// Helper for JSON response with proper headers
function jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestPost(context) {
    try {
        // Accept compressedImageData from client to avoid R2 read + OOM
        const { type, jobId, text, compressedImageData } = await context.request.json();

        console.log("[AI Generate] Request type:", type, "jobId:", jobId, "hasCompressedData:", !!compressedImageData);

        const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });

        // Use lighter models for analysis tasks (higher rate limits)
        const modelName = 'gemini-flash-latest';

        let prompt = "";
        let contents: any = null;

        if (type === 'enhance') {
            // Text-only task - no image needed
            if (!text) return jsonResponse({ success: false, error: "Missing text" }, 400);
            prompt = `Refine the following image editing instruction to be more technical, precise, and effective for an AI image generator. Keep it concise. Only output the refined instruction, nothing else. Input: "${text}"`;
            contents = { parts: [{ text: prompt }] };
        }
        else if (type === 'rename' || type === 'describe') {
            // Vision tasks - require image data
            if (!compressedImageData) {
                console.log("[AI Generate] No compressed image data provided");
                return jsonResponse({ success: false, error: "Compressed image data required" }, 400);
            }

            console.log("[AI Generate] Using client-compressed image, length:", compressedImageData.length);

            if (type === 'rename') {
                prompt = "Analyze this image and generate a short, SEO-friendly, kebab-case filename (e.g. 'sunset-beach-portrait'). Do not include file extension. Only output the filename, nothing else.";
            } else {
                prompt = "Analyze this image and provide a detailed technical description of the subject, lighting, and composition that could be used as a prompt to recreate or edit it.";
            }

            // Use client-provided compressed image (avoids R2 read + OOM)
            contents = {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: compressedImageData
                        }
                    }
                ]
            };
        } else {
            return jsonResponse({ success: false, error: "Invalid type" }, 400);
        }

        console.log("[AI Generate] Calling model:", modelName);

        const response = await ai.models.generateContent({
            model: modelName,
            contents: contents
        });

        // Extract text from response
        let resultText = "";
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    resultText += part.text;
                }
            }
        }

        console.log("[AI Generate] Response length:", resultText.length);

        if (!resultText) {
            throw new Error("No text response from model");
        }

        return jsonResponse({ success: true, result: resultText.trim() });
    } catch (e) {
        const errorMessage = e.message || 'Unknown error';
        console.error("[AI Generate] Error:", errorMessage);

        // Check for rate limit and parse retry delay
        const isRateLimited = isRateLimitError(errorMessage);
        const retryAfterSeconds = isRateLimited ? parseRetryDelay(errorMessage) : 0;

        if (isRateLimited) {
            console.log("[AI Generate] Rate limited, retry after:", retryAfterSeconds, "seconds");
        }

        return jsonResponse({
            success: false,
            error: isRateLimited ? `Rate limited. Retry in ${retryAfterSeconds}s` : errorMessage,
            isRetryable: isRateLimited,
            retryAfterSeconds: retryAfterSeconds
        });
    }
}
