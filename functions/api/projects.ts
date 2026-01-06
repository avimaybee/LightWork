
import { getAuthContext } from '../lib/auth';
import { createProjectSchema, validateRequest } from '../lib/validation';
import { generatePresignedUrls } from '../lib/presigner';

interface Env {
  DB: D1Database;
  // R2 S3 API credentials for presigned URLs
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
}

// Helper for consistent JSON responses
function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
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

    // Check if R2 credentials are available for presigned URLs
    const hasPresignedCredentials = context.env.R2_ACCESS_KEY_ID &&
      context.env.R2_SECRET_ACCESS_KEY &&
      context.env.R2_ACCOUNT_ID &&
      context.env.R2_BUCKET;

    // Map DB to Frontend Project
    const projects = await Promise.all(results.map(async (job: any) => {
      const images = await context.env.DB.prepare("SELECT * FROM images WHERE job_id = ?").bind(job.id).all();

      // Collect all R2 keys for presigning
      const r2Keys: string[] = [];
      images.results.forEach((img: any) => {
        if (img.r2_key_original) r2Keys.push(img.r2_key_original);
        if (img.r2_key_result) r2Keys.push(img.r2_key_result);
      });

      // Generate presigned URLs if credentials are available
      let presignedUrlMap = new Map<string, string>();
      if (hasPresignedCredentials && r2Keys.length > 0) {
        try {
          presignedUrlMap = await generatePresignedUrls(r2Keys, {
            accessKeyId: context.env.R2_ACCESS_KEY_ID,
            secretAccessKey: context.env.R2_SECRET_ACCESS_KEY,
            accountId: context.env.R2_ACCOUNT_ID,
            bucketName: context.env.R2_BUCKET,
          }, 3600); // 1 hour expiry
        } catch (e) {
          console.error('[Projects] Failed to generate presigned URLs:', e);
          // Fall back to proxy URLs
        }
      }

      // Helper to get URL (presigned or fallback to proxy)
      const getImageUrl = (r2Key: string | null): string | undefined => {
        if (!r2Key) return undefined;
        return presignedUrlMap.get(r2Key) || `/api/images/${encodeURIComponent(r2Key)}`;
      };

      return {
        id: job.id,
        name: job.name || 'Untitled Session',
        createdAt: job.created_at,
        jobs: images.results.map((img: any) => ({
          id: img.id,
          fileName: img.filename,
          status: img.status,
          originalUrl: getImageUrl(img.r2_key_original),
          resultUrl: getImageUrl(img.r2_key_result),
          thumbnailUrl: getImageUrl(img.r2_key_original),
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
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const rawBody = await context.request.json();

    // Validate input with Zod schema
    const validation = validateRequest(createProjectSchema, rawBody);
    if (!validation.success) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const body = validation.data;
    const id = crypto.randomUUID();

    await context.env.DB.prepare(
      "INSERT INTO jobs (id, user_id, name, status, created_at, module_prompt, selected_mode, selected_module_preset) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, auth.userId, body.name, 'active', Date.now(), '', 'fast', '').run();

    return jsonResponse({
      id,
      name: body.name,
      jobs: [],
      createdAt: Date.now(),
      modulePrompt: '',
      selectedMode: 'fast',
      selectedModulePreset: ''
    });
  } catch (e: any) {
    return jsonResponse({ error: e.message }, 500);
  }
}
