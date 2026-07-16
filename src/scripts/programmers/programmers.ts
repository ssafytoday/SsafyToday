/**
 * Programmers Hub main entry point
 * Content script for programmers.co.kr
 */
import PlatformHubBase, { Toast, log, checkEnable, type UploadData } from "@/commons/platformhub-base";
import { SubmissionChecker } from "@/commons/loader-service";
import { parseData } from "@/programmers/parsing";
import uploadOneSolveProblemOnGit from "@/programmers/uploadfunctions";
import { startUpload, markUploadedCSS } from "@/programmers/util";
import { PLATFORMS } from "@/constants/config";
import { initHintForProblem, cleanupHint } from "@/commons/hint-integration";

/**
 * ProgrammersHub class for handling Programmers submissions
 * Extends PlatformHubBase for common platform functionality
 */
class ProgrammersHub extends PlatformHubBase {
  // 과거 버전이 페이지 전체 a[href*="/users/"] 스캔(구 Method 5)으로 저장했던 시스템
  // 경로들. school 도메인의 /users/ 링크는 /users/profile·/users/challenge-activity
  // 같은 고정 경로뿐이라(닉네임 링크 없음) 링크 스캔은 유효한 사용자명을 만들 수 없고,
  // 실제로 'challenge-activity'가 sync-credentials를 타고 백엔드 programmers_username
  // 까지 오염시켰다. 저장소에 남은 과거 오염값을 지워 재캡처를 유도하는 데 쓴다.
  private static readonly POISONED_USERNAMES = new Set([
    "challenge-activity",
    "edit",
    "settings",
    "notifications",
    "dashboard",
    "profile",
  ]);

  constructor() {
    super({
      platformName: PLATFORMS.PROGRAMMERS,
      loaderInterval: 2000,
      // API 제출을 위해 enable 체크를 건너뜀 (비활성화 상태에서도 동작)
      skipEnableCheck: true,
    });
  }

  /**
   * Find Programmers username from page
   */
  private findUsername(): string | null {
    // Method 1: 프로필 팝업 이름 (새 랜딩페이지 - 2024년 업데이트)
    // 팝업이 열려있을 때만 찾을 수 있음
    const profilePopupName = document.querySelector('span[class*="ProfilePopupstyle__Name"]');
    if (profilePopupName?.textContent) {
      return profilePopupName.textContent.trim();
    }

    // Method 2: 네비게이션 바의 사용자 프로필 (레거시)
    const navUserName = document.querySelector('.navbar .nav-item .user-name, .navbar .dropdown-toggle .user-name');
    if (navUserName?.textContent) {
      return navUserName.textContent.trim();
    }

    // Method 3: 헤더의 사용자 이름 (레거시)
    const headerUserName = document.querySelector('header .user-info .name, .gnb-profile .name');
    if (headerUserName?.textContent) {
      return headerUserName.textContent.trim();
    }

    // Method 4: 프로필 드롭다운 메뉴 (레거시)
    const profileName = document.querySelector('.profile-dropdown .name, .account-dropdown .name');
    if (profileName?.textContent) {
      return profileName.textContent.trim();
    }

    // (구 Method 5 제거) 페이지 전체 a[href*="/users/"] 스캔은 school 도메인에서
    // 닉네임을 반환한 적이 없다 — 고정 경로(profile·challenge-activity 등)뿐이라
    // garbage만 저장했고 SYSTEM_PATHS 목록에 없던 'profile' 같은 값이 백엔드까지
    // 오염시킬 수 있었다. 실제 닉네임은 GNB 프로필 팝업(Method 1)이 팝업을 열지
    // 않아도 DOM에 존재하므로 그걸로 충분하다.
    return null;
  }

  /**
   * Remove poisoned username left in storage by old versions (Method 5 era)
   * 오염값을 지워야 MutationObserver/Method 1이 올바른 닉네임을 재캡처하고,
   * sync-credentials가 백엔드에 garbage를 계속 보내는 것도 멈춘다.
   */
  private async sanitizeStoredUsername(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(["platform_programmers_username"]);
      const stored = result.platform_programmers_username;
      if (typeof stored === "string" && ProgrammersHub.POISONED_USERNAMES.has(stored.toLowerCase())) {
        await chrome.storage.local.remove("platform_programmers_username");
        log.warn("Removed poisoned Programmers username from storage:", stored);
      }
    } catch (e) {
      log.warn("Failed to sanitize stored Programmers username:", e);
    }
  }

  /**
   * Setup MutationObserver to watch for profile popup appearance
   * 프로필 팝업이 동적으로 나타날 때 사용자명을 저장
   */
  private setupUsernameObserver(): void {
    // 이미 저장된 사용자명이 있으면 건너뛰기
    chrome.storage.local.get(['platform_programmers_username'], (result) => {
      if (result.platform_programmers_username) {
        log.debug("Programmers username already saved:", result.platform_programmers_username);
        return;
      }

      // MutationObserver로 팝업 감시
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              // 팝업 내 이름 요소 찾기
              const nameElement = node.querySelector?.('span[class*="ProfilePopupstyle__Name"]') ||
                                  (node.matches?.('span[class*="ProfilePopupstyle__Name"]') ? node : null);
              if (nameElement?.textContent) {
                const username = nameElement.textContent.trim();
                if (username) {
                  this.saveUsername(username);
                  observer.disconnect();
                  return;
                }
              }
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      log.debug("Programmers username observer started");
    });
  }

  /**
   * Save username to chrome storage
   */
  private async saveUsername(username: string): Promise<void> {
    try {
      await chrome.storage.local.set({
        platform_programmers_username: username
      });
      log.info("Programmers username saved to storage:", username);
    } catch (e) {
      log.warn("Failed to save Programmers username to storage:", e);
    }
  }

  /**
   * Initialize the ProgrammersHub extension
   */
  async init(): Promise<boolean> {
    log.info(`Initializing ${this.config.platformName} hub`);

    // 과거 버전(Method 5)이 저장한 시스템 경로 오염값 제거 → 재캡처 유도
    await this.sanitizeStoredUsername();

    // 회원가입 연동을 위해 사용자명 저장 (활성화 여부와 관계없이)
    // GNB가 있는 페이지에서는 프로필 팝업 DOM이 숨김 상태로도 존재해 즉시 캡처된다
    const username = this.findUsername();
    if (username) {
      await this.saveUsername(username);
    } else {
      // 팝업이 없으면 MutationObserver로 감시 시작
      // 사용자가 프로필 버튼을 클릭하면 사용자명 저장
      this.setupUsernameObserver();
    }

    if (this.isProgrammersLessonPage()) {
      // 제출 모니터링은 활성화 여부와 관계없이 동작
      this.startSubmissionMonitoring();

      // Hint UI는 enable 상태일 때만 활성화
      const isEnabled = await checkEnable();
      if (isEnabled) {
        this.initHintUI();
      }
    }

    return true;
  }

  /**
   * Initialize AI hint UI for the current problem
   */
  private initHintUI(): void {
    try {
      // Get problem info from page — 2026 개편으로 div.main 래퍼가 사라져
      // "div.main > div.lesson-content"는 더 이상 매칭되지 않는다 (parsing.ts와 동일 대응)
      const lessonContent =
        document.querySelector("div.lesson-content") || document.querySelector("[data-lesson-id]");
      const problemId =
        lessonContent?.getAttribute("data-lesson-id") ||
        window.location.pathname.match(/\/lessons\/(\d+)/)?.[1] ||
        "";

      if (!problemId) {
        log.debug("ProgrammersHub - Could not find problem ID for hint UI");
        return;
      }

      const level = lessonContent?.getAttribute("data-challenge-level") || "Unknown";

      const titleElement = document.querySelector(".algorithm-title .challenge-title");
      const title = titleElement?.textContent?.replace(/\\n/g, "").trim() || `Problem ${problemId}`;

      const descElement = document.querySelector("div.guide-section-description > div.markdown");
      const description = descElement?.textContent?.trim().slice(0, 2000) || "";

      initHintForProblem(
        "programmers",
        {
          id: problemId,
          title,
          level: `Level ${level}`,
          description,
        },
        this.getCurrentCode.bind(this)
      );

      log.info(`ProgrammersHub - Hint UI initialized for: ${title}`);
    } catch (error) {
      log.error("ProgrammersHub - Error initializing hint UI:", error);
    }
  }

  /**
   * Get current code from the editor
   */
  private getCurrentCode(): string {
    // Method 1: Standard textarea#code
    const textareaCode = document.querySelector("textarea#code") as HTMLTextAreaElement | null;
    if (textareaCode?.value) {
      return textareaCode.value;
    }

    // Method 2: data-type="code" input (fill-in-the-blank problems)
    const codeInput = document.querySelector(
      "input[data-type='code'][data-language]"
    ) as HTMLInputElement | null;
    if (codeInput?.value) {
      return codeInput.value;
    }

    // Method 3: Find hidden inputs with numeric IDs (submitted code storage)
    const allInputs = document.querySelectorAll("input[type='hidden']");
    for (const input of allInputs) {
      const inputEl = input as HTMLInputElement;
      if (inputEl.id && /^\d+$/.test(inputEl.id) && inputEl.value) {
        if (inputEl.value.includes("public class") || inputEl.value.includes("import java") ||
            inputEl.value.includes("def ") || inputEl.value.includes("function ")) {
          return inputEl.value;
        }
      }
    }

    // Method 4: CodeMirror editor
    const cmElement = document.querySelector(".CodeMirror") as HTMLElement & {
      CodeMirror?: { getValue: () => string };
    } | null;
    if (cmElement?.CodeMirror) {
      return cmElement.CodeMirror.getValue();
    }

    // Method 5: Monaco editor
    const monacoEditor = (window as unknown as {
      monaco?: { editor?: { getModels: () => Array<{ getValue: () => string }> } };
    }).monaco;
    if (monacoEditor?.editor?.getModels) {
      const models = monacoEditor.editor.getModels();
      if (models.length > 0) {
        return models[0].getValue();
      }
    }

    return "";
  }

  /**
   * Check if current page is a Programmers lesson page
   * @returns Whether current page is a lesson page
   */
  private isProgrammersLessonPage(): boolean {
    return this.matchesUrl(["/learn/courses/30"]) && this.currentUrl.includes("lessons");
  }

  /**
   * Start monitoring for successful submissions
   */
  private startSubmissionMonitoring(): void {
    Toast.info("프로그래머스 문제 모니터링을 시작합니다.", 3000);

    const checker = SubmissionChecker.createTextChecker("div.modal-header > h4", "정답");

    const onSuccess = async (): Promise<void> => {
      const result = await this.createAndExecuteUploadHandler(
        parseData,
        uploadOneSolveProblemOnGit,
        markUploadedCSS,
        startUpload
      );

      if (result?.success && result?.data) {
        // 라이브 페이지 우선, 저장값은 폴백 — 저장값 우선이면 프로그래머스 계정 전환 후
        // 이전 사용자 이름으로 제출이 귀속된다 (Method 5 제거 후 findUsername은
        // 로그인한 본인 이름만 반환하므로 라이브 우선이 항상 더 정확하다)
        const storageResult = await chrome.storage.local.get(['platform_programmers_username']);
        const platformUsername = this.findUsername() || storageResult.platform_programmers_username || "";

        // Use smartUpload for automatic routing (GitHub or ssafy.today direct)
        await this.smartUpload(
          result.data as UploadData,
          uploadOneSolveProblemOnGit,
          markUploadedCSS,
          platformUsername
        );
      }
    };

    // skipEnableCheck: true로 비활성화 상태에서도 모니터링
    this.setupSubmissionMonitoring(checker, onSuccess, { skipEnableCheck: true });
  }
}

// Initialize ProgrammersHub
new ProgrammersHub();
