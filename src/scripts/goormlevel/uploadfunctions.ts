import UploadService from '@/commons/uploadservice';
import type { UploadProblemData, UploadCallback, UploadResult, PlatformType } from '@types';

interface GoormlevelProblemData {
  code: string;
  readme: string;
  directory: string;
  fileName: string;
  message: string;
  examSequence?: number;
  quizNumber?: number;
  title?: string;
  difficulty?: number;
  language?: string;
  memory?: string;
  runtime?: string;
  submissionTime?: string;
  link?: string;
}

/**
 * 구름레벨 문제 풀이를 GitHub에 업로드합니다.
 *
 * @param problemData - 업로드할 문제 데이터
 * @param callback - 업로드 완료 후 실행할 콜백 함수 (마크업 아이콘 표시 등)
 * @returns Promise<UploadResult | void>
 */
export default async function uploadOneSolveProblemOnGit(
  problemData: GoormlevelProblemData,
  callback?: UploadCallback
): Promise<UploadResult | void> {
  // 원본 데이터에 구름레벨 플랫폼 정보와 문제 관련 메타데이터를 추가
  const enhancedData: UploadProblemData = {
    ...problemData,
    platform: 'goormlevel' as PlatformType,
    problemInfo: {
      examSequence: String(problemData.examSequence || 0),
      quizNumber: String(problemData.quizNumber || 0),
      problemId: String(problemData.quizNumber || ''),
      title: problemData.title || '',
      difficulty: String(problemData.difficulty || 0),
      level: `난이도 ${problemData.difficulty || 0}`,
      language: problemData.language || '',
      memory: problemData.memory || '',
      runtime: problemData.runtime || '',
      submissionTime: problemData.submissionTime || '',
      link: problemData.link || '',
    },
  };

  return UploadService.uploadProblem(enhancedData, callback);
}
