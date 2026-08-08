/**
 * SsafyToday Settings Entry Point
 * Handles settings page UI and ssafy.today connection status
 */
import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "./scripts/commons/storage";
import { STORAGE_KEYS } from "./scripts/constants/registry";
import log from "./scripts/commons/logger";

const SSAFY_HEALTH_URL = "https://ssafy.today/api/submissions/health/";

// Interfaces
interface AppSettings {
  autoUpload: boolean;
}

interface SettingsElements {
  errorMessage: HTMLElement | null;
  successMessage: HTMLElement | null;
  autoUpload: HTMLInputElement | null;
  ssafyStatusBadge: HTMLElement | null;
  testSsafyConnection: HTMLButtonElement | null;
}

// Settings state
const appSettings: AppSettings = {
  autoUpload: true,
};

// DOM elements (initialized after DOM load)
let elements: SettingsElements;

/**
 * Initialize DOM elements
 */
function initElements(): void {
  elements = {
    errorMessage: document.getElementById("errorMessage"),
    successMessage: document.getElementById("successMessage"),
    autoUpload: document.getElementById("autoUpload") as HTMLInputElement | null,
    ssafyStatusBadge: document.getElementById("ssafyStatusBadge"),
    testSsafyConnection: document.getElementById("testSsafyConnection") as HTMLButtonElement | null,
  };
}

/**
 * Show message notification
 */
function showMessage(type: "error" | "success", text: string, autoHide = true): void {
  const messageEl = type === "error" ? elements.errorMessage : elements.successMessage;
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.style.display = "block";

  if (autoHide) {
    setTimeout(() => {
      messageEl.style.display = "none";
    }, 5000);
  }
}

/**
 * Load stored settings
 */
async function loadSettings(): Promise<void> {
  try {
    const enabled = (await getObjectFromLocalStorage(STORAGE_KEYS.ENABLE)) as boolean | undefined;

    appSettings.autoUpload = enabled !== false;

    // ENABLE이 설정되지 않은 기존 사용자를 위해 자동으로 초기화
    if (enabled === undefined) {
      await saveObjectInLocalStorage({ [STORAGE_KEYS.ENABLE]: true });
    }
  } catch (error) {
    log.error("Settings load error:", error);
  }
}

/**
 * Update form values from settings
 */
function updateFormValues(): void {
  if (elements.autoUpload) {
    elements.autoUpload.checked = appSettings.autoUpload;
  }
}

/**
 * Update SSAFY Today status badge
 */
function updateSsafyStatusBadge(connected: boolean): void {
  if (!elements.ssafyStatusBadge) return;

  if (connected) {
    elements.ssafyStatusBadge.textContent = "연결됨";
    elements.ssafyStatusBadge.style.background = "#c6f6d5";
    elements.ssafyStatusBadge.style.color = "#276749";
  } else {
    elements.ssafyStatusBadge.textContent = "연결 안됨";
    elements.ssafyStatusBadge.style.background = "#fed7d7";
    elements.ssafyStatusBadge.style.color = "#c53030";
  }
}

/**
 * Check SSAFY Today connection status on load
 */
async function checkSsafyConnectionStatus(): Promise<void> {
  try {
    const response = await fetch(SSAFY_HEALTH_URL, {
      method: "GET",
      mode: "cors",
    });
    updateSsafyStatusBadge(response.ok);
  } catch (error) {
    log.warn("SSAFY Today connection check failed:", error);
    updateSsafyStatusBadge(false);
  }
}

/**
 * Save settings to storage
 */
async function saveSettings(): Promise<void> {
  try {
    await saveObjectInLocalStorage({
      [STORAGE_KEYS.ENABLE]: appSettings.autoUpload,
    });
  } catch (error) {
    log.error("Settings save error:", error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  if (elements.autoUpload) {
    elements.autoUpload.addEventListener("change", async (e) => {
      appSettings.autoUpload = (e.target as HTMLInputElement).checked;
      await saveSettings();
    });
  }

  // SSAFY Today connection test
  if (elements.testSsafyConnection) {
    elements.testSsafyConnection.addEventListener("click", async () => {
      elements.testSsafyConnection!.disabled = true;
      elements.testSsafyConnection!.textContent = "테스트 중...";

      try {
        const response = await fetch(SSAFY_HEALTH_URL);
        if (response.ok) {
          showMessage("success", "SSAFY Today 서버 연결 성공!");
          updateSsafyStatusBadge(true);
        } else {
          showMessage("error", `연결 실패: HTTP ${response.status}`);
          updateSsafyStatusBadge(false);
        }
      } catch (error) {
        showMessage("error", `연결 실패: ${error}`);
        updateSsafyStatusBadge(false);
      }

      elements.testSsafyConnection!.disabled = false;
      elements.testSsafyConnection!.textContent = "🔍 연결 테스트";
    });
  }
}

/**
 * Initialize settings app
 */
async function init(): Promise<void> {
  log.info("SsafyToday Settings initialized");

  try {
    initElements();
    await loadSettings();
    updateFormValues();
    setupEventListeners();
    await checkSsafyConnectionStatus();
  } catch (error) {
    log.error("Initialization error:", error);
  }
}

// DOM load handler
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
