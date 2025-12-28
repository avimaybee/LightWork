
import { getAuthContext } from '../lib/auth';

interface Env {
  DB: D1Database;
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const auth = await getAuthContext(context.request);

    // If no auth, return empty projects (user will be prompted to login)
    if (!auth.userId) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { results } = await context.env.DB.prepare(
      "SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(auth.userId).all();

    // Map DB to Frontend Project
    const projects = await Promise.all(results.map(async (job: any) => {
      const images = await context.env.DB.prepare("SELECT * FROM images WHERE job_id = ?").bind(job.id).all();

      return {
        id: job.id,
        name: job.name || 'Untitled Session',
        createdAt: job.created_at,
        jobs: images.results.map((img: any) => ({
          id: img.id,
          fileName: img.filename,
          status: img.status,
          originalUrl: `/api/images/${img.r2_key_original}`,
          resultUrl: img.r2_key_result ? `/api/images/${img.r2_key_result}` : undefined,
          thumbnailUrl: `/api/images/${img.r2_key_original}`,
          localPrompt: img.prompt || '',
          retryCount: 0,
          timestamp: img.created_at,
        })),
        modulePrompt: job.module_prompt || '',
        selectedMode: job.selected_mode || 'fast',
        selectedModulePreset: job.selected_module_preset || ''
      };
    }));

    return new Response(JSON.stringify(projects), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const auth = await getAuthContext(context.request);

    if (!auth.userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await context.request.json() as { name: string };
    const id = crypto.randomUUID();

    await context.env.DB.prepare(
      "INSERT INTO jobs (id, user_id, name, status, created_at, module_prompt, selected_mode, selected_module_preset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, auth.userId, body.name, 'active', Date.now(), '', 'fast', '').run();

    return new Response(JSON.stringify({
      id,
      name: body.name,
      jobs: [],
      createdAt: Date.now(),
      modulePrompt: '',
      selectedMode: 'fast',
      selectedModulePreset: ''
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
