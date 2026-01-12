// Import all dependencies directly
// Common utilities
import { log, isNull, isEmpty, isNotEmpty, calculateBlobSHA, getVersion } from "@/commons/util.js";
import { getStats, getHook, getObjectFromLocalStorage, getObjectFromSyncStorage, saveObjectInLocalStorage, saveObjectInSyncStorage, saveStats, updateLocalStorageStats } from "@/commons/storage.js";
import { Toast } from "@/commons/toast.js";
import { checkEnable } from "@/commons/enable.js";
import { STORAGE_KEYS } from "@/constants/registry.js";

// Platform-specific utilities
import { languages, uploadState } from "@/swexpertacademy/variables.js";
import { parseCode, parseData } from "@/swexpertacademy/parsing.js";
import uploadOneSolveProblemOnGit from "@/swexpertacademy/uploadfunctions.js";
import { startUpload, markUploadedCSS, getNickname, makeSubmitButton } from "@/swexpertacademy/util.js";

/**
 * Capture nickname for SSAFY Today registration
 * Checks if capture mode is enabled and saves the nickname
 */
async function captureNicknameForRegistration() {
  try {
    const captureMode = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_MODE);
    const capturePlatform = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_PLATFORM);

    if (captureMode && capturePlatform === "swea") {
      const nickname = getNickname();
      if (nickname) {
        await saveObjectInLocalStorage({
          [STORAGE_KEYS.PLATFORM_SWEA_NICKNAME]: nickname,
          [STORAGE_KEYS.CAPTURE_MODE]: false,
          [STORAGE_KEYS.CAPTURE_PLATFORM]: null,
        });
        log(`[SsafyToday] Captured SWEA nickname: ${nickname}`);

        // Show toast notification
        Toast.show(`SWEA 닉네임 '${nickname}'이(가) 연동되었습니다.`, "success");
      }
    }
  } catch (error) {
    console.error("[SsafyToday] Error capturing nickname:", error);
  }
}

// Run capture check on page load
captureNicknameForRegistration();
