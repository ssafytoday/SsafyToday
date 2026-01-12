import {
  initUploadUI,
  markUploadedCSS as markUploaded,
  markUploadFailedCSS as markFailed,
} from '@/commons/ui-util';
import { isNull } from '@/commons/util';
import { uploadState } from '@/swexpertacademy/variables';

/**
 * 로딩 버튼 추가
 */
export function startUpload(): void {
  const target = document.querySelector(
    'div.box-list > div.box-list-inner > div.right_answer > span.btn_right'
  );
  if (!isNull(target)) {
    const container = initUploadUI(target as HTMLElement, uploadState);
    if (container) {
      target.prepend(container);
    }
  }
}

/**
 * SWEA 플랫폼에서 접근이 좋은 업로드 버튼 생성
 * @param link - 업로드 시 이동할 링크
 */
export function makeSubmitButton(link: string): void {
  let elem = document.getElementById('BaekjoonHub_submit_button_element') as HTMLAnchorElement | null;
  if (elem === null) {
    elem = document.createElement('a');
    elem.id = 'baekjoonHubSubmitButtonElement';
    elem.className = 'btn_grey3 md btn';
    elem.style.cssText = 'cursor:pointer';
    elem.href = link;
  }
  const target = document.querySelector('body > div.popup_layer.show > div > div');
  if (!isNull(target)) {
    target.append(elem);
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
 * 로그인한 유저의 닉네임을 가져옵니다.
 * @returns 유저 닉네임이며 없을 시에 빈 문자열을 반환
 */
export function getNickname(): string {
  return (
    document.querySelector('#Beginner')?.textContent ||
    document.querySelector('header > div > span.name')?.textContent ||
    ''
  );
}
