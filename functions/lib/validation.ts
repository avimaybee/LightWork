/**
 * Input Validation Schemas using Zod
 * Provides type-safe validation for all API inputs to prevent XSS/injection attacks
 */

import { z } from 'zod';

// ============================================================================
// Common Validators
// ============================================================================

// Safe string that strips HTML/script tags and dangerous patterns
const safeString = (maxLength: number = 1000) =>
    z.string()
        .max(maxLength, `String exceeds maximum length of ${maxLength}`)
        .transform(s => s.trim())
        .refine(
            s => !/<script[^>]*>|<\/script>|javascript:|on\w+=/i.test(s),
            'Input contains potentially dangerous content'
        );

// UUID v4 format
const uuid = z.string().uuid('Invalid UUID format');

// Optional safe string
const optionalSafeString = (maxLength: number = 1000) =>
    safeString(maxLength).optional().or(z.literal(''));

// ============================================================================
// Process API Schemas
// ============================================================================

export const processRequestSchema = z.object({
    requestId: z.string().max(100).optional(),
    jobId: uuid,
    model: z.string().max(100), // Allow any model string (e.g. gemini-2.5-flash-image)
    systemPrompt: safeString(10000),
    userPrompt: safeString(10000),
    compressedImageData: z.string().optional(),
});

export type ProcessRequest = z.infer<typeof processRequestSchema>;

// ============================================================================
// Projects API Schemas
// ============================================================================

export const createProjectSchema = z.object({
    name: safeString(100).refine(
        s => s.length >= 1,
        'Project name is required'
    ),
});

export type CreateProjectRequest = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
    name: optionalSafeString(100),
    modulePrompt: optionalSafeString(10000),
    selectedMode: z.enum(['fast', 'pro']).optional(),
    selectedModulePreset: safeString(100).optional(),
});

export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;

// ============================================================================
// Modules API Schemas
// ============================================================================

export const createModuleSchema = z.object({
    name: safeString(100).refine(s => s.length >= 1, 'Module name is required'),
    description: safeString(500).optional().default(''),
    systemPrompt: safeString(10000),
    userPrompt: safeString(10000),
    icon: z.string().max(50).optional().default('Sparkles'),
    color: z.string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
        .optional()
        .default('#6366f1'),
});

export type CreateModuleRequest = z.infer<typeof createModuleSchema>;

export const updateModuleSchema = createModuleSchema.partial();

export type UpdateModuleRequest = z.infer<typeof updateModuleSchema>;

// ============================================================================
// Images API Schemas
// ============================================================================

export const uploadImageSchema = z.object({
    projectId: uuid,
    filename: safeString(255).refine(
        s => /^[\w\-. ]+\.(jpg|jpeg|png|gif|webp|bmp|heic|avif)$/i.test(s),
        'Invalid filename format or unsupported image type'
    ),
});

export type UploadImageRequest = z.infer<typeof uploadImageSchema>;

// ============================================================================
// Batch API Schemas
// ============================================================================

export const createBatchSchema = z.object({
    projectId: uuid,
    model: z.string().max(100).optional(), // Make optional and allow string
});

export type CreateBatchRequest = z.infer<typeof createBatchSchema>;

// ============================================================================
// AI Generate API Schemas
// ============================================================================

export const generatePromptSchema = z.object({
    userInput: safeString(5000).refine(
        s => s.length >= 3,
        'Input must be at least 3 characters'
    ),
    mode: z.enum(['system', 'user']).optional().default('user'),
});

export type GeneratePromptRequest = z.infer<typeof generatePromptSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

export function validateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        return { success: false, error: `Validation failed: ${errors}` };
    }
    return { success: true, data: result.data };
}

// Sanitize output to prevent XSS when returning user-generated content
export function sanitizeOutput(input: string): string {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Strip dangerous characters for SQL LIKE patterns
export function sanitizeSearchPattern(pattern: string): string {
    return pattern
        .replace(/[%_]/g, '') // Remove SQL wildcards
        .replace(/[<>'";&]/g, '') // Remove dangerous chars
        .trim()
        .slice(0, 100); // Limit length
}
