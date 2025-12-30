import { log } from "./util.js";

// SSAFY Today API는 항상 활성화, URL은 프로덕션으로 고정
const SSAFY_API_URL = "https://ssafy.today/api/submissions/";

/**
 * Django 백엔드(SSAFY Today)로 제출 데이터를 전송하는 서비스 클래스
 */
export default class DjangoAPIService {
  /**
   * Django 백엔드 API URL 가져오기 (프로덕션 URL 고정)
   * @returns {string} API URL
   */
  static getApiUrl() {
    return SSAFY_API_URL;
  }

  /**
   * Django 백엔드 전송 활성화 여부 확인 (항상 활성화)
   * @returns {boolean} 활성화 여부
   */
  static isEnabled() {
    return true;
  }

  /**
   * 제출 데이터를 Django 백엔드로 전송
   *
   * @param {Object} problemData - 문제 데이터
   * @param {string} problemData.platform - 플랫폼 (백준, 프로그래머스, SWEA, goormlevel)
   * @param {Object} problemData.problemInfo - 문제 정보
   * @param {string} problemData.code - 소스 코드
   * @param {string} problemData.directory - 디렉토리 경로
   * @param {string} problemData.fileName - 파일명
   * @param {string} problemData.message - 커밋 메시지
   * @param {string} githubUsername - GitHub 사용자명
   * @param {Object} metadata - 메타데이터
   * @param {string} metadata.hook - GitHub 저장소 (username/repo)
   * @returns {Promise<{success: boolean, data?: object, error?: string, skipped?: boolean}>}
   */
  static async sendSubmission(problemData, githubUsername, metadata) {
    // 항상 활성화 상태
    if (!this.isEnabled()) {
      log("SSAFY Today API is disabled, skipping submission");
      return { success: true, skipped: true };
    }

    const apiUrl = this.getApiUrl();
    const requestBody = this.formatRequestBody(problemData, githubUsername, metadata);

    try {
      log("Sending submission to SSAFY Today API:", apiUrl);
      log("Request body:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (response.ok) {
        log("SSAFY Today API submission successful:", responseData);
        return { success: true, data: responseData };
      } else {
        log("SSAFY Today API submission failed:", responseData);
        return {
          success: false,
          error: responseData.error?.message || responseData.message || "Unknown error",
          statusCode: response.status,
        };
      }
    } catch (error) {
      log("SSAFY Today API request error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Django API 요청 형식으로 데이터 변환
   *
   * @param {Object} problemData - 문제 데이터
   * @param {string} githubUsername - GitHub 사용자명
   * @param {Object} metadata - 메타데이터
   * @returns {Object} 포맷된 요청 본문
   */
  static formatRequestBody(problemData, githubUsername, metadata) {
    const { platform, problemInfo, code, directory, fileName, message } = problemData;

    // submissionTime 처리
    let submissionTime = problemInfo.submissionTime;
    if (submissionTime && typeof submissionTime === "string") {
      // 이미 문자열인 경우 ISO 8601 형식으로 변환 시도
      try {
        submissionTime = new Date(submissionTime).toISOString();
      } catch {
        submissionTime = new Date().toISOString();
      }
    } else if (submissionTime instanceof Date) {
      submissionTime = submissionTime.toISOString();
    } else {
      submissionTime = new Date().toISOString();
    }

    return {
      username: githubUsername,
      platform: platform,
      problemData: {
        problemId: String(problemInfo.problemId || problemInfo.quizNumber || ""),
        title: problemInfo.title || "",
        level: problemInfo.level || problemInfo.difficulty || problemInfo.bjLevel || "",
        language: problemInfo.language || "",
        code: code || "",
        runtime: problemInfo.runtime || "",
        memory: problemInfo.memory || "",
        submissionTime: submissionTime,
        tags: problemInfo.problem_tags || [],
        // 플랫폼별 선택 필드
        problemDescription: problemInfo.problem_description || "",
        problemInput: problemInfo.problem_input || "",
        problemOutput: problemInfo.problem_output || "",
        division: problemInfo.division || "",
        resultMessage: problemInfo.result_message || problemInfo.resultMessage || "",
        length: problemInfo.length || "",
        link: problemInfo.link || "",
        examSequence: problemInfo.examSequence || null,
      },
      metadata: {
        extensionVersion: chrome.runtime.getManifest().version,
        timestamp: new Date().toISOString(),
        githubRepo: metadata.hook || "",
        directory: directory || "",
        fileName: fileName || "",
        commitMessage: message || "",
      },
    };
  }

  /**
   * API 연결 테스트 (health check)
   *
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
  static async testConnection() {
    const apiUrl = this.getApiUrl();
    const healthUrl = apiUrl.replace(/\/$/, "") + "/health/";

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected (${data.version || "OK"})`,
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
