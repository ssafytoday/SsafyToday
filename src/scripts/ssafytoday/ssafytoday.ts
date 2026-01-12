/**
 * SsafyToday Content Script for ssafy.today registration page
 * Handles communication between the registration page and the extension
 */

import { STORAGE_KEYS } from '@/constants/registry';
import { getObjectFromLocalStorage, saveObjectInLocalStorage, getVersion } from '@/commons/storage';
import type { CapturePlatformType } from '@types';

// Event types for communication
const EVENTS = {
  CHECK: 'SSAFY_TODAY_CHECK',
  RESPONSE: 'SSAFY_TODAY_RESPONSE',
  GET_CREDENTIALS: 'SSAFY_TODAY_GET_CREDENTIALS',
  CREDENTIALS: 'SSAFY_TODAY_CREDENTIALS',
  CAPTURE_MODE: 'SSAFY_TODAY_CAPTURE_MODE',
  CLEAR_CREDENTIALS: 'SSAFY_TODAY_CLEAR_CREDENTIALS',
} as const;

interface ExtensionMessage {
  type: string;
  platform?: string;
  [key: string]: unknown;
}

/**
 * Send credentials to the webpage
 */
async function sendCredentialsToPage(): Promise<void> {
  const baekjoon = await getObjectFromLocalStorage(STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME);
  const programmers = await getObjectFromLocalStorage(STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME);
  const swea = await getObjectFromLocalStorage(STORAGE_KEYS.PLATFORM_SWEA_NICKNAME);
  const github = await getObjectFromLocalStorage(STORAGE_KEYS.USERNAME);

  window.postMessage(
    {
      type: EVENTS.CREDENTIALS,
      baekjoon_username: baekjoon || '',
      programmers_username: programmers || '',
      swea_nickname: swea || '',
      github_username: github || '',
    },
    '*'
  );
}

/**
 * Handle messages from the webpage
 */
async function handleMessage(event: MessageEvent): Promise<void> {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const { type, platform } = (event.data as ExtensionMessage) || {};

  switch (type) {
    // Extension check request
    case EVENTS.CHECK:
      window.postMessage(
        {
          type: EVENTS.RESPONSE,
          installed: true,
          verified: true,
          version: getVersion(),
          extensionId: chrome.runtime.id,
        },
        '*'
      );
      break;

    // Get stored credentials
    case EVENTS.GET_CREDENTIALS:
      await sendCredentialsToPage();
      break;

    // Enable capture mode for a specific platform
    case EVENTS.CAPTURE_MODE:
      if (platform) {
        await saveObjectInLocalStorage({
          [STORAGE_KEYS.CAPTURE_MODE]: true,
          [STORAGE_KEYS.CAPTURE_PLATFORM]: platform as CapturePlatformType,
        });
        console.log(`[SsafyToday] Capture mode enabled for: ${platform}`);
      }
      break;

    // Clear stored credentials
    case EVENTS.CLEAR_CREDENTIALS:
      await saveObjectInLocalStorage({
        [STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME]: '',
        [STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME]: '',
        [STORAGE_KEYS.PLATFORM_SWEA_NICKNAME]: '',
      });
      console.log('[SsafyToday] Credentials cleared');
      await sendCredentialsToPage();
      break;

    default:
      // Ignore unknown message types
      break;
  }
}

/**
 * Listen for storage changes and notify the page
 */
function setupStorageListener(): void {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    const credentialKeys = [
      STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME,
      STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME,
      STORAGE_KEYS.PLATFORM_SWEA_NICKNAME,
    ];

    const hasCredentialChange = Object.keys(changes).some((key) =>
      credentialKeys.includes(key as typeof credentialKeys[number])
    );

    if (hasCredentialChange) {
      console.log('[SsafyToday] Credentials changed, notifying page');
      sendCredentialsToPage();
    }
  });
}

/**
 * Initialize the content script
 */
function init(): void {
  // Listen for messages from the webpage
  window.addEventListener('message', handleMessage);

  // Setup storage change listener
  setupStorageListener();

  // Send initial credentials (in case page loads after credentials are already stored)
  setTimeout(sendCredentialsToPage, 500);

  console.log('[SsafyToday] Content script loaded for ssafy.today');
}

// Run initialization
init();
