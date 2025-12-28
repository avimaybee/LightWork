
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
// Uses model-aware compression: 1024px for Fast, no compression for Pro
async function getCompressedImageData(
  fileOrUrl: File | Blob | string | undefined,
  modelName: AppModel
): Promise<string | undefined> {
  if (!fileOrUrl) return undefined;

  // PRO model: no compression for best quality
  if (modelName === AppModel.PRO) {
    console.log("[GeminiService] Pro model - skipping compression for full quality");

    let blob: Blob;
    if (typeof fileOrUrl === 'string') {
      const response = await fetch(fileOrUrl);
      if (!response.ok) throw new Error("Failed to fetch image");
      blob = await response.blob();
    } else {
      blob = fileOrUrl;
    }

    // Convert blob to base64 without compression
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
  }

  // FAST model: compress to 1024px for token savings
  let blob: Blob;
  if (typeof fileOrUrl === 'string') {
    console.log("[GeminiService] Fetching image from URL for compression...");
    const response = await fetch(fileOrUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    blob = await response.blob();
  } else {
    blob = fileOrUrl;
  }

  return await compressImageForAI(blob, 1024); // 1024px for Fast model
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

    // Compress image client-side based on model
    // Fast: 1024px compression, Pro: no compression
    let compressedImageData: string | undefined;

    try {
      console.log(`[GeminiService] Preparing image for ${modelName}...`);
      compressedImageData = await getCompressedImageData(fileOrUrl, modelName);
      if (compressedImageData) {
        console.log("[GeminiService] Image prepared, length:", compressedImageData.length);
      } else {
        console.warn("[GeminiService] No file/URL provided, will use R2 fallback");
      }
    } catch (e) {
      console.warn("[GeminiService] Image prep failed, will use R2 fallback", e);
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

// Smart Rename - accepts file/blob or URL string (always uses 1024px compression)
export const generateSmartFilename = async (fileOrUrl: File | Blob | string): Promise<AIResponse> => {
  try {
    console.log("[GeminiService] Smart Rename starting...");
    const compressedImageData = await compressForUtility(fileOrUrl);
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

// Helper for utility functions - always compresses to 1024px
async function compressForUtility(fileOrUrl: File | Blob | string): Promise<string | undefined> {
  let blob: Blob;
  if (typeof fileOrUrl === 'string') {
    const response = await fetch(fileOrUrl);
    if (!response.ok) throw new Error("Failed to fetch image");
    blob = await response.blob();
  } else {
    blob = fileOrUrl;
  }
  return await compressImageForAI(blob, 1024);
}


// Enhance Prompt - text only, no image needed
export const enhancePrompt = async (originalPrompt: string): Promise<AIResponse> => {
  return await api.generateAI('enhance', { text: originalPrompt });
};

// Auto Draft / Describe - accepts file/blob or URL string (always uses 1024px compression)
export const generateImageDescription = async (fileOrUrl: File | Blob | string): Promise<AIResponse> => {
  try {
    console.log("[GeminiService] Auto Draft starting...");
    const compressedImageData = await compressForUtility(fileOrUrl);
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
