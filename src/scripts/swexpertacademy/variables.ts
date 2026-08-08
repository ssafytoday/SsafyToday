/**
 * SW Expert Academy Hub global variables declaration file
 * Includes constants and shared state
 */
import { createUploadState } from "@/commons/shared-state";
import type { UploadState } from "@/types/platform";

// Upload state using shared factory
export const uploadState: UploadState = createUploadState();
