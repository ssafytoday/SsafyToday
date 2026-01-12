import UploadService from '@/commons/uploadservice';
import type { UploadProblemData, UploadCallback, UploadResult, PlatformType } from '@types';

interface ProgrammersBojData {
  code: string;
  readme: string;
  directory: string;
  fileName: string;
  message: string;
  problemId?: string;
  title?: string;
  level?: string;
  language?: string;
  memory?: string;
  runtime?: string;
  submissionTime?: string;
  division?: string;
  problem_description?: string;
  result_message?: string;
}

/**
 * 프로그래머스 문제 풀이를 GitHub에 업로드합니다.
 *
 * @param bojData - 업로드할 문제 데이터
 * @param callback - 업로드 완료 후 실행할 콜백 함수 (마크업 아이콘 표시 등)
 * @returns Promise<UploadResult | void>
 */
export default async function uploadOneSolveProblemOnGit(
  bojData: ProgrammersBojData,
  callback?: UploadCallback
): Promise<UploadResult | void> {
  // 원본 데이터에 프로그래머스 플랫폼 정보와 문제 관련 메타데이터를 추가
  const enhancedData: UploadProblemData = {
    ...bojData,
    platform: '프로그래머스' as PlatformType,
    problemInfo: {
      problemId: bojData.problemId || '',
      title: bojData.title || '',
      level: bojData.level || '',
      language: bojData.language || '',
      memory: bojData.memory || '',
      runtime: bojData.runtime || '',
      submissionTime: bojData.submissionTime || '',
      division: bojData.division || '',
      problem_description: bojData.problem_description || '',
      result_message: bojData.result_message || '',
    },
  };

  return UploadService.uploadProblem(enhancedData, callback);
}
