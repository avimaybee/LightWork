
import { Project, ImageJob, Module } from "../types";
import { auth } from "./firebase";

const API_BASE = '/api';

// Get auth token for API requests
async function getAuthHeaders(): Promise<HeadersInit> {
    const user = auth.currentUser;
    if (!user) return {};

    try {
        const token = await user.getIdToken();
        return { 'Authorization': `Bearer ${token}` };
    } catch (e) {
        console.error('Failed to get auth token', e);
        return {};
    }
}

export const api = {
    // Sync user to D1 database after Firebase login
    syncUser: async (): Promise<boolean> => {
        const user = auth.currentUser;
        if (!user) return false;

        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE}/auth/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL
                })
            });
            return res.ok;
        } catch (e) {
            console.error('Failed to sync user', e);
            return false;
        }
    },

    // Projects (Jobs)
    getProjects: async (): Promise<Project[]> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/projects`, {
                headers: authHeaders
            });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch projects", e);
            return [];
        }
    },

    createProject: async (name: string): Promise<Project | null> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error('Failed to create project');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    updateProject: async (id: string, updates: Partial<Project>) => {
        const authHeaders = await getAuthHeaders();
        await fetch(`${API_BASE}/projects/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify(updates)
        });
    },

    deleteProject: async (id: string) => {
        const authHeaders = await getAuthHeaders();
        await fetch(`${API_BASE}/projects/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
    },

    duplicateProject: async (id: string): Promise<Project | null> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/projects/${id}/duplicate`, {
                method: 'POST',
                headers: authHeaders
            });
            if (!res.ok) throw new Error("Failed to duplicate");
            const data = await res.json();
            // Fetch full project data to return correct type
            // Or just return partial? App.tsx expects the object to append to list.
            // Let's re-fetch the single project or just reload all.
            // For now, let's return null and let app reload all.
            return null;
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    // Images
    uploadImage: async (projectId: string, file: File): Promise<ImageJob | null> => {
        try {
            const authHeaders = await getAuthHeaders();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', projectId);

            const res = await fetch(`${API_BASE}/images/upload`, {
                method: 'POST',
                headers: authHeaders,
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    deleteImage: async (imageId: string): Promise<boolean> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/images/${imageId}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            return res.ok;
        } catch (e) {
            console.error('Failed to delete image', e);
            return false;
        }
    },

    // AI-powered semantic search
    searchImages: async (images: Array<{ id: string, filename: string, thumbnailUrl: string }>, query: string): Promise<string[]> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ query, images })
            });
            const data = await res.json();
            return data.matchingIds || [];
        } catch (e) {
            console.error('Search failed', e);
            return images.map(img => img.id); // Return all on error
        }
    },
    processImage: async (jobId: string, model: string, systemPrompt: string, userPrompt: string, compressedImageData?: string): Promise<any> => {
        const authHeaders = await getAuthHeaders();
        const requestId = crypto.randomUUID();
        const res = await fetch(`${API_BASE}/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ requestId, jobId, model, systemPrompt, userPrompt, compressedImageData })
        });
        return await res.json();
    },

    // AI Generation
    generateAI: async (type: 'enhance' | 'rename' | 'describe', payload: { jobId?: string, text?: string, compressedImageData?: string }): Promise<{ success: boolean, result?: string, error?: string, isRetryable?: boolean, retryAfterSeconds?: number }> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/ai/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ type, ...payload })
            });
            const data = await res.json();
            return data;
        } catch (e) {
            console.error("AI Generation failed", e);
            return { success: false, error: 'Network error' };
        }
    },

    // Modules
    getModules: async (): Promise<Module[]> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/modules`, {
                headers: authHeaders
            });
            if (!res.ok) throw new Error("Failed to fetch modules");
            return await res.json();
        } catch (e) {
            console.warn("Using default modules fallback");
            return [];
        }
    },

    createModule: async (name: string, prompt: string): Promise<Module | null> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/modules`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ name, systemPrompt: prompt, userPrompt: '' })
            });
            if (!res.ok) throw new Error("Failed to create module");
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    deleteModule: async (id: string) => {
        const authHeaders = await getAuthHeaders();
        await fetch(`${API_BASE}/modules/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
    },

    // Batch API
    createBatch: async (projectId: string, model: string): Promise<{ success: boolean; batchId?: string; itemCount?: number; error?: string }> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/batch/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ projectId, model })
            });
            const data = await res.json();
            if (!res.ok) return { success: false, error: data.error };
            return { success: true, batchId: data.batchId, itemCount: data.itemCount };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    submitBatch: async (batchId: string): Promise<{ success: boolean; geminiBatchName?: string; error?: string }> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/batch/${batchId}/submit`, {
                method: 'POST',
                headers: authHeaders
            });
            const data = await res.json();
            if (!res.ok) return { success: false, error: data.error };
            return { success: true, geminiBatchName: data.geminiBatchName };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    },

    getBatchStatus: async (batchId: string): Promise<any> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/batch/${batchId}`, {
                headers: authHeaders
            });
            return await res.json();
        } catch (e) {
            console.error('Failed to get batch status', e);
            return null;
        }
    },

    getActiveBatches: async (): Promise<any[]> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/batch/active`, {
                headers: authHeaders
            });
            const data = await res.json();
            return data.batches || [];
        } catch (e) {
            console.error('Failed to get active batches', e);
            return [];
        }
    },

    // Parallel Processing - Process multiple images in parallel with throttling
    processImagesParallel: async (
        jobIds: string[],
        model: string,
        systemPrompt: string
    ): Promise<{
        success: boolean;
        processed?: Array<{ jobId: string; success: boolean; error?: string }>;
        summary?: { total: number; success: number; failed: number };
        usage?: { currentRpm: number; rpmUtilization: number; status: string };
        error?: string;
        retryAfterMs?: number;
    }> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/process-parallel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ jobIds, model, systemPrompt })
            });

            const data = await res.json();

            if (res.status === 429) {
                // Rate limited - return with retry info
                const retryAfter = res.headers.get('Retry-After');
                return {
                    success: false,
                    error: data.error || 'Rate limited',
                    retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : data.retryAfterMs
                };
            }

            return data;
        } catch (e: any) {
            console.error('Parallel processing failed', e);
            return { success: false, error: e.message || 'Network error' };
        }
    },

    // API Status - Get current usage stats and health
    getApiStatus: async (): Promise<{
        status: 'healthy' | 'warning' | 'critical' | 'error';
        circuit: 'closed' | 'open' | 'half-open';
        usage: {
            currentRpm: number;
            currentTpm: number;
            rpmUtilization: number;
            tpmUtilization: number;
        };
        performance: {
            successRate: number;
            avgLatencyMs: number;
        };
        warnings: string[];
        recommendations: string[];
    } | null> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/status`, {
                headers: authHeaders
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error('Failed to get API status', e);
            return null;
        }
    }
    ,

    // Favorites
    getFavorites: async (): Promise<string[]> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/favorites`, {
                headers: authHeaders
            });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch favorites", e);
            return [];
        }
    },

    addFavorite: async (moduleId: string): Promise<boolean> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/favorites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({ moduleId })
            });
            return res.ok;
        } catch (e) {
            console.error("Failed to add favorite", e);
            return false;
        }
    },

    removeFavorite: async (moduleId: string): Promise<boolean> => {
        try {
            const authHeaders = await getAuthHeaders();
            const res = await fetch(`${API_BASE}/favorites?moduleId=${moduleId}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            return res.ok;
        } catch (e) {
            console.error("Failed to remove favorite", e);
            return false;
        }
    }
};

