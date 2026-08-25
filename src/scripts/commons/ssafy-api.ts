/**
 * SsafyToday HTTP API Service
 * Django 백엔드와 HTTP POST 통신
 *
 * API v2.0 - SubmissionRecord 제거, 플랫폼별 Activity 모델 직접 생성
 */
import log from "@/commons/logger";

const SSAFY_API_URL = "https://ssafy.today/api/submissions/";

/**
 * 제출 데이터 인터페이스
 * Django의 UnifiedSubmissionRequestSerializer와 호환
 */
export interface SubmissionData {
  username: string; // 하위 호환용 — 항상 빈 문자열 (백엔드는 platformUsername으로 매칭)
  platformUsername?: string; // 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
  // ssafy.today 로그인 계정 — 백엔드 사용자 조회의 **1순위** 폴백 신원.
  // 플랫폼 닉네임이 어긋나도(연동 불일치) 제출이 주인을 찾게 한다.
  // 백엔드 계약: apis-extension.md §3.1(2026-08-11 추가, 없으면 기존 사슬 그대로)
  ssafyUsername?: string;
  ssafyEmail?: string;
  platform: string; // '백준' | '프로그래머스' | 'SWEA'
  problemData: {
    // 공통 필수 필드
    problemId: string;
    title: string;
    level: string;
    language: string;
    code: string;
    runtime: string;
    memory: string;
    submissionTime: string; // ISO 8601

    // 공통 선택 필드
    tags?: string[];
    link?: string;

    // 백준 전용 (선택)
    problemDescription?: string;
    problemInput?: string;
    problemOutput?: string;

    // 프로그래머스 전용 (선택)
    division?: string;
    resultMessage?: string;

    // SWEA 전용 (선택)
    length?: string;
  };
  metadata: {
    extensionVersion: string;
    timestamp: string; // ISO 8601
  };
}

/**
 * API 응답 인터페이스
 */
export interface SubmissionResponse {
  success: boolean;
  message?: string;
  data?: {
    submissionId: number;
    platform: string;
    problemId: string;
    title: string;
    savedAt: string;
    duplicate: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * SsafyToday HTTP API Service
 * Django 백엔드와의 HTTP POST 통신을 처리
 */
export class SsafyAPIService {
  /**
   * 제출 데이터를 ssafy.today로 전송
   */
  static async sendSubmission(
    data: SubmissionData
  ): Promise<{ success: boolean; error?: string; errorCode?: string; data?: SubmissionResponse }> {
    try {
      const response = await fetch(SSAFY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      // 상태코드를 보기 전에 .json() 을 부르면 안 된다. 백엔드가 죽은 순간
      // nginx 는 CORS 헤더 없는 HTML 에러 페이지(1710B)를 주고, 전송 중 끊긴
      // 요청은 길이 0 바디로 끝난다. 두 경우 모두 .json() 이 SyntaxError 를
      // 던지는데, 그러면 (1) 그 raw 예외 문자열이 그대로 사용자 토스트에 뜨고
      // (2) errorCode 가 undefined 가 되어 재시도 큐가 실패 종류를 분류하지
      // 못한 채 시도 횟수만 소모한다(MAX_ATTEMPTS 조기 소진 → 영구 폐기).
      const raw = await response.text().catch(() => "");
      let result: SubmissionResponse | null = null;
      if (raw) {
        try {
          result = JSON.parse(raw) as SubmissionResponse;
        } catch {
          log.warn(
            "SSAFY API returned a non-JSON body:",
            response.status,
            raw.slice(0, 120)
          );
        }
      }

      if (response.ok && result?.success) {
        log.info("SSAFY API submission successful:", result);
        return { success: true, data: result };
      }

      if (!result) {
        // JSON 이 아니다 = 백엔드 다운(502/504)이거나 전송이 끊겼다. 일시적
        // 실패로 분류해 큐에 남긴다 — 영구 실패로 오분류하면 그 풀이가 사라진다.
        return {
          success: false,
          error: `서버에 연결하지 못했습니다 (HTTP ${response.status}). 잠시 후 자동으로 다시 시도합니다.`,
          errorCode: "SERVER_UNAVAILABLE",
        };
      }

      const errorMsg = result.error?.message || `HTTP ${response.status}`;
      log.warn("SSAFY API submission failed:", errorMsg);
      // errorCode는 재시도 큐가 영구 실패(INVALID_REQUEST)와 일시 실패
      // (USER_NOT_FOUND=미연동, 네트워크)를 구분하는 데 쓴다
      return { success: false, error: errorMsg, errorCode: result.error?.code };
    } catch (error) {
      log.warn("SSAFY API request failed:", error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * ssafy.today API 연결 테스트
   */
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${SSAFY_API_URL}health/`, {
        method: "GET",
        mode: "cors",
      });

      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * API 정보 조회
   */
  static async getApiInfo(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const response = await fetch(`${SSAFY_API_URL}info/`, {
        method: "GET",
        mode: "cors",
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
