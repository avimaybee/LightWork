// Cloudflare Workers Environment Type Definitions

export interface Env {
    // D1 Database binding
    DB: D1Database;

    // R2 Storage binding
    STORAGE: R2Bucket;

    // Environment variables
    GEMINI_API_KEY: string;
    ENVIRONMENT: 'development' | 'production';
}

// Module type
export interface Module {
    id: string;
    name: string;
    description: string | null;
    system_prompt: string;
    icon: string | null;
    category: string;
    is_active: number;
    created_at: number;
}

// Gemini model selection
export type GeminiModel = 'nano_banana' | 'nano_banana_pro';

// Job status enum
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Job type
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

// Image status enum
export type ImageStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRY_LATER';

// Image type
export interface ImageRecord {
    id: string;
    job_id: string;
    original_key: string;
    original_filename: string | null;
    processed_key: string | null;
    thumbnail_key: string | null;
    status: ImageStatus;
    specific_prompt: string | null;
    error_message: string | null;
    retry_count: number;
    file_size: number | null;
    mime_type: string | null;
    created_at: number;
    processed_at: number | null;
}

// API Response types
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Job with module info
export interface JobWithModule extends Job {
    module_name: string;
    module_icon: string | null;
}

// Job with images
export interface JobWithImages extends Job {
    images: ImageRecord[];
}

// Upload request
export interface UploadRequest {
    job_id: string;
    files: File[];
}

// Create job request
export interface CreateJobRequest {
    module_id: string;
    global_prompt?: string;
    model?: GeminiModel;
}
