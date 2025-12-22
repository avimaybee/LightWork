/// <reference lib="webworker" />

export interface ImageProcessResult {
  id: string;
  blob: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  originalName: string;
}

export interface ImageProcessRequest {
  id: string; // Correlation ID
  file: File;
  maxDimension?: number; // default 1920
  thumbnailSize?: number; // default 300
  quality?: number; // default 0.8
}

const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent<ImageProcessRequest>) => {
  const { id, file, maxDimension = 1920, thumbnailSize = 200, quality = 0.7 } = e.data;

  try {
    const bitmap = await createImageBitmap(file);
    
    // Calculate dimensions for main image
    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Process main image
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    
    context.drawImage(bitmap, 0, 0, width, height);
    const processedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

    // Calculate dimensions for thumbnail
    let thumbWidth = bitmap.width;
    let thumbHeight = bitmap.height;
    if (thumbWidth > thumbnailSize || thumbHeight > thumbnailSize) {
      const ratio = Math.min(thumbnailSize / thumbWidth, thumbnailSize / thumbHeight);
      thumbWidth = Math.round(thumbWidth * ratio);
      thumbHeight = Math.round(thumbHeight * ratio);
    }

    // Process thumbnail
    const thumbCanvas = new OffscreenCanvas(thumbWidth, thumbHeight);
    const thumbContext = thumbCanvas.getContext('2d');
    if (!thumbContext) throw new Error('Could not get thumbnail context');

    thumbContext.drawImage(bitmap, 0, 0, thumbWidth, thumbHeight);
    const thumbnailBlob = await thumbCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });

    // Cleanup
    bitmap.close();

    // Respond
    const response: ImageProcessResult = {
      id,
      blob: processedBlob,
      thumbnail: thumbnailBlob,
      width,
      height,
      originalName: file.name
    };

    ctx.postMessage({ success: true, data: response });

  } catch (error) {
    ctx.postMessage({ 
      success: false, 
      id, 
      error: error instanceof Error ? error.message : 'Unknown processing error' 
    });
  }
};
