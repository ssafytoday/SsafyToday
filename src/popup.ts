import beginOAuth2 from '@/commons/oauth2';
import { STORAGE_KEYS } from '@/constants/registry';
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from '@/commons/storage';

let isAuthActionAllowed = false;

/**
 * GitHub 인증 흐름을 처리합니다.
 */
const handleAuthentication = async (): Promise<void> => {
  console.log('[Popup] handleAuthentication called');
  console.log('[Popup] Storage keys:', {
    TOKEN: STORAGE_KEYS.TOKEN,
    MODE_TYPE: STORAGE_KEYS.MODE_TYPE,
    HOOK: STORAGE_KEYS.HOOK,
  });
  const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);
  console.log('[Popup] Token exists:', !!token);

  if (token === null || token === undefined) {
    isAuthActionAllowed = true;
    const authModeEl = document.querySelector('#auth_mode') as HTMLElement | null;
    if (authModeEl) {
      authModeEl.style.display = 'block';
      authModeEl.removeAttribute('hidden');
    }
  } else {
    const AUTHENTICATION_URL = 'https://api.github.com/user';
    try {
      const response = await fetch(AUTHENTICATION_URL, {
        method: 'GET',
        headers: {
          Authorization: `token ${token}`,
        },
      });

      if (response.ok) {
        console.log('[Popup] GitHub API response OK');
        const modeType = await getObjectFromLocalStorage(STORAGE_KEYS.MODE_TYPE);
        console.log('[Popup] modeType loaded:', modeType, '(key:', STORAGE_KEYS.MODE_TYPE, ')');
        if (modeType === 'commit') {
          console.log('[Popup] Showing commit_mode');
          const commitModeEl = document.querySelector('#commit_mode') as HTMLElement | null;
          if (commitModeEl) {
            commitModeEl.style.display = 'block';
            commitModeEl.removeAttribute('hidden');
          }
          const hook = await getObjectFromLocalStorage(STORAGE_KEYS.HOOK);
          console.log('[Popup] hook loaded:', hook, '(key:', STORAGE_KEYS.HOOK, ')');
          if (hook) {
            const repoUrlEl = document.querySelector('#repo_url');
            if (repoUrlEl) {
              repoUrlEl.innerHTML = `Your Repo: <a target='_blank' style='color: cadetblue !important;' href='https://github.com/${hook}'>${hook}</a>`;
            }
          }
        } else {
          console.log("[Popup] Showing hook_mode (modeType is not 'commit')");
          const hookModeEl = document.querySelector('#hook_mode') as HTMLElement | null;
          if (hookModeEl) {
            hookModeEl.style.display = 'block';
            hookModeEl.removeAttribute('hidden');
          }
        }
      } else if (response.status === 401) {
        // Bad OAuth token, reset and re-authenticate
        await saveObjectInLocalStorage({ [STORAGE_KEYS.TOKEN]: undefined });
        console.log('BAD oAuth!!! Redirecting back to oAuth process');
        isAuthActionAllowed = true;
        const authModeEl = document.querySelector('#auth_mode') as HTMLElement | null;
        if (authModeEl) {
          authModeEl.style.display = 'block';
          authModeEl.removeAttribute('hidden');
        }
      } else {
        console.error('Authentication failed with status:', response.status);
        // Handle other errors if necessary
      }
    } catch (error) {
      console.error('Error during authentication:', error);
      // Handle network errors or other exceptions
    }
  }
};

/**
 * 기능 활성화/비활성화 스위치를 초기화합니다.
 */
const initializeOnOffSwitch = async (): Promise<void> => {
  const bjhEnable = await getObjectFromLocalStorage(STORAGE_KEYS.ENABLE);
  const onOffBox = document.querySelector('#onffbox') as HTMLInputElement | null;

  if (!onOffBox) return;

  if (bjhEnable === undefined) {
    onOffBox.checked = true;
    await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: onOffBox.checked });
  } else {
    onOffBox.checked = bjhEnable as boolean;
    await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: onOffBox.checked });
  }

  onOffBox.addEventListener('click', () => {
    saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: onOffBox.checked });
  });
};

/**
 * 설정 및 훅 페이지 URL을 설정합니다.
 */
const setSettingsAndHookUrls = (): void => {
  const settingsUrlEl = document.querySelector('#settings_URL');
  const hookUrlEl = document.querySelector('#hook_URL');

  if (settingsUrlEl) {
    settingsUrlEl.setAttribute('href', `chrome-extension://${chrome.runtime.id}/settings.html`);
  }
  if (hookUrlEl) {
    hookUrlEl.setAttribute('href', `chrome-extension://${chrome.runtime.id}/settings.html`);
  }
};

// DOMContentLoaded 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
  const authenticateBtn = document.querySelector('#authenticate');
  if (authenticateBtn) {
    authenticateBtn.addEventListener('click', () => {
      if (isAuthActionAllowed) {
        beginOAuth2();
      }
    });
  }

  setSettingsAndHookUrls();
  handleAuthentication();
  initializeOnOffSwitch();
});
