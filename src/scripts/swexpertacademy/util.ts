/**
 * SWEA platform utility functions
 * Handles UI notifications using shared upload-notifications service
 */
import { isNull } from "@/commons/util";
import { uploadState } from "@/swexpertacademy/variables";
import { createUploadNotifications } from "@/commons/upload-notifications";
import { Toast } from "@/commons/toast";
import log from "@/commons/logger";

// Create notification service for SWEA
const notifications = createUploadNotifications("SWEA", uploadState);

/**
 * Show upload start notification
 */
export function startUpload(): void {
  notifications.startUpload();
  log.debug("startUpload: Upload start toast displayed");
}

/**
 * Create a submit button for manual upload on SWEA platform
 * @param link - Link for navigation (not used when uploadHandler is provided)
 * @param uploadHandler - Optional upload handler function
 */
export function makeSubmitButton(
  link: string,
  uploadHandler: (() => Promise<void>) | null = null
): void {
  let elem = document.getElementById("baekjoonHubSubmitButtonElement") as HTMLButtonElement | null;

  if (elem === null) {
    elem = document.createElement("button");
    elem.id = "baekjoonHubSubmitButtonElement";
    elem.className = "btn_grey3 md btn";
    elem.style.cssText = "cursor:pointer; margin: 10px;";
    elem.textContent = "GitHub에 업로드";
    elem.type = "button";

    // Add click event
    elem.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (uploadHandler) {
        const button = elem as HTMLButtonElement;
        try {
          button.disabled = true;
          button.textContent = "업로드 중...";
          button.style.opacity = "0.6";

          log.info("수동 업로드 버튼 클릭됨");
          await uploadHandler();
        } catch (error) {
          log.error("수동 업로드 중 오류:", error);
          Toast.danger("업로드 중 오류가 발생했습니다.", 5000);
        } finally {
          button.disabled = false;
          button.textContent = "GitHub에 업로드";
          button.style.opacity = "1";
        }
      } else {
        // Original behavior (navigate to another page)
        window.location.href = link;
      }
    });
  }

  const target = document.querySelector("body > div.popup_layer.show > div > div");
  if (!isNull(target) && !target.contains(elem)) {
    target.append(elem);
  }
}

/**
 * Show upload success notification with GitHub link
 * @param branches - Branch info (repoName: branchName)
 * @param directory - Directory path
 */
export function markUploadedCSS(branches: Record<string, string>, directory: string): void {
  if (!directory) {
    log.warn("markUploadedCSS called with undefined directory");
    return;
  }

  notifications.markUploadSuccess(branches, directory);
  log.debug("markUploadedCSS: Upload success toast displayed");
}

/**
 * Show upload failure notification
 */
export function markUploadFailedCSS(): void {
  notifications.markUploadFailed();
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
