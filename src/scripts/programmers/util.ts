/**
 * Programmers platform utility functions
 * Handles submission UI notifications
 */
import { uploadState } from "@/programmers/variables";
import { markUploadStarted, markUploadCompleted } from "@/commons/shared-state";
import { Toast } from "@/commons/toast";
import log from "@/commons/logger";

/**
 * Show submission start notification
 */
export function startUpload(): void {
  markUploadStarted(uploadState);
  Toast.info("프로그래머스 제출 기록을 전송합니다!", 3000);
  log.debug("startUpload: Upload start toast displayed");
}

/**
 * Show submission failure notification
 */
export function markUploadFailedCSS(): void {
  markUploadCompleted(uploadState);
  Toast.danger("프로그래머스 제출 기록 전송 실패!", 6000);
  log.debug("markUploadFailedCSS: Upload failure toast displayed");
}
