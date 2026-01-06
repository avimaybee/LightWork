import { getAuthContext } from '../../lib/auth';

async function moveR2KeyToTrash(storage: R2Bucket, key: string, now: number) {
  if (!key) return;
  const obj = await storage.get(key);
  if (!obj) return;

  const date = new Date(now).toISOString().slice(0, 10);
  const trashKey = `trash/${date}/${now}-${key}`;

  await storage.put(trashKey, obj.body, {
    httpMetadata: obj.httpMetadata,
    customMetadata: {
      trashed_from: key,
      trashed_at: String(now)
    }
  });

  await storage.delete(key);
}

// PATCH /api/images/:id - Update image metadata
export async function onRequestPatch(context: any) {
  try {
    const auth = await getAuthContext(context.request);

    if (!auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const imageId = context.params.key;
    if (!imageId) {
      return new Response(JSON.stringify({ error: 'Missing image ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await context.request.json();
    const { fileName, localPrompt } = body;

    // Verify ownership
    const image = await context.env.DB.prepare(`
      SELECT i.id, j.user_id 
      FROM images i
      JOIN jobs j ON i.job_id = j.id
      WHERE i.id = ?
    `).bind(imageId).first();

    if (!image) {
      return new Response(JSON.stringify({ error: 'Image not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (image.user_id !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];

    if (fileName !== undefined) {
      updates.push('filename = ?');
      values.push(fileName);
    }

    if (localPrompt !== undefined) {
      updates.push('prompt = ?');
      values.push(localPrompt);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No updates provided' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    values.push(imageId);
    const sql = `UPDATE images SET ${updates.join(', ')} WHERE id = ?`;

    await context.env.DB.prepare(sql).bind(...values).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('[Images API] Patch error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context: any) {
  try {
    const auth = await getAuthContext(context.request);

    if (!auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // The key param here is actually the image ID
    const imageId = context.params.key;
    if (!imageId) {
      return new Response(JSON.stringify({ error: 'Missing image ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get image with job ownership verification
    const image = await context.env.DB.prepare(`
      SELECT i.id, i.r2_key_original, i.r2_key_result, j.user_id 
      FROM images i
      JOIN jobs j ON i.job_id = j.id
      WHERE i.id = ?
    `).bind(imageId).first();

    if (!image) {
      return new Response(JSON.stringify({ error: 'Image not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (image.user_id !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = Date.now();

    // Move R2 files to trash (for 30-day recovery)
    const keysToTrash: string[] = [];
    if (image.r2_key_original) keysToTrash.push(image.r2_key_original);
    if (image.r2_key_result) keysToTrash.push(image.r2_key_result);

    if (keysToTrash.length > 0) {
      await Promise.allSettled(
        keysToTrash.map((key) => moveR2KeyToTrash(context.env.STORAGE, key, now))
      );
    }

    // Delete from batch_items first (foreign key dependency)
    await context.env.DB.prepare("DELETE FROM batch_items WHERE image_id = ?").bind(imageId).run();

    // Delete the image
    await context.env.DB.prepare("DELETE FROM images WHERE id = ?").bind(imageId).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('[Images API] Delete error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  // Require authentication for the proxy endpoint (fallback when presigned URLs aren't used)
  const auth = await getAuthContext(context.request);
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get the key from params - may be URL encoded
  let key = context.params.key;

  if (!key) return new Response("Missing key", { status: 400 });

  // Decode the key if it's URL encoded
  try {
    key = decodeURIComponent(key);
  } catch (e) {
    // Key wasn't encoded, use as-is
  }

  // Verify ownership by checking if the image belongs to a project owned by this user
  const image = await context.env.DB.prepare(`
    SELECT i.id, j.user_id 
    FROM images i
    JOIN jobs j ON i.job_id = j.id
    WHERE i.r2_key_original = ? OR i.r2_key_result = ?
  `).bind(key, key).first();

  if (image && image.user_id !== auth.userId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log("[Images API] Fetching key:", key);

  try {
    const object = await context.env.STORAGE.get(key);

    if (!object) {
      console.log("[Images API] Key not found in R2:", key);

      // Try to list objects to debug
      const list = await context.env.STORAGE.list({ limit: 10 });
      console.log("[Images API] Available keys sample:", list.objects.map(o => o.key));

      return new Response("Image not found: " + key, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // Cache aggressively: Images are immutable (results are new keys)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*'); // Allow usage in canvas

    return new Response(object.body, { headers });
  } catch (e) {
    console.error("[Images API] Error:", e);
    return new Response("Internal Error: " + e.message, { status: 500 });
  }
}
