// Import all dependencies directly
// Common utilities
import { log, isNull, isEmpty, isNotEmpty, preProcessEmptyObj, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage, saveStats, updateLocalStorageStats } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";
import { STORAGE_KEYS } from "@/constants/registry.js";

// Platform-specific utilities
import { languages, bjLevel, RESULT_CATEGORY, RESULT_MESSAGE, uploadState, multiloader } from "@/baekjoon/variables.js";
import { findUsername, startUpload, markUploadedCSS } from "@/baekjoon/util.js";
import uploadOneSolveProblemOnGit from "@/baekjoon/uploadfunctions.js";

/**
 * Capture username for SSAFY Today registration
 * Checks if capture mode is enabled and saves the username
 */
async function captureUsernameForRegistration() {
  try {
    const captureMode = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_MODE);
    const capturePlatform = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_PLATFORM);

    if (captureMode && capturePlatform === "baekjoon") {
      const username = findUsername();
      if (username) {
        await saveObjectInLocalStorage({
          [STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME]: username,
          [STORAGE_KEYS.CAPTURE_MODE]: false,
          [STORAGE_KEYS.CAPTURE_PLATFORM]: null,
        });
        log(`[SsafyToday] Captured Baekjoon username: ${username}`);

        // Show toast notification
        Toast.show(`백준 아이디 '${username}'이(가) 연동되었습니다.`, "success");
      }
    }
  } catch (error) {
    console.error("[SsafyToday] Error capturing username:", error);
  }
}

// Run capture check on page load
captureUsernameForRegistration();
