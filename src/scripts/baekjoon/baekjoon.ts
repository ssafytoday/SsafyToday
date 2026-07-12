/**
 * SsafyToday Baekjoon platform entry point
 * Content script for acmicpc.net (Baekjoon Online Judge)
 */
import PlatformHubBase, { log, checkEnable, type UploadData } from "@/commons/platformhub-base";
import { isEmpty, isNull } from "@/commons/util";
import { RESULT_MESSAGE, bjLevel } from "@/baekjoon/variables";
import { TIMEOUTS, RETRY_LIMITS, RESULT_MESSAGES, PLATFORMS } from "@/constants/config";
import {
  findUsername,
  startUpload,
  markUploadedCSS,
  isExistResultTable,
  startMonitoringToast,
} from "@/baekjoon/util";
import { findData, parseProblemDescription, parsingResultTableList, getSolvedACById } from "@/baekjoon/parsing";
import uploadOneSolveProblemOnGit from "@/baekjoon/uploadfunctions";
import { initHintForProblem, cleanupHint } from "@/commons/hint-integration";

// Submission data interface
interface SubmissionData {
  problemId?: string;
  submissionId?: string;
  username?: string;
  result?: string;
  resultCategory?: string;
  language?: string;
  runtime?: string;
  memory?: string;
  codeLength?: string;
  submissionTime?: string;
  elementId?: string;
  [key: string]: string | undefined;
}

/**
 * BaekjoonHub class for handling Baekjoon Online Judge submissions
 * Extends PlatformHubBase for common platform functionality
 */
class BaekjoonHub extends PlatformHubBase {
  private username: string | null = null;

  constructor() {
    super({
      platformName: PLATFORMS.BAEKJOON,
      loaderInterval: TIMEOUTS.LOADER_INTERVAL,
      // API 제출을 위해 enable 체크를 건너뜀 (비활성화 상태에서도 동작)
      skipEnableCheck: true,
    });

    this.username = findUsername();
  }

  /**
   * Initialize the SsafyToday Baekjoon extension
   */
  async init(): Promise<boolean> {
    log.info(`Initializing ${this.config.platformName} hub`);

    // Retry finding username with exponential backoff
    const foundUsername = await this.retryFindUsername();
    if (!foundUsername) {
      log.warn("Could not find username after multiple retries");
      return false;
    }

    const requiredParams = ["status", `user_id=${this.username}`, "problem_id", "from_mine=1"];

    log.debug("SsafyToday Debug - Required params:", requiredParams);
    log.debug(
      "SsafyToday Debug - URL contains all params:",
      requiredParams.every((key) => this.currentUrl.includes(key))
    );

    // 제출 모니터링은 활성화 여부와 관계없이 동작
    if (requiredParams.every((key) => this.currentUrl.includes(key))) {
      log.debug("SsafyToday Debug - Starting submission monitoring");
      this.startSubmissionMonitoring();
    } else if (/\.net\/problem\/\d+/.test(this.currentUrl)) {
      log.debug("SsafyToday Debug - Parsing problem description");
      parseProblemDescription();
      // Hint UI는 enable 상태일 때만 활성화
      const isEnabled = await checkEnable();
      if (isEnabled) {
        this.initHintUI();
      }
    } else if (/\.net\/submit\/\d+/.test(this.currentUrl)) {
      // Hint UI는 enable 상태일 때만 활성화
      const isEnabled = await checkEnable();
      if (isEnabled) {
        this.initHintUI();
      }
    } else {
      log.debug("SsafyToday Debug - No matching URL pattern");
    }

    return true;
  }

  /**
   * Initialize AI hint UI for the current problem
   */
  private async initHintUI(): Promise<void> {
    try {
      // Extract problem ID from URL
      const problemIdMatch = this.currentUrl.match(/(?:problem|submit)\/(\d+)/);
      if (!problemIdMatch) {
        log.debug("SsafyToday Debug - Could not extract problem ID for hint UI");
        return;
      }

      const problemId = problemIdMatch[1];
      log.debug("SsafyToday Debug - Initializing hint UI for problem:", problemId);

      // Get problem data from Solved.ac
      const solvedData = await getSolvedACById(problemId);
      if (!solvedData) {
        log.warn("SsafyToday Debug - Could not get Solved.ac data for hint UI");
        // Still initialize with basic info
        const titleElement = document.getElementById("problem_title");
        const title = titleElement?.textContent?.trim() || `Problem ${problemId}`;

        initHintForProblem(
          "baekjoon",
          {
            id: problemId,
            title,
            level: "Unknown",
            description: this.getProblemDescription(),
          },
          this.getCurrentCode.bind(this)
        );
        return;
      }

      // Extract data from Solved.ac response
      const solvedProblem = solvedData as {
        titleKo?: string;
        level?: number;
        tags?: Array<{ displayNames: Array<{ language: string; name: string }> }>;
      };

      const title = solvedProblem.titleKo || `Problem ${problemId}`;
      const level = bjLevel[solvedProblem.level || 0] || "Unrated";
      const tags = solvedProblem.tags
        ?.flatMap((tag) => tag.displayNames)
        ?.filter((tag) => tag.language === "ko")
        ?.map((tag) => tag.name);

      initHintForProblem(
        "baekjoon",
        {
          id: problemId,
          title,
          level,
          description: this.getProblemDescription(),
          tags,
        },
        this.getCurrentCode.bind(this)
      );

      log.info(`SsafyToday - Hint UI initialized for: ${title}`);
    } catch (error) {
      log.error("SsafyToday Debug - Error initializing hint UI:", error);
    }
  }

  /**
   * Get problem description from the current page
   */
  private getProblemDescription(): string {
    const descElement = document.getElementById("problem_description");
    return descElement?.textContent?.trim().slice(0, 2000) || "";
  }

  /**
   * Get current code from the editor (if on submit page)
   */
  private getCurrentCode(): string {
    // Try to get code from submit page textarea
    const sourceTextarea = document.getElementById("source") as HTMLTextAreaElement | null;
    if (sourceTextarea?.value) {
      return sourceTextarea.value;
    }

    // Try CodeMirror editor
    const cmElement = document.querySelector(".CodeMirror") as HTMLElement & {
      CodeMirror?: { getValue: () => string };
    } | null;
    if (cmElement?.CodeMirror) {
      return cmElement.CodeMirror.getValue();
    }

    // Try Ace editor
    const aceEditor = (window as unknown as { editor?: { getValue: () => string } }).editor;
    if (aceEditor?.getValue) {
      return aceEditor.getValue();
    }

    return "";
  }

  /**
   * Retry finding username with exponential backoff
   * @returns True if username found
   */
  private async retryFindUsername(): Promise<boolean> {
    for (let i = 0; i < RETRY_LIMITS.USERNAME_MAX_RETRIES; i++) {
      this.username = findUsername();
      if (!isNull(this.username)) {
        log.debug("Username found:", this.username);
        // 회원가입 연동을 위해 사용자명 저장
        try {
          await chrome.storage.local.set({
            platform_baekjoon_username: this.username
          });
          log.debug("Baekjoon username saved to storage:", this.username);
        } catch (e) {
          log.warn("Failed to save baekjoon username to storage:", e);
        }
        return true;
      }

      if (i < RETRY_LIMITS.USERNAME_MAX_RETRIES - 1) {
        const delay = Math.min(
          TIMEOUTS.USERNAME_RETRY * Math.pow(2, i),
          TIMEOUTS.MAX_RETRY_WAIT
        );
        log.debug(
          `Username not found, retrying in ${delay}ms (attempt ${i + 1}/${RETRY_LIMITS.USERNAME_MAX_RETRIES})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return false;
  }

  /**
   * Start monitoring for successful submissions
   */
  private async startSubmissionMonitoring(): Promise<void> {
    // Show monitoring toast when entering submission page
    startMonitoringToast();

    let table: SubmissionData[] = [];

    const checker = (): boolean => {
      log.debug("SsafyToday Debug - Checking for result table...");

      if (!isExistResultTable()) {
        log.debug("SsafyToday Debug - Result table not found");
        return false;
      }

      log.debug("SsafyToday Debug - Result table exists");

      try {
        table = parsingResultTableList(document);
        log.debug("SsafyToday Debug - Table data:", table);
      } catch (error) {
        log.error("SsafyToday Debug - Error parsing result table:", error);
        return false;
      }

      if (isEmpty(table)) {
        log.debug("SsafyToday Debug - Table is empty");
        return false;
      }

      const data = table[0];
      log.debug("SsafyToday Debug - First submission data:", data);

      if (!data) {
        log.debug("SsafyToday Debug - No submission data found");
        return false;
      }

      const isValid = this.isValidSubmission(data);
      log.debug("SsafyToday Debug - Is valid submission:", isValid);
      return isValid;
    };

    const onSuccess = async (): Promise<void> => {
      log.info("풀이가 맞았습니다. 업로드를 시작합니다.");

      // Show upload start toast
      startUpload();

      try {
        if (!table || isEmpty(table)) {
          log.error("SsafyToday Debug - No table data available for upload");
          return;
        }

        const data = table[0];
        log.debug("SsafyToday Debug - Processing submission data:", data);

        // Create and execute upload handler
        const bojData = await this.createAndExecuteUploadHandler(
          () => findData(data),
          uploadOneSolveProblemOnGit,
          markUploadedCSS,
          undefined
        );

        if (isNull(bojData)) {
          log.error("SsafyToday Debug - Failed to get bojData, skipping upload.");
          return;
        }

        log.debug("SsafyToday Debug - Upload data prepared:", bojData);
        // Use smartUpload for automatic routing (GitHub or ssafy.today direct)
        await this.smartUpload(
          bojData.data as UploadData,
          uploadOneSolveProblemOnGit,
          markUploadedCSS,
          this.username || ""
        );
      } catch (error) {
        log.error("SsafyToday Debug - Error during upload process:", error);
      }
    };

    // Setup submission monitoring (skipEnableCheck: true로 비활성화 상태에서도 동작)
    this.setupSubmissionMonitoring(checker, onSuccess, { skipEnableCheck: true });
  }

  /**
   * Check if submission data represents a valid successful submission
   * @param data - Submission data from result table
   * @returns Whether submission is valid and successful
   */
  private isValidSubmission(data: SubmissionData): boolean {
    if (!data) {
      log.debug("SsafyToday Debug - No data provided for validation");
      return false;
    }

    const { username, result } = data;

    log.debug("SsafyToday Debug - Validating submission:", {
      username: username,
      expectedUsername: this.username,
      result: result,
    });

    // Check if required fields exist
    if (
      !Object.prototype.hasOwnProperty.call(data, "username") ||
      !Object.prototype.hasOwnProperty.call(data, "result")
    ) {
      log.debug("SsafyToday Debug - Missing required fields");
      return false;
    }

    // Check if username matches
    if (username !== this.username) {
      log.debug("SsafyToday Debug - Username mismatch");
      return false;
    }

    // Check if result indicates success
    const isAccepted =
      result === RESULT_MESSAGE.ac ||
      result === RESULT_MESSAGE.Accepted ||
      result === RESULT_MESSAGES.BAEKJOON.SUCCESS ||
      result === RESULT_MESSAGES.BAEKJOON.ACCEPTED ||
      (result?.includes("맞았습니다") ?? false) ||
      (result?.startsWith("100") ?? false);

    log.debug("SsafyToday Debug - Result validation:", {
      result: result,
      isAccepted: isAccepted,
    });

    return isAccepted;
  }
}

// Initialize BaekjoonHub
new BaekjoonHub();
