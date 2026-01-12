import {
  initUploadUI,
  markUploadedCSS as markUploaded,
  markUploadFailedCSS as markFailed,
} from '@/commons/ui-util';
import { parseNumberFromString, maxValuesGroupBykey } from '@/commons/util';
import { uploadState } from '@/baekjoon/variables';

interface BaekjoonSubmission {
  submissionId: string;
  problemId: string;
  result: string;
  language: string;
  runtime: string;
  memory: string;
  codeLength: string;
  submissionTime: string;
  username: string;
}

/**
 * 로딩 버튼 추가
 */
export function startUpload(): void {
  const target =
    document.getElementById('status-table')?.childNodes[1]?.childNodes[0]?.childNodes[3] ||
    document.querySelector('div.table-responsive > table > tbody > tr > td:nth-child(5)');
  const container = initUploadUI(target as HTMLElement | null, uploadState);

  // 백준 사이트에 특화된 추가 로직이 필요한 경우 여기에 구현
  if (target && target.childNodes.length > 0 && container) {
    (target.childNodes[0] as HTMLElement).append(container);
  }
}

/**
 * 업로드 완료 아이콘 표시 및 링크 생성
 * @param branches - 브랜치 정보
 * @param directory - 디렉토리 정보
 */
export function markUploadedCSS(branches: Record<string, string>, directory: string): void {
  markUploaded(branches, directory, uploadState);
}

/**
 * 업로드 실패 아이콘 표시
 */
export function markUploadFailedCSS(): void {
  markFailed(uploadState);
}

/**
 * 제출 목록 비교함수입니다
 * @param a - 제출 요소 피연산자 a
 * @param b - 제출 요소 피연산자 b
 * @returns a와 b 아래의 우선순위로 값을 비교하여 정수값을 반환합니다.
 */
export function compareSubmission(a: BaekjoonSubmission, b: BaekjoonSubmission): number {
  const aRuntime = parseInt(a.runtime) || 0;
  const bRuntime = parseInt(b.runtime) || 0;
  const aMemory = parseInt(a.memory) || 0;
  const bMemory = parseInt(b.memory) || 0;
  const aCodeLength = parseInt(a.codeLength) || 0;
  const bCodeLength = parseInt(b.codeLength) || 0;
  const aSubmissionId = parseInt(a.submissionId) || 0;
  const bSubmissionId = parseInt(b.submissionId) || 0;

  return hasNotSubtask(a.result, b.result)
    ? aRuntime === bRuntime
      ? aMemory === bMemory
        ? aCodeLength === bCodeLength
          ? -(aSubmissionId - bSubmissionId)
          : aCodeLength - bCodeLength
        : aMemory - bMemory
      : aRuntime - bRuntime
    : compareResult(a.result, b.result);
}

/**
 * 서브태스크가 있는 문제의 경우도 고려해 제출 결과를 비교하는 함수입니다.
 * @param aResult 제출 결과 피연산자 a
 * @param bResult 제출 결과 피연산자 b
 * @returns 서브 태스크가 없는 경우 true, 서브 태스크가 있는 경우 false를 반환합니다.
 */
export function hasNotSubtask(aResult: string, bResult: string): boolean {
  const parsedAResult = parseNumberFromString(aResult);
  const parsedBResult = parseNumberFromString(bResult);

  if (Number.isNaN(parsedAResult) && Number.isNaN(parsedBResult)) return true;

  return false;
}

/**
 * 서브태스크가 있는 문제의 경우 점수가 높은 순서로 정렬되도록 값을 반환합니다.
 * @param aResult 제출 결과 피연산자 a
 * @param bResult 제출 결과 피연산자 b
 * @returns a의 점수가 높은 경우 음수, b의 점수가 높은 경우 양수
 */
export function compareResult(aResult: string, bResult: string): number {
  const parsedAResult = parseNumberFromString(aResult);
  const parsedBResult = parseNumberFromString(bResult);

  if (typeof parsedAResult === 'number' && typeof parsedBResult === 'number')
    return -(parsedAResult - parsedBResult);
  if (Number.isNaN(parsedBResult)) return -1;
  if (Number.isNaN(parsedAResult)) return 1;
  return 0;
}

/**
 * 파싱된 문제별로 최고의 성능의 제출 내역을 하나씩 뽑아서 배열로 반환합니다.
 * @param submissions - 제출 목록 배열
 * @returns 목록 중 문제별로 최고의 성능 제출 내역을 담은 배열
 */
export function selectBestSubmissionList(submissions: BaekjoonSubmission[]): BaekjoonSubmission[] {
  if (submissions === null || submissions.length === 0) return [];
  return maxValuesGroupBykey(submissions, 'problemId', (a, b) => -compareSubmission(a, b));
}

export function convertResultTableHeader(header: string): string {
  switch (header) {
    case '문제번호':
    case '문제':
      return 'problemId';
    case '난이도':
      return 'level';
    case '결과':
      return 'result';
    case '문제내용':
      return 'problemDescription';
    case '언어':
      return 'language';
    case '제출 번호':
      return 'submissionId';
    case '아이디':
      return 'username';
    case '제출시간':
    case '제출한 시간':
      return 'submissionTime';
    case '시간':
      return 'runtime';
    case '메모리':
      return 'memory';
    case '코드 길이':
      return 'codeLength';
    default:
      return 'unknown';
  }
}

export function findUsername(): string | null {
  const el = document.querySelector('a.username');
  if (el === null) return null;
  const username = (el as HTMLElement)?.innerText?.trim();
  if (username === null || username === '') return null;
  return username;
}

export function isExistResultTable(): boolean {
  return document.getElementById('status-table') !== null;
}

/**
 * 백준에서 표기된 프로그래밍 언어의 버전을 없애고 업로드 하기 위함입니다.
 * @param lang - 처리 하고자 하는 언어입니다.
 * @param ignores - 예외 처리 하고자 하는 언어를 추가 해주세요.
 * @returns 분기 처리에 따른 lang
 */
export function langVersionRemove(lang: string, ignores: Set<string> | null): string {
  const defaultIgnores = new Set(['PyPy3', 'PyPy2', 'node.js']);
  const effectiveIgnores = ignores || defaultIgnores;

  if (effectiveIgnores.has(lang)) {
    return lang;
  }

  // "Python 3.8" -> "Python", "Java 11" -> "Java"
  return lang.replace(/\s+[\d.]+$/, '').trim();
}
