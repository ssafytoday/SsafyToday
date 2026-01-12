import sha1 from 'js-sha1';

const debug = true;

/**
 * 현재 익스텐션의 버전정보를 반환합니다.
 * @returns 현재 익스텐션의 버전정보
 */
export function getVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * element가 존재하는지 반환합니다.
 * @param element - 존재하는지 확인할 element
 * @returns 존재하면 true, 존재하지 않으면 false
 */
export function elementExists(
  element: NodeListOf<Element> | HTMLCollectionOf<Element> | Element[] | null | undefined
): boolean {
  return (
    element !== undefined &&
    element !== null &&
    'length' in element &&
    element.length > 0
  );
}

/**
 * 해당 값이 null 또는 undefined인지 체크합니다.
 * @param value - 체크할 값
 * @returns null이면 true, null이 아니면 false
 */
export function isNull(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * 해당 값이 비어있거나 빈 문자열인지 체크합니다.
 * @param value - 체크할 값
 * @returns 비어있으면 true, 비어있지 않으면 false
 */
export function isEmpty(value: unknown): boolean {
  if (isNull(value)) return true;
  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * UTF-8문자열의 길이를 한글을 3byte로 계산하며 반환합니다.
 * \r\n escape문자는 \n으로 변환됩니다.
 * @param str - 계산할 문자열
 * @returns 계산된 길이
 */
export function utf8Length(str: string): number {
  const normalizedStr = str.replace(/\r\n/g, '\n');
  return new TextEncoder().encode(normalizedStr).length;
}

interface ProblemObject {
  codeLength?: number | string;
  code?: string;
  problem_tags?: string[];
}

/**
 * 'codeLength' 값이 비어있다면 'code'의 길이로 계산해서 채웁니다.
 * 'problem_tags' 값이 비어있다면 '분류 없음'으로 채웁니다.
 * @param obj - 체크하여 길이를 계산할 객체
 * @returns 반환할 객체
 */
export function preProcessEmptyObj<T extends ProblemObject>(obj: T): T {
  if (isEmpty(obj.codeLength) && !isEmpty(obj.code)) {
    const { code } = obj;
    obj.codeLength = utf8Length(code!);
  }
  if (isEmpty(obj.problem_tags) && !isEmpty(obj.code)) {
    obj.problem_tags = ['분류 없음'];
  }
  return obj;
}

/**
 * 객체 또는 배열의 모든 요소를 재귀적으로 순회하여 값이 비어있지 않은지 체크합니다.
 * 자기 자신의 null값이거나 빈 문자열, 빈 배열, 빈 객체인 경우이거나, 요소 중 하나라도 값이 비어있으면 false를 반환합니다.
 * @param obj - 체크할 객체 또는 배열
 * @returns 비어있지 않으면 true, 비어있으면 false
 */
export function isNotEmpty(obj: unknown): boolean {
  if (isEmpty(obj)) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  if (Array.isArray(obj) && obj.length === 0) return false;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (!isNotEmpty((obj as Record<string, unknown>)[key])) return false;
    }
  }
  return true;
}

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

/**
 * 문자열을 escape 하여 반환합니다.
 * @param text - escape 할 문자열
 * @returns escape된 문자열
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (m) => htmlEscapeMap[m]);
}

const htmlUnescapeMap: Record<string, string> = {
  '&amp;': '&',
  '&#38;': '&',
  '&lt;': '<',
  '&#60;': '<',
  '&gt;': '>',
  '&#62;': '>',
  '&apos;': "'",
  '&#39;': "'",
  '&quot;': '"',
  '&#34;': '"',
  '&nbsp;': ' ',
  '&#160;': ' ',
};

/**
 * escape된 문자열을 unescape하여 반환합니다.
 * @param text - unescape할 문자열
 * @returns unescape된 문자열
 */
export function unescapeHtml(text: string): string {
  return text.replace(
    /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34|nbsp|#160);/g,
    (m) => htmlUnescapeMap[m]
  );
}

const singleToDoubleCharMap: Record<string, string> = {
  '!': '！',
  '%': '％',
  '&': '＆',
  '(': '（',
  ')': '）',
  '*': '＊',
  '+': '＋',
  ',': '，',
  '.': '．',
  '/': '／',
  ':': '：',
  ';': '；',
  '<': '＜',
  '=': '＝',
  '>': '＞',
  '?': '？',
  '@': '＠',
  '[': '［',
  '\\': '＼',
  ']': '］',
  '^': '＾',
  _: '＿',
  '`': '｀',
  '{': '｛',
  '|': '｜',
  '}': '｝',
  '~': '～',
  ' ': ' ',
};

/**
 * 일반 특수문자를 전각문자로 변환하는 함수
 * @param text - 변환할 문자열
 * @returns 전각문자로 변환된 문자열
 */
export function convertSingleCharToDoubleChar(text: string): string {
  return text.replace(/[!%&()*+,./:;<=>?@[\]^_`{|}~ -]/g, (m) => singleToDoubleCharMap[m]);
}

/**
 * base64로 문자열을 base64로 인코딩하여 반환합니다.
 * @param str - base64로 인코딩할 문자열
 * @returns base64로 인코딩된 문자열
 */
export function b64EncodeUnicode(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_match, p1: string) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

/**
 * base64로 인코딩된 문자열을 base64로 디코딩하여 반환합니다.
 * @param b64str - base64로 인코딩된 문자열
 * @returns base64로 디코딩된 문자열
 */
export function b64DecodeUnicode(b64str: string): string {
  return decodeURIComponent(
    atob(b64str)
      .split('')
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join('')
  );
}

/**
 * 문자열에서 숫자를 추출하여 반환합니다.
 * @param str - 숫자를 추출할 문자열
 * @returns 추출된 숫자
 */
export function parseNumberFromString(str: string): number {
  const numbers = str.match(/\d+/g);
  if (isNotEmpty(numbers) && numbers && numbers.length > 0) {
    return Number(numbers[0]);
  }
  return NaN;
}

/**
 * key 값을 기준으로 array를 그룹핑하여 map으로 반환합니다.
 * @param array - 그룹핑할 배열
 * @param key - 그룹핑할 키
 * @returns key 기준으로 그룹핑된 객체들 배열을 value로 갖는 map
 */
export function groupBy<T extends object>(
  array: T[],
  key: keyof T
): Record<string, T[]> {
  return array.reduce(
    (rv, x) => {
      const keyValue = String(x[key]);
      rv[keyValue] = rv[keyValue] || [];
      rv[keyValue].push(x);
      return rv;
    },
    {} as Record<string, T[]>
  );
}

/**
 * arr에서 같은 key 그룹 내의 요소 중 최고의 값을 리스트화하여 반환합니다.
 * @param arr - 비교할 요소가 있는 배열
 * @param key - 같은 그룹으로 묶을 키 값
 * @param compare - 비교할 함수
 * @returns 같은 key 그룹 내의 요소 중 최고의 값을 반환합니다.
 */
export function maxValuesGroupBykey<T extends object>(
  arr: T[],
  key: keyof T,
  compare: (a: T, b: T) => number
): T[] {
  const map = groupBy(arr, key);
  const result: T[] = [];
  for (const value of Object.values(map)) {
    const maxValue = value.reduce((max, current) => (compare(max, current) > 0 ? max : current));
    result.push(maxValue);
  }
  return result;
}

/**
 * 배열 내의 key에 val 값을 포함하고 있는 요소만을 반환합니다.
 * @param arr - 필터링할 배열
 * @param conditions - 필터링 조건 객체
 * @returns 필터링된 배열
 */
export function filter<T extends Record<string, string>>(
  arr: T[],
  conditions: Record<string, string>
): T[] {
  return arr.filter((item) => {
    for (const [key, value] of Object.entries(conditions)) {
      if (!item[key].includes(value)) return false;
    }
    return true;
  });
}

/**
 * calculate github blob file SHA
 * @param content - file content
 * @returns SHA hash
 */
export function calculateBlobSHA(content: string): string {
  return sha1(`blob ${new Blob([content]).size}\0${content}`);
}

/**
 * asyncPool https://github.com/rxaviers/async-pool/blob/master/lib/es7.js
 * @param poolLimit - pool limit
 * @param array - array to be processed
 * @param iteratorFn - iterator function
 * @returns processed array
 */
export async function asyncPool<T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T, array: T[]) => Promise<R>
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e: Promise<void> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

/**
 * combine two array<Object> same index.
 * @param a - 첫 번째 배열
 * @param b - 두 번째 배열
 * @returns 병합된 배열
 */
export function combine<T extends object, U extends object>(a: T[], b: U[]): (T & U)[] {
  return a.map((x, i) => ({ ...x, ...b[i] }));
}

/**
 * Log function that only works when debug is true
 * @param args - Arguments to log
 */
export function log(...args: unknown[]): void {
  if (typeof debug !== 'undefined' && debug) console.log(...args);
}
