import UploadService from '@/commons/uploadservice';
import type { UploadProblemData, UploadCallback, UploadResult, PlatformType } from '@types';

interface BaekjoonBojData {
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
  problem_tags?: string[];
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
}

/**
 * 백준 문제 풀이를 GitHub에 업로드합니다.
 *
 * @param bojData - 업로드할 문제 데이터
 * @param callback - 업로드 완료 후 실행할 콜백 함수 (마크업 아이콘 표시 등)
 * @returns Promise<UploadResult | void>
 */
export default async function uploadOneSolveProblemOnGit(
  bojData: BaekjoonBojData,
  callback?: UploadCallback
): Promise<UploadResult | void> {
  // 원본 데이터에 백준 플랫폼 정보와 문제 관련 메타데이터를 추가
  const enhancedData: UploadProblemData = {
    ...bojData,
    platform: '백준' as PlatformType,
    problemInfo: {
      problemId: bojData.problemId || '',
      title: bojData.title || '',
      level: bojData.level || '',
      language: bojData.language || '',
      memory: bojData.memory || '',
      runtime: bojData.runtime || '',
      submissionTime: bojData.submissionTime || '',
      problem_tags: bojData.problem_tags || [],
      problem_description: bojData.problem_description || '',
      problem_input: bojData.problem_input || '',
      problem_output: bojData.problem_output || '',
    },
  };

  return UploadService.uploadProblem(enhancedData, callback);
}
