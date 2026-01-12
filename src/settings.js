import { getObjectFromLocalStorage, saveObjectInLocalStorage } from "@/commons/storage.js";
import { STORAGE_KEYS } from "@/constants/registry.js";
import beginOAuth2 from "@/commons/oauth2.js";
import { parseTemplateString } from "safe-template-parser";
import { getTextTransforms } from "@/commons/text-transforms.js";

// 설정 상태 관리
let appSettings = {
  connected: false,
  repoName: "",
  autoUpload: true,
  useCustomTemplate: false,
  templateString: "{{platform}}/{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}",
};

// GitHub 사용자 정보 및 저장소 목록
let githubUserInfo = {
  username: "",
  repositories: [],
};

// DOM 요소들
const elements = {
  connectionStatus: document.getElementById("connectionStatus"),
  errorMessage: document.getElementById("errorMessage"),
  successMessage: document.getElementById("successMessage"),
  setupSection: document.getElementById("setupSection"),
  settingsSection: document.getElementById("settingsSection"),
  ssafyApiSection: document.getElementById("ssafyApiSection"),
  managementSection: document.getElementById("managementSection"),
  repoType: document.getElementById("repoType"),
  repoName: document.getElementById("repoName"),
  repoSelect: document.getElementById("repoSelect"),
  connectRepo: document.getElementById("connectRepo"),
  autoUpload: document.getElementById("autoUpload"),
  useCustomTemplate: document.getElementById("useCustomTemplate"),
  customTemplateInput: document.getElementById("customTemplateInput"),
  templateString: document.getElementById("templateString"),
  templatePreview: document.getElementById("templatePreview"),
  unlinkRepo: document.getElementById("unlinkRepo"),
  saveTemplate: document.getElementById("saveTemplate"),
  resetTemplate: document.getElementById("resetTemplate"),
  testApiConnection: document.getElementById("testApiConnection"),
  apiStatusIcon: document.getElementById("apiStatusIcon"),
  apiStatusBadge: document.getElementById("apiStatusBadge"),
};

// 유틸리티 함수들
function showMessage(type, text, autoHide = true) {
  const messageEl = elements[type + "Message"];
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.style.display = "block";

  if (autoHide) {
    setTimeout(() => {
      messageEl.style.display = "none";
    }, 5000);
  }
}

function hideMessage(type) {
  const messageEl = elements[type + "Message"];
  if (messageEl) {
    messageEl.style.display = "none";
  }
}

// 연결 상태 업데이트
function updateConnectionStatus() {
  if (appSettings.connected) {
    elements.connectionStatus.innerHTML = `
      <div class="status-connected">
        <a class="repo-info" href="https://github.com/${appSettings.repoName}" target="_blank" title="클릭하여 GitHub 저장소로 이동">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <strong>연결됨:</strong> ${appSettings.repoName}
        </a>
      </div>
    `;
    elements.setupSection.style.display = "none";
    elements.settingsSection.style.display = "block";
    elements.managementSection.style.display = "block";
  } else {
    elements.connectionStatus.innerHTML = `
      <div class="status-disconnected">
        GitHub 저장소가 연결되지 않았습니다. 아래에서 저장소를 설정해주세요.
      </div>
    `;
    elements.setupSection.style.display = "block";
    elements.settingsSection.style.display = "none";
    elements.managementSection.style.display = "none";
  }
}

// 모드 감지 및 설정
async function detectAndSetMode() {
  try {
    const data = await getObjectFromLocalStorage([
      STORAGE_KEYS.MODE_TYPE,
      STORAGE_KEYS.HOOK,
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.ENABLE,
      STORAGE_KEYS.USE_CUSTOM_TEMPLATE,
      STORAGE_KEYS.DIR_TEMPLATE,
    ]);

    const modeType = data[STORAGE_KEYS.MODE_TYPE];
    const hook = data[STORAGE_KEYS.HOOK];
    const token = data[STORAGE_KEYS.TOKEN];
    const enabled = data[STORAGE_KEYS.ENABLE];
    const useCustomTemplate = data[STORAGE_KEYS.USE_CUSTOM_TEMPLATE];
    const dirTemplate = data[STORAGE_KEYS.DIR_TEMPLATE];

    if (modeType === "commit" && hook) {
      if (!token) {
        showAuthorizationError();
        return;
      }

      // 연결된 상태
      appSettings.connected = true;
      appSettings.repoName = hook;
      appSettings.autoUpload = enabled !== false;
      appSettings.useCustomTemplate = useCustomTemplate || false;
      appSettings.templateString =
        dirTemplate || "{{platform}}/{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}";

      updateConnectionStatus();
      updateFormValues();
    } else {
      // 연결되지 않은 상태
      appSettings.connected = false;
      updateConnectionStatus();
    }
  } catch (error) {
    console.error("Mode detection error:", error);
    appSettings.connected = false;
    updateConnectionStatus();
  }
}

// 토큰 유효성 확인 함수
async function checkGitHubToken() {
  try {
    const token = await getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);

    if (!token || token.trim() === "") {
      return null;
    }

    return token;
  } catch (error) {
    console.error("Token check error:", error);
    return null;
  }
}

// GitHub 인증 안내 표시
function showGitHubAuthRequired() {
  const authMessage = `
    <div class="auth-required-notice">
      <div class="notice-icon">🔐</div>
      <div class="notice-content">
        <h3>GitHub 인증이 필요합니다</h3>
        <p>저장소를 연결하려면 먼저 GitHub 계정 인증을 완료해야 합니다.</p>
        <button id="authorize_button" class="button button-primary">
          <span>🔗</span> GitHub 인증하기
        </button>
      </div>
    </div>
  `;

  elements.errorMessage.innerHTML = authMessage;
  elements.errorMessage.style.display = "block";

  const authorizeButton = document.getElementById("authorize_button");
  if (authorizeButton) {
    authorizeButton.addEventListener("click", () => {
      hideMessage("error");
      beginOAuth2();
    });
  }
}

// 인증 오류 표시
function showAuthorizationError() {
  elements.errorMessage.innerHTML =
    'GitHub 계정 인증이 필요합니다. <button id="authorize_button" class="button button-primary">인증하기</button>';
  elements.errorMessage.style.display = "block";

  const authorizeButton = document.getElementById("authorize_button");
  if (authorizeButton) {
    authorizeButton.addEventListener("click", beginOAuth2);
  }
}

// 폼 값 업데이트
function updateFormValues() {
  if (elements.autoUpload) {
    elements.autoUpload.checked = appSettings.autoUpload;
  }
  if (elements.useCustomTemplate) {
    elements.useCustomTemplate.checked = appSettings.useCustomTemplate;
    elements.customTemplateInput.style.display = appSettings.useCustomTemplate ? "block" : "none";
  }
  if (elements.templateString) {
    elements.templateString.value = appSettings.templateString;
  }
}

// GitHub 사용자 정보 및 저장소 목록 가져오기
async function fetchGitHubUserInfo() {
  try {
    const data = await getObjectFromLocalStorage([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USERNAME]);
    const token = data[STORAGE_KEYS.TOKEN];
    const username = data[STORAGE_KEYS.USERNAME];

    if (!token || !username) {
      return null;
    }

    githubUserInfo.username = username;

    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.ok) {
      const repos = await response.json();
      githubUserInfo.repositories = repos.map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
      }));
    }

    return githubUserInfo;
  } catch (error) {
    console.error("GitHub user info fetch error:", error);
    return null;
  }
}

// 저장소 선택 드롭다운 업데이트
function updateRepositorySelect() {
  if (!elements.repoSelect) return;

  while (elements.repoSelect.options.length > 1) {
    elements.repoSelect.removeChild(elements.repoSelect.lastChild);
  }

  githubUserInfo.repositories.forEach((repo) => {
    const option = document.createElement("option");
    option.value = repo.fullName;
    option.textContent = `${repo.name} ${repo.private ? "(비공개)" : ""}`;
    if (repo.description) {
      option.textContent += ` - ${repo.description}`;
    }
    elements.repoSelect.appendChild(option);
  });
}

// 저장소 타입 변경 처리
async function handleRepoTypeChange() {
  const repoType = elements.repoType.value;

  if (repoType === "new") {
    elements.repoName.style.display = "block";
    elements.repoSelect.style.display = "none";

    const userInfo = await fetchGitHubUserInfo();
    if (userInfo && userInfo.username) {
      elements.repoName.value = `${userInfo.username}/algorithm-solutions`;
    } else {
      elements.repoName.value = "username/algorithm-solutions";
    }
  } else if (repoType === "existing") {
    const token = await checkGitHubToken();
    if (!token) {
      showGitHubAuthRequired();
      elements.repoType.value = "";
      return;
    }

    elements.repoName.style.display = "none";
    elements.repoSelect.style.display = "block";

    const userInfo = await fetchGitHubUserInfo();
    if (userInfo) {
      updateRepositorySelect();
    } else {
      showMessage("error", "GitHub 사용자 정보를 가져올 수 없습니다. 다시 로그인해 주세요.");
    }
  } else {
    elements.repoName.style.display = "none";
    elements.repoSelect.style.display = "none";
    elements.repoName.value = "";
    elements.repoSelect.value = "";
  }

  validateForm();
}

// 저장소 선택 처리
function handleRepoSelect() {
  const selectedRepo = elements.repoSelect.value;
  if (selectedRepo) {
    elements.repoName.value = selectedRepo;
  }
  validateForm();
}

// 폼 유효성 검사
function validateForm() {
  const repoType = elements.repoType.value;
  let repoName = "";

  if (repoType === "new") {
    repoName = elements.repoName.value;
  } else if (repoType === "existing") {
    repoName = elements.repoSelect.value || elements.repoName.value;
  }

  const isValid = repoType && repoName && repoName.includes("/");
  elements.connectRepo.disabled = !isValid;

  return isValid;
}

// 저장소 생성
async function createRepo(token, fullName) {
  const name = fullName.split("/")[1];
  const AUTHENTICATION_URL = "https://api.github.com/user/repos";
  const data = {
    name,
    private: true,
    auto_init: true,
    description: "SSAFY TODAY로 자동 업로드되는 알고리즘 풀이 저장소입니다.",
  };

  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify(data),
    });
    const res = await response.json();

    if (response.status === 201 || response.status === 200) {
      await saveObjectInLocalStorage({
        [STORAGE_KEYS.MODE_TYPE]: "commit",
        [STORAGE_KEYS.HOOK]: res.full_name,
      });

      const stats = {};
      stats.version = chrome.runtime.getManifest().version;
      stats.submission = {};
      await saveObjectInLocalStorage({ [STORAGE_KEYS.STATS]: stats });

      appSettings.connected = true;
      appSettings.repoName = res.full_name;
      updateConnectionStatus();
      showMessage("success", `저장소 '${res.full_name}'이(가) 생성되었습니다.`);
    } else {
      handleCreateRepoError(response.status, fullName);
    }
  } catch (error) {
    console.error("Repository creation error:", error);
    showMessage("error", "저장소 생성에 실패했습니다. 콘솔을 확인해주세요.");
  }
}

// 저장소 생성 오류 처리
function handleCreateRepoError(status, fullName) {
  const errorMessages = {
    304: `'${fullName}' 저장소를 수정할 수 없습니다. 나중에 다시 시도해주세요.`,
    400: `잘못된 요청입니다. 기존 스크립트를 덮어쓰고 있지 않은지 확인해주세요.`,
    401: `'${fullName}'에 대한 접근 권한이 없습니다. 나중에 다시 시도해주세요.`,
    403: `'${fullName}' 저장소에 대한 접근이 금지되었습니다.`,
    422: `저장소가 이미 존재할 수 있습니다. '기존 저장소 연결' 옵션을 사용해보세요.`,
  };

  showMessage("error", errorMessages[status] || `저장소 생성 중 오류가 발생했습니다 (${status}).`);
}

// 기존 저장소 연결
async function linkRepo(token, name) {
  const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;

  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    const res = await response.json();

    if (response.status === 200) {
      await saveObjectInLocalStorage({
        [STORAGE_KEYS.MODE_TYPE]: "commit",
        [STORAGE_KEYS.HOOK]: res.full_name,
      });

      const stats = {};
      stats.version = chrome.runtime.getManifest().version;
      stats.submission = {};
      await saveObjectInLocalStorage({ [STORAGE_KEYS.STATS]: stats });

      appSettings.connected = true;
      appSettings.repoName = res.full_name;
      updateConnectionStatus();
      showMessage("success", `저장소 '${res.full_name}'이(가) 연결되었습니다.`);
    } else {
      handleLinkRepoError(response.status, name);
    }
  } catch (error) {
    console.error("Repository linking error:", error);
    showMessage("error", "저장소 연결에 실패했습니다. 콘솔을 확인해주세요.");
  }
}

// 저장소 연결 오류 처리
function handleLinkRepoError(status, name) {
  const errorMessages = {
    301: `'${name}' 저장소가 영구적으로 이동되었습니다. 새 저장소를 생성해주세요.`,
    403: `'${name}' 저장소에 대한 접근 권한이 없습니다.`,
    404: `'${name}' 저장소를 찾을 수 없습니다. 저장소 이름을 확인해주세요.`,
  };

  showMessage("error", errorMessages[status] || `저장소 연결 중 오류가 발생했습니다 (${status}).`);
}

// 저장소 연결 처리
async function handleRepoConnection() {
  const token = await checkGitHubToken();
  if (!token) {
    showGitHubAuthRequired();
    return;
  }

  if (!validateForm()) {
    showMessage("error", "모든 필드를 올바르게 입력해주세요.");
    return;
  }

  const repoType = elements.repoType.value;
  let repoName = "";

  if (repoType === "new") {
    repoName = elements.repoName.value;
  } else if (repoType === "existing") {
    repoName = elements.repoSelect.value || elements.repoName.value;
  }

  try {
    hideMessage("error");
    elements.connectRepo.disabled = true;
    elements.connectRepo.innerHTML = "<span>⏳</span> 연결 중...";

    if (repoType === "new") {
      await createRepo(token, repoName);
    } else {
      await linkRepo(token, repoName);
    }
  } catch (error) {
    console.error("Repository connection error:", error);
    showMessage("error", "저장소 연결에 실패했습니다. 다시 시도해주세요.");
  } finally {
    elements.connectRepo.disabled = false;
    elements.connectRepo.innerHTML = "<span>🔗</span> 연결하기";
  }
}

// 저장소 연결 해제
async function handleRepoDisconnection() {
  if (!confirm("정말로 저장소 연결을 해제하시겠습니까?")) {
    return;
  }

  try {
    await saveObjectInLocalStorage({
      [STORAGE_KEYS.MODE_TYPE]: "",
      [STORAGE_KEYS.HOOK]: "",
      [STORAGE_KEYS.TOKEN]: "",
      [STORAGE_KEYS.USERNAME]: "",
      [STORAGE_KEYS.ORG_OPTION]: "",
    });

    appSettings.connected = false;
    appSettings.repoName = "";

    updateConnectionStatus();
    showMessage("success", "저장소 연결이 해제되었습니다.");
  } catch (error) {
    console.error("Disconnection error:", error);
    showMessage("error", "연결 해제에 실패했습니다.");
  }
}

// 설정 저장
async function saveSettings() {
  try {
    await saveObjectInLocalStorage({
      [STORAGE_KEYS.ENABLE]: appSettings.autoUpload,
      [STORAGE_KEYS.USE_CUSTOM_TEMPLATE]: appSettings.useCustomTemplate,
      [STORAGE_KEYS.DIR_TEMPLATE]: appSettings.templateString,
    });
  } catch (error) {
    console.error("Settings save error:", error);
  }
}

// SSAFY API 상태 확인
async function checkSsafyApiStatus() {
  updateApiStatusUI("checking");

  try {
    const response = await fetch("https://ssafy.today/api/submissions/health/", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      updateApiStatusUI("connected");
    } else {
      updateApiStatusUI("disconnected");
    }
  } catch (error) {
    console.error("SSAFY API check error:", error);
    updateApiStatusUI("disconnected");
  }
}

// API 상태 UI 업데이트
function updateApiStatusUI(status) {
  const statusConfig = {
    checking: {
      icon: "🔄",
      badge: "연결 확인 중...",
      badgeClass: "checking",
    },
    connected: {
      icon: "✅",
      badge: "연결됨",
      badgeClass: "connected",
    },
    disconnected: {
      icon: "❌",
      badge: "연결 안됨",
      badgeClass: "disconnected",
    },
  };

  const config = statusConfig[status];
  if (elements.apiStatusIcon) {
    elements.apiStatusIcon.textContent = config.icon;
  }
  if (elements.apiStatusBadge) {
    elements.apiStatusBadge.textContent = config.badge;
    elements.apiStatusBadge.className = `api-status-badge ${config.badgeClass}`;
  }
}

// 이벤트 리스너 등록
function setupEventListeners() {
  // 저장소 타입 변경
  if (elements.repoType) {
    elements.repoType.addEventListener("change", handleRepoTypeChange);
  }

  // 저장소 선택
  if (elements.repoSelect) {
    elements.repoSelect.addEventListener("change", handleRepoSelect);
  }

  // 폼 유효성 검사
  if (elements.repoName) {
    elements.repoName.addEventListener("input", validateForm);
  }

  // 저장소 연결/해제
  if (elements.connectRepo) {
    elements.connectRepo.addEventListener("click", handleRepoConnection);
  }
  if (elements.unlinkRepo) {
    elements.unlinkRepo.addEventListener("click", handleRepoDisconnection);
  }

  // 설정 변경
  if (elements.autoUpload) {
    elements.autoUpload.addEventListener("change", async (e) => {
      appSettings.autoUpload = e.target.checked;
      await saveSettings();
    });
  }

  if (elements.useCustomTemplate) {
    elements.useCustomTemplate.addEventListener("change", async (e) => {
      appSettings.useCustomTemplate = e.target.checked;
      elements.customTemplateInput.style.display = e.target.checked ? "block" : "none";
      await saveSettings();
    });
  }

  if (elements.templateString) {
    elements.templateString.addEventListener("input", async (e) => {
      appSettings.templateString = e.target.value;
    });
  }

  // SSAFY API 연결 테스트
  if (elements.testApiConnection) {
    elements.testApiConnection.addEventListener("click", checkSsafyApiStatus);
  }
}

// 툴팁 관리 클래스
class TooltipManager {
  constructor() {
    this.tooltip = null;
    this.init();
  }

  init() {
    this.tooltip = document.createElement("div");
    this.tooltip.className = "tooltip";
    document.body.appendChild(this.tooltip);
    this.attachEventListeners();
  }

  attachEventListeners() {
    const elementsWithTooltip = document.querySelectorAll("[data-tooltip]");

    elementsWithTooltip.forEach((element) => {
      element.addEventListener("mouseenter", (e) => {
        this.showTooltip(e.target);
      });

      element.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });

      element.addEventListener("mousemove", (e) => {
        this.updateTooltipPosition(e);
      });
    });
  }

  showTooltip(element) {
    const tooltipText = element.getAttribute("data-tooltip");
    if (!tooltipText) return;

    this.tooltip.textContent = tooltipText;
    this.tooltip.classList.add("show");
  }

  hideTooltip() {
    this.tooltip.classList.remove("show");
  }

  updateTooltipPosition(event) {
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let left = event.pageX - tooltipRect.width / 2;
    let top = event.pageY - tooltipRect.height - 10;

    if (left < 0) {
      left = 5;
    }
    if (left + tooltipRect.width > viewportWidth) {
      left = viewportWidth - tooltipRect.width - 5;
    }
    if (top < 0) {
      top = event.pageY + 10;
    }

    this.tooltip.style.left = left + "px";
    this.tooltip.style.top = top + "px";
  }

  refresh() {
    this.attachEventListeners();
  }
}

// 템플릿 빌더 클래스
class TemplateBuilder {
  constructor() {
    this.templateInput = document.getElementById("templateString");
    this.templatePreview = document.getElementById("templatePreview");
    this.presetCards = document.querySelectorAll(".preset-card");
    this.variableBtns = document.querySelectorAll(".variable-btn");
    this.filterBtns = document.querySelectorAll(".filter-btn");
    this.saveBtn = document.getElementById("saveTemplate");
    this.resetBtn = document.getElementById("resetTemplate");

    this.init();
  }

  init() {
    // 프리셋 카드 클릭 이벤트
    this.presetCards.forEach((card) => {
      card.addEventListener("click", () => {
        this.selectPreset(card);
      });
    });

    // 변수 버튼 클릭 이벤트
    this.variableBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.insertVariable(btn.dataset.variable);
      });
    });

    // 필터 버튼 클릭 이벤트
    this.filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.insertFunction(btn.dataset.function);
      });
    });

    // 템플릿 입력 실시간 업데이트
    if (this.templateInput) {
      this.templateInput.addEventListener("input", () => {
        this.updatePreview();
      });
    }

    // 저장 버튼 이벤트
    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => {
        this.saveTemplate();
      });
    }

    // 초기화 버튼 이벤트
    if (this.resetBtn) {
      this.resetBtn.addEventListener("click", () => {
        this.resetTemplate();
      });
    }

    // 초기 미리보기 업데이트
    this.updatePreview();
  }

  selectPreset(selectedCard) {
    this.presetCards.forEach((card) => card.classList.remove("selected"));
    selectedCard.classList.add("selected");

    const template = selectedCard.dataset.template;
    if (this.templateInput) {
      this.templateInput.value = template;
      this.updatePreview();
    }
  }

  insertVariable(variable) {
    if (!this.templateInput) return;

    const cursorPos = this.templateInput.selectionStart;
    const currentValue = this.templateInput.value;
    const newValue = currentValue.slice(0, cursorPos) + variable + currentValue.slice(cursorPos);

    this.templateInput.value = newValue;

    const newCursorPos = cursorPos + variable.length;
    this.templateInput.setSelectionRange(newCursorPos, newCursorPos);
    this.templateInput.focus();

    this.updatePreview();
  }

  insertFunction(functionName) {
    if (!this.templateInput) return;

    const cursorPos = this.templateInput.selectionStart;
    const currentValue = this.templateInput.value;
    const newValue = currentValue.slice(0, cursorPos) + functionName + "()" + currentValue.slice(cursorPos);

    this.templateInput.value = newValue;

    const newCursorPos = cursorPos + functionName.length + 1;
    this.templateInput.setSelectionRange(newCursorPos, newCursorPos);
    this.templateInput.focus();

    this.updatePreview();
  }

  updatePreview() {
    if (!this.templateInput || !this.templatePreview) return;

    const template =
      this.templateInput.value || "{{platform}}/{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}";

    try {
      // 예시 데이터 (다양한 플랫폼 지원)
      const sampleData = {
        platform: "백준",
        problemId: "1000",
        title: "A+B",
        level: "Silver V",
        language: "Python",
      };

      const result = parseTemplateString(template, sampleData, getTextTransforms());
      const finalResult = result.includes(".") ? result : result + ".py";

      this.templatePreview.textContent = finalResult;
      this.templatePreview.style.color = "#fbb6ce";
    } catch (error) {
      console.error("Template parsing error:", error);
      this.templatePreview.textContent = "템플릿 구문 오류: " + error.message;
      this.templatePreview.style.color = "#f56565";
    }
  }

  async saveTemplate() {
    try {
      const templateString = this.templateInput.value;
      appSettings.templateString = templateString;

      await saveObjectInLocalStorage({
        [STORAGE_KEYS.DIR_TEMPLATE]: templateString,
      });

      showMessage("success", "템플릿이 저장되었습니다.");
    } catch (error) {
      console.error("Template save error:", error);
      showMessage("error", "템플릿 저장에 실패했습니다.");
    }
  }

  resetTemplate() {
    const defaultTemplate = "{{platform}}/{{language}}/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}";

    if (this.templateInput) {
      this.templateInput.value = defaultTemplate;
      this.updatePreview();
    }

    this.presetCards.forEach((card) => card.classList.remove("selected"));
    showMessage("success", "템플릿이 초기화되었습니다.");
  }
}

// 앱 초기화
async function init() {
  console.log("SSAFY TODAY Settings initialized");

  try {
    await detectAndSetMode();
    setupEventListeners();
    validateForm();

    // 툴팁 매니저 초기화
    new TooltipManager();

    // 템플릿 빌더 초기화
    new TemplateBuilder();

    // SSAFY API 상태 확인
    checkSsafyApiStatus();
  } catch (error) {
    console.error("Initialization error:", error);
  }
}

// DOM이 로드되면 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
