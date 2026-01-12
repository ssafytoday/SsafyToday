import { languages, difficultyLabels } from '@/goormlevel/variables';
import { convertSingleCharToDoubleChar } from '@/commons/util';
import { getDirNameByOrgOption } from '@/commons/storage';
import { getDateString } from '@/commons/ui-util';

interface GoormlevelOriginData {
  link: string;
  examSequence: number;
  quizNumber: number;
  difficulty: number;
  title: string;
  language: string;
  code: string;
  memory: string;
  runtime: string;
}

interface GoormlevelData {
  examSequence: number;
  quizNumber: number;
  directory: string;
  message: string;
  fileName: string;
  readme: string;
  code: string;
}

export async function makeData({
  link,
  examSequence,
  quizNumber,
  difficulty,
  title,
  language,
  code,
  memory,
  runtime,
}: GoormlevelOriginData): Promise<GoormlevelData> {
  const languageExtension = languages[language.toLowerCase()] || 'txt';

  // 기본 디렉토리 경로 생성
  const baseDirPath = `goormlevel/${examSequence}/${quizNumber}. ${convertSingleCharToDoubleChar(title)}`;

  // 공통 업로드 서비스를 사용하여 디렉토리 경로 생성
  const directory = await getDirNameByOrgOption(baseDirPath, language, {
    problemId: String(quizNumber),
    title,
    level: `난이도 ${difficulty}`,
    memory,
    runtime,
    submissionTime: getDateString(new Date(Date.now())),
    language,
    examSequence: String(examSequence),
    difficulty: String(difficulty),
    link,
  });

  const message = `[난이도 ${difficulty}] Title: ${title}, Time: ${runtime}, Memory: ${memory} -BaekjoonHub`;
  const fileName = `${convertSingleCharToDoubleChar(title)}.${languageExtension}`;
  const dateInfo = getDateString(new Date(Date.now()));

  const readme =
    `# ${title} - ${examSequence}/${quizNumber} \n\n` +
    `[문제 링크](${link}) \n\n` +
    `### 성능 요약\n\n` +
    `메모리: ${memory}, ` +
    `시간: ${runtime}\n\n` +
    `### 제출 일자\n\n` +
    `${dateInfo}\n\n`;

  return {
    examSequence,
    quizNumber,
    directory,
    message,
    fileName,
    readme,
    code,
  };
}

interface PerformanceData {
  memory: number | string;
  runtime: number | string;
}

/**
 * 문제 데이터 파싱
 */
export async function parseData(): Promise<GoormlevelData> {
  const { href: link, pathname } = window.location;

  const pathnameList = pathname.split('/');

  const examSequence = Number(pathnameList[2]) || 0;
  const quizNumber = Number(pathnameList[5]) || 0;

  const difficultyLabelEl = document.querySelector('span[role=text] > span');
  const difficultyLabel = difficultyLabelEl?.innerHTML || '';
  const difficulty = difficultyLabels[difficultyLabel] || 0;

  const titlePrefix = 'title-';
  const titleEl = document.querySelector(`div[aria-label^="${titlePrefix}"]`);
  const title = titleEl?.getAttribute('aria-label')?.replace(titlePrefix, '') || '';

  /* 프로그래밍 언어별 폴더 정리 옵션을 위한 언어 값 가져오기 */
  const langButtonEl = document.querySelector('.Tour__selectLang button');
  const currentLanguage = langButtonEl?.textContent?.trim() || '';

  const languageMenuItems = [
    ...document.querySelectorAll(
      '#FrameBody .Tour__selectLang div[role="menu"] button[role="menuitem"]'
    ),
  ];
  const languageList = languageMenuItems.map((element) => element.textContent || '');
  const currentLanguageIndex = languageList.findIndex((language) => currentLanguage === language);

  const editors = document.querySelectorAll('#fileEditor div.cm-content.cm-lineWrapping');

  // 대상 에디터 결정
  let targetIndex: number;
  if (currentLanguageIndex >= 0 && currentLanguageIndex < editors.length) {
    targetIndex = currentLanguageIndex;
  } else if (editors.length === 1 && currentLanguageIndex < 0) {
    targetIndex = 0;
  } else {
    targetIndex = -1;
  }

  // 코드 추출
  const code =
    targetIndex >= 0
      ? Array.from(editors[targetIndex].querySelectorAll('div.cm-line'))
          .map((line) => line.textContent || '')
          .join('\n')
      : '';

  const tableRows = [
    ...document.querySelectorAll('.tab-content .tab-pane.active table tbody tr'),
  ];
  const $dataList = tableRows.filter(
    (element) => element.childNodes[1]?.textContent === 'PASS'
  );

  const performanceResult = $dataList
    .map((element) => ({
      memory: Number((element.childNodes[5] as HTMLElement)?.textContent?.trim() || '0'),
      runtime: Number((element.childNodes[6] as HTMLElement)?.textContent?.trim() || '0'),
    }))
    .reduce<PerformanceData>(
      (acc, cur, index) => {
        const accMemory = typeof acc.memory === 'number' ? acc.memory : 0;
        const accRuntime = typeof acc.runtime === 'number' ? acc.runtime : 0;

        if (index === $dataList.length - 1) {
          return {
            memory: `${((accMemory + cur.memory) / $dataList.length / 1024).toFixed(2)} MB`,
            runtime: `${((accRuntime + cur.runtime) / $dataList.length).toFixed(2)} ms`,
          };
        }
        return {
          memory: accMemory + cur.memory,
          runtime: accRuntime + cur.runtime,
        };
      },
      { memory: 0, runtime: 0 }
    );

  const memory = typeof performanceResult.memory === 'string' ? performanceResult.memory : '0 MB';
  const runtime = typeof performanceResult.runtime === 'string' ? performanceResult.runtime : '0 ms';

  return makeData({
    link,
    examSequence,
    quizNumber,
    difficulty,
    title,
    language: currentLanguage,
    code,
    memory,
    runtime,
  });
}
