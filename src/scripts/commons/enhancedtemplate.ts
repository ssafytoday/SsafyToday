import { parseTemplateString } from 'safe-template-parser';
import type { PlatformType } from '@types';

interface TemplateData extends Record<string, unknown> {
  platform: string;
  language: string;
  problemId?: string;
  title?: string;
  level?: string;
  examSequence?: string | number | null;
}

// Flexible input type for template data that doesn't require all BaseProblemData fields
type TemplateInputData = {
  problemId?: string;
  title?: string;
  level?: string;
  language?: string;
  runtime?: string;
  memory?: string;
  submissionTime?: string;
  length?: string;
  link?: string;
  examSequence?: string | number | null;
  difficulty?: string;
  division?: string;
  problem_tags?: string[];
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
  result_message?: string;
} | null;

/**
 * 모든 플랫폼에서 공통으로 사용할 수 있는 향상된 템플릿 시스템
 * 각 플랫폼별 데이터를 표준화된 형식으로 변환하여 일관된 디렉토리 구조 생성
 */
export default class EnhancedTemplateService {
  /**
   * 이미 표준화된 문제 데이터를 활용합니다.
   * 각 플랫폼의 uploadfunctions.ts에서 platform과 problemInfo 필드가 전달됩니다.
   *
   * @param platform - 플랫폼 이름 ('백준', '프로그래머스', 'SWEA', 'goormlevel')
   * @param data - 플랫폼별 문제 데이터
   * @returns 템플릿에 사용할 데이터
   */
  static prepareTemplateData(
    platform: PlatformType,
    data: TemplateInputData
  ): TemplateData {
    // 기본 데이터 준비
    const templateData: TemplateData = {
      platform,
      language: data?.language || '',
      ...(data || {}),
    };

    return templateData;
  }

  /**
   * 커스텀 템플릿을 사용하여 디렉토리 이름을 생성합니다.
   *
   * @param platform - 플랫폼 이름 ('백준', '프로그래머스', 'SWEA', 'goormlevel')
   * @param defaultDirName - 기본 디렉토리 이름
   * @param language - 프로그래밍 언어
   * @param data - 문제 데이터 (플랫폼 및 문제 메타정보 포함)
   * @param useCustomTemplate - 커스텀 템플릿 사용 여부
   * @param customTemplate - 커스텀 템플릿 문자열
   * @param orgOption - 정렬 옵션
   * @returns 생성된 디렉토리 경로
   */
  static getDirNameWithTemplate(
    platform: PlatformType,
    defaultDirName: string,
    language: string,
    data: TemplateInputData,
    useCustomTemplate: boolean,
    customTemplate: string,
    orgOption: string
  ): string {
    try {
      // 템플릿에 사용할 데이터 준비
      const templateData = this.prepareTemplateData(platform, data);
      templateData.language = language; // 언어 정보 보장

      // 커스텀 템플릿이 설정되어 있고 활성화되어 있다면 사용
      if (useCustomTemplate === true && customTemplate && customTemplate.trim() !== '') {
        return this.parseDirectoryTemplate(customTemplate, templateData);
      }

      // 언어별 정리 옵션 확인
      if (orgOption === 'language') {
        return `${language}/${defaultDirName}`;
      }

      // 기본 디렉토리 반환
      return defaultDirName;
    } catch (error) {
      console.error('템플릿 적용 중 오류가 발생했습니다:', error);
      return defaultDirName; // 오류 발생 시 기본 디렉토리 반환
    }
  }

  /**
   * 템플릿 문자열을 파싱하여 디렉토리 경로를 생성합니다.
   *
   * @param templateString - 템플릿 문자열
   * @param data - 템플릿에 사용할 데이터
   * @returns 파싱된 디렉토리 경로
   */
  static parseDirectoryTemplate(templateString: string, data: TemplateData): string {
    try {
      return parseTemplateString(templateString, data);
    } catch (error) {
      console.error('템플릿 파싱 중 오류가 발생했습니다:', error);

      // 플랫폼별 기본 템플릿으로 대체
      switch (data.platform) {
        case '백준':
          return `백준/${(data.level as string)?.replace?.(/ .*/, '') || 'Unrated'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        case '프로그래머스':
          return `프로그래머스/${data.level || '0'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        case 'SWEA':
          return `SWEA/${data.level || 'Unrated'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        case 'goormlevel':
          return `goormlevel/${data.examSequence || '0'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
        default:
          return `${data.platform || 'Unknown'}/${data.problemId || '0000'}. ${data.title || 'Unknown'}`;
      }
    }
  }
}
