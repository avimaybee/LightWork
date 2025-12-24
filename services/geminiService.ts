
import { AppModel } from "../types";
import { api } from "./api";
import { compressImageForAI } from "../utils";

interface GeminiResponse {
  success: boolean;
  imageBytes?: string;
  error?: string;
  isRetryable?: boolean;
  retryAfterSeconds?: number;
}

export const processImageWithGemini = async (
  file: File,
  systemContext: string,
  userPrompt: string,
  modelName: AppModel,
  jobId?: string
): Promise<GeminiResponse> => {
  try {
    if (!jobId) throw new Error("Job ID required for backend processing");

    // Compress image client-side to reduce token consumption
    let compressedImageData: string | undefined;

    if (file) {
      try {
        console.log("[GeminiService] Compressing image for AI...");
        compressedImageData = await compressImageForAI(file, 1536);
        console.log("[GeminiService] Image compressed successfully");
      } catch (e) {
        console.warn("[GeminiService] Compression failed, using original", e);
      }
    }

    const result = await api.processImage(jobId, modelName, systemContext, userPrompt, compressedImageData);

    if (result.success && result.imageBytes) {
      return { success: true, imageBytes: result.imageBytes };
    }

    return {
      success: false,
      error: result.error || "Backend processing failed",
      isRetryable: result.isRetryable,
      retryAfterSeconds: result.retryAfterSeconds
    };

  } catch (error: any) {
    console.error("[GeminiService] Error:", error);
    return {
      success: false,
      error: error.message || "Network error",
      isRetryable: true
    };
  }
};

// Response type for AI operations with retry support
interface AIResponse {
  success: boolean;
  result?: string;
  error?: string;
  isRetryable?: boolean;
  retryAfterSeconds?: number;
}

// Helper to get compressed image data from file OR url
async function getCompressedImageData(fileOrUrl: File | Blob | string): Promise<string> {
  let blob: Blob;

  if (typeof fileOrUrl === 'string') {
    // It's a URL - fetch the image
    console.log("[GeminiService] Fetching image from URL...");
    const response = await fetch(fileOrUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    blob = await response.blob();
  } else {
    blob = fileOrUrl;
  }

  return await compressImageForAI(blob, 1024);
}

// Smart Rename - accepts file/blob or URL string
export const generateSmartFilename = async (fileOrUrl: File | Blob | string): Promise<AIResponse> => {
  try {
    console.log("[GeminiService] Smart Rename starting...");
    const compressedImageData = await getCompressedImageData(fileOrUrl);
    console.log("[GeminiService] Image compressed for rename, calling API...");
    return await api.generateAI('rename', { compressedImageData });
  } catch (e: any) {
    console.error("[GeminiService] Smart Rename error:", e);
    return { success: false, error: e.message };
  }
};

// Enhance Prompt - text only, no image needed
export const enhancePrompt = async (originalPrompt: string): Promise<AIResponse> => {
  return await api.generateAI('enhance', { text: originalPrompt });
};

// Auto Draft / Describe - accepts file/blob or URL string
export const generateImageDescription = async (fileOrUrl: File | Blob | string): Promise<AIResponse> => {
  try {
    console.log("[GeminiService] Auto Draft starting...");
    const compressedImageData = await getCompressedImageData(fileOrUrl);
    console.log("[GeminiService] Image compressed for describe, calling API...");
    return await api.generateAI('describe', { compressedImageData });
  } catch (e: any) {
    console.error("[GeminiService] Auto Draft error:", e);
    return { success: false, error: e.message };
  }
};
