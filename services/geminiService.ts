
import { AppModel } from "../types";
import { api } from "./api";

interface GeminiResponse {
  success: boolean;
  imageBytes?: string;
  error?: string;
  isRetryable?: boolean;
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

    const result = await api.processImage(jobId, modelName, systemContext, userPrompt);
    
    if (result.success && result.imageBytes) {
        return { success: true, imageBytes: result.imageBytes };
    }

    return { 
        success: false, 
        error: result.error || "Backend processing failed", 
        isRetryable: result.isRetryable 
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

// Utilities updated to use Backend
export const generateSmartFilename = async (jobId: string): Promise<string | null> => {
    return await api.generateAI('rename', { jobId });
};

export const enhancePrompt = async (originalPrompt: string): Promise<string | null> => {
    return await api.generateAI('enhance', { text: originalPrompt });
};

export const generateImageDescription = async (jobId: string): Promise<string | null> => {
    return await api.generateAI('describe', { jobId });
};
