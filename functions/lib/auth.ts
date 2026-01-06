// Auth middleware for Cloudflare Pages Functions
// Extracts user ID from Firebase token or passes through for public routes

interface AuthContext {
    userId: string | null;
    userEmail: string | null;
}

// Firebase public keys endpoint for token verification
const FIREBASE_PROJECT_ID = 'light-work-auth';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

function base64UrlToUint8Array(input: string): Uint8Array {
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (b64.length % 4)) % 4;
    const padded = b64 + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function base64ToUint8Array(input: string): Uint8Array {
    const normalized = input.replace(/\s+/g, '');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function readAsn1Length(bytes: Uint8Array, offset: number): { length: number; lengthBytes: number } {
    const first = bytes[offset];
    if ((first & 0x80) === 0) {
        return { length: first, lengthBytes: 1 };
    }
    const count = first & 0x7f;
    let length = 0;
    for (let i = 0; i < count; i++) {
        length = (length << 8) | bytes[offset + 1 + i];
    }
    return { length, lengthBytes: 1 + count };
}

function readAsn1Element(bytes: Uint8Array, offset: number): { tag: number; headerLen: number; valueOffset: number; valueLen: number; end: number } {
    const tag = bytes[offset];
    const { length, lengthBytes } = readAsn1Length(bytes, offset + 1);
    const headerLen = 1 + lengthBytes;
    const valueOffset = offset + headerLen;
    const valueLen = length;
    const end = valueOffset + valueLen;
    return { tag, headerLen, valueOffset, valueLen, end };
}

function extractSubjectPublicKeyInfoFromX509Cert(certDer: Uint8Array): Uint8Array | null {
    // Certificate  ::=  SEQUENCE  {
    //   tbsCertificate       TBSCertificate,
    //   signatureAlgorithm   AlgorithmIdentifier,
    //   signatureValue       BIT STRING  }
    // TBSCertificate ::= SEQUENCE {
    //   version [0] EXPLICIT Version DEFAULT v1,
    //   serialNumber INTEGER,
    //   signature AlgorithmIdentifier,
    //   issuer Name,
    //   validity Validity,
    //   subject Name,
    //   subjectPublicKeyInfo SubjectPublicKeyInfo,
    //   ... }

    const root = readAsn1Element(certDer, 0);
    if (root.tag !== 0x30) return null;

    let cursor = root.valueOffset;
    const tbs = readAsn1Element(certDer, cursor);
    if (tbs.tag !== 0x30) return null;
    cursor = tbs.valueOffset;

    // Optional version [0] EXPLICIT
    const maybeVersion = readAsn1Element(certDer, cursor);
    if (maybeVersion.tag === 0xA0) {
        cursor = maybeVersion.end;
    }

    // serialNumber, signature, issuer, validity, subject
    for (let i = 0; i < 5; i++) {
        const el = readAsn1Element(certDer, cursor);
        cursor = el.end;
    }

    // subjectPublicKeyInfo
    const spki = readAsn1Element(certDer, cursor);
    if (spki.tag !== 0x30) return null;
    return certDer.slice(cursor, spki.end);
}

async function getFirebaseCerts(): Promise<Record<string, string>> {
    const now = Date.now();
    if (cachedCerts && now < cachedCertsExpiresAt) return cachedCerts;

    const res = await fetch(GOOGLE_CERTS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } as any });
    if (!res.ok) throw new Error(`Failed to fetch Firebase certs: ${res.status}`);

    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
    const maxAgeSeconds = maxAgeMatch ? Number.parseInt(maxAgeMatch[1], 10) : 3600;

    cachedCerts = await res.json();
    cachedCertsExpiresAt = now + Math.max(60, maxAgeSeconds) * 1000;
    return cachedCerts!;
}

async function verifyJwtRS256(token: string): Promise<{ header: any; payload: any } | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const headerJson = new TextDecoder().decode(base64UrlToUint8Array(headerB64));
    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));

    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    const kid = header?.kid;
    if (!kid) return null;

    const certs = await getFirebaseCerts();
    const pem = certs[kid];
    if (!pem) return null;

    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(sigB64);


    // Import X.509 cert public key (extract SPKI from certificate DER)
    const pemBody = pem
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '');
    const certDer = base64ToUint8Array(pemBody);
    const spkiDer = extractSubjectPublicKeyInfoFromX509Cert(certDer);
    if (!spkiDer) return null;

    const cryptoKey = await crypto.subtle.importKey(
        'spki',
        spkiDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const ok = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        signature,
        data
    );

    if (!ok) return null;
    return { header, payload };
}

/**
 * Decode and verify Firebase ID token
 * Note: For production, you should verify the token signature using Firebase Admin SDK
 * or by fetching Google's public keys. This simplified version decodes the JWT payload.
 */
async function verifyFirebaseToken(token: string): Promise<{ uid: string; email: string } | null> {
    try {
        // Verify signature if possible; otherwise fail closed.
        const verified = await verifyJwtRS256(token);
        if (!verified) {
            console.log('Token verification failed (signature)');
            return null;
        }

        const payload = verified.payload;

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
    let token: string | undefined;
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        // Fallback: Check query param (for <img> tags etc)
        try {
            const url = new URL(request.url);
            token = url.searchParams.get('auth_token') || undefined;
        } catch (e) {
            // ignore invalid URL
        }
    }

    if (!token) {
        return { userId: null, userEmail: null };
    }

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
