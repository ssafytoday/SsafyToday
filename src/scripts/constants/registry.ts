/**
 * Storage keys registry for SsafyToday
 * NOTE: Storage key values retain 'baekjoonhub_' prefix for backward compatibility
 */

export const STORAGE_KEYS = {
  TOKEN: "baekjoonhub_token",
  USERNAME: "baekjoonhub_username",
  HOOK: "baekjoonhub_hook",
  ORG_OPTION: "baekjoonhub_org_option",
  USE_CUSTOM_TEMPLATE: "baekjoonhub_use_custom_template",
  DIR_TEMPLATE: "baekjoonhub_dir_template",
  STATS: "baekjoonhub_stats",
  MODE_TYPE: "baekjoonhub_mode_type",
  ENABLE: "baekjoonhub_enable",
  PIPE: "baekjoonhub_pipe",
  IS_SYNC: "baekjoonhub_is_sync",
  SWEA: "baekjoonhub_swea",
  MIGRATION_VERSION: "baekjoonhub_migration_version",
  // Platform usernames for registration
  PLATFORM_BAEKJOON_USERNAME: "platform_baekjoon_username",
  PLATFORM_PROGRAMMERS_USERNAME: "platform_programmers_username",
  PLATFORM_SWEA_NICKNAME: "platform_swea_nickname",
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;
export type StorageKeyValue = (typeof STORAGE_KEYS)[StorageKey];
