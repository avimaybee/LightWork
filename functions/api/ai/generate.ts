
import { GoogleGenAI } from "@google/genai";
import { z } from 'zod';

// Input validation schema
const generateRequestSchema = z.object({
    type: z.enum(['enhance', 'rename', 'describe']),
    jobId: z.string().uuid().optional(),
    text: z.string().max(5000).optional(),
    compressedImageData: z.string().optional(),
}).refine(
    (data) => {
        // 'enhance' requires text, others require image data
        if (data.type === 'enhance') return !!data.text;
        return !!data.compressedImageData;
    },
    { message: 'Invalid input: enhance requires text, rename/describe require image data' }
);

// Parse retry delay from Google's rate limit error
function parseRetryDelay(errorMessage: string): number {
    const retryMatch = errorMessage.match(/retryDelay[^0-9]*"?(\d+)s"?/i);
    if (retryMatch) return parseInt(retryMatch[1], 10);
    return 30; // Default to 30 seconds
}

// Check if error is rate limit related
function isRateLimitError(errorMessage: string): boolean {
    return errorMessage.includes('429') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('retryDelay');
}

// Helper for JSON response with proper headers
function jsonResponse(data: any, status: number = 200, extraHeaders?: Record<string, string>): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) }
    });
}

export async function onRequestPost(context) {
    try {
        const rawBody = await context.request.json();
        
        // Validate input with Zod schema
        const validation = generateRequestSchema.safeParse(rawBody);
        if (!validation.success) {
            const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            return jsonResponse({ success: false, error: `Validation failed: ${errors}` }, 400);
        }
        
        const { type, jobId, text, compressedImageData } = validation.data;

        console.log("[AI Generate] Request type:", type, "jobId:", jobId, "hasCompressedData:", !!compressedImageData);

        const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });

        // Use lighter models for analysis tasks (higher rate limits)
        const modelName = 'gemini-flash-latest';

        let prompt = "";
        let contents: any = null;

        if (type === 'enhance') {
            // Text-only task - no image needed (already validated)
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

        const retryHeaders = isRateLimited && retryAfterSeconds > 0
            ? { 'Retry-After': String(retryAfterSeconds) }
            : undefined;

        return jsonResponse({
            success: false,
            error: isRateLimited ? `Rate limited. Retry in ${retryAfterSeconds}s` : errorMessage,
            isRetryable: isRateLimited,
            retryAfterSeconds: retryAfterSeconds
        }, isRateLimited ? 429 : 500, retryHeaders);
    }
}
