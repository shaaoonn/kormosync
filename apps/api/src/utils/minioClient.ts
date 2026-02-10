import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

// MinIO Configuration
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'https://minio-x8s4k00s04g0484ow888wwoc.213.136.79.44.sslip.io';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'VniGPlUH4sEsgr3h';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '2Tv11g92xDHWocMzfzLfjgnQBke4K20n';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'kormosync';

// ============================================================
// MinIO Circuit Breaker — instant fail when MinIO is down
// ============================================================
let minioHealthy = true;
let minioFailCount = 0;
let minioLastFailTime = 0;
const MINIO_CB_THRESHOLD = 3;       // 3 consecutive fails → circuit open
const MINIO_CB_RECOVERY_MS = 30_000; // Try again after 30s

export function isMinioHealthy(): boolean {
    // If circuit is open, check if recovery period has passed
    if (!minioHealthy && (Date.now() - minioLastFailTime) > MINIO_CB_RECOVERY_MS) {
        console.log('🔄 [MINIO] Circuit breaker half-open — allowing next request as probe');
        return true; // Half-open: allow one probe request
    }
    return minioHealthy;
}

function markMinioSuccess(): void {
    if (!minioHealthy) {
        console.log('✅ [MINIO] Circuit breaker closed — MinIO recovered');
    }
    minioHealthy = true;
    minioFailCount = 0;
}

function markMinioFailure(): void {
    minioFailCount++;
    minioLastFailTime = Date.now();
    if (minioFailCount >= MINIO_CB_THRESHOLD && minioHealthy) {
        minioHealthy = false;
        console.error(`🔴 [MINIO] Circuit breaker OPEN — ${MINIO_CB_THRESHOLD} consecutive failures`);
    }
}

// S3 Client (MinIO compatible) — with timeouts to prevent event loop blocking
export const minioClient = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1', // MinIO doesn't use regions but SDK requires it
    credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true, // Required for MinIO
    requestHandler: {
        requestTimeout: 30_000,    // 30 second timeout for each request
        connectionTimeout: 10_000, // 10 second connection timeout
    } as any,
    maxAttempts: 2, // Retry once on failure, then give up
});

/**
 * Upload file to MinIO
 */
export async function uploadToMinio(
    buffer: Buffer,
    fileName: string,
    contentType: string = 'image/png',
    folder: string = 'uploads'
): Promise<string> {
    // Sanitize filename for internal storage (privacy: use UUID)
    // We keep extension but randomize name
    const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
    const randomName = crypto.randomUUID();
    const storageFileName = ext ? `${randomName}.${ext}` : randomName;

    let key = '';

    if (folder === 'screenshots') {
        key = `screenshots/${new Date().toISOString().split('T')[0]}/${storageFileName}`;
    } else {
        // distinct path for general uploads: uploads/YYYY/MM/filename
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        key = `${folder}/${year}/${month}/${storageFileName}`;
    }

    console.log(`📤 MinIO Upload: ${key} (${(buffer.length/1024).toFixed(0)}KB)`);

    const command = new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });

    try {
        // Circuit breaker check — fail instantly if MinIO is down
        if (!isMinioHealthy()) {
            throw new Error('MinIO circuit breaker open — upload rejected');
        }

        // 15 second hard timeout — prevents event loop blocking on slow MinIO
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 15_000);
        await minioClient.send(command, { abortSignal: abortController.signal });
        clearTimeout(timeout);
        markMinioSuccess();
        console.log('✅ MinIO Upload OK:', key);

        // ALWAYS return the KEY relative key (not full URL) for storage in DB
        // The DB should only assume it holds path/to/file
        // But previously we were returning full URL.
        // If we change this now, old data is full URL, new data is Key.
        // Better: Return Full URL, but make getSignedViewUrl smart enough to strip it.

        return `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${key}`;

    } catch (error: any) {
        // Don't count circuit breaker rejections as new failures
        if (!error?.message?.includes('circuit breaker')) {
            markMinioFailure();
        }
        console.error('❌ MinIO Upload Failed:', error?.message || error);
        throw error;
    }
}

/**
 * Signed URL Cache — avoids repeated MinIO API calls for the same file.
 * Cache TTL: 30 minutes (signed URLs valid for 1 hour).
 * This eliminates N+1 signing in controller loops (5500+ → 1 per unique key).
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_URL_CACHE_SIZE = 2000;

// Periodic cleanup every 2 minutes (was 15min — too slow, caused memory pressure)
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [k, v] of signedUrlCache.entries()) {
        if (now >= v.expiresAt) { signedUrlCache.delete(k); cleaned++; }
    }
    if (cleaned > 0) console.log(`🧹 MinIO URL cache: cleaned ${cleaned}, remaining ${signedUrlCache.size}`);
}, 2 * 60 * 1000);

/**
 * Extract clean storage key from full URL or key string
 */
function extractKey(keyOrUrl: string): string {
    let key = keyOrUrl;
    const prefix = `${MINIO_ENDPOINT}/${MINIO_BUCKET}/`;

    if (keyOrUrl.startsWith(prefix)) {
        key = keyOrUrl.replace(prefix, '');
    } else if (keyOrUrl.startsWith('http')) {
        const parts = keyOrUrl.split(`/${MINIO_BUCKET}/`);
        if (parts.length > 1) {
            key = parts[1];
        }
    }

    key = decodeURIComponent(key);
    if (key.includes('?')) {
        key = key.split('?')[0];
    }
    return key;
}

/**
 * Get signed URL for viewing (expires in 1 hour)
 * Uses in-memory cache to avoid repeated MinIO API calls.
 */
export async function getSignedViewUrl(keyOrUrl: string): Promise<string | null> {
    const key = extractKey(keyOrUrl);

    // Check cache
    const cached = signedUrlCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.url;
    }

    try {
        // Circuit breaker check — fail instantly if MinIO is down
        if (!isMinioHealthy()) {
            return null;
        }

        const command = new GetObjectCommand({
            Bucket: MINIO_BUCKET,
            Key: key,
        });

        const url = await getSignedUrl(minioClient, command, { expiresIn: 3600 });
        markMinioSuccess();

        // Populate cache (evict oldest if full)
        if (signedUrlCache.size >= MAX_URL_CACHE_SIZE) {
            const firstKey = signedUrlCache.keys().next().value;
            if (firstKey) signedUrlCache.delete(firstKey);
        }
        signedUrlCache.set(key, { url, expiresAt: Date.now() + URL_CACHE_TTL });

        return url;
    } catch (error) {
        markMinioFailure();
        console.error(`[MINIO] Failed to sign URL for key: ${key}`, error);
        return null;
    }
}

/**
 * Generate public URL (if bucket is public)
 */
export function getPublicUrl(key: string): string {
    return `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${key}`;
}

/**
 * Delete file from MinIO
 */
export async function deleteFromMinio(keyOrUrl: string): Promise<boolean> {
    let key = keyOrUrl;
    const prefix = `${MINIO_ENDPOINT}/${MINIO_BUCKET}/`;

    if (keyOrUrl.startsWith(prefix)) {
        key = keyOrUrl.replace(prefix, '');
    } else if (keyOrUrl.startsWith('http')) {
        const parts = keyOrUrl.split(`/${MINIO_BUCKET}/`);
        if (parts.length > 1) {
            key = parts[1];
        }
    }

    key = decodeURIComponent(key);
    if (key.includes('?')) {
        key = key.split('?')[0];
    }

    try {
        const command = new DeleteObjectCommand({
            Bucket: MINIO_BUCKET,
            Key: key,
        });
        await minioClient.send(command);
        console.log('🗑️ MinIO Delete Success:', key);
        return true;
    } catch (error) {
        console.error('❌ MinIO Delete Failed:', key, error);
        return false;
    }
}

export { MINIO_BUCKET };
