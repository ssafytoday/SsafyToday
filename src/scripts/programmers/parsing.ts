/**
 * Programmers platform parsing functions
 * Handles problem description and submission code parsing
 */
import { convertSingleCharToDoubleChar } from "@/commons/util";
import EnhancedTemplateService from "@/commons/enhanced-template";
import {
  DEFAULT_DIR_TEMPLATES,
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_FILENAME_TEMPLATE,
} from "@/constants/templates";
import { nowISO, toKoreanDateString } from "@/commons/date-util";
import { getDirNameByTemplate } from "@/commons/storage";
import log from "@/commons/logger";
import { ReadmeBuilder } from "@/commons/readme-builder";

// Problem data interface for Programmers
interface ProgrammersProblemOrigin {
  problemDescription: string;
  problemId: string;
  level: string;
  resultMessage: string;
  division: string;
  languageExtension: string;
  title: string;
  runtime: string;
  memory: string;
  code: string;
  language: string;
  link: string;
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
  division: string;
  problem_description: string;
  result_message: string;
  link: string;
}

/**
 * Create upload data from parsed problem info
 * @param origin - Original problem data
 * @returns Formatted data for upload
 */
export async function makeData(origin: ProgrammersProblemOrigin): Promise<ParsedProblemData> {
  const {
    problemDescription,
    problemId,
    level,
    resultMessage,
    division,
    languageExtension,
    title,
    runtime,
    memory,
    code,
    language,
    link,
  } = origin;

  // Convert level to display format (e.g., "1" -> "level 1", "lv1" -> "lv1")
  const levelWithLv = `${level}`.includes("lv") ? level : `lv${level}`.replace("lv", "level ");

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
  const baseDirPath = EnhancedTemplateService.parseTemplate(DEFAULT_DIR_TEMPLATES.programmers, templateData);

  // Get directory from template
  const directory = await getDirNameByTemplate(baseDirPath, language, {
    problemId,
    title,
    level,
    division,
    memory,
    runtime,
    submissionTime: nowISO(),
    language,
    problemDescription,
    resultMessage,
    link,
  });

  // Build commit message and filename using templates
  // Note: message uses levelWithLv for display purposes
  const message = EnhancedTemplateService.parseTemplate(DEFAULT_MESSAGE_TEMPLATES.programmers, {
    ...templateData,
    level: levelWithLv,
  });
  const fileName = EnhancedTemplateService.parseTemplate(DEFAULT_FILENAME_TEMPLATE, templateData);
  const dateInfo = toKoreanDateString();

  const readme = new ReadmeBuilder()
    .addTitle(levelWithLv, title, problemId)
    .addProblemLink(link)
    .addPerformance(memory, runtime)
    .addSection("구분", division.replace("/", " > "))
    .addSection("채점결과", resultMessage)
    .addSubmissionDate(dateInfo)
    .addProblemDescription(problemDescription)
    .addSource("프로그래머스 코딩 테스트 연습", "https://school.programmers.co.kr/learn/challenges")
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
    language,
    memory,
    runtime,
    submissionTime: nowISO(),
    division,
    problem_description: problemDescription,
    result_message: resultMessage,
    link,
  };
}

/**
 * Parse problem data from the current page
 * @returns Parsed problem data for upload
 */
export async function parseData(): Promise<ParsedProblemData> {
  // 2026 개편 후 og:url/twitter:url 메타가 문제 URL이 아니라 홈("https://programmers.co.kr/")
  // 을 담는다 — 문제 경로가 아니면 현재 주소로 대체 (README 링크·백엔드 link 필드 오염 방지)
  const linkMeta = document.querySelector('head > meta[name$="url"]') as HTMLMetaElement | null;
  const metaUrl = linkMeta?.content?.replace(/\?.*/g, "").trim() || "";
  const link = /\/lessons\/\d+/.test(metaUrl)
    ? metaUrl
    : `${window.location.origin}${window.location.pathname}`;

  // 2026 개편으로 div.main 래퍼가 사라져 "div.main > div.lesson-content"가 매칭되지
  // 않는다 (업스트림 BaekjoonHub도 동일하게 느슨한 셀렉터로 전환). problemId는 URL로도
  // 복원 가능 — 백엔드가 빈 problemId/level을 INVALID_REQUEST로 거부하므로 폴백 필수.
  const lessonContent =
    document.querySelector("div.lesson-content") || document.querySelector("[data-lesson-id]");
  const problemId =
    lessonContent?.getAttribute("data-lesson-id") ||
    window.location.pathname.match(/\/lessons\/(\d+)/)?.[1] ||
    "";
  const level = lessonContent?.getAttribute("data-challenge-level") || "0";

  const breadcrumb = document.querySelector("ol.breadcrumb");
  const division = breadcrumb
    ? [...breadcrumb.childNodes]
        .filter((x) => (x as Element).className !== "active")
        .map((x) => (x as HTMLElement).innerText)
        .map((x) => convertSingleCharToDoubleChar(x))
        .reduce((a, b) => `${a}/${b}`)
    : "";

  const titleElement = document.querySelector(".algorithm-title .challenge-title");
  const title = titleElement?.textContent?.replace(/\\n/g, "").trim() || "";

  const descElement = document.querySelector("div.guide-section-description > div.markdown");
  const problemDescription = descElement?.innerHTML || "";

  const editorTab = document.querySelector("div.editor > ul > li.nav-item > a") as HTMLElement | null;
  const languageExtension = editorTab?.innerText?.split(".")[1] || "txt";

  // Try multiple methods to get the code
  let code = "";

  // Method 1: Standard textarea#code
  const textareaCode = document.querySelector("textarea#code") as HTMLTextAreaElement | null;
  if (textareaCode?.value) {
    code = textareaCode.value;
    log.debug("[SsafyToday]: Found code in textarea");
  }

  // Method 2: data-type="code" input (fill-in-the-blank problems)
  if (!code) {
    const codeInput = document.querySelector(
      "input[data-type='code'][data-language]"
    ) as HTMLInputElement | null;
    if (codeInput?.value) {
      code = codeInput.value;
      log.debug("[SsafyToday]: Found code in data-type input");
    }
  }

  // Method 3: Find hidden inputs with numeric IDs (submitted code storage)
  if (!code) {
    const allInputs = document.querySelectorAll("input[type='hidden']");
    for (const input of allInputs) {
      const inputEl = input as HTMLInputElement;
      if (inputEl.id && /^\d+$/.test(inputEl.id) && inputEl.value) {
        // Check for Java code pattern
        if (inputEl.value.includes("public class") || inputEl.value.includes("import java")) {
          code = inputEl.value;
          log.debug("[SsafyToday]: Found code in hidden input:", inputEl.id);
          break;
        }
      }
    }
  }

  // Method 4: Fill-in-the-blank problems - combine template with user input
  if (!code) {
    const algorithmType = document
      .querySelector("div.lesson-content")
      ?.getAttribute("data-algorithm-type");
    if (algorithmType === "fill" || document.querySelector(".code-editor input[type='text']")) {
      log.debug("[SsafyToday]: Processing as fill-in-the-blank problem");

      const initialCodeElement = document.querySelector(
        "input[id^='initial_code_']"
      ) as HTMLInputElement | null;
      if (initialCodeElement?.value) {
        let initialCode = initialCodeElement.value;

        // Get user input values
        const inputFields = document.querySelectorAll("input[id^='input_code_'][type='text']");
        const userInputs = Array.from(inputFields).map(
          (input) => (input as HTMLInputElement).value || ""
        );

        // Replace @@@ markers with user inputs
        if (initialCode.includes("@@@")) {
          userInputs.forEach((input) => {
            initialCode = initialCode.replace("@@@", input);
          });
        }
        code = initialCode;
        log.debug("[SsafyToday]: Fill-in-the-blank code generated");
      }
    }
  }

  // Method 5: Extract from code editor DOM (last resort)
  if (!code) {
    const codeEditor = document.querySelector(".code-editor");
    if (codeEditor) {
      const codeContainer = codeEditor.querySelector(".rouge-code");
      if (codeContainer) {
        const clonedContainer = codeContainer.cloneNode(true) as HTMLElement;

        // Replace input fields with their values
        const inputs = clonedContainer.querySelectorAll("input[type='text']");
        inputs.forEach((input) => {
          const inputEl = input as HTMLInputElement;
          const value = inputEl.value || "";
          const textNode = document.createTextNode(value);
          inputEl.parentNode?.replaceChild(textNode, inputEl);
        });

        code = clonedContainer.textContent || "";
        log.debug("[SsafyToday]: Extracted code from DOM");
      }
    }
  }

  log.debug("[SsafyToday]: Final code length:", code.length);

  if (!code) {
    log.warn("[SsafyToday]: Could not find code");
    code = "";
  }

  // Parse result message
  const resultMessage =
    [...document.querySelectorAll("#output .console-message")]
      .map((node) => node.textContent || "")
      .filter((text) => text.includes(":"))
      .reduce((cur, next) => (cur ? `${cur}<br/>${next}` : next), "") || "Empty";

  // Parse runtime and memory — 3단 폴백.
  // 개편 후 td.result.passed 셀에서 "12.3ms, 45.6MB" 형태가 사라져 기존 파싱이
  // 빈 문자열을 만들었고, 백엔드는 빈 runtime/memory를 INVALID_REQUEST로 거부한다.
  // 형식이 검증된 값만 채택하고, 실패 시 콘솔 출력의 "(X.XXms, YY.YMB)" 패턴,
  // 그래도 없으면 기존 기본값으로 — 어떤 경우에도 빈 값은 보내지 않는다.
  let runtime = "";
  let memory = "";

  // Method 1: legacy result table cells ("12.34ms, 56.7MB")
  const passedCells = [...document.querySelectorAll("td.result.passed")]
    .map((x) => (x as HTMLElement).innerText)
    .map((x) => x.replace(/[^., 0-9a-zA-Z]/g, "").trim())
    .map((x) => x.split(", "))
    .filter((x) => x.length === 2 && /ms$/i.test(x[0]) && /mb$/i.test(x[1]));
  if (passedCells.length > 0) {
    [runtime, memory] = passedCells
      .reduce((x, y) => (Number(x[0].slice(0, -2)) > Number(y[0].slice(0, -2)) ? x : y))
      .map((x) => x.replace(/(?<=[0-9])(?=[A-Za-z])/, " "));
  }

  // Method 2: result/console text "테스트 N 〉 통과 (0.05ms, 52.1MB)" — 가장 느린 케이스 채택
  if (!runtime || !memory) {
    const resultAreas = document.querySelectorAll(
      "#output, .console-content, .modal-body, .result-area"
    );
    const resultText = (resultAreas.length > 0 ? [...resultAreas] : [document.body])
      .map((el) => (el as HTMLElement).innerText || "")
      .join("\n");
    const perf = [...resultText.matchAll(/\(([\d.]+)\s*ms\s*,\s*([\d.]+)\s*MB\)/gi)];
    if (perf.length > 0) {
      const slowest = perf.reduce((x, y) => (Number(x[1]) > Number(y[1]) ? x : y));
      runtime = `${slowest[1]} ms`;
      memory = `${slowest[2]} MB`;
      log.debug("[SsafyToday]: runtime/memory parsed from result text");
    }
  }

  // Method 3: defaults (기존 파서의 기본값과 동일)
  if (!runtime) runtime = "0.00 ms";
  if (!memory) memory = "0.0 MB";

  // Get language for folder organization
  const languageButton = document.querySelector("div#tour7 > button");
  const language = languageButton?.textContent?.trim() || "";

  return makeData({
    link,
    problemId,
    level,
    title,
    problemDescription,
    division,
    languageExtension,
    code,
    resultMessage,
    runtime,
    memory,
    language,
  });
}
