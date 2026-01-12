// Import all dependencies directly
// Common utilities
import { log } from '@/commons/util';
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from '@/commons/storage';
import { Toast } from '@/commons/toast';
import { STORAGE_KEYS } from '@/constants/registry';

// Platform-specific utilities
import { parseData } from '@/programmers/parsing';
import uploadOneSolveProblemOnGit from '@/programmers/uploadfunctions';
import { startUpload, markUploadedCSS, getUsername } from '@/programmers/util';
import { levels, uploadState } from '@/programmers/variables';

/**
 * Capture username for SSAFY Today registration
 * Checks if capture mode is enabled and saves the username
 */
async function captureUsernameForRegistration(): Promise<void> {
  try {
    const captureMode = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_MODE);
    const capturePlatform = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_PLATFORM);

    if (captureMode && (capturePlatform as string) === 'programmers') {
      const username = getUsername();
      if (username) {
        await saveObjectInLocalStorage({
          [STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME]: username,
          [STORAGE_KEYS.CAPTURE_MODE]: false,
          [STORAGE_KEYS.CAPTURE_PLATFORM]: null,
        });
        log(`[SsafyToday] Captured Programmers username: ${username}`);

        // Show toast notification
        Toast.raiseToast(`프로그래머스 아이디 '${username}'이(가) 연동되었습니다.`, 5000);
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
  parseData,
  uploadOneSolveProblemOnGit,
  startUpload,
  markUploadedCSS,
  getUsername,
  levels,
  uploadState,
  captureUsernameForRegistration,
};
