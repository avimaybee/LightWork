
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
    // 12MP images can consume thousands of tokens, causing rate limits
    // Resizing to 1536px max reduces to ~1000 tokens while maintaining quality
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

// Smart Rename - requires file for client-side compression
export const generateSmartFilename = async (file: File | Blob): Promise<AIResponse> => {
  try {
    const compressedImageData = await compressImageForAI(file, 1024); // Smaller for analysis
    return await api.generateAI('rename', { compressedImageData });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};

// Enhance Prompt - text only, no image needed
export const enhancePrompt = async (originalPrompt: string): Promise<AIResponse> => {
  return await api.generateAI('enhance', { text: originalPrompt });
};

// Auto Draft / Describe - requires file for client-side compression
export const generateImageDescription = async (file: File | Blob): Promise<AIResponse> => {
  try {
    const compressedImageData = await compressImageForAI(file, 1024); // Smaller for analysis
    return await api.generateAI('describe', { compressedImageData });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
};
