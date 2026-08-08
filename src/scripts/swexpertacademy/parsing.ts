/**
 * SWEA platform parsing functions
 * Handles problem description and submission code parsing
 */
import { isNull } from "@/commons/util";
import { getProblemData, updateProblemData, flushProblemCache } from "@/swexpertacademy/storage";
import { getNickname } from "@/swexpertacademy/util";
import urls from "@/constants/url";
import log from "@/commons/logger";

// Problem origin data interface
interface SWEAProblemOrigin {
  link: string;
  problemId: string;
  level: string;
  title: string;
  runtime: string;
  memory: string;
  code: string;
  length: string;
  submissionTime: string;
  language: string;
}

// Parsed problem data interface
export interface ParsedProblemData {
  problemId: string;
  code: string;
  // Fields needed for API submission
  title: string;
  level: string;
  language: string;
  memory: string;
  runtime: string;
  submissionTime: string;
  length: string;
  link: string;
}

/**
 * Extract numeric problem ID from text
 * @param text - Raw text that may contain problem ID (e.g., "1234. 문제제목")
 * @returns Extracted problem ID or empty string
 */
function extractProblemId(text: string | null | undefined): string {
  if (!text) return "";
  const match = text.match(/^\s*(\d+)/);
  return match ? match[1] : "";
}

/**
 * 결과 페이지 URL을 pathname/search로 분해합니다.
 * 제자리 업로드(tryUploadInPlace)에서는 현재 주소가 풀이 페이지(solvingProblem.do)이므로
 * window.location 이 아니라 fetch 대상 결과 URL을 기준으로 판단해야 한다.
 * @param resultUrl - 결과 페이지 URL (상대 경로 허용)
 */
function splitResultUrl(resultUrl: string): { pathname: string; search: string } {
  try {
    const url = new URL(resultUrl, window.location.href);
    return { pathname: url.pathname, search: url.search };
  } catch {
    return { pathname: window.location.pathname, search: window.location.search };
  }
}

/**
 * Extract problem ID from URL parameters
 * Used for SolvingClub result pages where problemId is passed via URL
 * @param search - 결과 페이지 쿼리 스트링
 * @returns Problem ID from URL or empty string
 */
function extractProblemIdFromUrl(search: string): string {
  try {
    return new URLSearchParams(search).get("problemId") || "";
  } catch {
    return "";
  }
}

/**
 * Check if the result page is a SolvingClub result page
 * SolvingClub pages have different HTML structure than regular problem pages
 * @param pathname - 결과 페이지 경로
 */
function isSolvingClubResultPage(pathname: string): boolean {
  return pathname.includes("/problemPassedUser.do");
}

// Parse code result interface
interface ParseCodeResult {
  problemId: string;
  contestProbId: string;
}

/**
 * Update text source event for code editor synchronization
 */
export function updateTextSourceEvent(): void {
  document.documentElement.setAttribute("onreset", "cEditor.save();");
  document.documentElement.dispatchEvent(new CustomEvent("reset"));
  document.documentElement.removeAttribute("onreset");
}

/**
 * Create upload data from parsed problem info
 * @param origin - Original problem data
 * @returns Formatted data for upload
 */
export async function makeData(origin: SWEAProblemOrigin): Promise<ParsedProblemData> {
  const {
    link,
    problemId,
    level,
    title,
    runtime,
    memory,
    code,
    length,
    submissionTime,
    language,
  } = origin;

  // Normalize language case (SWEA uses all uppercase like "JAVA")
  const lang =
    language === language.toUpperCase()
      ? language.substring(0, 1) + language.substring(1).toLowerCase()
      : language;

  return {
    problemId,
    code,
    // Fields needed for API submission
    title,
    level,
    language: lang,
    memory,
    runtime,
    submissionTime,
    length,
    link,
  };
}

/**
 * Parse and store submission code
 * @returns Parse code result with problemId and contestProbId
 */
export async function parseCode(): Promise<ParseCodeResult | undefined> {
  const problemIdEl = document.querySelector("div.problem_box > h3");
  if (!problemIdEl) {
    log.error("parseCode: 문제번호 요소를 찾을 수 없습니다.");
    return;
  }
  const problemId = extractProblemId(problemIdEl.textContent);
  log.debug("parseCode: problemId:", problemId, "raw:", problemIdEl.textContent);

  const contestProbIdElements = document.querySelectorAll("#contestProbId");
  if (contestProbIdElements.length === 0) {
    log.error("parseCode: contestProbId 요소를 찾을 수 없습니다.");
    return;
  }
  const contestProbId = (
    [...contestProbIdElements].slice(-1)[0] as HTMLInputElement
  ).value;

  updateTextSourceEvent();
  const textSourceEl = document.querySelector("#textSource") as HTMLTextAreaElement | null;
  const code = textSourceEl?.value || "";

  await updateProblemData(problemId, { code, contestProbId });
  // Flush cache immediately before page navigation to ensure data is persisted
  await flushProblemCache();
  return { problemId, contestProbId };
}

/**
 * Parse problem data from a result page document
 *
 * @param root - 파싱 기준 문서. 결과 페이지를 fetch해 DOMParser로 만든 문서를 넘기면
 *   페이지 이동 없이 제자리 업로드가 가능하다. (기본값: 현재 문서)
 * @param resultUrl - 결과 페이지 URL. 페이지 종류(SolvingClub 여부) 판별과
 *   problemId/contestProbId fallback에 쓰인다. (기본값: 현재 주소)
 * @returns Parsed problem data for upload
 */
export async function parseData(
  root: ParentNode = document,
  resultUrl: string = window.location.href
): Promise<ParsedProblemData | undefined> {
  const { pathname, search } = splitResultUrl(resultUrl);
  const isSolvingClub = isSolvingClubResultPage(pathname);
  // 로그인 유저 이름은 fetch한 결과 페이지가 아니라 항상 현재 화면의 GNB에서 읽는다.
  const currentUserNickname = getNickname();

  log.debug(
    "parseData: 페이지 타입 확인",
    isSolvingClub ? "SolvingClub" : "일반",
    "currentUser:",
    currentUserNickname,
    "inPlace:",
    root !== document
  );

  // User verification differs by page type.
  // SolvingClub 페이지는 클럽원 전원의 통과 목록 — 유저마다 div.problem_smt 블록
  // (dl.smt_txt: 이름·제출일 + div.info: 성능)을 갖는다. document 레벨 querySelector로
  // 읽으면 첫 번째 클럽원의 성능·제출일이 잡히고, 백엔드가 제출일로 created_at을
  // 백데이트하므로 남의 값이 기록된다 — 반드시 내 블록(entryScope) 안에서만 읽는다.
  let entryScope: ParentNode = root;
  if (isSolvingClub) {
    const userSubmissions = root.querySelectorAll("#problemForm dl dt a");
    const myLink = Array.from(userSubmissions).find(
      (el) => el.textContent?.trim() === currentUserNickname
    );

    log.debug(
      "parseData: SolvingClub 제출 기록 확인",
      "hasUserSubmission:",
      !!myLink,
      "submissions:",
      userSubmissions.length
    );

    if (!myLink) {
      log.debug("parseData: 현재 사용자의 제출 기록이 없습니다.");
      return;
    }
    entryScope = myLink.closest("div.problem_smt") || root;
  } else {
    // Regular page: Check #searchinput value matches current user
    const searchInputElement = root.querySelector("#searchinput") as HTMLInputElement | null;
    if (!searchInputElement) {
      log.error("parseData: #searchinput 요소를 찾을 수 없습니다.");
      return;
    }
    const nickname = searchInputElement.value;

    log.debug(
      "parseData: 일반 페이지 닉네임 확인",
      "searchInput:",
      nickname,
      "currentUser:",
      currentUserNickname
    );

    if (currentUserNickname !== nickname) {
      log.debug("parseData: 닉네임 불일치");
      return;
    }
  }

  // Check if user has PASS record (common for both page types)
  const infoBlock = entryScope.querySelector(
    entryScope === root ? "#problemForm div.info" : "div.info"
  );
  if (isNull(infoBlock)) {
    log.debug("parseData: div.info 요소를 찾을 수 없습니다.");
    return;
  }

  log.debug("결과 데이터 파싱 시작");

  // Problem title - try multiple selectors for compatibility with both page types
  const titleElement =
    root.querySelector("div.problem_box > p.problem_title") ||
    root.querySelector("p.problem_title");
  if (!titleElement) {
    log.error("parseData: 문제 제목 요소를 찾을 수 없습니다.");
    return;
  }
  // Normalize whitespace first (tabs, newlines -> single space), then parse title
  const rawTitle = titleElement.textContent?.replace(/\s+/g, " ").trim() || "";
  const title = rawTitle
    .replace(/ D[0-9]+$/, "")  // Remove level badge like " D5"
    .replace(/^[^.]*\./, "")   // Remove prefix like "[S/W 문제해결 응용] 3일차 - " up to and including first dot
    .trim() || rawTitle;       // Fallback to raw title if parsing fails

  // Level - try multiple selectors
  const levelEl =
    root.querySelector("div.problem_box > p.problem_title > span.badge") ||
    root.querySelector("p.problem_title > span.badge");
  const level = levelEl?.textContent || "Unrated";

  // Problem ID - try multiple sources for compatibility with both page types
  let problemId = "";

  // Method 1: Try URL parameter (used for SolvingClub result pages)
  problemId = extractProblemIdFromUrl(search);
  if (problemId) {
    log.debug("parseData: problemId from URL:", problemId);
  }

  // Method 2: Try DOM selectors (for regular result pages)
  if (!problemId) {
    const problemIdElement =
      root.querySelector("body > div.container > div.container.sub > div > div.problem_box > p") ||
      root.querySelector("p.problem_title");
    if (problemIdElement) {
      problemId = extractProblemId(problemIdElement.textContent);
      log.debug("parseData: problemId from DOM:", problemId, "raw:", problemIdElement.textContent);
    }
  }

  if (!problemId) {
    log.error("parseData: 문제번호를 찾을 수 없습니다.");
    return;
  }

  // Contest problem ID — 히든 input 우선, 없으면 결과 URL 쿼리에서 복원한다.
  // (제자리 업로드로 fetch한 문서에 히든 input이 없더라도 redirectUrl에는 항상 들어 있다)
  const contestProbIdElements = root.querySelectorAll("#contestProbId");
  let contestProbId =
    contestProbIdElements.length > 0
      ? (([...contestProbIdElements].slice(-1)[0] as HTMLInputElement).value || "").trim()
      : "";
  if (!contestProbId) {
    contestProbId = (new URLSearchParams(search).get("contestProbId") || "").trim();
  }
  if (!contestProbId) {
    log.error("contestProbId 요소를 찾을 수 없습니다.");
    return;
  }

  // Problem link
  const link = `${urls.SWEA_PROBLEM_DETAIL_URL}?contestProbId=${contestProbId}`;

  // Language, memory, runtime, length — 내 항목의 div.info(infoBlock) 기준
  const languageElement = infoBlock!.querySelector(
    ":scope > ul > li:nth-child(1) > span:nth-child(1)"
  );
  const memoryElement = infoBlock!.querySelector(
    ":scope > ul > li:nth-child(2) > span:nth-child(1)"
  );
  const runtimeElement = infoBlock!.querySelector(
    ":scope > ul > li:nth-child(3) > span:nth-child(1)"
  );
  const lengthElement = infoBlock!.querySelector(
    ":scope > ul > li:nth-child(4) > span:nth-child(1)"
  );

  if (!languageElement || !memoryElement || !runtimeElement || !lengthElement) {
    log.error("문제 정보 요소들을 찾을 수 없습니다.");
    return;
  }

  const language = languageElement.textContent?.trim() || "";
  const memory = memoryElement.textContent?.trim().toUpperCase() || "";
  const runtime = runtimeElement.textContent?.trim() || "";
  const length = lengthElement.textContent?.trim() || "";

  // Submission time — SolvingClub에서는 내 블록의 dl.smt_txt에서 읽는다
  const submissionTimeElement = entryScope.querySelector(".smt_txt > dd");
  if (!submissionTimeElement) {
    log.error("제출 시간 요소를 찾을 수 없습니다.");
    return;
  }
  const submissionTimeMatch = submissionTimeElement.textContent?.match(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g
  );
  if (!submissionTimeMatch || submissionTimeMatch.length === 0) {
    log.error("제출 시간 형식을 파싱할 수 없습니다.");
    return;
  }
  const submissionTime = submissionTimeMatch[0];

  // Get cached code from storage
  const data = await getProblemData(problemId);
  log.debug("parseData: cached data for problemId:", problemId, "data:", data);
  if (isNull(data?.code)) {
    log.error("소스코드 데이터가 없습니다.");
    return;
  }
  const { code } = data;
  log.debug("파싱 완료");

  return makeData({
    link,
    problemId,
    level,
    title,
    code,
    runtime,
    memory,
    length,
    submissionTime,
    language,
  });
}
