import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { screenshotApi } from '../services/api';

// ============================================================
// KormoSync Desktop - Offline Queue (IndexedDB via idb)
// Stores screenshots locally when offline, flushes when back online
// ============================================================

const MAX_QUEUE_SIZE = 100; // Cap queue to prevent unbounded growth

interface QueuedScreenshot {
    id: number;
    taskId: string;
    subTaskId?: string;
    activeSubTaskIds?: string;   // Comma-separated IDs of concurrent subtasks
    activeSubTaskNames?: string; // Comma-separated names for admin display
    deviceId?: string;
    keystrokes: number;
    mouseClicks: number;
    activeSeconds: number;
    capturedAt: string;
    imageBlob: Blob;
    createdAt: string;
    retries: number;
}

interface OfflineQueueDB extends DBSchema {
    screenshots: {
        key: number;
        value: QueuedScreenshot;
        indexes: {
            'by-created': string;
        };
    };
}

const DB_NAME = 'kormosync-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<OfflineQueueDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineQueueDB>> {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<OfflineQueueDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            const store = db.createObjectStore('screenshots', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('by-created', 'createdAt');
        },
    });

    return dbInstance;
}

/**
 * Add a screenshot to the offline queue.
 * Call this when a screenshot capture happens but the network is unavailable.
 * Queue is capped at MAX_QUEUE_SIZE — oldest items are evicted to make room.
 */
export async function enqueueScreenshot(params: {
    taskId: string;
    subTaskId?: string;
    activeSubTaskIds?: string;
    activeSubTaskNames?: string;
    deviceId?: string;
    keystrokes: number;
    mouseClicks: number;
    activeSeconds: number;
    capturedAt: string;
    imageBlob: Blob;
}): Promise<number> {
    const db = await getDB();

    // Evict oldest items if queue is full
    const count = await db.count('screenshots');
    if (count >= MAX_QUEUE_SIZE) {
        try {
            const oldest = await db.getAllFromIndex('screenshots', 'by-created');
            // Remove oldest entries to make room (evict up to 10 at once)
            const toRemove = oldest.slice(0, Math.max(1, count - MAX_QUEUE_SIZE + 1));
            for (const item of toRemove) {
                await db.delete('screenshots', item.id);
            }
            console.warn(`[OfflineQueue] Evicted ${toRemove.length} oldest items (queue at ${MAX_QUEUE_SIZE} cap)`);
        } catch {
            // Non-critical — just log
            console.warn('[OfflineQueue] Failed to evict old items');
        }
    }

    const id = await db.add('screenshots', {
        ...params,
        createdAt: new Date().toISOString(),
        retries: 0,
    } as QueuedScreenshot);
    return id;
}

/**
 * Get all queued screenshots (oldest first).
 */
export async function getQueuedScreenshots(): Promise<QueuedScreenshot[]> {
    const db = await getDB();
    return db.getAllFromIndex('screenshots', 'by-created');
}

/**
 * Get the number of pending items in the queue.
 */
export async function getQueueSize(): Promise<number> {
    const db = await getDB();
    return db.count('screenshots');
}

/**
 * Remove a successfully uploaded item from the queue.
 */
export async function dequeueScreenshot(id: number): Promise<void> {
    const db = await getDB();
    await db.delete('screenshots', id);
}

/**
 * Increment retry count for a failed item.
 * Items with >5 retries are automatically discarded.
 */
async function markRetry(id: number): Promise<boolean> {
    const db = await getDB();
    const item = await db.get('screenshots', id);
    if (!item) return false;

    if (item.retries >= 5) {
        await db.delete('screenshots', id);
        console.warn(`[OfflineQueue] Discarded screenshot ${id} after ${item.retries} failed retries`);
        return false;
    }

    await db.put('screenshots', { ...item, retries: item.retries + 1 });
    return true;
}

/**
 * Flush all queued screenshots to the server.
 * Processes items sequentially (oldest first) to preserve order.
 * Returns the number of successfully uploaded items.
 */
export async function flushQueue(): Promise<number> {
    const items = await getQueuedScreenshots();
    if (items.length === 0) return 0;

    let uploaded = 0;

    for (const item of items) {
        try {
            const formData = new FormData();
            formData.append('screenshot', item.imageBlob, 'screenshot.jpg');
            formData.append('taskId', item.taskId);
            if (item.subTaskId) formData.append('subTaskId', item.subTaskId);
            if (item.activeSubTaskIds) formData.append('activeSubTaskIds', item.activeSubTaskIds);
            if (item.activeSubTaskNames) formData.append('activeSubTaskNames', item.activeSubTaskNames);
            if (item.deviceId) formData.append('deviceId', item.deviceId);
            formData.append('keystrokes', String(item.keystrokes));
            formData.append('mouseClicks', String(item.mouseClicks));
            formData.append('activeSeconds', String(item.activeSeconds));
            formData.append('capturedAt', item.capturedAt);

            await screenshotApi.upload(formData);
            await dequeueScreenshot(item.id);
            uploaded++;
        } catch (error) {
            console.error(`[OfflineQueue] Failed to upload screenshot ${item.id}:`, error);
            await markRetry(item.id);
            // Stop processing on first network failure to avoid hammering a dead server
            break;
        }
    }

    return uploaded;
}

/**
 * Start listening for online/offline events and auto-flush when connectivity returns.
 * Call this once at app startup.
 */
export function startOfflineQueueSync(): () => void {
    const handleOnline = async () => {
        console.log('[OfflineQueue] Back online, flushing queue...');
        const count = await flushQueue();
        if (count > 0) {
            console.log(`[OfflineQueue] Successfully uploaded ${count} queued screenshots`);
        }
    };

    window.addEventListener('online', handleOnline);

    // Also attempt an initial flush in case we start online with leftover items
    if (navigator.onLine) {
        flushQueue().catch(() => {});
    }

    return () => {
        window.removeEventListener('online', handleOnline);
    };
}

/**
 * Check if the app is currently offline.
 */
export function isOffline(): boolean {
    return !navigator.onLine;
}

/**
 * Clear the entire offline queue (use with caution).
 */
export async function clearQueue(): Promise<void> {
    const db = await getDB();
    await db.clear('screenshots');
}
