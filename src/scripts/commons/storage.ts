/**
 * Chrome Storage API wrapper for SsafyToday
 * Provides typed access to chrome.storage.local and chrome.storage.sync
 *
 * Refactored to use ChromeStorageAdapter for better separation of concerns
 */

import { STORAGE_KEYS } from "@/constants/registry";
import log from "@/commons/logger";
import { chromeStorageAdapter } from "./storage-adapter";
import type { Stats } from "@/types/storage";

/**
 * Get current extension version
 * @returns The current extension version
 */
export function getVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * Get object from Chrome Local Storage
 * @param key - Storage key or array of keys
 * @returns Promise resolving to stored value
 */
export async function getObjectFromLocalStorage<T = unknown>(key: string | string[]): Promise<T | undefined> {
  log.info("storage.ts: getObjectFromLocalStorage called with key:", key);
  return chromeStorageAdapter.get<T>(key, "local");
}

/**
 * Save object to Chrome Local Storage
 * @param obj - Object to save
 */
export async function saveObjectInLocalStorage(obj: Record<string, unknown>): Promise<void> {
  log.info("storage.ts: saveObjectInLocalStorage called with obj:", obj);
  return chromeStorageAdapter.set(obj, "local");
}

/**
 * Remove object from Chrome Local Storage
 * @param keys - Key or array of keys to remove
 */
export async function removeObjectFromLocalStorage(keys: string | string[]): Promise<void> {
  log.info("storage.ts: removeObjectFromLocalStorage called with keys:", keys);
  return chromeStorageAdapter.remove(keys, "local");
}

/**
 * Get object from Chrome Sync Storage
 * @param key - Storage key
 * @returns Promise resolving to stored value
 */
export async function getObjectFromSyncStorage<T = unknown>(key: string): Promise<T | undefined> {
  log.info("storage.ts: getObjectFromSyncStorage called with key:", key);
  return chromeStorageAdapter.get<T>(key, "sync");
}

/**
 * Save object to Chrome Sync Storage
 * @param obj - Object to save
 */
export async function saveObjectInSyncStorage(obj: Record<string, unknown>): Promise<void> {
  log.info("storage.ts: saveObjectInSyncStorage called with obj:", obj);
  return chromeStorageAdapter.set(obj, "sync");
}

/**
 * Remove object from Chrome Sync Storage
 * @param keys - Key or array of keys to remove
 */
export async function removeObjectFromSyncStorage(keys: string | string[]): Promise<void> {
  log.info("storage.ts: removeObjectFromSyncStorage called with keys:", keys);
  return chromeStorageAdapter.remove(keys, "sync");
}

// ============ Convenience getters/setters ============

export async function getStats(): Promise<Stats> {
  const stats = await getObjectFromLocalStorage<Stats>(STORAGE_KEYS.STATS);

  // Return default object if stats is null or undefined
  if (!stats) {
    const defaultStats: Stats = {
      version: "0.0.0",
      problems: {},
    };
    await saveStats(defaultStats);
    return defaultStats;
  }

  // Ensure all required fields exist
  if (!stats.problems) stats.problems = {};
  if (!stats.version) stats.version = "0.0.0";

  return stats;
}

export async function saveStats(stats: Stats): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.STATS]: stats });
}

/**
 * Initialize storage
 */
export function initializeStorage(): void {
  getStats().then((stats) => {
    let needsUpdate = false;

    if (!stats.version || stats.version === "0.0.0") {
      stats.version = getVersion();
      needsUpdate = true;
    }

    if (!stats.problems || stats.version !== getVersion()) {
      stats.problems = {};
      needsUpdate = true;
    }

    if (stats.version !== getVersion()) {
      stats.version = getVersion();
      needsUpdate = true;
    }

    if (needsUpdate) {
      saveStats(stats);
    }
  });
}
