
// Thumbnail Generator (Optimized via createImageBitmap)
export const generateThumbnail = async (file: File, width: number = 200): Promise<string> => {
    // Fast path: use createImageBitmap which is non-blocking on modern browsers
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file);
            const scale = width / bitmap.width;
            const height = bitmap.height * scale;
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(bitmap, 0, 0, width, height);
                return canvas.toDataURL('image/jpeg', 0.7);
            }
        } catch (e) {
            console.warn("createImageBitmap failed, falling back to FileReader", e);
        }
    }

    // Fallback path
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = width / img.width;
                canvas.width = width;
                canvas.height = img.height * scale;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); 
                } else {
                    resolve(e.target?.result as string); 
                }
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

// Exponential Backoff Helper
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const calculateBackoff = (retryCount: number): number => {
    // 2s, 4s, 8s, 16s... up to 30s max + jitter
    const base = Math.min(30000, 2000 * Math.pow(2, retryCount));
    const jitter = Math.random() * 1000;
    return base + jitter;
};

// Error Mapper
export const mapGeminiError = (error: any): string => {
    const msg = error?.message || '';
    if (msg.includes('429')) return 'Rate limit exceeded. Retrying...';
    if (msg.includes('503')) return 'Service overloaded. Retrying...';
    if (msg.includes('SAFETY')) return 'Blocked by safety filters.';
    if (msg.includes('API_KEY')) return 'Invalid API Key.';
    return 'Processing failed.';
};
