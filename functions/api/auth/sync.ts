// User sync endpoint - syncs Firebase user to D1 database

import { getAuthContext } from '../../lib/auth';

interface Env {
    DB: D1Database;
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

        // Get user data from request body
        const body = await context.request.json() as {
            email: string;
            displayName?: string;
            photoURL?: string;
        };

        const now = Date.now();

        // Upsert user - insert or update on conflict
        await context.env.DB.prepare(`
      INSERT INTO users (id, email, display_name, photo_url, created_at, last_login)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        photo_url = excluded.photo_url,
        last_login = excluded.last_login
    `).bind(
            auth.userId,
            body.email,
            body.displayName || null,
            body.photoURL || null,
            now,
            now
        ).run();

        return new Response(JSON.stringify({
            success: true,
            userId: auth.userId
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error('User sync failed:', e);
        return new Response(JSON.stringify({
            error: 'Failed to sync user',
            details: e instanceof Error ? e.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
