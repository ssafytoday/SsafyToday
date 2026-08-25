/**
 * Common submission service for all platforms
 * Sends solved-problem submissions to the ssafy.today backend
 */
import { isNull, isEmpty, preProcessEmptyObj } from "./util";
import { toISOString } from "./date-util";
import log from "@/commons/logger";
import { SsafyAPIService, type SubmissionData } from "./ssafy-api";
import { enqueuePendingSubmission, removePendingSubmission } from "./pending-submissions";
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

      if (!platform) {
        log.warn("sendToSsafyTodayDirect: Missing platform");
        return { success: false, error: "Missing platform" };
      }

      // ssafy.today 계정을 함께 실어 보낸다 — 플랫폼 닉네임이 어긋나 있어도
      // 백엔드가 이 계정으로 먼저 주인을 찾는다(닉네임 폴백은 그대로 유지).
      // 미방문·로그아웃이면 빈 값이라 예전과 똑같이 닉네임만으로 매칭된다.
      const account = await getSsafyAccount();

      // 신원은 **둘 중 하나만** 있으면 된다. 백엔드는 2026-08-11부터 ssafy.today
      // 계정을 1순위로 조회하고(_find_user_by_ssafy_account), 계정만 온 경우를
      // 위한 전용 분기까지 갖고 있다. 예전처럼 platformUsername 을 필수로 막으면
      // 계정으로 찾을 수 있었던 제출까지 **전송도 큐 적재도 없이** 버려진다 —
      // SWEA GNB 가 안 잡히거나 플랫폼 세션이 끊긴 순간이 전부 여기로 샜다.
      if (!platformUsername && !account.username && !account.email) {
        log.warn("sendToSsafyTodayDirect: no identity (platform username nor ssafy account)");
        return {
          success: false,
          error: "ssafy.today 로그인 정보를 찾을 수 없습니다. ssafy.today에 로그인한 뒤 다시 시도해주세요.",
        };
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

      const submissionData: SubmissionData = {
        username: "",
        platformUsername: platformUsername || "",
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

      // **보내기 전에 먼저 큐에 적는다(write-ahead).** POST 가 응답을 받기 전에
      // 페이지가 이동하거나 content script 가 파괴되면 fetch 가 통째로 사라지는데,
      // 그러면 성공도 실패도 아니어서 catch 조차 돌지 않고 그 풀이가 조용히
      // 유실된다(라이브 로그: 프리플라이트 307건 중 70건이 POST 없이 끝났고
      // 그중 68건이 SWEA다 — 제자리 업로드 도입 직후부터). 선기록해 두면 다음
      // 페이지 로드의 flush 가 이어받고, 이미 저장된 건이면 백엔드가 duplicate
      // 로 흡수하므로 중복 위험도 없다.
      await enqueuePendingSubmission(submissionData);

      const result = await SsafyAPIService.sendSubmission(submissionData);
      if (result.success) {
        log.info("SSAFY Today direct submission sent successfully:", result.data);
        await removePendingSubmission(submissionData);
      } else {
        log.warn("SSAFY Today direct submission failed:", result.error);
        if (result.errorCode === "INVALID_REQUEST") {
          // 페이로드 자체가 거부됨 — 재시도해도 영원히 실패하므로 큐에 두지 않는다
          // (flush 의 폐기 규칙과 같은 판단을 여기서 미리 내린다).
          await removePendingSubmission(submissionData);
        }
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
