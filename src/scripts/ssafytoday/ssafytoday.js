/**
 * SsafyToday Content Script for ssafy.today registration page
 * Handles communication between the registration page and the extension
 */

import { STORAGE_KEYS } from "@/constants/registry.js";
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage.js";
import { getVersion } from "@/commons/storage.js";

// Event types for communication
const EVENTS = {
  CHECK: "SSAFY_TODAY_CHECK",
  RESPONSE: "SSAFY_TODAY_RESPONSE",
  GET_CREDENTIALS: "SSAFY_TODAY_GET_CREDENTIALS",
  CREDENTIALS: "SSAFY_TODAY_CREDENTIALS",
  CAPTURE_MODE: "SSAFY_TODAY_CAPTURE_MODE",
  CLEAR_CREDENTIALS: "SSAFY_TODAY_CLEAR_CREDENTIALS",
};

/**
 * Send credentials to the webpage
 */
async function sendCredentialsToPage() {
  const baekjoon = await getObjectFromLocalStorage(STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME);
  const programmers = await getObjectFromLocalStorage(STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME);
  const swea = await getObjectFromLocalStorage(STORAGE_KEYS.PLATFORM_SWEA_NICKNAME);
  const github = await getObjectFromLocalStorage(STORAGE_KEYS.USERNAME);

  window.postMessage(
    {
      type: EVENTS.CREDENTIALS,
      baekjoon_username: baekjoon || "",
      programmers_username: programmers || "",
      swea_nickname: swea || "",
      github_username: github || "",
    },
    "*"
  );
}

/**
 * Handle messages from the webpage
 */
async function handleMessage(event) {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const { type, platform } = event.data || {};

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
        "*"
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
          [STORAGE_KEYS.CAPTURE_PLATFORM]: platform,
        });
        console.log(`[SsafyToday] Capture mode enabled for: ${platform}`);
      }
      break;

    // Clear stored credentials
    case EVENTS.CLEAR_CREDENTIALS:
      await saveObjectInLocalStorage({
        [STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME]: "",
        [STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME]: "",
        [STORAGE_KEYS.PLATFORM_SWEA_NICKNAME]: "",
      });
      console.log("[SsafyToday] Credentials cleared");
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
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== "local") return;

    const credentialKeys = [
      STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME,
      STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME,
      STORAGE_KEYS.PLATFORM_SWEA_NICKNAME,
    ];

    const hasCredentialChange = Object.keys(changes).some((key) => credentialKeys.includes(key));

    if (hasCredentialChange) {
      console.log("[SsafyToday] Credentials changed, notifying page");
      sendCredentialsToPage();
    }
  });
}

/**
 * Initialize the content script
 */
function init() {
  // Listen for messages from the webpage
  window.addEventListener("message", handleMessage);

  // Setup storage change listener
  setupStorageListener();

  // Send initial credentials (in case page loads after credentials are already stored)
  setTimeout(sendCredentialsToPage, 500);

  console.log("[SsafyToday] Content script loaded for ssafy.today");
}

// Run initialization
init();
