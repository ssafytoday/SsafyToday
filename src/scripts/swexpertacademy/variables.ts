/* SWEA의 전역 변수 선언 파일입니다. */
import constants from '@/constants/code';
import type { UploadState } from '@types';

export const languages: Record<string, string> = constants.languages.swexpertacademy;

/* state of upload for progress */
export const uploadState: UploadState = { uploading: false };
