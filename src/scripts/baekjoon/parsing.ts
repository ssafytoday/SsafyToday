import {
  isNull,
  preProcessEmptyObj,
  parseNumberFromString,
  asyncPool,
  convertSingleCharToDoubleChar,
  unescapeHtml,
  log,
} from '@/commons/util';
import { getDateString, convertImageTagToAbsoluteURL } from '@/commons/ui-util';
import {
  updateProblemData,
  getProblemData,
  updateSubmitCodeData,
  getSubmitCodeData,
  updateSolvedACData,
  getSolvedACData,
} from '@/baekjoon/storage';
import { languages, bjLevel, uploadState } from '@/baekjoon/variables';
import {
  markUploadFailedCSS,
  selectBestSubmissionList,
  langVersionRemove,
} from '@/baekjoon/util';
import { getDirNameByOrgOption } from '@/commons/storage';
import urls from '@/constants/url';
import type { SolvedACProblem, SolvedACTag, SolvedACDisplayName, BaekjoonProblemData, SolvedApiCallMessage } from '@types';

interface BaekjoonSubmission {
  submissionId: string;
  problemId: string;
  result: string;
  language: string;
  runtime: string;
  memory: string;
  codeLength: string;
  submissionTime: string;
  username: string;
}

interface ProblemDescription {
  problemId?: string;
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
}

interface ProblemInfoAndCode {
  problemId: string;
  submissionId: string;
  title: string;
  level: string;
  code: string;
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
  problemTags: string[];
}

interface DetailMessageAndReadme {
  directory: string;
  fileName: string;
  message: string;
  readme: string;
  code: string;
}

/**
 * url에 해당하는 html 문서를 가져오는 함수
 * @param url - url 주소
 * @returns html document
 */
export async function findHtmlDocumentByUrl(url: string): Promise<Document> {
  const html = await fetch(url, { method: 'GET' });
  const text = await html.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, 'text/html');
}

export function parsingResultTableList(doc: Document = document): BaekjoonSubmission[] {
  const table: BaekjoonSubmission[] = [];
  const trs = doc.querySelectorAll('#status-table > tbody > tr');
  trs.forEach((tr) => {
    const td = tr.querySelectorAll('td');
    const submissionId = td[0].innerText.trim();
    const problemId = td[2].innerText.trim();
    const result = td[3].innerText.trim();
    const language = td[5].innerText.trim();
    const runtime = td[6].innerText.trim();
    const memory = td[7].innerText.trim();
    const codeLength = td[8].innerText.trim();
    const submissionTime = td[9].innerText.trim();
    const username = td[1].innerText.trim();
    table.push({
      submissionId,
      problemId,
      result,
      language,
      runtime,
      memory,
      codeLength,
      submissionTime,
      username,
    });
  });
  return table;
}

/**
 * user가 "맞았습니다!!" 결과를 맞은 모든 제출 결과 리스트를 가져오는 함수
 * @param username - 백준 아이디
 * @returns Promise<BaekjoonSubmission[]>
 */
export async function findResultTableListByUsername(
  username: string
): Promise<BaekjoonSubmission[]> {
  const result: BaekjoonSubmission[] = [];
  let doc = await findHtmlDocumentByUrl(
    `${urls.BAEKJOON_STATUS_URL}?user_id=${username}&result_id=4`
  );
  let nextPage = doc.getElementById('next_page');
  do {
    result.push(...parsingResultTableList(doc));
    if (nextPage !== null) {
      doc = await findHtmlDocumentByUrl(nextPage.getAttribute('href') || '');
      nextPage = doc.getElementById('next_page');
    }
  } while (nextPage !== null);
  result.push(...parsingResultTableList(doc));

  return result;
}

/**
 * user가 "맞았습니다!!" 결과를 맞은 중복되지 않은 제출 결과 리스트를 가져오는 함수
 * @param username - 백준 아이디
 * @returns Promise<BaekjoonSubmission[]>
 */
export async function findUniqueResultTableListByUsername(
  username: string
): Promise<BaekjoonSubmission[]> {
  return selectBestSubmissionList(await findResultTableListByUsername(username));
}

export async function fetchProblemDescriptionById(
  problemId: string
): Promise<ProblemDescription> {
  const res = await fetch(`${urls.BAEKJOON_PROBLEM_URL}${problemId}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return parseProblemDescription(doc);
}

export async function fetchSubmitCodeById(submissionId: string): Promise<string> {
  const res = await fetch(`${urls.BAEKJOON_SOURCE_DOWNLOAD_URL}${submissionId}`, {
    method: 'GET',
  });
  return res.text();
}

export async function getProblemDescriptionById(
  problemId: string
): Promise<ProblemDescription | null> {
  let problem: ProblemDescription | null = await getProblemData(problemId);
  if (isNull(problem)) {
    problem = await fetchProblemDescriptionById(problemId);
    if (problem) {
      updateProblemData({
        problemId,
        problem_description: problem.problemDescription,
        problem_input: problem.problemInput,
        problem_output: problem.problemOutput,
      });
    }
  }
  return problem;
}

export async function getSubmitCodeById(submissionId: string): Promise<string> {
  let code = await getSubmitCodeData(submissionId);
  if (isNull(code)) {
    code = await fetchSubmitCodeById(submissionId);
    updateSubmitCodeData({ submissionId, code });
  }
  return code || '';
}

export async function getSolvedACById(problemId: string): Promise<SolvedACProblem | undefined> {
  let jsonData = await getSolvedACData(problemId);
  if (isNull(jsonData)) {
    jsonData = await fetchSolvedACById(parseInt(problemId));
    if (jsonData) {
      updateSolvedACData({ problemId, jsonData });
    }
  }
  return jsonData;
}

/**
 * 문제와 제출 코드 정보를 가져옵니다.
 */
export async function findProblemInfoAndSubmissionCode(
  problemId: string,
  submissionId: string
): Promise<ProblemInfoAndCode | null> {
  log('in find with promise');
  if (!isNull(problemId) && !isNull(submissionId)) {
    try {
      const [description, code, solvedJson] = await Promise.all([
        getProblemDescriptionById(problemId),
        getSubmitCodeById(submissionId),
        getSolvedACById(problemId),
      ]);

      if (!solvedJson) return null;

      const problemTags = solvedJson.tags
        .flatMap((tag: SolvedACTag) => tag.displayNames)
        .filter((tag: SolvedACDisplayName) => tag.language === 'ko')
        .map((tag: SolvedACDisplayName) => tag.name);
      const title = solvedJson.titleKo;
      const level = bjLevel[solvedJson.level];

      const problemDescription = description?.problemDescription;
      const problemInput = description?.problemInput;
      const problemOutput = description?.problemOutput;

      return {
        problemId,
        submissionId,
        title,
        level,
        code,
        problemDescription,
        problemInput,
        problemOutput,
        problemTags,
      };
    } catch (err) {
      console.log('error ocurred: ', err);
      uploadState.uploading = false;
      markUploadFailedCSS();
      return null;
    }
  }
  return null;
}

/**
 * 문제의 상세 정보를 가지고, 문제의 업로드할 디렉토리, 파일명, 커밋 메시지, 문제 설명을 파싱하여 반환합니다.
 */
export async function makeDetailMessageAndReadme(
  data: BaekjoonProblemData & ProblemInfoAndCode
): Promise<DetailMessageAndReadme> {
  const {
    problemId,
    result,
    title,
    level,
    problemTags,
    problemDescription,
    problemInput,
    problemOutput,
    submissionTime,
    code,
    language,
    memory,
    runtime,
  } = data;
  const score = parseNumberFromString(result || '');

  // 데이터 객체에 언어 정보 전달
  const processedLanguage = langVersionRemove(language, null);

  // 기본 디렉토리 경로 생성
  const baseDirPath = `백준/${level.replace(/ .*/, '')}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // 공통 업로드 서비스를 사용하여 디렉토리 경로 생성
  const directory = await getDirNameByOrgOption(baseDirPath, processedLanguage, {
    problemId,
    title,
    level,
    problem_tags: problemTags,
    memory,
    runtime,
    submissionTime,
    language: processedLanguage,
    problem_description: problemDescription,
    problem_input: problemInput,
    problem_output: problemOutput,
  });

  const message = `[${level}] Title: ${runtime} ms, Memory: ${memory} KB${Number.isNaN(score) ? ' ' : `, Score: ${score} point `}-BaekjoonHub`;
  const category = problemTags.join(', ');
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languages[language] || 'txt'}`;
  const dateInfo = submissionTime ?? getDateString(new Date(Date.now()));

  const readme =
    `# [${level}] ${title} - ${problemId} \n\n` +
    `[문제 링크](${urls.BAEKJOON_PROBLEM_URL}${problemId}) \n\n` +
    `### 성능 요약\n\n` +
    `메모리: ${memory} KB, ` +
    `시간: ${runtime} ms\n\n` +
    `### 분류\n\n` +
    `${category || 'Empty'}\n\n${problemDescription ? `### 제출 일자\n\n${dateInfo}\n\n### 문제 설명\n\n${problemDescription}\n\n### 입력 \n\n ${problemInput}\n\n### 출력 \n\n ${problemOutput}\n\n` : ''}`;

  return {
    directory,
    fileName,
    message,
    readme,
    code,
  };
}

/**
 * bojData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.
 */
export async function findData(
  inputData: BaekjoonSubmission | null
): Promise<(BaekjoonSubmission & DetailMessageAndReadme) | null> {
  try {
    const data = inputData;
    if (isNull(data)) {
      return null;
    }
    if (Number.isNaN(Number(data.problemId)) || Number(data.problemId) < 1000)
      throw new Error(
        `정책상 대회 문제는 업로드 되지 않습니다. 대회 문제가 아니라고 판단된다면 이슈로 남겨주시길 바랍니다.\n문제 ID: ${data.problemId}`
      );
    const problemInfoAndCode = await findProblemInfoAndSubmissionCode(
      data.problemId,
      data.submissionId
    );
    if (!problemInfoAndCode) return null;

    const mergedData = preProcessEmptyObj({ ...data, ...problemInfoAndCode }) as BaekjoonProblemData &
      ProblemInfoAndCode;
    const detail = await makeDetailMessageAndReadme(mergedData);
    return { ...data, ...detail };
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * 문제 설명을 파싱합니다.
 */
export function parseProblemDescription(doc: Document = document): ProblemDescription {
  const problemDescriptionEl = doc.getElementById('problem_description');
  if (problemDescriptionEl) {
    convertImageTagToAbsoluteURL(doc);
  }

  const titleEl = doc.getElementsByTagName('title')[0];
  const problemId = titleEl?.textContent?.split(':')[0]?.replace(/[^0-9]/, '') || '';

  const problemDescription = problemDescriptionEl
    ? unescapeHtml(problemDescriptionEl.innerHTML.trim())
    : '';
  const problemInputEl = doc.getElementById('problem_input');
  const problemOutputEl = doc.getElementById('problem_output');
  const problemInput = problemInputEl?.innerHTML?.trim() || 'Empty';
  const problemOutput = problemOutputEl?.innerHTML?.trim() || 'Empty';

  if (problemId && problemDescription) {
    log(`문제번호 ${problemId}의 내용을 저장합니다.`);
    updateProblemData({
      problemId,
      problem_description: problemDescription,
      problem_input: problemInput,
      problem_output: problemOutput,
    });
    return {
      problemId,
      problemDescription,
      problemInput,
      problemOutput,
    };
  }
  return {};
}

export async function fetchSolvedACById(problemId: number): Promise<SolvedACProblem> {
  const message: SolvedApiCallMessage = {
    sender: 'baekjoon',
    task: 'SolvedApiCall',
    problemId: String(problemId),
  };
  return chrome.runtime.sendMessage(message);
}

/**
 * 문제의 목록을 문제 번호로 한꺼번에 반환합니다.
 * (한번 조회 시 100개씩 나눠서 진행)
 */
export async function fetchProblemInfoByIds(problemIds: string[][]): Promise<SolvedACProblem[]> {
  const dividedProblemIds: string[][] = [];
  for (const problemIdChunk of problemIds) {
    dividedProblemIds.push(problemIdChunk.slice(0, 100));
  }
  const results = await asyncPool(1, dividedProblemIds, async (pids) => {
    const result = await fetch(
      `https://solved.ac/api/v3/problem/lookup?problemIds=${pids.join('%2C')}`,
      { method: 'GET' }
    );
    return result.json();
  });
  return results.flatMap((result) => result);
}

/**
 * 문제의 상세 정보 목록을 문제 번호 목록으로 한꺼번에 반환합니다.
 * (한번 조회 시 2개씩 병렬로 진행)
 */
export async function fetchProblemDescriptionsByIds(
  problemIds: string[]
): Promise<(ProblemDescription | null)[]> {
  return asyncPool(2, problemIds, async (problemId) => getProblemDescriptionById(problemId));
}

/**
 * submissionId들을 통해 코드들을 가져옵니다. (부하를 줄이기 위해 한번에 2개씩 가져옵니다.)
 */
export async function fetchSubmissionCodeByIds(submissionIds: string[]): Promise<string[]> {
  return asyncPool(2, submissionIds, async (submissionId) => getSubmitCodeById(submissionId));
}

/**
 * user가 problemId 에 제출한 리스트를 가져오는 함수
 */
export async function findResultTableByProblemIdAndUsername(
  problemId: string,
  username: string
): Promise<BaekjoonSubmission[]> {
  const html = await fetch(
    `https://www.acmicpc.net/status?from_mine=1&problem_id=${problemId}&user_id=${username}`,
    { method: 'GET' }
  );
  const text = await html.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return parsingResultTableList(doc);
}
