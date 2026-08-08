/**
 * SWEA platform utility functions
 * Handles submission UI notifications
 */
import { uploadState } from "@/swexpertacademy/variables";
import { markUploadStarted, markUploadCompleted } from "@/commons/shared-state";
import { Toast } from "@/commons/toast";
import log from "@/commons/logger";

/**
 * Show submission start notification
 */
export function startUpload(): void {
  markUploadStarted(uploadState);
  Toast.info("SWEA 제출 기록을 전송합니다!", 3000);
  log.debug("startUpload: Upload start toast displayed");
}

/**
 * Show submission failure notification
 */
export function markUploadFailedCSS(): void {
  markUploadCompleted(uploadState);
  Toast.danger("SWEA 제출 기록 전송 실패!", 6000);
  log.debug("markUploadFailedCSS: Upload failure toast displayed");
}

/**
 * Get logged-in user's nickname
 * @returns User nickname or empty string
 */
export function getNickname(): string {
  // 로그인 유저 이름은 GNB의 a.my-login > span.name (id는 유저의 리그명 —
  // #Beginner/#Intermediate/… — 리그마다 바뀌므로 id로 잡으면 안 된다).
  // 특히 #Beginner id는 메인 페이지 공개 위젯들(랭킹 티커·숨은 랭킹 팝업·우수유저
  // 카드)이 남의 이름으로 중복 사용한다 — 과거처럼 id 단독 조회하면 랭킹 유저
  // 이름이 저장돼 sync-credentials로 백엔드 계정 연동까지 오염된다.
  const el =
    document.querySelector(".login-after a.my-login span.name") ||
    document.querySelector(".login-after span.name") ||
    document.querySelector("header > div > span.name") ||
    document.querySelector("header span.name");
  return (el?.textContent || "").trim();
}
