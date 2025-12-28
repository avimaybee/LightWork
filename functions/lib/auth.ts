// Auth middleware for Cloudflare Pages Functions
// Extracts user ID from Firebase token or passes through for public routes

interface AuthContext {
    userId: string | null;
    userEmail: string | null;
}

// Firebase public keys endpoint for token verification
const FIREBASE_PROJECT_ID = 'light-work-auth';

/**
 * Decode and verify Firebase ID token
 * Note: For production, you should verify the token signature using Firebase Admin SDK
 * or by fetching Google's public keys. This simplified version decodes the JWT payload.
 */
async function verifyFirebaseToken(token: string): Promise<{ uid: string; email: string } | null> {
    try {
        // JWT format: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        // Decode the payload (base64url encoded)
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        // Basic validation
        const now = Math.floor(Date.now() / 1000);

        // Check expiration
        if (payload.exp && payload.exp < now) {
            console.log('Token expired');
            return null;
        }

        // Check audience matches our Firebase project
        if (payload.aud !== FIREBASE_PROJECT_ID) {
            console.log('Invalid audience');
            return null;
        }

        // Check issuer
        if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
            console.log('Invalid issuer');
            return null;
        }

        return {
            uid: payload.sub || payload.user_id,
            email: payload.email || ''
        };
    } catch (e) {
        console.error('Token verification failed:', e);
        return null;
    }
}

/**
 * Extract auth context from request
 */
export async function getAuthContext(request: Request): Promise<AuthContext> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { userId: null, userEmail: null };
    }

    const token = authHeader.substring(7);
    const decoded = await verifyFirebaseToken(token);

    if (!decoded) {
        return { userId: null, userEmail: null };
    }

    return {
        userId: decoded.uid,
        userEmail: decoded.email
    };
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(request: Request): Promise<{ userId: string; userEmail: string }> {
    const auth = await getAuthContext(request);

    if (!auth.userId) {
        throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return { userId: auth.userId, userEmail: auth.userEmail || '' };
}
