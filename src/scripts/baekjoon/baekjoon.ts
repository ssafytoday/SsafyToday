// Import all dependencies directly
// Common utilities
import { log } from '@/commons/util';
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from '@/commons/storage';
import { Toast } from '@/commons/toast';
// checkEnable import removed - unused in this file
import { STORAGE_KEYS } from '@/constants/registry';

// Platform-specific utilities
import { uploadState, multiloader } from '@/baekjoon/variables';
import { findUsername, startUpload, markUploadedCSS } from '@/baekjoon/util';
import uploadOneSolveProblemOnGit from '@/baekjoon/uploadfunctions';

/**
 * Capture username for SSAFY Today registration
 * Checks if capture mode is enabled and saves the username
 */
async function captureUsernameForRegistration(): Promise<void> {
  try {
    const captureMode = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_MODE);
    const capturePlatform = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_PLATFORM);

    if (captureMode && (capturePlatform as string) === 'baekjoon') {
      const username = findUsername();
      if (username) {
        await saveObjectInLocalStorage({
          [STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME]: username,
          [STORAGE_KEYS.CAPTURE_MODE]: false,
          [STORAGE_KEYS.CAPTURE_PLATFORM]: null,
        });
        log(`[SsafyToday] Captured Baekjoon username: ${username}`);

        // Show toast notification
        Toast.raiseToast(`백준 아이디 '${username}'이(가) 연동되었습니다.`, 5000);
      }
    }
  } catch (error) {
    console.error('[SsafyToday] Error capturing username:', error);
  }
}

// Run capture check on page load
captureUsernameForRegistration();

// Export for module usage
export {
  uploadState,
  multiloader,
  findUsername,
  startUpload,
  markUploadedCSS,
  uploadOneSolveProblemOnGit,
  captureUsernameForRegistration,
};
