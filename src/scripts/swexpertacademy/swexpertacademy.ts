import PlatformHubBase, { Toast, log, checkEnable, type UploadData } from "@/commons/platformhub-base";
import { SubmissionChecker } from "@/commons/loader-service";
import {
  parseCode,
  parseData,
  updateTextSourceEvent,
  type ParsedProblemData,
} from "@/swexpertacademy/parsing";
import { startUpload, markUploadFailedCSS, getNickname } from "@/swexpertacademy/util";
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
  /** 제자리 업로드 후 팝업이 닫히기를 기다리는 재무장 타이머 */
  private rearmTimer: ReturnType<typeof setInterval> | null = null;
  /** disableModalConfirmButton()이 실제로 잠근 버튼들 (복구용) */
  private disabledModalButtons: HTMLButtonElement[] = [];

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
    this.disabledModalButtons = [];
    confirmButtons.forEach((btn) => {
      this.disabledModalButtons.push(btn);
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    });
  }

  /**
   * 잠갔던 결과 팝업 버튼을 되돌립니다.
   * 제자리 처리 후에는 페이지가 유지되므로 버튼을 잠근 채로 두면 사용자가 팝업을
   * 닫지 못하고, 팝업이 닫혀야 진행되는 재무장(rearmAfterPopupClose)도 멈춘다.
   */
  private restoreModalConfirmButton(): void {
    this.disabledModalButtons.forEach((btn) => {
      btn.disabled = false;
      btn.style.opacity = "";
      btn.style.cursor = "";
    });
    this.disabledModalButtons = [];
  }

  private async parseAndUpload(): Promise<void> {
    try {
      startUpload();

      const parsedData = await parseData();
      if (!parsedData) {
        log.error("parseData 실패: 데이터를 파싱할 수 없습니다.");
        return;
      }

      await this.sendParsedSubmission(parsedData);
    } catch (error) {
      log.error("Error in SWEA parseAndUpload:", error);
    }
  }

  /**
   * 파싱된 제출 데이터를 ssafy.today로 전송합니다.
   * (결과 페이지 경로와 제자리 업로드 경로가 공유)
   */
  private async sendParsedSubmission(parsedData: ParsedProblemData): Promise<void> {
    // Get platform username from storage or current page
    const storageResult = await chrome.storage.local.get(['platform_swea_nickname']);
    const platformUsername = storageResult.platform_swea_nickname || getNickname() || "";

    await this.smartUpload(parsedData as unknown as UploadData, platformUsername);
  }

  /**
   * 결과 페이지로 이동하지 않고, 해당 페이지 HTML을 fetch해 DOMParser로 파싱한 뒤
   * 현재 화면(solvingProblem.do)에서 전송까지 처리합니다.
   * 남은 최대 병목이던 결과 페이지 전체 로드를 제출 체인에서 제거한다.
   *
   * - 성공 / 전송 단계 실패: true 반환 (전송 오류는 페이지를 이동해도 동일하게
   *   실패하므로 폴백하지 않는다)
   * - 데이터 확보(fetch/파싱) 실패: false 반환 → 호출부가 기존 내비게이션으로 폴백
   *
   * @param resultUrl - 결과 페이지 URL (extension=BaekjoonHub 파라미터 포함)
   */
  private async tryUploadInPlace(resultUrl: string): Promise<boolean> {
    let parsedData: ParsedProblemData | undefined;
    try {
      const response = await fetch(resultUrl, { credentials: "same-origin" });
      if (!response.ok) {
        log.error(`결과 페이지 fetch 실패(${response.status}) — 페이지 이동 방식으로 폴백합니다.`);
        return false;
      }
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      parsedData = await parseData(doc, resultUrl);
    } catch (error) {
      log.error("결과 페이지 fetch/파싱 실패 — 페이지 이동 방식으로 폴백합니다.", error);
      return false;
    }

    if (!parsedData) {
      // 파싱 결과가 비어 있는 경우(닉네임 불일치·DOM 변경·서버 렌더 누락 등)
      // 실제 결과 페이지에서 한 번 더 시도할 기회를 준다.
      log.debug("제자리 파싱 결과가 비었습니다 — 페이지 이동 방식으로 폴백합니다.");
      return false;
    }

    try {
      startUpload();
      await this.sendParsedSubmission(parsedData);
    } catch (error) {
      log.error("제자리 전송 중 오류가 발생했습니다.", error);
      markUploadFailedCSS();
    }
    return true;
  }

  /**
   * 결과 팝업이 닫힌 뒤 정답 감지를 재무장합니다.
   * 팝업이 떠 있는 동안 바로 재무장하면 같은 'pass입니다' 텍스트로 즉시 재트리거되어
   * 루프가 되므로, popup_layer 의 show 클래스가 사라진 것을 확인한 뒤 되돌린다.
   */
  private rearmAfterPopupClose(): void {
    if (this.rearmTimer) return;
    this.rearmTimer = setInterval(() => {
      // 확장 업데이트/재설치로 컨텍스트가 무효화되면 타이머만 남으므로 정리한다.
      if (!chrome.runtime?.id) {
        this.clearRearmTimer();
        return;
      }
      if (!document.querySelector("div.popup_layer.show")) {
        this.clearRearmTimer();
        this.startSubmissionMonitoring({ silent: true });
      }
    }, 500);
  }

  private clearRearmTimer(): void {
    if (this.rearmTimer) {
      clearInterval(this.rearmTimer);
      this.rearmTimer = null;
    }
  }

  /**
   * @param options.silent - 재무장 시에는 모니터링 시작 토스트를 다시 띄우지 않는다
   */
  private startSubmissionMonitoring(options: { silent?: boolean } = {}): void {
    if (!options.silent) {
      Toast.info("SW Expert Academy 문제 모니터링을 시작합니다.", 3000);
    }

    const checker = SubmissionChecker.createTextChecker(
      "div.popup_layer.show > div > p.txt",
      "pass입니다",
      { caseSensitive: false }
    );

    const onSuccess = async (): Promise<void> => {
      log.info("정답이 나왔습니다. 코드를 저장하고 제출 기록을 전송합니다.");

      try {
        this.disableModalConfirmButton();

        const codeResult = await parseCode();
        if (!codeResult) {
          log.error("코드 파싱에 실패했습니다.");
          this.restoreModalConfirmButton();
          // 실패해도 반드시 재무장한다 — LoaderService.start 가 onSuccess 앞에서
          // stop() 을 부르는데, v3.5.8 이 결과 페이지 이동을 없애면서 새 content
          // script 로 되살아나던 자연 복구까지 사라졌다. 재무장하지 않으면 이 탭은
          // 이후 어떤 제출도 감지하지 못하고, 사용자에게는 아무 신호도 없다.
          this.rearmAfterPopupClose();
          return;
        }

        const formData = this.getFormData();
        const redirectUrl = this.buildRedirectUrl(codeResult.contestProbId, formData, codeResult.problemId);

        // 결과 페이지로 이동하지 않고 현재 화면에서 fetch로 파싱·전송까지 처리한다.
        // 데이터 확보에 실패한 경우에만 기존 방식(결과 페이지 이동)으로 폴백한다.
        const handled = await this.tryUploadInPlace(redirectUrl);
        if (!handled) {
          log.info("결과 페이지로 이동:", redirectUrl);
          window.location.href = redirectUrl;
          return;
        }

        // 제자리 처리 후에는 페이지가 유지되므로 팝업 버튼을 되돌리고, 팝업이 닫히면
        // 감지를 재무장해 같은 화면에서의 재제출도 이어서 처리한다.
        this.restoreModalConfirmButton();
        this.rearmAfterPopupClose();
      } catch (error) {
        log.error("SWEA 제출 처리 중 오류:", error);
        this.restoreModalConfirmButton();
        // 위와 같은 이유 — 예외 한 번이 그 탭의 감지를 영구히 끄지 않게 한다.
        this.rearmAfterPopupClose();
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
