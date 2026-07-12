/**
 * Base class for all platform hub implementations
 * Provides common functionality for submission monitoring and upload handling
 */
import { isNull, isEmpty, calculateBlobSHA, getVersion } from "@/commons/util";
import { getStats, getHook, getToken, saveStats, updateLocalStorageStats, getStatsSHAfromPath } from "@/commons/storage";
import { Toast } from "@/commons/toast";
import { checkEnable } from "@/commons/enable";
import { LoaderFactory, LoaderService } from "@/commons/loader-service";
import UploadService, { UploadHandlerFactory } from "@/commons/upload-service";
import log from "@/commons/logger";
import { TIMEOUTS, RETRY_LIMITS } from "@/constants/config";
import type { PlatformConfig, CheckCondition, SuccessCallback } from "@/types/platform";
import type { BaseProblemInfo, ProblemInfoMapper } from "@/types/problem";
import type { UploadCallback, MarkFunction, ParseDataFunction, StartUploadFunction, UploadHandlerResult } from "@/types/upload";

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
   * When true, submission monitoring and upload will work even when extension is disabled
   * Useful for platforms that want to submit to ssafy.today API regardless of GitHub integration status
   */
  skipEnableCheck?: boolean;
}

// Upload data interface
export interface UploadData {
  directory: string;
  fileName: string;
  code: string;
  platformUsername?: string;  // 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
  [key: string]: unknown;
}

/**
 * Base class for all platform hub implementations
 * Provides common functionality for submission monitoring and upload handling
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
          log.info(`정답이 나왔습니다. ${this.config.platformName} 업로드를 시작합니다.`);
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
   * Generic upload handler creation and execution
   * @param parseDataFn - Data parsing function
   * @param uploadFn - Upload function
   * @param markFn - Mark uploaded function
   * @param startUploadFn - Start upload function
   */
  async createAndExecuteUploadHandler(
    parseDataFn: ParseDataFunction,
    uploadFn: unknown,
    markFn: MarkFunction,
    startUploadFn?: StartUploadFunction
  ): Promise<UploadHandlerResult> {
    const uploadHandler = UploadHandlerFactory.create(
      this.config.platformName || "unknown",
      parseDataFn,
      uploadFn,
      markFn,
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
   * Common upload logic for all platforms
   * @param data - Parsed problem data
   * @param uploadFunction - Platform-specific upload function
   * @param markFunction - Platform-specific mark function
   */
  async beginUpload(
    data: UploadData,
    uploadFunction: (data: UploadData, callback: UploadCallback) => Promise<void>,
    markFunction: MarkFunction
  ): Promise<void> {
    try {
      log.debug(`${this.config.platformName} data:`, data);

      if (isEmpty(data)) {
        log.debug(`No data to upload for ${this.config.platformName}`);
        return;
      }

      const [stats, hook] = await Promise.all([getStats(), getHook()]);
      const currentVersion = stats.version;

      const shouldUpdateVersion =
        isNull(currentVersion) ||
        currentVersion !== getVersion() ||
        isNull(await getStatsSHAfromPath(hook || ""));

      if (shouldUpdateVersion) {
        await this.versionUpdate();
      }

      const filePath = `${hook}/${data.directory}/${data.fileName}`;
      const [cachedSHA, calcSHA] = await Promise.all([
        getStatsSHAfromPath(filePath),
        calculateBlobSHA(data.code),
      ]);

      log.debug("cachedSHA", cachedSHA, "calcSHA", calcSHA);

      if (cachedSHA === calcSHA) {
        markFunction(stats.branches, data.directory);
        log.info(`현재 제출번호를 업로드한 기록이 있습니다. (${this.config.platformName})`);
        return;
      }

      await uploadFunction(data, markFunction);
    } catch (error) {
      log.error(`Error in ${this.config.platformName} upload:`, error);
      Toast.raiseToast(`${this.config.platformName} 업로드 중 오류가 발생했습니다.`);
    }
  }

  /**
   * Update version information
   */
  async versionUpdate(): Promise<void> {
    try {
      log.info(`start versionUpdate for ${this.config.platformName}`);
      const stats = await updateLocalStorageStats();
      stats.version = getVersion();
      await saveStats(stats);
      log.debug("stats updated.", stats);
    } catch (error) {
      log.error(`Error updating version for ${this.config.platformName}:`, error);
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
   * Create a generic upload function for platform-specific implementations
   * This eliminates code duplication across platform upload functions
   * @param platformName - Platform display name
   * @param problemInfoMapper - Function to map problem data to platform-specific format
   */
  static createUploadFunction<T extends BaseProblemInfo>(
    platformName: string,
    problemInfoMapper?: ProblemInfoMapper<T>
  ): (problemData: UploadData, callback: UploadCallback) => Promise<void> {
    return async function uploadOneSolveProblemOnGit(
      problemData: UploadData,
      callback: UploadCallback
    ): Promise<void> {
      try {
        const enhancedData = {
          ...problemData,
          platform: platformName,
          platformUsername: problemData.platformUsername,  // 플랫폼별 사용자명 전달
          problemInfo: problemInfoMapper
            ? problemInfoMapper(problemData as unknown as Partial<T>)
            : problemData.problemInfo,
          readme: (problemData.readme as string) || "",
          message: (problemData.message as string) || "",
        };
        await UploadService.uploadProblem(
          enhancedData as unknown as {
            code: string;
            readme: string;
            directory: string;
            fileName: string;
            message: string;
            platformUsername?: string;
          },
          callback
        );
      } catch (error) {
        log.error(`Error in ${platformName} upload function:`, error);
        throw error;
      }
    };
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
   * Check if GitHub authentication is available
   * @returns True if user has GitHub OAuth token and hook configured
   */
  async hasGitHubAuth(): Promise<boolean> {
    const [token, hook] = await Promise.all([getToken(), getHook()]);
    return !isNull(token) && !isNull(hook) && token !== "" && hook !== "";
  }

  /**
   * Send submission to ssafy.today only (without GitHub upload)
   * Used when user has no GitHub authentication
   *
   * @param data - Parsed problem data
   * @param platformUsername - Platform-specific username (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
   */
  async sendToSsafyTodayOnly(
    data: UploadData,
    platformUsername: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      log.debug(`${this.config.platformName} - Sending to ssafy.today only (no GitHub auth)`);

      if (isEmpty(data)) {
        log.debug(`No data to send for ${this.config.platformName}`);
        return { success: false, error: "No data to send" };
      }

      if (!platformUsername) {
        log.warn(`${this.config.platformName} - No platform username available`);
        Toast.raiseToast(`${this.config.platformName} 사용자명을 찾을 수 없습니다.`);
        return { success: false, error: "Platform username not found" };
      }

      // Convert UploadData to UploadProblemData format
      // problemInfo가 없으면 data에서 직접 필드 추출 (parseData가 flat 구조로 반환하는 경우)
      const problemData = {
        code: data.code,
        readme: (data.readme as string) || "",
        directory: data.directory,
        fileName: data.fileName,
        message: (data.message as string) || "",
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
   * Smart upload - routes to GitHub or ssafy.today based on authentication status
   *
   * @param data - Parsed problem data
   * @param uploadFunction - Platform-specific upload function (used for GitHub)
   * @param markFunction - Platform-specific mark function (used for GitHub)
   * @param platformUsername - Platform-specific username for ssafy.today direct upload
   */
  async smartUpload(
    data: UploadData,
    uploadFunction: (data: UploadData, callback: UploadCallback) => Promise<void>,
    markFunction: MarkFunction,
    platformUsername: string
  ): Promise<void> {
    const hasAuth = await this.hasGitHubAuth();

    // platformUsername을 data에 주입하여 ssafy.today 전송 시 사용
    const dataWithUsername: UploadData = {
      ...data,
      platformUsername: platformUsername,
    };

    if (hasAuth) {
      // GitHub 인증 있음: 기존 흐름 (GitHub 업로드 → ssafy.today 자동 전송)
      log.info(`${this.config.platformName} - GitHub auth available, using full upload flow`);
      await this.beginUpload(dataWithUsername, uploadFunction, markFunction);
    } else {
      // GitHub 인증 없음: ssafy.today로만 전송
      log.info(`${this.config.platformName} - No GitHub auth, sending to ssafy.today directly`);
      await this.sendToSsafyTodayOnly(dataWithUsername, platformUsername);
    }
  }
}
