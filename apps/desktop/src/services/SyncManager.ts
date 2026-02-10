// ============================================================
// KormoSync Desktop - SyncManager (Phase 6.3)
// Full offline data sync orchestrator
// Priority: TimeLogs > ActivityLogs > Screenshots
// ============================================================

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { api } from './api';
import { flushQueue as flushScreenshotQueue, getQueueSize } from '../utils/offlineQueue';

// ─── IndexedDB Schema for Sync Queue ────────────────────────
interface SyncQueueItem {
    id?: number;
    type: 'timelog' | 'activity';
    payload: Record<string, any>;
    createdAt: string;
    retries: number;
}

interface SyncQueueDB extends DBSchema {
    syncQueue: {
        key: number;
        value: SyncQueueItem;
        indexes: {
            'by-type': string;
            'by-created': string;
        };
    };
}

const SYNC_DB_NAME = 'kormosync-sync';
const SYNC_DB_VERSION = 1;
const MAX_RETRIES = 5;
const BATCH_SIZE = 25;

let syncDbInstance: IDBPDatabase<SyncQueueDB> | null = null;

async function getSyncDB(): Promise<IDBPDatabase<SyncQueueDB>> {
    if (syncDbInstance) return syncDbInstance;

    syncDbInstance = await openDB<SyncQueueDB>(SYNC_DB_NAME, SYNC_DB_VERSION, {
        upgrade(db) {
            const store = db.createObjectStore('syncQueue', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('by-type', 'type');
            store.createIndex('by-created', 'createdAt');
        },
    });

    return syncDbInstance;
}

// ─── Enqueue Functions ──────────────────────────────────────

export async function enqueueTimeLog(payload: {
    taskId: string;
    subTaskId?: string;
    startTime: string;
    endTime?: string;
    durationSeconds?: number;
}): Promise<void> {
    const db = await getSyncDB();
    await db.add('syncQueue', {
        type: 'timelog',
        payload,
        createdAt: new Date().toISOString(),
        retries: 0,
    });
}

export async function enqueueActivityLog(payload: {
    taskId: string;
    subTaskId?: string;
    intervalStart: string;
    intervalEnd: string;
    keystrokes: number;
    mouseClicks: number;
    mouseMovement: number;
    activeSeconds: number;
}): Promise<void> {
    const db = await getSyncDB();
    await db.add('syncQueue', {
        type: 'activity',
        payload,
        createdAt: new Date().toISOString(),
        retries: 0,
    });
}

// ─── Flush Sync Queue ───────────────────────────────────────

async function flushSyncQueue(): Promise<number> {
    const db = await getSyncDB();
    const allItems = await db.getAllFromIndex('syncQueue', 'by-created');

    if (allItems.length === 0) return 0;

    // Sort by priority: timelogs first, then activity
    const prioritized = [
        ...allItems.filter((i) => i.type === 'timelog'),
        ...allItems.filter((i) => i.type === 'activity'),
    ];

    let totalSynced = 0;

    // Process in batches
    for (let i = 0; i < prioritized.length; i += BATCH_SIZE) {
        const batch = prioritized.slice(i, i + BATCH_SIZE);

        try {
            const response = await api.post('/sync/bulk', {
                items: batch.map((item) => ({
                    type: item.type,
                    ...item.payload,
                })),
            });

            const results = response.data.results || [];

            // Remove successful items, mark retry for failures
            for (let j = 0; j < batch.length; j++) {
                const item = batch[j];
                const result = results[j];

                if (result?.success) {
                    await db.delete('syncQueue', item.id!);
                    totalSynced++;
                } else {
                    // Increment retry
                    if (item.retries >= MAX_RETRIES) {
                        console.warn(`[SyncManager] Discarding item ${item.id} after ${MAX_RETRIES} retries`);
                        await db.delete('syncQueue', item.id!);
                    } else {
                        await db.put('syncQueue', { ...item, retries: item.retries + 1 });
                    }
                }
            }
        } catch (error) {
            console.error('[SyncManager] Batch sync failed, stopping:', error);
            // Network error - stop processing
            break;
        }
    }

    return totalSynced;
}

// ─── Full Sync (all queues) ─────────────────────────────────

export async function syncAll(): Promise<{ timelogs: number; activity: number; screenshots: number }> {
    if (!navigator.onLine) {
        console.log('[SyncManager] Offline, skipping sync');
        return { timelogs: 0, activity: 0, screenshots: 0 };
    }

    console.log('[SyncManager] Starting full sync...');

    // 1. Flush timelogs & activity (priority)
    const syncedCount = await flushSyncQueue();

    // 2. Flush screenshots
    const screenshotCount = await flushScreenshotQueue();

    console.log(`[SyncManager] Sync complete: ${syncedCount} data items, ${screenshotCount} screenshots`);

    return {
        timelogs: syncedCount, // Combined count for now
        activity: 0,
        screenshots: screenshotCount,
    };
}

// ─── Queue Status ───────────────────────────────────────────

export async function getSyncStatus(): Promise<{
    pendingTimeLogs: number;
    pendingActivity: number;
    pendingScreenshots: number;
    total: number;
}> {
    const db = await getSyncDB();
    const allItems = await db.getAll('syncQueue');
    const pendingTimeLogs = allItems.filter((i) => i.type === 'timelog').length;
    const pendingActivity = allItems.filter((i) => i.type === 'activity').length;
    const pendingScreenshots = await getQueueSize();

    return {
        pendingTimeLogs,
        pendingActivity,
        pendingScreenshots,
        total: pendingTimeLogs + pendingActivity + pendingScreenshots,
    };
}

// ─── Auto-Sync Listener ────────────────────────────────────

export function startSyncManager(): () => void {
    const handleOnline = async () => {
        console.log('[SyncManager] Back online, triggering full sync...');
        try {
            await syncAll();
        } catch (err) {
            console.error('[SyncManager] Auto-sync failed:', err);
        }
    };

    window.addEventListener('online', handleOnline);

    // Initial sync attempt
    if (navigator.onLine) {
        syncAll().catch(() => {});
    }

    // Periodic sync every 5 minutes
    const intervalId = setInterval(async () => {
        if (navigator.onLine) {
            try {
                const status = await getSyncStatus();
                if (status.total > 0) {
                    await syncAll();
                }
            } catch (err) {
                // Silent fail for periodic sync
            }
        }
    }, 5 * 60 * 1000);

    return () => {
        window.removeEventListener('online', handleOnline);
        clearInterval(intervalId);
    };
}
