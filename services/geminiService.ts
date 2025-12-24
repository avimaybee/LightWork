
import { AppModel } from "../types";
import { api } from "./api";
import { compressImageForAI } from "../utils";

interface GeminiResponse {
  success: boolean;
  imageBytes?: string;
  error?: string;
  details?: string;
  isRetryable?: boolean;
  retryAfterSeconds?: number;
}

// Helper to get compressed image data from file OR url
async function getCompressedImageData(fileOrUrl: File | Blob | string | undefined, maxSize: number = 1536): Promise<string | undefined> {
  if (!fileOrUrl) return undefined;

  let blob: Blob;

  if (typeof fileOrUrl === 'string') {
    // It's a URL - fetch the image
    console.log("[GeminiService] Fetching image from URL for compression...");
    const response = await fetch(fileOrUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    blob = await response.blob();
  } else {
    blob = fileOrUrl;
  }

  return await compressImageForAI(blob, maxSize);
}

export const processImageWithGemini = async (
  fileOrUrl: File | string | undefined,
  systemContext: string,
  userPrompt: string,
  modelName: AppModel,
  jobId?: string
): Promise<GeminiResponse> => {
  try {
    if (!jobId) throw new Error("Job ID required for backend processing");

    // Compress image client-side to reduce token consumption
    // This is CRITICAL to avoid hitting TPM limits
    let compressedImageData: string | undefined;

    try {
      console.log("[GeminiService] Compressing image for AI processing...");
      compressedImageData = await getCompressedImageData(fileOrUrl, 1536);
      if (compressedImageData) {
        console.log("[GeminiService] Image compressed successfully, length:", compressedImageData.length);
      } else {
        console.warn("[GeminiService] No file/URL provided, will use R2 fallback (may hit TPM limits!)");
      }
    } catch (e) {
      console.warn("[GeminiService] Compression failed, will use R2 fallback", e);
    }

    const result = await api.processImage(jobId, modelName, systemContext, userPrompt, compressedImageData);

    if (result.success && result.imageBytes) {
      return { success: true, imageBytes: result.imageBytes };
    }

    if (result.details) {
      console.error("[GeminiService] Backend Error Details:", result.details);
    }

    return {
      success: false,
      error: result.error || "Backend processing failed",
      details: result.details,
      isRetryable: result.isRetryable,
      retryAfterSeconds: result.retryAfterSeconds
    };

  } catch (error: any) {
    console.error("[GeminiService] Error:", error);
    return {
      success: false,
      error: error.message || "Network error",
      isRetryable: false // Don't auto-retry network errors
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

// Smart Rename - accepts file/blob or URL string
export const generateSmartFilename = async (fileOrUrl: File | Blob | string): Promise<AIResponse> => {
  try {
    console.log("[GeminiService] Smart Rename starting...");
    const compressedImageData = await getCompressedImageData(fileOrUrl, 1024);
    if (!compressedImageData) {
      return { success: false, error: "No image data to process" };
    }
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
    const compressedImageData = await getCompressedImageData(fileOrUrl, 1024);
    if (!compressedImageData) {
      return { success: false, error: "No image data to process" };
    }
    console.log("[GeminiService] Image compressed for describe, calling API...");
    return await api.generateAI('describe', { compressedImageData });
  } catch (e: any) {
    console.error("[GeminiService] Auto Draft error:", e);
    return { success: false, error: e.message };
  }
};
