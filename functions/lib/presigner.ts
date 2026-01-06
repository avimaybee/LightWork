/**
 * AWS S3-compatible Presigned URL Generator for Cloudflare R2
 * Implements AWS Signature Version 4 for presigned URLs.
 * Zero dependencies, works in Cloudflare Workers.
 */

interface PresignOptions {
    key: string;
    method?: 'GET' | 'PUT';
    expiresIn?: number; // seconds, default 3600 (1 hour), max 604800 (7 days)
}

interface R2Credentials {
    accessKeyId: string;
    secretAccessKey: string;
    accountId: string;
    bucketName: string;
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

async function sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return toHex(new Uint8Array(hashBuffer));
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function getSignatureKey(
    secretKey: string,
    dateStamp: string,
    region: string,
    service: string
): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const kDate = await hmacSha256(encoder.encode('AWS4' + secretKey), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    return hmacSha256(kService, 'aws4_request');
}

/**
 * Generate a presigned URL for Cloudflare R2
 * @param options - key, method (GET/PUT), expiresIn (seconds)
 * @param credentials - R2 S3 API credentials
 * @returns Presigned URL string
 */
export async function generatePresignedUrl(
    options: PresignOptions,
    credentials: R2Credentials
): Promise<string> {
    const { key, method = 'GET', expiresIn = 3600 } = options;
    const { accessKeyId, secretAccessKey, accountId, bucketName } = credentials;

    const region = 'auto'; // R2 uses 'auto' region
    const service = 's3';
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    // Encode the key properly (but not twice)
    const encodedKey = key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    const canonicalUri = `/${bucketName}/${encodedKey}`;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${accessKeyId}/${credentialScope}`;

    // Query parameters for presigned URL
    const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(expiresIn),
        'X-Amz-SignedHeaders': 'host',
    });

    // Sort and canonicalize query string
    const sortedParams = [...queryParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const canonicalQueryString = sortedParams
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    const canonicalRequestHash = await sha256(canonicalRequest);

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        canonicalRequestHash,
    ].join('\n');

    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signatureBuffer = await hmacSha256(signingKey, stringToSign);
    const signature = toHex(new Uint8Array(signatureBuffer));

    return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

/**
 * Generate multiple presigned URLs efficiently
 */
export async function generatePresignedUrls(
    keys: string[],
    credentials: R2Credentials,
    expiresIn: number = 3600
): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Process in parallel for speed
    await Promise.all(
        keys.map(async (key) => {
            const url = await generatePresignedUrl({ key, method: 'GET', expiresIn }, credentials);
            results.set(key, url);
        })
    );

    return results;
}
