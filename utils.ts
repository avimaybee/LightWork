
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

/**
 * Compress image for AI processing to reduce token consumption.
 * Gemini breaks images into 768x768 tiles, each ~258 tokens.
 * A 12MP image can consume thousands of tokens instantly.
 * This resizes to max 1536px which fits in ~4 tiles (~1000 tokens).
 */
export const compressImageForAI = async (file: File | Blob, maxSize: number = 1536): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        const loadImage = () => {
            // Calculate new dimensions maintaining aspect ratio
            let { width, height } = img;

            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = Math.round(height * (maxSize / width));
                    width = maxSize;
                } else {
                    width = Math.round(width * (maxSize / height));
                    height = maxSize;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Return base64 without data URL prefix for direct API use
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            const base64 = dataUrl.split(',')[1];

            console.log(`[CompressForAI] ${img.width}x${img.height} -> ${width}x${height}`);
            resolve(base64);
        };

        img.onload = loadImage;
        img.onerror = () => reject(new Error('Failed to load image'));

        // Create object URL for the file
        if (file instanceof File || file instanceof Blob) {
            img.src = URL.createObjectURL(file);
        }
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
