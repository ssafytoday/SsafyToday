/* 프로그래머스의 전역 변수 선언 파일입니다. */
import constants from '@/constants/code';
import type { UploadState } from '@types';

export const levels = constants.programmersLevels;

/* state of upload for progress */
export const uploadState: UploadState = { uploading: false };
