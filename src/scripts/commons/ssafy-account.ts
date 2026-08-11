/**
 * ssafy.today 로그인 계정 캐시
 *
 * 왜 필요한가: 제출 전송(`POST /api/submissions/`)은 **비인증** 요청이라
 * 플랫폼 페이지(acmicpc·programmers·swea)에서는 "지금 이 사람이 누구인지"를
 * 알 방법이 플랫폼 닉네임뿐이었다. 그런데 닉네임은 학생이 언제든 바꿀 수 있고
 * 한 번 어긋나면 제출이 매번 404 USER_NOT_FOUND로 유실됐다(연동 불일치).
 *
 * 그래서 ssafy.today에 방문해 로그인 상태를 확인할 때(`auth/check/`) 계정
 * 사용자명·이메일을 여기에 캐시해 두고, 제출 페이로드에 함께 실어 보낸다.
 * 백엔드는 이 계정을 **1순위**로 보고, 없을 때만 플랫폼 닉네임으로 찾는다
 * (`ssafy-advisor/docs/contract/apis-extension.md` §3.1/§5.1).
 *
 * 프라이버시·오귀속 주의: 로그아웃이 확인되면 즉시 비운다. 공유 PC에서 이전
 * 사용자의 계정이 남아 다음 사람의 풀이가 남의 것으로 기록되면 안 된다.
 */
import log from "@/commons/logger";

const USERNAME_KEY = "ssafy_account_username";
const EMAIL_KEY = "ssafy_account_email";

export interface SsafyAccount {
  username: string;
  email: string;
}

/** 캐시된 ssafy.today 계정. 없으면 빈 문자열들. */
export async function getSsafyAccount(): Promise<SsafyAccount> {
  try {
    const result = await chrome.storage.local.get([USERNAME_KEY, EMAIL_KEY]);
    return {
      username: result[USERNAME_KEY] || "",
      email: result[EMAIL_KEY] || "",
    };
  } catch {
    return { username: "", email: "" };
  }
}

/** `auth/check/`가 준 계정을 캐시한다. */
export async function saveSsafyAccount(username: unknown, email: unknown): Promise<void> {
  const next: SsafyAccount = {
    username: typeof username === "string" ? username : "",
    email: typeof email === "string" ? email : "",
  };
  if (!next.username && !next.email) return;
  try {
    const prev = await getSsafyAccount();
    if (prev.username === next.username && prev.email === next.email) return;
    await chrome.storage.local.set({
      [USERNAME_KEY]: next.username,
      [EMAIL_KEY]: next.email,
    });
    log.info("SSAFY account cached for submission fallback");
  } catch (e) {
    log.warn("Failed to cache SSAFY account:", e);
  }
}

/** 로그아웃(또는 세션 만료) 확인 시 비운다 — 공유 PC 오귀속 방지. */
export async function clearSsafyAccount(): Promise<void> {
  try {
    const prev = await getSsafyAccount();
    if (!prev.username && !prev.email) return;
    await chrome.storage.local.remove([USERNAME_KEY, EMAIL_KEY]);
    log.info("SSAFY account cache cleared (logged out)");
  } catch (e) {
    log.warn("Failed to clear SSAFY account cache:", e);
  }
}
