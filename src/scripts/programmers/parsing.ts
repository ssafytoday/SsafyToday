import { convertSingleCharToDoubleChar } from '@/commons/util';
import { getDateString } from '@/commons/ui-util';
import { getDirNameByOrgOption } from '@/commons/storage';

interface ProgrammersOriginData {
  link: string;
  problemId: string;
  level: string;
  title: string;
  problemDescription: string;
  division: string;
  languageExtension: string;
  code: string;
  resultMessage: string;
  runtime: string;
  memory: string;
  language: string;
}

interface ProgrammersData {
  problemId: string;
  directory: string;
  message: string;
  fileName: string;
  readme: string;
  code: string;
}

/*
  문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
  모든 해당 파일의 모든 함수는 parseData()를 통해 호출됩니다.
*/

/*
  bojData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - readme : README.md에 작성할 내용
  - code : 소스코드 내용
*/
export async function makeData(origin: ProgrammersOriginData): Promise<ProgrammersData> {
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

  // 기본 디렉토리 경로 생성
  const baseDirPath = `프로그래머스/${level}/${problemId}. ${convertSingleCharToDoubleChar(title)}`;

  // 공통 업로드 서비스를 사용하여 디렉토리 경로 생성
  const directory = await getDirNameByOrgOption(baseDirPath, language, {
    problemId,
    title,
    level,
    division,
    memory,
    runtime,
    submissionTime: getDateString(new Date(Date.now())),
    language,
    problem_description: problemDescription,
    result_message: resultMessage,
    link,
  });

  const levelWithLv = `${level}`.includes('lv') ? level : `lv${level}`.replace('lv', 'level ');
  const message = `[${levelWithLv}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languageExtension}`;
  const dateInfo = getDateString(new Date(Date.now()));

  const readme =
    `# [${levelWithLv}] ${title} - ${problemId} \n\n` +
    `[문제 링크](${link}) \n\n` +
    `### 성능 요약\n\n` +
    `메모리: ${memory}, ` +
    `시간: ${runtime}\n\n` +
    `### 구분\n\n` +
    `${division.replace('/', ' > ')}\n\n` +
    `### 채점결과\n\n` +
    `${resultMessage}\n\n` +
    `### 제출 일자\n\n` +
    `${dateInfo}\n\n` +
    `### 문제 설명\n\n` +
    `${problemDescription}\n\n` +
    `> 출처: 프로그래머스 코딩 테스트 연습, https://school.programmers.co.kr/learn/challenges`;

  return {
    problemId,
    directory,
    message,
    fileName,
    readme,
    code,
  };
}

/**
 * 페이지에서 문제 데이터를 파싱합니다.
 */
export async function parseData(): Promise<ProgrammersData> {
  const metaUrl = document.querySelector('head > meta[name$=url]') as HTMLMetaElement | null;
  const link = metaUrl?.content?.replace(/\?.*/g, '').trim() || '';

  const lessonContent = document.querySelector('div.main > div.lesson-content');
  const problemId = lessonContent?.getAttribute('data-lesson-id') || '';
  const level =
    document.querySelector('body > div.main > div.lesson-content')?.getAttribute('data-challenge-level') || '';

  const breadcrumb = document.querySelector('ol.breadcrumb');
  const division = breadcrumb
    ? [...breadcrumb.childNodes]
        .filter((x) => (x as HTMLElement).className !== 'active')
        .map((x) => (x as HTMLElement).innerText)
        .map((x) => convertSingleCharToDoubleChar(x))
        .reduce((a, b) => `${a}/${b}`)
    : '';

  const titleEl = document.querySelector('.algorithm-title .challenge-title');
  const title = titleEl?.textContent?.replace(/\\n/g, '').trim() || '';

  const descriptionEl = document.querySelector('div.guide-section-description > div.markdown');
  const problemDescription = descriptionEl?.innerHTML || '';

  const langNavEl = document.querySelector('div.editor > ul > li.nav-item > a') as HTMLElement | null;
  const languageExtension = langNavEl?.innerText?.split('.')[1] || 'txt';

  const codeEl = document.querySelector('textarea#code') as HTMLTextAreaElement | null;
  const code = codeEl?.value || '';

  const consoleMessages = [...document.querySelectorAll('#output .console-message')];
  const resultMessage =
    consoleMessages
      .map((node) => node.textContent || '')
      .filter((text) => text.includes(':'))
      .reduce((cur, next) => (cur ? `${cur}<br/>${next}` : next), '') || 'Empty';

  const resultCells = [...document.querySelectorAll('td.result.passed')];
  const [runtime, memory] = resultCells
    .map((x) => (x as HTMLElement).innerText)
    .map((x) => x.replace(/[^., 0-9a-zA-Z]/g, '').trim())
    .map((x) => x.split(', '))
    .reduce((x, y) => (Number(x[0].slice(0, -2)) > Number(y[0].slice(0, -2)) ? x : y), [
      '0.00ms',
      '0.0MB',
    ])
    .map((x) => x.replace(/(?<=[0-9])(?=[A-Za-z])/, ' '));

  /* 프로그래밍 언어별 폴더 정리 옵션을 위한 언어 값 가져오기 */
  const langButtonEl = document.querySelector('div#tour7 > button');
  const language = langButtonEl?.textContent?.trim() || '';

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
