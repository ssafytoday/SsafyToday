/**
 * SsafyToday Type Definitions
 *
 * This module re-exports all type definitions for easy importing.
 */

// Config types
export type {
  Timeouts,
  RetryLimits,
  ResultMessage,
  ResultMessages,
  LogLevels,
  LogLevel,
  FileLimits,
  PlatformSelectors,
  Selectors,
} from './config';

// Platform types
export type {
  PlatformName,
  PlatformKey,
  PlatformConfig,
  SubmissionData,
  CheckCondition,
  SuccessCallback,
  SubmissionCheckerOptions,
  UploadState,
  PlatformUrls,
} from './platform';

// Problem types
export type {
  BaseProblemInfo,
  BaekjoonProblemInfo,
  ProgrammersProblemInfo,
  GoormLevelProblemInfo,
  SWEAProblemInfo,
  ProblemInfo,
  ProblemData,
  ProblemInfoMapper,
  ParsedProblemData,
} from './problem';

// Submission types
export type {
  UploadHandlerResult,
  ParseDataFunction,
  StartUploadFunction,
  UploadHandlerCreator,
} from './upload';

// Storage types
export type {
  Stats,
  StorageData,
  StorageArea,
  BatchUpdate,
} from './storage';

// Toast types
export type {
  ToastType,
  ToastTypeColors,
  ToastColors,
  ToastConfig,
  ToastOptions,
  IToast,
  IToastManager,
} from './toast';
