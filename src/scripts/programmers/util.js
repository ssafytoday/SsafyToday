import { initUploadUI, markUploadedCSS as markUploaded, markUploadFailedCSS as markFailed } from "@/commons/ui-util.js";
import { isNull } from "@/commons/util.js";
import { uploadState } from "@/programmers/variables.js";

/**
 * 로딩 버튼 추가
 */
export function startUpload() {
  const target = document.querySelector("#modal-dialog > div.modal-dialog > div.modal-content > div.modal-footer");
  if (!isNull(target)) {
    const container = initUploadUI(target, uploadState);
    if (container) {
      target.prepend(container); // 프로그래머스에서는 prepend 사용
    }
  }
}

/**
 * 업로드 완료 아이콘 표시 및 링크 생성
 * @param {object} branches - 브랜치 정보
 * @param {string} directory - 디렉토리 정보
 */
export function markUploadedCSS(branches, directory) {
  markUploaded(branches, directory, uploadState);
}

/**
 * 업로드 실패 아이콘 표시
 */
export function markUploadFailedCSS() {
  markFailed(uploadState);
}

/**
 * 로그인한 유저의 사용자명을 가져옵니다.
 * @returns {string} 유저 사용자명이며 없을 시에 빈 문자열을 반환
 */
export function getUsername() {
  // Programmers shows username in various places
  // Try header area first
  const headerUsername = document.querySelector(".header-user-name") ||
                         document.querySelector("[data-testid='header-user-name']") ||
                         document.querySelector(".gnb-profile .name") ||
                         document.querySelector(".user-profile .nickname");

  if (headerUsername) {
    return headerUsername.textContent.trim();
  }

  // Try navigation area
  const navUsername = document.querySelector(".nav-user-name") ||
                      document.querySelector(".sc-user-name");

  if (navUsername) {
    return navUsername.textContent.trim();
  }

  // Try localStorage user info
  try {
    const userInfo = localStorage.getItem("user") || localStorage.getItem("currentUser");
    if (userInfo) {
      const parsed = JSON.parse(userInfo);
      return parsed.nickname || parsed.name || parsed.username || "";
    }
  } catch (e) {
    console.log("[SsafyToday] Could not parse user info from localStorage");
  }

  // Try to get from profile link
  const profileLink = document.querySelector('a[href*="/users/"]');
  if (profileLink) {
    const match = profileLink.href.match(/\/users\/([^\/\?]+)/);
    if (match) {
      return match[1];
    }
  }

  return "";
}
