import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

// MinIO Configuration
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'https://minio-x8s4k00s04g0484ow888wwoc.213.136.79.44.sslip.io';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'VniGPlUH4sEsgr3h';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '2Tv11g92xDHWocMzfzLfjgnQBke4K20n';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'kormosync';

// S3 Client (MinIO compatible)
export const minioClient = new S3Client({
    endpoint: MINIO_ENDPOINT,
    region: 'us-east-1', // MinIO doesn't use regions but SDK requires it
    credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true, // Required for MinIO
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

    console.log('📤 MinIO Upload Starting...');
    console.log('   Bucket:', MINIO_BUCKET);
    console.log('   Key:', key);
    console.log('   Size:', buffer.length, 'bytes');

    const command = new PutObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });

    try {
        await minioClient.send(command);
        console.log('✅ MinIO Upload Success:', key);

        // ALWAYS return the KEY relative key (not full URL) for storage in DB
        // The DB should only assume it holds path/to/file
        // But previously we were returning full URL.
        // If we change this now, old data is full URL, new data is Key.
        // Better: Return Full URL, but make getSignedViewUrl smart enough to strip it.

        return `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${key}`;

    } catch (error) {
        console.error('❌ MinIO Upload Failed:', error);
        throw error;
    }
}

/**
 * Get signed URL for viewing (expires in 1 hour)
 */
export async function getSignedViewUrl(keyOrUrl: string): Promise<string> {
    // If it's a full URL, strip the endpoint/bucket to get the key
    let key = keyOrUrl;
    const prefix = `${MINIO_ENDPOINT}/${MINIO_BUCKET}/`;

    if (keyOrUrl.startsWith(prefix)) {
        key = keyOrUrl.replace(prefix, '');
    } else if (keyOrUrl.startsWith('http')) {
        // Fallback for other potential full URL structures
        // Try to splitting by bucketname? Or assume everything after bucketname is key
        // Simple heuristic: split by bucketname
        const parts = keyOrUrl.split(`/${MINIO_BUCKET}/`);
        if (parts.length > 1) {
            key = parts[1];
        }
    }

    // Decode URI component in case it was encoded
    key = decodeURIComponent(key);

    // Safety: Strip query params if they exist in the key (e.g. from previously saved signed URLs)
    if (key.includes('?')) {
        key = key.split('?')[0];
    }

    const command = new GetObjectCommand({
        Bucket: MINIO_BUCKET,
        Key: key,
    });

    const url = await getSignedUrl(minioClient, command, { expiresIn: 3600 });
    return url;
}

/**
 * Generate public URL (if bucket is public)
 */
export function getPublicUrl(key: string): string {
    return `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${key}`;
}

export { MINIO_BUCKET };
