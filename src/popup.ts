/**
 * SsafyToday Popup Entry Point
 * Handles popup UI state management
 */
import log from "@/commons/logger";
import { STORAGE_KEYS } from "@/constants/registry";
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage";

// DOM Elements interface
interface PopupElements {
  settingsUrl: HTMLElement | null;
  enablePopup: HTMLInputElement | null;
}

/**
 * Get popup DOM elements
 */
function getElements(): PopupElements {
  return {
    settingsUrl: document.querySelector("#settings_URL"),
    enablePopup: document.querySelector("#enable_popup"),
  };
}

/**
 * Wire up the enable/disable toggle and reflect stored state
 */
async function initEnableToggle(): Promise<void> {
  const { enablePopup } = getElements();
  if (!enablePopup) return;

  const enableStatus = (await getObjectFromLocalStorage(STORAGE_KEYS.ENABLE)) as boolean | undefined;
  log.info(`initEnableToggle: Enable status: ${enableStatus}`);

  // 최초 실행(미설정)이면 켜진 상태를 기본값으로 저장
  if (enableStatus === undefined) {
    enablePopup.checked = true;
    await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: true });
  } else {
    enablePopup.checked = enableStatus;
  }

  enablePopup.addEventListener("change", async () => {
    log.info(`initEnableToggle: Enable switch changed to ${enablePopup.checked}`);
    await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: enablePopup.checked });
  });
}

/**
 * Set settings page URL
 */
function setSettingsUrl(): void {
  const { settingsUrl } = getElements();
  const extensionUrl = `chrome-extension://${chrome.runtime.id}/settings.html`;

  if (settingsUrl) {
    settingsUrl.setAttribute("href", extensionUrl);
  }
}

/**
 * Handle storage changes made elsewhere (e.g. the settings page)
 */
function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  namespace: string
): void {
  if (namespace !== "local" || !changes[STORAGE_KEYS.ENABLE]) return;

  const { enablePopup } = getElements();
  const newValue = changes[STORAGE_KEYS.ENABLE].newValue as boolean | undefined;
  if (enablePopup && typeof newValue === "boolean") {
    enablePopup.checked = newValue;
  }
}

/**
 * Initialize popup
 */
function init(): void {
  log.info("DOMContentLoaded: Initializing popup page.");

  setSettingsUrl();
  void initEnableToggle();
}

// DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", init);

// Storage change listener
chrome.storage.onChanged.addListener(handleStorageChange);
