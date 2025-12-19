/**
 * API client for BananaBatch backend.
 * Handles all HTTP requests to the FastAPI backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// Types matching backend models
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COOLDOWN' | 'COMPLETED' | 'FAILED' | 'REFUSED';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type OutputFormat = 'webp' | 'png' | 'jpeg';

export interface ModuleParameters {
  aspect_ratio: AspectRatio;
  output_format: OutputFormat;
}

export interface WorkflowModule {
  id: string;
  name: string;
  icon: string;
  description?: string;
  category?: string;
  system_instruction: string;
  parameters: ModuleParameters;
  user_prompt_placeholder?: string;
}

export interface ImageResponse {
  id: string;
  job_id: string;
  status: JobStatus;
  original_url?: string;
  result_url?: string;
  individual_prompt?: string;
  retry_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface JobResponse {
  id: string;
  module_id: string;
  global_prompt?: string;
  aspect_ratio_override?: AspectRatio;
  status: JobStatus;
  total_images: number;
  completed_images: number;
  failed_images: number;
  created_at: string;
  updated_at: string;
}

export interface JobWithImages extends JobResponse {
  images: ImageResponse[];
}

export interface CreateJobRequest {
  module_id: string;
  global_prompt?: string;
  aspect_ratio_override?: AspectRatio;
}

export interface RateLimitStatus {
  rpm_limit: number;
  min_interval_seconds: number;
  time_since_last_request: number | null;
  can_request_now: boolean;
  cooldown_seconds: number;
}

export interface HealthResponse {
  status: string;
  worker_running: boolean;
  rate_limit: RateLimitStatus;
}

// API functions
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Health
  async health(): Promise<HealthResponse> {
    const response = await fetch(`${API_BASE}/health`);
    return handleResponse<HealthResponse>(response);
  },

  // Modules
  async getModules(): Promise<WorkflowModule[]> {
    const response = await fetch(`${API_BASE}/modules/`);
    return handleResponse<WorkflowModule[]>(response);
  },

  async getModule(moduleId: string): Promise<WorkflowModule> {
    const response = await fetch(`${API_BASE}/modules/${moduleId}`);
    return handleResponse<WorkflowModule>(response);
  },

  // Jobs
  async createJob(data: CreateJobRequest): Promise<JobResponse> {
    const response = await fetch(`${API_BASE}/jobs/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<JobResponse>(response);
  },

  async getJob(jobId: string): Promise<JobWithImages> {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`);
    return handleResponse<JobWithImages>(response);
  },

  async deleteJob(jobId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete job');
  },

  // Images
  async uploadImage(
    jobId: string,
    file: File,
    individualPrompt?: string
  ): Promise<ImageResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (individualPrompt) {
      formData.append('individual_prompt', individualPrompt);
    }

    const response = await fetch(`${API_BASE}/jobs/${jobId}/images/`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<ImageResponse>(response);
  },

  async getImages(jobId: string): Promise<ImageResponse[]> {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/images/`);
    return handleResponse<ImageResponse[]>(response);
  },

  getOriginalImageUrl(jobId: string, imageId: string): string {
    return `${API_BASE}/jobs/${jobId}/images/${imageId}/original`;
  },

  getResultImageUrl(jobId: string, imageId: string): string {
    return `${API_BASE}/jobs/${jobId}/images/${imageId}/result`;
  },

  getDownloadUrl(jobId: string): string {
    return `${API_BASE}/jobs/${jobId}/download`;
  },
};

export default api;
