/** NOTE: goormlevel에서 사용할 util 모음입니다. */

import {
  initUploadUI,
  markUploadedCSS as markUploaded,
  markUploadFailedCSS as markFailed,
} from '@/commons/ui-util';
import { uploadState } from '@/goormlevel/variables';

/**
 * 로딩 버튼 추가
 */
export function startUpload(): void {
  /** 정답을 맞추면 렌더링되는 target element */
  const elements = [...document.querySelectorAll('#FrameBody div > p[class] > span')];
  const target = elements.find(($element) => $element.textContent === '정답입니다.');

  if (target !== undefined) {
    initUploadUI(target as HTMLElement, uploadState);
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
