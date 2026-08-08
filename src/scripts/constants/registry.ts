/**
 * Storage keys registry for SsafyToday
 * NOTE: Storage key values retain 'baekjoonhub_' prefix for backward compatibility
 */

export const STORAGE_KEYS = {
  STATS: "baekjoonhub_stats",
  ENABLE: "baekjoonhub_enable",
  // Platform usernames for registration
  PLATFORM_BAEKJOON_USERNAME: "platform_baekjoon_username",
  PLATFORM_PROGRAMMERS_USERNAME: "platform_programmers_username",
  PLATFORM_SWEA_NICKNAME: "platform_swea_nickname",
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;
export type StorageKeyValue = (typeof STORAGE_KEYS)[StorageKey];
