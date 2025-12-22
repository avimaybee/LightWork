/**
 * Gemini AI Service for Image Processing
 * Uses Google's Nano Banana (Gemini 2.5 Flash Image) for image-to-image generation
 * 
 * Supported Models:
 * - gemini-2.5-flash-image (Nano Banana): Fast, 1024px, high-volume
 * - gemini-3-pro-image-preview (Nano Banana Pro): Professional, 4K, complex instructions
 * 
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 * @see https://ai.google.dev/gemini-api/docs/nanobanana
 */

import type { Module } from '../types';

// Available Nano Banana models
export const MODELS = {
    NANO_BANANA: 'gemini-2.5-flash-image',           // Fast, 1024px output
    NANO_BANANA_PRO: 'gemini-3-pro-image-preview',   // Professional, up to 4K
} as const;

// Default model for batch processing (optimized for speed)
const DEFAULT_MODEL = MODELS.NANO_BANANA;

// Supported input MIME types per Gemini docs
const SUPPORTED_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
];

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
                inlineData?: {
                    mimeType: string;
                    data: string;
                };
            }>;
        };
        finishReason?: string;
    }>;
    error?: {
        code: number;
        message: string;
        status: string;
    };
    promptFeedback?: {
        blockReason?: string;
    };
}

export interface ProcessImageResult {
    success: boolean;
    imageData?: ArrayBuffer;
    mimeType?: string;
    error?: string;
}

export class GeminiService {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = DEFAULT_MODEL) {
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Process an image using Gemini AI (image-to-image transformation)
     * 
     * @param imageBuffer - The input image as ArrayBuffer
     * @param mimeType - MIME type of the input image
     * @param module - The processing module with system prompt
     * @param specificPrompt - Optional image-specific instructions
     */
    async processImage(
        imageBuffer: ArrayBuffer,
        mimeType: string,
        module: Module,
        specificPrompt?: string | null
    ): Promise<ProcessImageResult> {
        // Validate input MIME type
        const normalizedMimeType = mimeType.toLowerCase();
        if (!SUPPORTED_MIME_TYPES.includes(normalizedMimeType)) {
            return {
                success: false,
                error: `Unsupported image format: ${mimeType}. Supported: ${SUPPORTED_MIME_TYPES.join(', ')}`,
            };
        }

        // Build the complete prompt
        // 2-prompt rule:
        // - Module system_prompt is the global base
        // - Image specific_prompt is appended (optional)
        const systemContext = (module.system_prompt || '').trim();
        const imageInstructions = (specificPrompt || '').trim();

        const fullPrompt = imageInstructions
            ? `${systemContext}\n\n${imageInstructions}`
            : systemContext;

        // Convert image to base64
        const base64Image = this.arrayBufferToBase64(imageBuffer);

        // Build request body per Gemini API docs
        // @see https://ai.google.dev/gemini-api/docs/image-generation
        const requestBody = {
            contents: [
                {
                    parts: [
                        // Text prompt first
                        {
                            text: fullPrompt,
                        },
                        // Then the input image
                        {
                            inlineData: {
                                mimeType: normalizedMimeType,
                                data: base64Image,
                            },
                        },
                    ],
                },
            ],
            generationConfig: {
                // Request image-only output (no text)
                // Note: Case matters! Use 'Image' not 'IMAGE'
                responseModalities: ['Image'],
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        try {
            console.log(`🍌 Calling Gemini API with model: ${this.model}`);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            // Handle rate limiting (429) and server errors (503)
            if (response.status === 429) {
                return {
                    success: false,
                    error: 'RATE_LIMITED',
                };
            }

            if (response.status === 503) {
                return {
                    success: false,
                    error: 'MODEL_OVERLOADED',
                };
            }

            const data = await response.json() as GeminiResponse;

            // Check for API-level errors
            if (!response.ok || data.error) {
                const code = data.error?.code || response.status;
                const message = data.error?.message || '';
                
                let errorMessage = 'An unexpected error occurred.';

                if (code === 400) {
                    if (message.includes('image') && message.includes('large')) {
                        errorMessage = 'Image is too large for this model. Try a smaller file.';
                    } else if (message.includes('unsupported')) {
                        errorMessage = 'This image format is not supported by Gemini.';
                    } else {
                        errorMessage = 'Invalid request. Please check your prompt or image.';
                    }
                } else if (code === 401 || code === 403) {
                    errorMessage = 'API Key issue. Please check your configuration.';
                } else if (code === 404) {
                    errorMessage = 'The selected AI model is currently unavailable.';
                } else if (code === 429) {
                    errorMessage = 'Rate limit exceeded. Please wait a moment.';
                } else if (code >= 500) {
                    errorMessage = 'Gemini is having trouble. Retrying...';
                }

                console.error(`🍌 Gemini API error [${code}]:`, message);
                return {
                    success: false,
                    error: errorMessage,
                };
            }

            // Check for content filtering
            if (data.promptFeedback?.blockReason) {
                const reason = data.promptFeedback.blockReason;
                let friendlyReason = 'Content blocked by safety filters.';
                
                if (reason === 'SAFETY') friendlyReason = 'Image or prompt triggered safety filters.';
                else if (reason === 'OTHER') friendlyReason = 'Content blocked for policy reasons.';

                return {
                    success: false,
                    error: `SAFETY_BLOCKED: ${friendlyReason}`,
                };
            }

            // Extract the generated image from response
            if (data.candidates?.[0]?.content?.parts) {
                for (const part of data.candidates[0].content.parts) {
                    if (part.inlineData?.data) {
                        const imageData = this.base64ToArrayBuffer(part.inlineData.data);
                        const outputMimeType = part.inlineData.mimeType || 'image/png';

                        console.log(`🍌 Successfully generated image (${outputMimeType})`);

                        return {
                            success: true,
                            imageData,
                            mimeType: outputMimeType,
                        };
                    }
                }
            }

            // Check finish reason for issues
            const finishReason = data.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                let reasonMsg = `Generation stopped: ${finishReason}`;
                
                if (finishReason === 'SAFETY') reasonMsg = 'Output blocked by safety filters.';
                else if (finishReason === 'RECITATION') reasonMsg = 'Output blocked (copyright protection).';
                else if (finishReason === 'OTHER') reasonMsg = 'Output blocked for policy reasons.';

                return {
                    success: false,
                    error: reasonMsg,
                };
            }

            return {
                success: false,
                error: 'No image generated in response',
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`🍌 Gemini API exception:`, errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        // Avoid building a giant intermediate "binary" string byte-by-byte.
        // The previous implementation had quadratic behavior for large buffers and could
        // blow CPU time and memory on Workers.
        const bytes = new Uint8Array(buffer);
        return encodeBase64(bytes);
    }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(bytes: Uint8Array): string {
    const len = bytes.length;
    if (len === 0) return '';

    // Each 3 bytes become 4 chars.
    const out = new Array<string>(Math.ceil(len / 3) * 4);
    let outIndex = 0;

    let i = 0;
    for (; i + 2 < len; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out[outIndex++] = BASE64_ALPHABET[(n >>> 18) & 63];
        out[outIndex++] = BASE64_ALPHABET[(n >>> 12) & 63];
        out[outIndex++] = BASE64_ALPHABET[(n >>> 6) & 63];
        out[outIndex++] = BASE64_ALPHABET[n & 63];
    }

    const remaining = len - i;
    if (remaining === 1) {
        const n = bytes[i] << 16;
        out[outIndex++] = BASE64_ALPHABET[(n >>> 18) & 63];
        out[outIndex++] = BASE64_ALPHABET[(n >>> 12) & 63];
        out[outIndex++] = '=';
        out[outIndex++] = '=';
    } else if (remaining === 2) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
        out[outIndex++] = BASE64_ALPHABET[(n >>> 18) & 63];
        out[outIndex++] = BASE64_ALPHABET[(n >>> 12) & 63];
        out[outIndex++] = BASE64_ALPHABET[(n >>> 6) & 63];
        out[outIndex++] = '=';
    }

    if (outIndex !== out.length) out.length = outIndex;
    return out.join('');
}
