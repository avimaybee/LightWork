
import { getAuthContext } from '../../../lib/auth';
import { generatePresignedUrls } from '../../../lib/presigner';

interface Env {
    DB: D1Database;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ACCOUNT_ID: string;
    R2_BUCKET: string;
}

export async function onRequestGet(context: { request: Request; env: Env, params: { key: string } }) {
    try {
        const auth = await getAuthContext(context.request);
        if (!auth.userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const headId = context.params.key;

        // Verify ownership via the head image
        const headImage = await context.env.DB.prepare(`
        SELECT i.id, j.user_id 
        FROM images i
        JOIN jobs j ON i.job_id = j.id
        WHERE i.id = ?
    `).bind(headId).first();

        if (!headImage) {
            return new Response(JSON.stringify({ error: 'Image not found' }), { status: 404 });
        }

        if (headImage.user_id !== auth.userId) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
        }

        // Fetch history (versions where parent_id = headId)
        // We order by version DESC to show newest first
        const history = await context.env.DB.prepare(`
        SELECT * FROM images 
        WHERE parent_id = ? 
        ORDER BY version DESC
    `).bind(headId).all();

        const results = history.results || [];

        // Collect R2 key for presigning
        const r2Keys: string[] = [];
        results.forEach((img: any) => {
            if (img.r2_key_result) r2Keys.push(img.r2_key_result);
        });

        // Generate presigned URLs
        let presignedUrlMap = new Map<string, string>();
        const hasCredentials = context.env.R2_ACCESS_KEY_ID && context.env.R2_SECRET_ACCESS_KEY;

        if (hasCredentials && r2Keys.length > 0) {
            try {
                presignedUrlMap = await generatePresignedUrls(r2Keys, {
                    accessKeyId: context.env.R2_ACCESS_KEY_ID,
                    secretAccessKey: context.env.R2_SECRET_ACCESS_KEY,
                    accountId: context.env.R2_ACCOUNT_ID,
                    bucketName: context.env.R2_BUCKET,
                }, 3600);
            } catch (e) {
                console.error('Failed to presign history URLs', e);
            }
        }

        const getUrl = (key: string) => key ? (presignedUrlMap.get(key) || `/api/images/${encodeURIComponent(key)}`) : undefined;

        const mappedHistory = results.map((img: any) => ({
            id: img.id,
            version: img.version,
            resultUrl: getUrl(img.r2_key_result),
            prompt: img.prompt,
            generatedPrompt: img.generated_prompt,
            createdAt: img.created_at
        }));

        return new Response(JSON.stringify(mappedHistory), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
