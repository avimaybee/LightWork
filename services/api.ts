
import { Project, ImageJob, Module } from "../types";

const API_BASE = '/api';

export const api = {
    // Projects (Jobs)
    getProjects: async (): Promise<Project[]> => {
        try {
            const res = await fetch(`${API_BASE}/projects`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch projects", e);
            return [];
        }
    },

    createProject: async (name: string): Promise<Project | null> => {
        try {
            const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        await fetch(`${API_BASE}/projects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
    },

    deleteProject: async (id: string) => {
        await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
    },

    // Images
    uploadImage: async (projectId: string, file: File): Promise<ImageJob | null> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', projectId);
            
            const res = await fetch(`${API_BASE}/images/upload`, {
                method: 'POST',
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
    processImage: async (jobId: string, model: string, systemPrompt: string, userPrompt: string): Promise<any> => {
        const res = await fetch(`${API_BASE}/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, model, systemPrompt, userPrompt })
        });
        return await res.json();
    },

    generateAI: async (type: 'enhance' | 'rename' | 'describe', payload: { jobId?: string, text?: string }): Promise<string | null> => {
        try {
            const res = await fetch(`${API_BASE}/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, ...payload })
            });
            const data = await res.json();
            return data.success ? data.result : null;
        } catch (e) {
            console.error("AI Generation failed", e);
            return null;
        }
    },

    // Modules
    getModules: async (): Promise<Module[]> => {
        try {
            const res = await fetch(`${API_BASE}/modules`);
            if (!res.ok) throw new Error("Failed to fetch modules");
            return await res.json();
        } catch (e) {
            console.warn("Using default modules fallback");
            return []; 
        }
    },

    createModule: async (name: string, prompt: string): Promise<Module | null> => {
        try {
            const res = await fetch(`${API_BASE}/modules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        await fetch(`${API_BASE}/modules/${id}`, { method: 'DELETE' });
    }
};
