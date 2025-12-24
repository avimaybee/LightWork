
export async function onRequestPost(context) {
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

    // 1. Upload to R2
    console.log("[Upload API] Uploading to R2...");
    await context.env.STORAGE.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });
    console.log("[Upload API] R2 upload complete");

    // 2. Insert into D1
    console.log("[Upload API] Inserting into D1...");
    await context.env.DB.prepare(
      "INSERT INTO images (id, job_id, status, filename, r2_key_original, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, projectId, 'queued', file.name, r2Key, Date.now()).run();
    console.log("[Upload API] D1 insert complete");

    // 3. Return ImageJob structure expected by frontend
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
  } catch (e) {
    console.error("[Upload API] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
