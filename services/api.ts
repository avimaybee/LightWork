
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

    // Processing & AI
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
                body: JSON.stringify({ name, prompt })
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
    }
};
