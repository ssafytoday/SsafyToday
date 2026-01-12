import { log } from './util';
import type {
  DjangoSubmissionRequest,
  DjangoSubmissionResponse,
  UploadProblemData,
} from '@types';

// SSAFY Today API는 항상 활성화, URL은 프로덕션으로 고정
const SSAFY_API_URL = 'https://ssafy.today/api/submissions/';

interface DjangoMetadata {
  hook?: string;
  directory?: string;
  fileName?: string;
  message?: string;
}

interface DjangoSendResult {
  success: boolean;
  data?: DjangoSubmissionResponse;
  error?: string;
  skipped?: boolean;
  statusCode?: number;
}

interface DjangoTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Django 백엔드(SSAFY Today)로 제출 데이터를 전송하는 서비스 클래스
 */
export default class DjangoAPIService {
  /**
   * Django 백엔드 API URL 가져오기 (프로덕션 URL 고정)
   * @returns API URL
   */
  static getApiUrl(): string {
    return SSAFY_API_URL;
  }

  /**
   * Django 백엔드 전송 활성화 여부 확인 (항상 활성화)
   * @returns 활성화 여부
   */
  static isEnabled(): boolean {
    return true;
  }

  /**
   * 제출 데이터를 Django 백엔드로 전송
   *
   * @param problemData - 문제 데이터
   * @param githubUsername - GitHub 사용자명
   * @param metadata - 메타데이터
   * @returns Promise with result
   */
  static async sendSubmission(
    problemData: UploadProblemData,
    githubUsername: string,
    metadata: DjangoMetadata
  ): Promise<DjangoSendResult> {
    // 항상 활성화 상태
    if (!this.isEnabled()) {
      log('SSAFY Today API is disabled, skipping submission');
      return { success: true, skipped: true };
    }

    const apiUrl = this.getApiUrl();
    const requestBody = this.formatRequestBody(problemData, githubUsername, metadata);

    try {
      log('Sending submission to SSAFY Today API:', apiUrl);
      log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (response.ok) {
        log('SSAFY Today API submission successful:', responseData);
        return { success: true, data: responseData };
      } else {
        log('SSAFY Today API submission failed:', responseData);
        return {
          success: false,
          error: responseData.error?.message || responseData.message || 'Unknown error',
          statusCode: response.status,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('SSAFY Today API request error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Django API 요청 형식으로 데이터 변환
   *
   * @param problemData - 문제 데이터
   * @param githubUsername - GitHub 사용자명
   * @param metadata - 메타데이터
   * @returns 포맷된 요청 본문
   */
  static formatRequestBody(
    problemData: UploadProblemData,
    githubUsername: string,
    metadata: DjangoMetadata
  ): DjangoSubmissionRequest {
    const { platform, problemInfo, code, directory, fileName, message } = problemData;

    // submissionTime 처리
    let submissionTime: string;
    const rawTime = problemInfo.submissionTime;

    if (rawTime) {
      // 문자열인 경우 ISO 8601 형식으로 변환 시도
      try {
        submissionTime = new Date(rawTime).toISOString();
      } catch {
        submissionTime = new Date().toISOString();
      }
    } else {
      submissionTime = new Date().toISOString();
    }

    return {
      username: githubUsername,
      platform: platform,
      problemData: {
        problemId: String(problemInfo.problemId || ''),
        title: problemInfo.title || '',
        level: problemInfo.level || '',
        language: problemInfo.language || '',
        code: code || '',
        runtime: problemInfo.runtime || '',
        memory: problemInfo.memory || '',
        submissionTime: submissionTime,
        tags: problemInfo.problem_tags || [],
        // 플랫폼별 선택 필드
        problemDescription: problemInfo.problem_description || '',
        problemInput: problemInfo.problem_input || '',
        problemOutput: problemInfo.problem_output || '',
        division: problemInfo.division || '',
        resultMessage: problemInfo.result_message || '',
        length: problemInfo.length || '',
        link: problemInfo.link || '',
        examSequence: typeof problemInfo.examSequence === 'string'
          ? parseInt(problemInfo.examSequence, 10) || null
          : problemInfo.examSequence ?? null,
      },
      metadata: {
        extensionVersion: chrome.runtime.getManifest().version,
        timestamp: new Date().toISOString(),
        githubRepo: metadata.hook || '',
        directory: directory || '',
        fileName: fileName || '',
        commitMessage: message || '',
      },
    };
  }

  /**
   * API 연결 테스트 (health check)
   *
   * @returns Promise with test result
   */
  static async testConnection(): Promise<DjangoTestResult> {
    const apiUrl = this.getApiUrl();
    const healthUrl = apiUrl.replace(/\/$/, '') + '/health/';

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected (${data.version || 'OK'})`,
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
