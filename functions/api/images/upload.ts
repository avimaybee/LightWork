
export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const file = formData.get('file');
    const projectId = formData.get('projectId');

    if (!file || !projectId) {
      return new Response("Missing file or project ID", { status: 400 });
    }

    const id = crypto.randomUUID();
    const r2Key = `original-${id}-${file.name}`;
    
    // 1. Upload to R2
    await context.env.STORAGE.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    // 2. Insert into D1
    // Note: status starts as 'queued' or 'idle' usually, but here we set to 'queued' to match frontend flow
    // or 'uploading' done. Frontend handles upload status.
    // We assume successful upload means it's ready for queue.
    await context.env.DB.prepare(
      "INSERT INTO images (id, job_id, status, filename, r2_key_original, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, projectId, 'queued', file.name, r2Key, Date.now()).run();

    // 3. Return ImageJob structure expected by frontend
    const job = {
        id: id,
        fileName: file.name,
        originalUrl: `/api/images/${r2Key}`,
        thumbnailUrl: `/api/images/${r2Key}?thumb=true`,
        status: 'queued',
        localPrompt: '',
        retryCount: 0,
        timestamp: Date.now()
    };

    return new Response(JSON.stringify(job));
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
