
import { getAuthContext } from '../../lib/auth';

export async function onRequestPatch(context: any) {
  try {
    const auth = await getAuthContext(context.request);

    if (!auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = context.params.id;
    const updates = await context.request.json();

    // Verify ownership
    const job = await context.env.DB.prepare("SELECT user_id FROM jobs WHERE id = ?").bind(id).first();
    if (!job || job.user_id !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fields: string[] = [];
    const values: any[] = [];

    // Map frontend keys to DB columns
    if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
    if (updates.modulePrompt !== undefined) { fields.push("module_prompt = ?"); values.push(updates.modulePrompt); }
    if (updates.selectedMode !== undefined) { fields.push("selected_mode = ?"); values.push(updates.selectedMode); }
    if (updates.selectedModulePreset !== undefined) { fields.push("selected_module_preset = ?"); values.push(updates.selectedModulePreset); }

    if (fields.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    values.push(id); // For WHERE clause

    const query = `UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`;
    await context.env.DB.prepare(query).bind(...values).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
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

    const id = context.params.id;

    // Verify ownership
    const job = await context.env.DB.prepare("SELECT user_id FROM jobs WHERE id = ?").bind(id).first();
    if (!job || job.user_id !== auth.userId) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Get images to delete from R2
    const images = await context.env.DB.prepare("SELECT r2_key_original, r2_key_result FROM images WHERE job_id = ?").bind(id).all();

    // 2. Delete from R2
    const keysToDelete: string[] = [];
    images.results.forEach((img: any) => {
      if (img.r2_key_original) keysToDelete.push(img.r2_key_original);
      if (img.r2_key_result) keysToDelete.push(img.r2_key_result);
    });

    if (keysToDelete.length > 0) {
      await Promise.all(keysToDelete.map(key => context.env.STORAGE.delete(key)));
    }

    // 3. Delete from DB
    await context.env.DB.batch([
      context.env.DB.prepare("DELETE FROM images WHERE job_id = ?").bind(id),
      context.env.DB.prepare("DELETE FROM jobs WHERE id = ?").bind(id)
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

