/**
 * SWEA platform parsing functions
 * Handles problem description and submission code parsing
 */
import { isNull } from "@/commons/util";
import EnhancedTemplateService from "@/commons/enhanced-template";
import {
  DEFAULT_DIR_TEMPLATES,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_FILENAME_TEMPLATE,
} from "@/constants/templates";
import { getProblemData, updateProblemData, flushProblemCache } from "@/swexpertacademy/storage";
import { languages } from "@/swexpertacademy/variables";
import { getNickname } from "@/swexpertacademy/util";
import { getDirNameByTemplate } from "@/commons/storage";
import urls from "@/constants/url";
import log from "@/commons/logger";
import { ReadmeBuilder } from "@/commons/readme-builder";

// Problem origin data interface
interface SWEAProblemOrigin {
  link: string;
  problemId: string;
  level: string;
  languageExtension: string;
  title: string;
  runtime: string;
  memory: string;
  code: string;
  length: string;
  submissionTime: string;
  language: string;
}

// Parsed problem data interface
interface ParsedProblemData {
  problemId: string;
  directory: string;
  message: string;
  fileName: string;
  readme: string;
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
 * Extract problem ID from URL parameters
 * Used for SolvingClub result pages where problemId is passed via URL
 * @returns Problem ID from URL or empty string
 */
function extractProblemIdFromUrl(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("problemId") || "";
  } catch {
    return "";
  }
}

/**
 * Check if current page is SolvingClub result page
 * SolvingClub pages have different HTML structure than regular problem pages
 */
function isSolvingClubResultPage(): boolean {
  return window.location.pathname.includes("/problemPassedUser.do");
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
    languageExtension,
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

  // Prepare template data
  const templateData = {
    problemId,
    title,
    level,
    memory,
    runtime,
    languageExtension,
  };

  // Build base directory path using template
  const baseDirPath = EnhancedTemplateService.parseTemplate(DEFAULT_DIR_TEMPLATES.swea, templateData);

  // Get directory from template
  const directory = await getDirNameByTemplate(baseDirPath, lang, {
    problemId,
    title,
    level,
    memory,
    runtime,
    submissionTime,
    language: lang,
    length,
    link,
  });

  // Build commit message and filename using templates
  const message = EnhancedTemplateService.parseTemplate(DEFAULT_MESSAGE_TEMPLATES.swea, templateData);
  const fileName = EnhancedTemplateService.parseTemplate(DEFAULT_FILENAME_TEMPLATE, templateData);
  const dateInfo = submissionTime;

  const readme = new ReadmeBuilder()
    .addTitle(level, title, problemId)
    .addProblemLink(urls.SWEA_PROBLEM_DETAIL_URL)
    .addPerformance(memory, runtime, `${length} Bytes`)
    .addSubmissionDate(dateInfo)
    .addSource("SW Expert Academy", "https://swexpertacademy.com/main/code/problem/problemList.do")
    .build();

  return {
    problemId,
    directory,
    message,
    fileName,
    readme,
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
 * Parse problem data from the current page
 * @returns Parsed problem data for upload
 */
export async function parseData(): Promise<ParsedProblemData | undefined> {
  const isSolvingClub = isSolvingClubResultPage();
  const currentUserNickname = getNickname();

  log.debug(
    "parseData: 페이지 타입 확인",
    isSolvingClub ? "SolvingClub" : "일반",
    "currentUser:",
    currentUserNickname
  );

  // User verification differs by page type.
  // SolvingClub 페이지는 클럽원 전원의 통과 목록 — 유저마다 div.problem_smt 블록
  // (dl.smt_txt: 이름·제출일 + div.info: 성능)을 갖는다. document 레벨 querySelector로
  // 읽으면 첫 번째 클럽원의 성능·제출일이 잡히고, 백엔드가 제출일로 created_at을
  // 백데이트하므로 남의 값이 기록된다 — 반드시 내 블록(entryScope) 안에서만 읽는다.
  let entryScope: Document | Element = document;
  if (isSolvingClub) {
    const userSubmissions = document.querySelectorAll("#problemForm dl dt a");
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
    entryScope = myLink.closest("div.problem_smt") || document;
  } else {
    // Regular page: Check #searchinput value matches current user
    const searchInputElement = document.querySelector("#searchinput") as HTMLInputElement | null;
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
    entryScope === document ? "#problemForm div.info" : "div.info"
  );
  if (isNull(infoBlock)) {
    log.debug("parseData: div.info 요소를 찾을 수 없습니다.");
    return;
  }

  log.debug("결과 데이터 파싱 시작");

  // Problem title - try multiple selectors for compatibility with both page types
  const titleElement =
    document.querySelector("div.problem_box > p.problem_title") ||
    document.querySelector("p.problem_title");
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
    document.querySelector("div.problem_box > p.problem_title > span.badge") ||
    document.querySelector("p.problem_title > span.badge");
  const level = levelEl?.textContent || "Unrated";

  // Problem ID - try multiple sources for compatibility with both page types
  let problemId = "";

  // Method 1: Try URL parameter (used for SolvingClub result pages)
  problemId = extractProblemIdFromUrl();
  if (problemId) {
    log.debug("parseData: problemId from URL:", problemId);
  }

  // Method 2: Try DOM selectors (for regular result pages)
  if (!problemId) {
    const problemIdElement =
      document.querySelector("body > div.container > div.container.sub > div > div.problem_box > p") ||
      document.querySelector("p.problem_title");
    if (problemIdElement) {
      problemId = extractProblemId(problemIdElement.textContent);
      log.debug("parseData: problemId from DOM:", problemId, "raw:", problemIdElement.textContent);
    }
  }

  if (!problemId) {
    log.error("parseData: 문제번호를 찾을 수 없습니다.");
    return;
  }

  // Contest problem ID
  const contestProbIdElements = document.querySelectorAll("#contestProbId");
  if (contestProbIdElements.length === 0) {
    log.error("contestProbId 요소를 찾을 수 없습니다.");
    return;
  }
  const contestProbId = (
    [...contestProbIdElements].slice(-1)[0] as HTMLInputElement
  ).value;

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

  // File extension
  const languageExtension = languages[language.toLowerCase()] || "txt";

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
    languageExtension,
    code,
    runtime,
    memory,
    length,
    submissionTime,
    language,
  });
}
