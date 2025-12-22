/**
 * LightWork API Client
 * Frontend API integration layer
 * 
 * ⚠️ SYNC REQUIRED: Core types must match the backend definitions in:
 *    - functions/types.ts
 * 
 * Shared types: Module, Job, ImageRecord, JobStatus, ImageStatus, GeminiModel
 * When modifying these, ensure both files are updated together.
 */

const API_BASE = '/api';

// Types matching backend (see functions/types.ts)
export interface Module {
    id: string;
    name: string;
    description: string | null;
    system_prompt?: string;
    icon: string | null;
    category: string;
    created_at: number;
}

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ImageStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRY_LATER';
export type GeminiModel = 'nano_banana' | 'nano_banana_pro';

export interface Job {
    id: string;
    module_id: string;
    global_prompt: string | null;
    model: GeminiModel;
    status: JobStatus;
    total_images: number;
    completed_images: number;
    failed_images: number;
    created_at: number;
    updated_at: number;
    started_at: number | null;
    completed_at: number | null;
}

export interface JobWithModule extends Job {
    module_name: string;
    module_icon: string | null;
}

export interface ImageRecord {
    id: string;
    job_id: string;
    original_key: string;
    original_filename: string | null;
    processed_key: string | null;
    status: ImageStatus;
    specific_prompt: string | null;
    error_message: string | null;
    retry_count: number;
    rating?: number | null;
    created_at: number;
    processed_at: number | null;
    original_url?: string;
    processed_url?: string;
}

export interface Feedback {
    id: string;
    image_id: string;
    rating: 1 | -1;
    comment: string | null;
    created_at: number;
}

export interface JobWithImages extends Job {
    images: ImageRecord[];
}

interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

class ApiError extends Error {
    statusCode?: number;

    constructor(message: string, statusCode?: number) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    const data = await response.json() as ApiResponse<T>;

    if (!response.ok || !data.success) {
        throw new ApiError(data.error || 'Request failed', response.status);
    }

    return data.data as T;
}

// Health check
export async function checkHealth(): Promise<{ status: string; services: { database: string; storage: string } }> {
    return request('/health');
}

// Modules
export async function getModules(): Promise<Module[]> {
    return request('/modules');
}

export async function getModule(id: string): Promise<Module> {
    return request(`/modules/${id}`);
}

export async function updateModulePrompt(id: string, systemPrompt: string): Promise<Module> {
    return request(`/modules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ system_prompt: systemPrompt }),
    });
}

// Jobs
export async function getJobs(limit?: number, offset?: number, search?: string): Promise<JobWithModule[]> {
    let url = '/jobs';
    const params = new URLSearchParams();
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());
    if (search) params.append('q', search);

    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;

    return request(url);
}

export async function getJob(id: string): Promise<JobWithImages> {
    return request(`/jobs/${id}`);
}

export async function createJob(moduleId: string, globalPrompt?: string, model: GeminiModel = 'nano_banana'): Promise<Job> {
    return request('/jobs', {
        method: 'POST',
        body: JSON.stringify({ module_id: moduleId, global_prompt: globalPrompt, model }),
    });
}

export async function startJob(id: string): Promise<Job> {
    return request(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'start' }),
    });
}

export async function retryJob(id: string): Promise<Job> {
    return request(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'retry' }),
    });
}

export async function cleanupJobs(): Promise<void> {
    return request('/jobs/cleanup', {
        method: 'DELETE',
    });
}

// Processing
export interface ProcessResult {
    processed: number;
    completed: number;
    failed: number;
    errors: string[];
}

export async function triggerProcessing(): Promise<ProcessResult> {
    return request('/process', {
        method: 'POST',
    });
}

export async function cancelJob(id: string): Promise<Job> {
    return request(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'cancel' }),
    });
}

export async function updateJobPrompt(id: string, globalPrompt: string): Promise<Job> {
    return request(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ global_prompt: globalPrompt }),
    });
}

export async function updateJobModel(id: string, model: GeminiModel): Promise<Job> {
    return request(`/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ model }),
    });
}

export async function deleteJob(id: string): Promise<void> {
    return request(`/jobs/${id}`, {
        method: 'DELETE',
    });
}

// Images
export async function uploadImages(
    jobId: string,
    items: { file: File; thumbnail: Blob }[]
): Promise<{ uploaded: number; images: ImageRecord[] }> {
    const formData = new FormData();
    formData.append('job_id', jobId);

    items.forEach((item, index) => {
        formData.append(`file${index}`, item.file);
        formData.append(`thumb${index}`, item.thumbnail, `thumb_${item.file.name}`);
    });

    const response = await fetch(`${API_BASE}/images/upload`, {
        method: 'POST',
        body: formData,
    });

    const data = await response.json() as ApiResponse<{ uploaded: number; images: ImageRecord[] }>;

    if (!response.ok || !data.success) {
        throw new ApiError(data.error || 'Upload failed', response.status);
    }

    return data.data!;
}

export async function updateImagePrompt(id: string, specificPrompt: string): Promise<ImageRecord> {
    return request(`/images/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ specific_prompt: specificPrompt }),
    });
}

export async function deleteImage(id: string): Promise<void> {
    return request(`/images/${id}`, {
        method: 'DELETE',
    });
}

export async function submitFeedback(imageId: string, rating: 1 | -1, comment?: string): Promise<void> {
    return request(`/images/${imageId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
    });
}

export async function getFeedback(imageId: string): Promise<any> {
    return request(`/images/${imageId}/feedback`);
}

export function getImageUrl(imageId: string, type: 'original' | 'processed' | 'thumbnail'): string {
    return `${API_BASE}/images/${imageId}/${type}`;
}

export function getDownloadUrl(jobId: string): string {
    return `${API_BASE}/jobs/${jobId}/download`;
}
