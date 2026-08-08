/**
 * Storage-related type definitions
 */

// Stats object structure
export interface Stats {
  version?: string;
  problems?: Record<string, unknown>;
  [cacheName: string]: string | Record<string, unknown> | undefined;
}

// Storage data structure
export interface StorageData {
  [key: string]: unknown;
  stats?: Stats;
  enable?: boolean;
}

// Chrome storage areas
export type StorageArea = 'local' | 'sync';

// Storage batch update
export interface BatchUpdate {
  key: string;
  value: unknown;
}
