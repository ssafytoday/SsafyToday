/**
 * Common submission service for all platforms
 * Sends solved-problem submissions to the ssafy.today backend
 */
import { isNull, isEmpty, preProcessEmptyObj } from "./util";
import { toISOString } from "./date-util";
import log from "@/commons/logger";
import { SsafyAPIService, type SubmissionData } from "./ssafy-api";
import { enqueuePendingSubmission } from "./pending-submissions";
import { getSsafyAccount } from "./ssafy-account";
import type { BaseProblemInfo } from "@/types/problem";
import type { UploadHandlerResult, ParseDataFunction, StartUploadFunction } from "@/types/upload";

// Problem data required to build a submission
interface SubmissionProblemData {
  code: string;
  platform?: string;
  problemInfo?: BaseProblemInfo;
  platformUsername?: string;  // 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
}

/**
 * Common submission service for all platforms
 */
export default class UploadService {
  /**
   * ssafy.today로 제출 기록 전송
   *
   * @param problemData - 문제 데이터
   * @param platformUsername - 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
   */
  static async sendToSsafyTodayDirect(
    problemData: SubmissionProblemData,
    platformUsername: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { code, platform, problemInfo } = problemData;

      if (!platformUsername || !platform) {
        log.warn("sendToSsafyTodayDirect: Missing platformUsername or platform");
        return { success: false, error: "Missing platformUsername or platform" };
      }

      // 기본 problemData 구성
      const problemDataBase = {
        problemId: String(problemInfo?.problemId || ""),
        title: problemInfo?.title || "",
        level: problemInfo?.level || "",
        language: problemInfo?.language || "",
        code: code,
        runtime: problemInfo?.runtime || "",
        memory: problemInfo?.memory || "",
        submissionTime: toISOString(problemInfo?.submissionTime),
        tags: (Array.isArray(problemInfo?.tags) ? problemInfo.tags : []) as string[],
        link: (typeof problemInfo?.link === "string" ? problemInfo.link : undefined) as string | undefined,
      };

      // 플랫폼별 추가 필드
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const info = problemInfo as any;
      let platformSpecificData = {};

      if (platform === "백준") {
        platformSpecificData = {
          problemDescription: info?.problem_description || "",
          problemInput: info?.problem_input || "",
          problemOutput: info?.problem_output || "",
        };
      } else if (platform === "프로그래머스") {
        platformSpecificData = {
          division: info?.division || "",
          resultMessage: info?.result_message || "",
        };
      } else if (platform === "SWEA" || platform === "SW Expert Academy") {
        // SWEA 허브는 platformName을 "SWEA"로 넘긴다(백엔드 platform 값과 동일).
        // "SW Expert Academy"(PLATFORMS.SWEXPERTACADEMY)만 보던 과거 분기는
        // 죽어 있어서 length가 항상 누락됐다 — 두 표기를 모두 받는다.
        platformSpecificData = {
          length: info?.length || "",
        };
      }

      // ssafy.today 계정을 함께 실어 보낸다 — 플랫폼 닉네임이 어긋나 있어도
      // 백엔드가 이 계정으로 먼저 주인을 찾는다(닉네임 폴백은 그대로 유지).
      // 미방문·로그아웃이면 빈 값이라 예전과 똑같이 닉네임만으로 매칭된다.
      const account = await getSsafyAccount();

      const submissionData: SubmissionData = {
        username: "",
        platformUsername: platformUsername,
        ssafyUsername: account.username,
        ssafyEmail: account.email,
        platform: platform,
        problemData: {
          ...problemDataBase,
          ...platformSpecificData,
        },
        metadata: {
          extensionVersion: chrome.runtime.getManifest().version,
          timestamp: new Date().toISOString(),
        },
      };

      const result = await SsafyAPIService.sendSubmission(submissionData);
      if (result.success) {
        log.info("SSAFY Today direct submission sent successfully:", result.data);
      } else {
        log.warn("SSAFY Today direct submission failed:", result.error);
        // 미연동(USER_NOT_FOUND) 등으로 실패한 제출은 큐에 보관 후 재시도
        await enqueuePendingSubmission(submissionData);
      }
      return result;
    } catch (error) {
      log.error("sendToSsafyTodayDirect error:", error);
      return { success: false, error: String(error) };
    }
  }
}

/**
 * Factory for creating platform-specific submission handlers
 */
export class UploadHandlerFactory {
  /**
   * Create a submission handler for a specific platform
   * @param platformName - Name of the platform
   * @param parseDataFunction - Platform-specific data parsing function
   * @param startUploadFunction - Platform-specific start function
   */
  static create(
    platformName: string,
    parseDataFunction: ParseDataFunction,
    startUploadFunction?: StartUploadFunction
  ): () => Promise<UploadHandlerResult> {
    return async function () {
      try {
        const rawData = await parseDataFunction();

        if (isNull(rawData)) {
          log.debug(`${platformName}: parseDataFunction returned null/undefined`);
          return { success: false, error: "Parse data failed" };
        }

        const processedData = preProcessEmptyObj(rawData as Record<string, unknown>);
        log.debug(`${platformName} processed data:`, processedData);

        if (isEmpty(processedData) || isNull(processedData)) {
          log.debug(`No data to send for ${platformName}`);
          return { success: false, error: "No data to send" };
        }

        // Signal start of submission process
        if (startUploadFunction) {
          startUploadFunction();
        }

        return { success: true, data: processedData };
      } catch (error) {
        log.error(`Error in ${platformName} submission handler:`, error);
        throw error;
      }
    };
  }
}
