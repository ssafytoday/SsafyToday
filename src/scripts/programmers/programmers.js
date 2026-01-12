// Import all dependencies directly
// Common utilities
import { log, isNull, isEmpty, isNotEmpty, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage, saveStats, updateLocalStorageStats } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";
import { STORAGE_KEYS } from "@/constants/registry.js";

// Platform-specific utilities
import { parseData } from "@/programmers/parsing.js";
import uploadOneSolveProblemOnGit from "@/programmers/uploadfunctions.js";
import { startUpload, markUploadedCSS, getUsername } from "@/programmers/util.js";
import { levels, uploadState } from "@/programmers/variables.js";

/**
 * Capture username for SSAFY Today registration
 * Checks if capture mode is enabled and saves the username
 */
async function captureUsernameForRegistration() {
  try {
    const captureMode = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_MODE);
    const capturePlatform = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_PLATFORM);

    if (captureMode && capturePlatform === "programmers") {
      const username = getUsername();
      if (username) {
        await saveObjectInLocalStorage({
          [STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME]: username,
          [STORAGE_KEYS.CAPTURE_MODE]: false,
          [STORAGE_KEYS.CAPTURE_PLATFORM]: null,
        });
        log(`[SsafyToday] Captured Programmers username: ${username}`);

        // Show toast notification
        Toast.show(`프로그래머스 아이디 '${username}'이(가) 연동되었습니다.`, "success");
      }
    }
  } catch (error) {
    console.error("[SsafyToday] Error capturing username:", error);
  }
}

// Run capture check on page load
captureUsernameForRegistration();
