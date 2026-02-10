import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Task } from '../types';

// ============================================================
// KormoSync Desktop - Task Cache (IndexedDB)
// Caches tasks locally so the app works offline.
// When API is unreachable, serves tasks from cache.
// ============================================================

const DB_NAME = 'kormosync-tasks';
const DB_VERSION = 1;
const STORE_NAME = 'task-cache';

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
 * Cache tasks to IndexedDB after a successful API fetch.
 * Stores the full task array + timestamp.
 */
export async function cacheTasks(tasks: Task[]): Promise<void> {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, {
            tasks,
            cachedAt: new Date().toISOString(),
        }, 'latest');
        console.log(`📦 Tasks cached: ${tasks.length} tasks`);
    } catch (err) {
        console.warn('Failed to cache tasks:', err);
    }
}

/**
 * Get cached tasks from IndexedDB.
 * Returns null if no cache exists.
 */
export async function getCachedTasks(): Promise<{ tasks: Task[]; cachedAt: string } | null> {
    try {
        const db = await getDB();
        const cached = await db.get(STORE_NAME, 'latest');
        if (cached && cached.tasks && cached.tasks.length > 0) {
            console.log(`📦 Loaded ${cached.tasks.length} cached tasks (from ${cached.cachedAt})`);
            return cached;
        }
        return null;
    } catch (err) {
        console.warn('Failed to read task cache:', err);
        return null;
    }
}

/**
 * Clear the task cache (e.g., on logout).
 */
export async function clearTaskCache(): Promise<void> {
    try {
        const db = await getDB();
        await db.delete(STORE_NAME, 'latest');
    } catch (err) {
        console.warn('Failed to clear task cache:', err);
    }
}
