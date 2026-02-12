import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

// ============================================================
// KormoSync Desktop - History Cache (IndexedDB)
// Caches timelog/screenshot entries by date for offline access.
// Also stores locally captured entries for real-time History UI.
// ============================================================

export interface CachedTimeLog {
    id: string;
    recordedAt: string;
    imageUrl?: string;
    activityScore: number;
    keyboardCount: number;
    mouseCount: number;
    duration: number;
    taskId?: string;
    synced: boolean; // true = server-confirmed, false = local/pending
}

const DB_NAME = 'kormosync-history';
const DB_VERSION = 1;
const STORE_NAME = 'history-cache';

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
    if (dbInstance) return dbInstance;
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
    return dbInstance;
}

/**
 * Cache history logs for a specific date after successful API fetch.
 * All entries from API are marked as synced: true.
 */
export async function cacheHistoryLogs(date: string, logs: CachedTimeLog[]): Promise<void> {
    try {
        const db = await getDB();
        // Mark all API entries as synced
        const syncedLogs = logs.map(log => ({ ...log, synced: true }));

        // Merge with any existing local (unsynced) entries for this date
        const existing = await db.get(STORE_NAME, `logs-${date}`);
        let localEntries: CachedTimeLog[] = [];
        if (existing?.logs) {
            // Keep local entries that haven't been synced and don't match API entries
            // Use both ID and timestamp matching since local IDs (auto-increment) differ from server UUIDs
            const apiIds = new Set(syncedLogs.map(l => l.id));
            const apiTimestamps = new Set(syncedLogs.map(l => new Date(l.recordedAt).getTime()));
            localEntries = existing.logs.filter(
                (l: CachedTimeLog) => !l.synced && !apiIds.has(l.id) &&
                    !apiTimestamps.has(new Date(l.recordedAt).getTime())
            );
        }

        const merged = [...syncedLogs, ...localEntries].sort(
            (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        );

        await db.put(STORE_NAME, {
            logs: merged,
            cachedAt: new Date().toISOString(),
        }, `logs-${date}`);
        console.log(`📋 History cached: ${merged.length} entries for ${date} (${localEntries.length} local)`);
    } catch (err) {
        console.warn('Failed to cache history logs:', err);
    }
}

/**
 * Get cached history logs for a specific date.
 */
export async function getCachedHistoryLogs(date: string): Promise<{ logs: CachedTimeLog[]; cachedAt: string } | null> {
    try {
        const db = await getDB();
        const cached = await db.get(STORE_NAME, `logs-${date}`);
        if (cached && cached.logs && cached.logs.length > 0) {
            console.log(`📋 Loaded ${cached.logs.length} cached history entries for ${date}`);
            return cached;
        }
        return null;
    } catch (err) {
        console.warn('Failed to read history cache:', err);
        return null;
    }
}

/**
 * Add a single local history entry (e.g., when a screenshot is captured).
 * This makes it appear immediately in the History page.
 */
export async function addLocalHistoryEntry(date: string, entry: CachedTimeLog): Promise<void> {
    try {
        const db = await getDB();
        const existing = await db.get(STORE_NAME, `logs-${date}`);
        const logs: CachedTimeLog[] = existing?.logs || [];

        // Prepend new entry (most recent first)
        logs.unshift(entry);

        await db.put(STORE_NAME, {
            logs,
            cachedAt: new Date().toISOString(),
        }, `logs-${date}`);
        console.log(`📋 Local history entry added for ${date}: ${entry.id}`);
    } catch (err) {
        console.warn('Failed to add local history entry:', err);
    }
}

/**
 * Clear all history cache (e.g., on logout).
 */
export async function clearHistoryCache(): Promise<void> {
    try {
        const db = await getDB();
        await db.clear(STORE_NAME);
        console.log('📋 History cache cleared');
    } catch (err) {
        console.warn('Failed to clear history cache:', err);
    }
}
