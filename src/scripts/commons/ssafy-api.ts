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
  username: string; // GitHub username (GitHub 연동 시) 또는 빈 문자열
  platformUsername?: string; // 플랫폼별 사용자명 (백준 ID, 프로그래머스 닉네임, SWEA 닉네임)
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
    githubRepo?: string; // GitHub 저장소 (GitHub 연동 시에만)
    directory?: string;
    fileName?: string;
    commitMessage?: string;
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
  static async sendSubmission(data: SubmissionData): Promise<{ success: boolean; error?: string; data?: SubmissionResponse }> {
    try {
      const response = await fetch(SSAFY_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result: SubmissionResponse = await response.json();

      if (response.ok && result.success) {
        log.info("SSAFY API submission successful:", result);
        return { success: true, data: result };
      } else {
        const errorMsg = result.error?.message || `HTTP ${response.status}`;
        log.warn("SSAFY API submission failed:", errorMsg);
        return { success: false, error: errorMsg };
      }
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
