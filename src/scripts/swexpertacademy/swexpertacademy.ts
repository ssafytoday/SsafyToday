import PlatformHubBase, { Toast, log, checkEnable, type UploadData } from "@/commons/platformhub-base";
import { SubmissionChecker } from "@/commons/loader-service";
import { parseCode, parseData, updateTextSourceEvent } from "@/swexpertacademy/parsing";
import uploadOneSolveProblemOnGit from "@/swexpertacademy/uploadfunctions";
import { startUpload, markUploadedCSS, getNickname } from "@/swexpertacademy/util";
import { PLATFORMS } from "@/constants/config";
import { initHintForProblem, cleanupHint } from "@/commons/hint-integration";

const SWEA_SOLVINGCLUB_CONTEXT_KEY = "swea_solvingclub_context";

interface SolvingClubContext {
  solveclubId: string;
  probBoxId: string;
  timestamp: number;
}

interface SWEAFormData {
  contestProbId: string;
  categoryType: string;
  categoryId: string;
  solveclubId: string | null;
}

class SWExpertAcademyHub extends PlatformHubBase {
  constructor() {
    super({
      platformName: "SWEA",  // API expects "SWEA" not "SW Expert Academy"
      loaderInterval: 2000,
      // API 제출을 위해 enable 체크를 건너뜀 (비활성화 상태에서도 동작)
      skipEnableCheck: true,
    });
  }

  async init(): Promise<boolean> {
    log.info(`Initializing ${this.config.platformName} hub`);

    // 회원가입 연동을 위해 닉네임 저장 (활성화 여부와 관계없이)
    const nickname = getNickname();
    if (nickname) {
      try {
        await chrome.storage.local.set({
          platform_swea_nickname: nickname
        });
        log.debug("SWEA nickname saved to storage:", nickname);
      } catch (e) {
        log.warn("Failed to save SWEA nickname to storage:", e);
      }
    }

    // 결과 페이지 처리 (활성화 여부와 관계없이)
    if (this.isSWEAResultPage()) {
      log.info("SWEA result page detected, proceeding with upload");
      await this.parseAndUpload();
      return true;
    }

    // 풀이 페이지 처리 (활성화 여부와 관계없이 모니터링, Hint는 enable 시에만)
    if (this.isSWEASolvingPage()) {
      log.info("SWEA solving page detected");
      this.checkAndSaveSolvingClubContext();
      this.startSubmissionMonitoring();

      // Hint UI는 enable 상태일 때만 활성화
      const isEnabled = await checkEnable();
      if (isEnabled) {
        this.initHintUI();
      }
      return true;
    }

    return true;
  }

  /**
   * Initialize AI hint UI for the current problem
   */
  private initHintUI(): void {
    try {
      // Get problem info from page
      const problemIdElement = document.querySelector("div.problem_box > h3");
      const problemId = problemIdElement?.textContent?.replace(/\..*$/, "").trim() || "";

      if (!problemId) {
        log.debug("SWExpertAcademyHub - Could not find problem ID for hint UI");
        return;
      }

      const titleElement = document.querySelector("div.problem_box > p.problem_title");
      let title = titleElement?.textContent
        ?.replace(/ D[0-9]$/, "")
        .replace(/^[^.]*/, "")
        .substring(1)
        .trim() || "";
      // 풀이 페이지(solvingProblem.do)에는 p.problem_title이 없고 h3에
      // "1952. 제목" 형태로만 있다 — h3에서 제목을 복원한다.
      if (!title && problemIdElement?.textContent) {
        title = problemIdElement.textContent.replace(/^\s*\d+\.\s*/, "").trim();
      }
      if (!title) {
        title = `Problem ${problemId}`;
      }

      // Level
      const levelEl = document.querySelector("div.problem_box > p.problem_title > span.badge");
      const level = levelEl?.textContent || "Unrated";

      initHintForProblem(
        "swea",
        {
          id: problemId,
          title,
          level,
        },
        this.getCurrentCode.bind(this)
      );

      log.info(`SWExpertAcademyHub - Hint UI initialized for: ${title}`);
    } catch (error) {
      log.error("SWExpertAcademyHub - Error initializing hint UI:", error);
    }
  }

  /**
   * Get current code from the editor
   */
  private getCurrentCode(): string {
    try {
      // Trigger code editor save
      updateTextSourceEvent();

      // Get code from textarea
      const textSourceEl = document.querySelector("#textSource") as HTMLTextAreaElement | null;
      if (textSourceEl?.value) {
        return textSourceEl.value;
      }

      // Try CodeMirror
      const cmElement = document.querySelector(".CodeMirror") as HTMLElement & {
        CodeMirror?: { getValue: () => string };
      } | null;
      if (cmElement?.CodeMirror) {
        return cmElement.CodeMirror.getValue();
      }

      // Try cEditor global
      const cEditor = (window as unknown as { cEditor?: { getValue: () => string } }).cEditor;
      if (cEditor?.getValue) {
        return cEditor.getValue();
      }

      return "";
    } catch (error) {
      log.error("SWExpertAcademyHub - Error getting current code:", error);
      return "";
    }
  }

  private isSWEASolvingPage(): boolean {
    const headerSpan = this.querySelector("header > h1 > span");
    return (
      this.matchesUrl(["/main/solvingProblem/solvingProblem.do"]) &&
      headerSpan?.textContent === "모의 테스트"
    );
  }

  private isSWEAResultPage(): boolean {
    const hasExtensionParam = this.currentUrl.includes("extension=BaekjoonHub");
    const isProblemSolverPage = this.matchesUrl(["/main/code/problem/problemSolver.do"]);
    const isSolvingClubPage = this.matchesUrl(["/main/talk/solvingClub/problemPassedUser.do"]);
    return hasExtensionParam && (isProblemSolverPage || isSolvingClubPage);
  }

  private extractSolveclubIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get("solveclubId");
    } catch {
      const match = url.match(/solveclubId=([^&]+)/);
      return match ? match[1] : null;
    }
  }

  private saveSolvingClubContext(solveclubId: string, probBoxId: string): void {
    const context: SolvingClubContext = {
      solveclubId,
      probBoxId,
      timestamp: Date.now(),
    };
    try {
      sessionStorage.setItem(SWEA_SOLVINGCLUB_CONTEXT_KEY, JSON.stringify(context));
      log.debug("Saved Solving Club context:", context);
    } catch (e) {
      log.debug("Could not save Solving Club context:", e);
    }
  }

  private loadSolvingClubContext(): SolvingClubContext | null {
    try {
      const stored = sessionStorage.getItem(SWEA_SOLVINGCLUB_CONTEXT_KEY);
      if (!stored) return null;

      const context: SolvingClubContext = JSON.parse(stored);
      if (Date.now() - context.timestamp > 5 * 60 * 1000) {
        sessionStorage.removeItem(SWEA_SOLVINGCLUB_CONTEXT_KEY);
        return null;
      }
      return context;
    } catch {
      return null;
    }
  }

  private checkAndSaveSolvingClubContext(): void {
    const referrer = document.referrer;
    if (!referrer) return;

    if (referrer.includes("/solvingClub/") || referrer.includes("solveclubId=")) {
      const solveclubId = this.extractSolveclubIdFromUrl(referrer);
      if (solveclubId) {
        const probBoxIdMatch = referrer.match(/probBoxId=([^&]+)/);
        const probBoxId = probBoxIdMatch ? probBoxIdMatch[1] : "";
        this.saveSolvingClubContext(solveclubId, probBoxId);
        log.info("Detected Solving Club context from referrer:", { solveclubId, probBoxId });
      }
    }
  }

  private getSolveclubId(): string | null {
    const solveclubIdEl = document.querySelector<HTMLInputElement>(
      "form[name='mainForm'] input[name='solveclubId'], " +
      "input[name='solveclubId'], " +
      "#solveclubId"
    );
    if (solveclubIdEl?.value) {
      log.debug("solveclubId found in form input:", solveclubIdEl.value);
      return solveclubIdEl.value;
    }

    const urlSolveclubId = this.extractSolveclubIdFromUrl(window.location.href);
    if (urlSolveclubId) {
      log.debug("solveclubId found in URL:", urlSolveclubId);
      return urlSolveclubId;
    }

    const referrer = document.referrer;
    if (referrer) {
      const referrerSolveclubId = this.extractSolveclubIdFromUrl(referrer);
      if (referrerSolveclubId) {
        log.debug("solveclubId found in referrer:", referrerSolveclubId);
        return referrerSolveclubId;
      }
    }

    const savedContext = this.loadSolvingClubContext();
    if (savedContext?.solveclubId) {
      log.debug("solveclubId found in saved context:", savedContext.solveclubId);
      return savedContext.solveclubId;
    }

    try {
      const mainForm = (window as unknown as { mainForm?: HTMLFormElement }).mainForm;
      if (mainForm) {
        const formElement = mainForm.elements.namedItem("solveclubId") as HTMLInputElement | null;
        if (formElement?.value) {
          log.debug("solveclubId found in mainForm:", formElement.value);
          return formElement.value;
        }
      }
    } catch (e) {
      log.debug("Could not access mainForm:", e);
    }

    log.debug("No solveclubId found from any source");
    return null;
  }

  private getFormData(): SWEAFormData {
    const contestProbIdEl = document.querySelector<HTMLInputElement>("#contestProbId");
    const categoryTypeEl = document.querySelector<HTMLInputElement>(
      "form[name='mainForm'] input[name='categoryType'], input[name='categoryType'], #categoryType"
    );
    const categoryIdEl = document.querySelector<HTMLInputElement>(
      "form[name='mainForm'] input[name='categoryId'], input[name='categoryId'], #categoryId"
    );

    const formData: SWEAFormData = {
      contestProbId: contestProbIdEl?.value || "",
      categoryType: categoryTypeEl?.value || "",
      categoryId: categoryIdEl?.value || "",
      solveclubId: this.getSolveclubId(),
    };

    log.debug("Form data:", formData);
    return formData;
  }

  private disableModalConfirmButton(): void {
    const confirmButtons = document.querySelectorAll<HTMLButtonElement>(
      "div.popup_layer.show button, div.popup_layer.show .btn"
    );
    confirmButtons.forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
  }

  private async parseAndUpload(): Promise<void> {
    try {
      startUpload();

      const parsedData = await parseData();
      if (!parsedData) {
        log.error("parseData 실패: 데이터를 파싱할 수 없습니다.");
        return;
      }

      // Get platform username from storage or current page
      const storageResult = await chrome.storage.local.get(['platform_swea_nickname']);
      const platformUsername = storageResult.platform_swea_nickname || getNickname() || "";

      // Use smartUpload for automatic routing (GitHub or ssafy.today direct)
      await this.smartUpload(
        parsedData as unknown as UploadData,
        uploadOneSolveProblemOnGit,
        markUploadedCSS,
        platformUsername
      );
    } catch (error) {
      log.error("Error in SWEA parseAndUpload:", error);
    }
  }

  private startSubmissionMonitoring(): void {
    Toast.info("SW Expert Academy 문제 모니터링을 시작합니다.", 3000);

    const checker = SubmissionChecker.createTextChecker(
      "div.popup_layer.show > div > p.txt",
      "pass입니다",
      { caseSensitive: false }
    );

    const onSuccess = async (): Promise<void> => {
      log.info("정답이 나왔습니다. 코드를 저장하고 결과 페이지로 이동합니다.");

      try {
        this.disableModalConfirmButton();

        const codeResult = await parseCode();
        if (!codeResult) {
          log.error("코드 파싱에 실패했습니다.");
          return;
        }

        const formData = this.getFormData();
        const redirectUrl = this.buildRedirectUrl(codeResult.contestProbId, formData, codeResult.problemId);
        log.info("결과 페이지로 이동:", redirectUrl);
        window.location.href = redirectUrl;
      } catch (error) {
        log.error("SWEA 제출 처리 중 오류:", error);
      }
    };

    // skipEnableCheck: true 옵션으로 비활성화 상태에서도 모니터링
    this.setupSubmissionMonitoring(checker, onSuccess, { skipEnableCheck: true });
  }

  private buildRedirectUrl(contestProbId: string, formData: SWEAFormData, problemId?: string): string {
    const origin = window.location.origin;

    if (formData.solveclubId) {
      const baseUrl = `${origin}/main/talk/solvingClub/problemPassedUser.do`;
      const params = new URLSearchParams({
        contestProbId,
        solveclubId: formData.solveclubId,
        probBoxId: formData.categoryId,
        extension: "BaekjoonHub",
      });
      // Add problemId to URL for cache lookup on result page
      if (problemId) {
        params.set("problemId", problemId);
      }
      return `${baseUrl}?${params.toString()}`;
    }

    const baseUrl = `${origin}/main/code/problem/problemSolver.do`;
    const params = new URLSearchParams({
      contestProbId,
      nickName: getNickname(),
      extension: "BaekjoonHub",
    });
    // Add problemId to URL for cache lookup on result page
    if (problemId) {
      params.set("problemId", problemId);
    }
    return `${baseUrl}?${params.toString()}`;
  }
}

new SWExpertAcademyHub();
