
import { GoogleGenAI } from "@google/genai";

// Helper to convert ArrayBuffer to base64 safely
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

export async function onRequestPost(context: any) {
  console.log("[Upload API] Request received");

  try {
    const formData = await context.request.formData();
    const file = formData.get('file');
    const projectId = formData.get('projectId');

    console.log("[Upload API] File:", file?.name, "Size:", file?.size, "Project:", projectId);

    if (!file || !projectId) {
      console.log("[Upload API] Missing file or projectId");
      return new Response("Missing file or project ID", { status: 400 });
    }

    const id = crypto.randomUUID();
    const r2Key = `original-${id}-${file.name}`;

    console.log("[Upload API] Generated ID:", id, "R2 Key:", r2Key);

    // Read file into ArrayBuffer for both R2 upload and OCR
    const arrayBuffer = await file.arrayBuffer();

    // 1. Upload to R2
    console.log("[Upload API] Uploading to R2...");
    await context.env.STORAGE.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: file.type }
    });
    console.log("[Upload API] R2 upload complete");

    // 2. Insert into D1 (without description initially)
    console.log("[Upload API] Inserting into D1...");
    await context.env.DB.prepare(
      "INSERT INTO images (id, job_id, status, filename, r2_key_original, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, projectId, 'queued', file.name, r2Key, Date.now()).run();
    console.log("[Upload API] D1 insert complete");

    // 3. Background OCR using Gemini 2.5 Flash Lite (fire-and-forget)
    // Use waitUntil to not block the response
    context.waitUntil((async () => {
      try {
        const apiKey = context.env.FREE_GEMINI_API_KEY || context.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.log("[Upload API] No API key for OCR, skipping");
          return;
        }

        const genAI = new GoogleGenAI({ apiKey });

        // Compress image for OCR (use smaller size for faster processing)
        const b64Data = arrayBufferToBase64(arrayBuffer);

        // Skip very large images for OCR
        if (b64Data.length > 5 * 1024 * 1024) {
          console.log("[Upload API] Image too large for background OCR, skipping");
          return;
        }

        console.log("[Upload API] Running background OCR...");

        const response = await genAI.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: [{
            role: 'user',
            parts: [
              { text: "Describe this image in 2-3 sentences. Include any visible text (OCR), objects, colors, and the overall scene. Be concise and factual." },
              {
                inlineData: {
                  mimeType: file.type || 'image/jpeg',
                  data: b64Data
                }
              }
            ]
          }]
        });

        const description = response.text?.trim() || '';

        if (description) {
          await context.env.DB.prepare(
            "UPDATE images SET description = ? WHERE id = ?"
          ).bind(description, id).run();
          console.log("[Upload API] OCR description saved:", description.substring(0, 50) + "...");
        }
      } catch (ocrError: any) {
        console.error("[Upload API] Background OCR failed:", ocrError.message);
        // Don't fail the upload if OCR fails
      }
    })());

    // 4. Return ImageJob structure expected by frontend
    const job = {
      id: id,
      fileName: file.name,
      originalUrl: `/api/images/${encodeURIComponent(r2Key)}`,
      thumbnailUrl: `/api/images/${encodeURIComponent(r2Key)}?thumb=true`,
      status: 'queued',
      localPrompt: '',
      retryCount: 0,
      timestamp: Date.now()
    };

    console.log("[Upload API] Success, returning job:", job.id);
    return new Response(JSON.stringify(job));
  } catch (e: any) {
    console.error("[Upload API] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
