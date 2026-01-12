/**
 * 템플릿에서 사용할 수 있는 텍스트 변환 유틸리티 함수들
 * 기존 util.js의 함수들을 템플릿에 적합하게 재구성
 */

import {
  b64DecodeUnicode,
  b64EncodeUnicode,
  escapeHtml,
  unescapeHtml,
  convertSingleCharToDoubleChar,
} from './util';

/**
 * 문자열에서 지정한 부분 문자열을 다른 문자열로 교체합니다
 * @param text - 원본 문자열
 * @param searchValue - 찾을 값(문자열 또는 정규식)
 * @param replaceValue - 교체할 값
 * @returns 교체된 문자열
 */
export function replaceText(
  text: string,
  searchValue: string | RegExp,
  replaceValue: string
): string {
  if (typeof text !== 'string') return text;
  return text.replace(searchValue, replaceValue);
}

/**
 * 문자열 양쪽의 공백을 제거합니다
 * @param text - 처리할 텍스트
 * @returns 공백이 제거된 텍스트
 */
export function trim(text: string): string {
  if (typeof text !== 'string') return text;
  return text.trim();
}

/**
 * 배열을 지정된 구분자로 연결합니다
 * @param arr - 연결할 배열
 * @param separator - 구분자 (기본: '-')
 * @returns 연결된 문자열
 */
export function arrayJoin<T>(arr: T[], separator: string = '-'): string {
  if (!Array.isArray(arr)) return String(arr);
  return arr.join(separator);
}

/**
 * 문자열에서 첫 번째 공백 이후의 모든 내용을 제거합니다
 * 주로 level에서 "Bronze V" → "Bronze" 변환에 사용
 * @param text - 처리할 텍스트
 * @returns 처리된 텍스트
 */
export function removeAfterSpace(text: string): string {
  if (typeof text !== 'string') return text;
  return text.replace(/ .*/, '');
}

/**
 * 문자열을 URL 안전한 형태로 변환합니다
 * @param text - 변환할 텍스트
 * @returns URL 안전한 텍스트
 */
export function urlSafe(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[\s\\/\\:*?"<>|]/g, '_') // 특수문자를 언더스코어로 변경
    .replace(/_{2,}/g, '_') // 연속된 언더스코어를 하나로
    .replace(/^_|_$/g, ''); // 앞뒤 언더스코어 제거
}

/**
 * 문자열을 kebab-case로 변환합니다
 * @param text - 변환할 텍스트
 * @returns kebab-case로 변환된 텍스트
 */
export function toKebabCase(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
    .replace(/[\s_]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * 문자열을 snake_case로 변환합니다
 * @param text - 변환할 텍스트
 * @returns snake_case로 변환된 텍스트
 */
export function toSnakeCase(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
    .replace(/[\s-]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

/**
 * 문자열을 camelCase로 변환합니다
 * @param text - 변환할 텍스트
 * @returns camelCase로 변환된 텍스트
 */
export function toCamelCase(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[\s\-_]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * 문자열을 PascalCase로 변환합니다
 * @param text - 변환할 텍스트
 * @returns PascalCase로 변환된 텍스트
 */
export function toPascalCase(text: string): string {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[\s\-_]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

/**
 * 문자열의 길이를 제한합니다
 * @param text - 제한할 텍스트
 * @param maxLength - 최대 길이
 * @param ellipsis - 말줄임표 (기본: '...')
 * @returns 길이가 제한된 텍스트
 */
export function truncate(text: string, maxLength: number = 50, ellipsis: string = '...'): string {
  if (typeof text !== 'string') return text;
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * 문자열에서 숫자만 추출합니다
 * @param text - 처리할 텍스트
 * @returns 숫자만 포함된 텍스트
 */
export function extractNumbers(text: string): string {
  if (typeof text !== 'string') return text;
  return text.replace(/[^0-9]/g, '');
}

/**
 * 문자열에서 영문자만 추출합니다
 * @param text - 처리할 텍스트
 * @returns 영문자만 포함된 텍스트
 */
export function extractLetters(text: string): string {
  if (typeof text !== 'string') return text;
  return text.replace(/[^a-zA-Z]/g, '');
}

/**
 * 날짜를 한국어 형식으로 포맷합니다
 * @param dateString - 날짜 문자열
 * @returns 한국어 형식의 날짜
 */
export function formatKoreanDate(dateString: string): string {
  if (typeof dateString !== 'string') return dateString;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export interface TextTransforms {
  [key: string]: (value: string, ...args: string[]) => string;
  safe: (text: string) => string;
  urlSafe: (text: string) => string;
  truncate: (text: string, maxLength?: string, ellipsis?: string) => string;
  trim: (text: string) => string;
  extractNumbers: (text: string) => string;
  extractLetters: (text: string) => string;
  arrayJoin: (arr: string, separator?: string) => string;
  removeAfterSpace: (text: string) => string;
  toKebabCase: (text: string) => string;
  toSnakeCase: (text: string) => string;
  toCamelCase: (text: string) => string;
  toPascalCase: (text: string) => string;
  htmlEscape: (text: string) => string;
  htmlUnescape: (text: string) => string;
  base64Encode: (str: string) => string;
  base64Decode: (b64str: string) => string;
}

export const textTransforms: TextTransforms = {
  // 기본 함수들
  safe: convertSingleCharToDoubleChar,
  urlSafe,
  truncate: (text: string, maxLength?: string, ellipsis?: string) =>
    truncate(text, maxLength ? parseInt(maxLength, 10) : 50, ellipsis),
  trim,
  extractNumbers,
  extractLetters,
  arrayJoin: (arr: string, separator?: string) => {
    try {
      const parsed = JSON.parse(arr);
      return Array.isArray(parsed) ? parsed.join(separator || '-') : arr;
    } catch {
      return arr;
    }
  },
  removeAfterSpace,
  toKebabCase,
  toSnakeCase,
  toCamelCase,
  toPascalCase,

  // HTML & 인코딩
  htmlEscape: escapeHtml,
  htmlUnescape: unescapeHtml,
  base64Encode: b64EncodeUnicode,
  base64Decode: b64DecodeUnicode,
};

export function getTextTransforms(): TextTransforms {
  return textTransforms;
}
