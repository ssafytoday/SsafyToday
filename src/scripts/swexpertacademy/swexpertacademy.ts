// Import all dependencies directly
// Common utilities
import { log } from '@/commons/util';
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from '@/commons/storage';
import { Toast } from '@/commons/toast';
import { STORAGE_KEYS } from '@/constants/registry';

// Platform-specific utilities
import { languages, uploadState } from '@/swexpertacademy/variables';
import { parseCode, parseData } from '@/swexpertacademy/parsing';
import uploadOneSolveProblemOnGit from '@/swexpertacademy/uploadfunctions';
import { startUpload, markUploadedCSS, getNickname, makeSubmitButton } from '@/swexpertacademy/util';

/**
 * Capture nickname for SSAFY Today registration
 * Checks if capture mode is enabled and saves the nickname
 */
async function captureNicknameForRegistration(): Promise<void> {
  try {
    const captureMode = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_MODE);
    const capturePlatform = await getObjectFromLocalStorage(STORAGE_KEYS.CAPTURE_PLATFORM);

    if (captureMode && (capturePlatform as string) === 'swea') {
      const nickname = getNickname();
      if (nickname) {
        await saveObjectInLocalStorage({
          [STORAGE_KEYS.PLATFORM_SWEA_NICKNAME]: nickname,
          [STORAGE_KEYS.CAPTURE_MODE]: false,
          [STORAGE_KEYS.CAPTURE_PLATFORM]: null,
        });
        log(`[SsafyToday] Captured SWEA nickname: ${nickname}`);

        // Show toast notification
        Toast.raiseToast(`SWEA 닉네임 '${nickname}'이(가) 연동되었습니다.`, 5000);
      }
    }
  } catch (error) {
    console.error('[SsafyToday] Error capturing nickname:', error);
  }
}

// Run capture check on page load
captureNicknameForRegistration();

// Export for module usage
export {
  parseCode,
  parseData,
  uploadOneSolveProblemOnGit,
  startUpload,
  markUploadedCSS,
  getNickname,
  makeSubmitButton,
  languages,
  uploadState,
  captureNicknameForRegistration,
};
