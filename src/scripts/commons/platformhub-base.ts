/**
 * Base class for all platform hub implementations
 * Provides common functionality for submission monitoring and submission handling
 */
import { isEmpty } from "@/commons/util";
import { Toast } from "@/commons/toast";
import { checkEnable } from "@/commons/enable";
import { LoaderFactory, LoaderService } from "@/commons/loader-service";
import UploadService, { UploadHandlerFactory } from "@/commons/upload-service";
import { flushPendingSubmissions } from "@/commons/pending-submissions";
import log from "@/commons/logger";
import { TIMEOUTS, RETRY_LIMITS } from "@/constants/config";
import type { CheckCondition, SuccessCallback } from "@/types/platform";
import type { BaseProblemInfo } from "@/types/problem";
import type { ParseDataFunction, StartUploadFunction, UploadHandlerResult } from "@/types/upload";

// Re-export commonly used utilities for subclasses
export { Toast, checkEnable, log };

// Platform hub configuration interface
interface PlatformHubConfig {
  loaderInterval?: number;
  platformName?: string;
  resultMessages?: {
    SUCCESS: string;
    ACCEPTED?: string;
  };
  /**
   * Skip enable check for API submission
   * When true, submission monitoring and sending will work even when extension is disabled
   */
  skipEnableCheck?: boolean;
}

// Submission data interface
export interface UploadData {
  code: string;
  platformUsername?: string;  // 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
  [key: string]: unknown;
}

/**
 * Base class for all platform hub implementations
 * Provides common functionality for submission monitoring and submission handling
 */
export default class PlatformHubBase {
  protected loader: ReturnType<typeof setInterval> | null = null;
  protected loaderService: LoaderService | null = null;
  protected currentUrl: string;
  protected currentPathname: string;
  protected config: PlatformHubConfig;

  constructor(config: PlatformHubConfig = {}) {
    this.currentUrl = window.location.href;
    this.currentPathname = window.location.pathname;
    this.config = {
      loaderInterval: TIMEOUTS.LOADER_INTERVAL,
      platformName: "unknown",
      ...config,
    };

    this.init().catch((error) => log.error(`Error initializing ${this.config.platformName}:`, error));

    // 이전에 전송 실패해 큐에 남은 제출 재시도 — 페이지 초기화와 경합하지 않게
    // 지연 실행 (페이지 로드당 1회·항목당 30분 간격 제한은 큐 모듈이 관리).
    // 무작위 지터: 여러 탭을 한꺼번에 열 때 flush 타이머가 정렬돼 같은 항목을
    // 동시에 중복 POST하는 것을 완화 (claim 쓰기와 이중 방어)
    setTimeout(
      () => {
        void flushPendingSubmissions();
      },
      5000 + Math.floor(Math.random() * 10000)
    );
  }

  /**
   * Initialize the platform hub
   * This method should be overridden by subclasses
   * @returns Whether initialization was successful
   */
  async init(): Promise<boolean> {
    log.info(`Initializing ${this.config.platformName} hub`);

    // skipEnableCheck가 true면 enable 체크를 건너뜀 (API 제출 전용 모드)
    if (this.config.skipEnableCheck) {
      log.info(`${this.config.platformName} hub running in API-only mode (skipEnableCheck=true)`);
      return true;
    }

    // Check if extension is enabled globally
    const enabled = await checkEnable();
    if (!enabled) {
      log.info(`${this.config.platformName} hub is disabled, skipping initialization`);
      return false;
    }

    return true;
  }

  /**
   * Start the submission monitoring loader
   * @param checkCondition - Function that returns true when submission should be processed
   * @param onSuccess - Function to call when successful submission is detected
   */
  startLoader(checkCondition: CheckCondition, onSuccess: SuccessCallback): void {
    this.loader = setInterval(async () => {
      try {
        const enable = await checkEnable();
        if (!enable) {
          this.stopLoader();
          return;
        }

        if (await checkCondition()) {
          log.info(`정답이 나왔습니다. ${this.config.platformName} 제출 기록을 시작합니다.`);
          this.stopLoader();
          await onSuccess();
        }
      } catch (error) {
        log.error(`Error in ${this.config.platformName} loader:`, error);
        this.stopLoader();
      }
    }, this.config.loaderInterval);
  }

  /**
   * Generic submission monitoring setup using LoaderService
   * @param checker - Checker function or SubmissionChecker instance
   * @param onSuccess - Success callback
   * @param options - Additional options (e.g., skipEnableCheck for API-only submission)
   */
  setupSubmissionMonitoring(
    checker: CheckCondition,
    onSuccess: SuccessCallback,
    options: { skipEnableCheck?: boolean } = {}
  ): void {
    const loader = LoaderFactory.create(this.config.platformName || "unknown", {
      interval: this.config.loaderInterval,
      skipEnableCheck: options.skipEnableCheck,
    });
    loader.start(checker, onSuccess);
    this.loaderService = loader;
  }

  /**
   * Generic submission handler creation and execution
   * @param parseDataFn - Data parsing function
   * @param startUploadFn - Start function
   */
  async createAndExecuteUploadHandler(
    parseDataFn: ParseDataFunction,
    startUploadFn?: StartUploadFunction
  ): Promise<UploadHandlerResult> {
    const uploadHandler = UploadHandlerFactory.create(
      this.config.platformName || "unknown",
      parseDataFn,
      startUploadFn
    );

    return await uploadHandler();
  }

  /**
   * Stop the submission monitoring loader
   */
  stopLoader(): void {
    if (this.loader) {
      clearInterval(this.loader);
      this.loader = null;
    }
    if (this.loaderService) {
      this.loaderService.stop();
      this.loaderService = null;
    }
  }

  /**
   * Check if current URL matches any of the provided patterns
   * @param patterns - URL patterns to match
   */
  matchesUrl(patterns: (string | RegExp)[]): boolean {
    return patterns.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(this.currentUrl) || pattern.test(this.currentPathname);
      }
      return this.currentUrl.includes(pattern);
    });
  }

  /**
   * Safely query DOM element with optional chaining
   * @param selector - CSS selector
   */
  querySelector<T extends Element = Element>(selector: string): T | null {
    return document.querySelector<T>(selector);
  }

  /**
   * Safely query multiple DOM elements
   * @param selector - CSS selector
   */
  querySelectorAll<T extends Element = Element>(selector: string): T[] {
    return Array.from(document.querySelectorAll<T>(selector));
  }

  /**
   * Get text content from element with safe fallback
   * @param selector - CSS selector
   */
  getTextContent(selector: string): string {
    const element = this.querySelector(selector);
    return element?.textContent?.trim() || "";
  }

  /**
   * Retry operation with exponential backoff
   * @param operation - Async operation to retry
   * @param maxRetries - Maximum number of retries
   * @param operationName - Name for logging
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = RETRY_LIMITS.API_MAX_RETRIES,
    operationName = "operation"
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) {
          log.error(`${operationName} failed after ${maxRetries} retries:`, error);
          throw error;
        }
        const delay = Math.min(TIMEOUTS.API_RETRY_BASE * Math.pow(2, i), TIMEOUTS.MAX_RETRY_WAIT);
        log.debug(`${operationName} failed, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error(`${operationName} failed after all retries`);
  }

  /**
   * Send submission to ssafy.today
   *
   * @param data - Parsed problem data
   * @param platformUsername - Platform-specific username (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
   */
  async sendToSsafyTodayOnly(
    data: UploadData,
    platformUsername: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      log.debug(`${this.config.platformName} - Sending to ssafy.today`);

      if (isEmpty(data)) {
        log.debug(`No data to send for ${this.config.platformName}`);
        return { success: false, error: "No data to send" };
      }

      // 플랫폼 닉네임이 비어도 여기서 막지 않는다 — ssafy.today 계정만으로도
      // 백엔드가 주인을 찾을 수 있고(v3.5.10), 신원이 정말 하나도 없을 때만
      // UploadService 가 거른다. 예전에는 여기서 조용히 끊겨 제출이 재시도
      // 큐에도 남지 않고 사라졌다.
      if (!platformUsername) {
        log.warn(
          `${this.config.platformName} - No platform username; falling back to ssafy.today account`
        );
      }

      // problemInfo가 없으면 data에서 직접 필드 추출 (parseData가 flat 구조로 반환하는 경우)
      const problemData = {
        code: data.code,
        platform: this.config.platformName,
        problemInfo: (data.problemInfo as BaseProblemInfo | undefined) || {
          problemId: data.problemId as string,
          title: data.title as string,
          level: data.level as string,
          language: data.language as string,
          runtime: data.runtime as string,
          memory: data.memory as string,
          submissionTime: data.submissionTime as string,
          link: data.link as string,
          length: data.length as string,
          // parseData가 flat 구조로 반환하는 플랫폼별 필드 — 여기서 빠지면
          // division/resultMessage 등이 항상 빈 값으로 백엔드에 저장된다
          division: data.division as string,
          result_message: data.result_message as string,
          problem_description: data.problem_description as string,
          problem_input: data.problem_input as string,
          problem_output: data.problem_output as string,
          tags: data.tags as string[],
        },
      };

      const result = await UploadService.sendToSsafyTodayDirect(problemData, platformUsername);

      if (result.success) {
        Toast.success(`ssafy.today에 ${this.config.platformName} 제출이 기록되었습니다!`, 5000);
      } else {
        Toast.raiseToast(`ssafy.today 기록 실패: ${result.error || "Unknown error"}`);
      }

      return result;
    } catch (error) {
      log.error(`Error sending to ssafy.today for ${this.config.platformName}:`, error);
      Toast.raiseToast(`ssafy.today 전송 중 오류가 발생했습니다.`);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send a parsed submission to ssafy.today
   *
   * @param data - Parsed problem data
   * @param platformUsername - Platform-specific username for ssafy.today
   */
  async smartUpload(data: UploadData, platformUsername: string): Promise<void> {
    // platformUsername을 data에 주입하여 ssafy.today 전송 시 사용
    const dataWithUsername: UploadData = {
      ...data,
      platformUsername: platformUsername,
    };

    await this.sendToSsafyTodayOnly(dataWithUsername, platformUsername);
  }
}
