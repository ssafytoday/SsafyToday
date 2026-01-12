// ============================================
// Storage Types
// ============================================

export const STORAGE_KEYS = {
  TOKEN: 'baekjoonhub_token',
  USERNAME: 'baekjoonhub_username',
  HOOK: 'baekjoonhub_hook',
  ORG_OPTION: 'baekjoonhub_org_option',
  USE_CUSTOM_TEMPLATE: 'baekjoonhub_use_custom_template',
  DIR_TEMPLATE: 'baekjoonhub_dir_template',
  STATS: 'baekjoonhub_stats',
  MODE_TYPE: 'baekjoonhub_mode_type',
  ENABLE: 'baekjoonhub_enable',
  PIPE: 'baekjoonhub_pipe',
  IS_SYNC: 'baekjoonhub_is_sync',
  SWEA: 'baekjoonhub_swea',
  SSAFY_API_URL: 'ssafytoday_api_url',
  SSAFY_ENABLED: 'ssafytoday_enabled',
  PLATFORM_BAEKJOON_USERNAME: 'ssafytoday_baekjoon_username',
  PLATFORM_PROGRAMMERS_USERNAME: 'ssafytoday_programmers_username',
  PLATFORM_SWEA_NICKNAME: 'ssafytoday_swea_nickname',
  CAPTURE_MODE: 'ssafytoday_capture_mode',
  CAPTURE_PLATFORM: 'ssafytoday_capture_platform',
} as const;

export type StorageKeyType = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export type OrgOption = 'platform' | 'language' | 'custom';
export type ModeType = 'commit' | '';

export interface StorageStats {
  version: string;
  branches?: Record<string, string>;
  submission?: Record<string, unknown>;
  problems?: Record<string, unknown>;
}

export interface SWEAProblemCache {
  contestProbId?: string;
  spiCode?: string;
  problemId?: string;
  title?: string;
  level?: string;
  submissionId?: string;
  code?: string;
  submissionTime?: string;
  language?: string;
  extension?: string;
  runtime?: string;
  memory?: string;
  result?: string;
  length?: string;
}

export interface StorageData {
  [STORAGE_KEYS.TOKEN]?: string;
  [STORAGE_KEYS.USERNAME]?: string;
  [STORAGE_KEYS.HOOK]?: string;
  [STORAGE_KEYS.ORG_OPTION]?: OrgOption;
  [STORAGE_KEYS.USE_CUSTOM_TEMPLATE]?: boolean;
  [STORAGE_KEYS.DIR_TEMPLATE]?: string;
  [STORAGE_KEYS.STATS]?: StorageStats;
  [STORAGE_KEYS.MODE_TYPE]?: ModeType;
  [STORAGE_KEYS.ENABLE]?: boolean;
  [STORAGE_KEYS.PIPE]?: boolean;
  [STORAGE_KEYS.IS_SYNC]?: boolean;
  [STORAGE_KEYS.SWEA]?: SWEAProblemCache;
  [STORAGE_KEYS.SSAFY_API_URL]?: string;
  [STORAGE_KEYS.SSAFY_ENABLED]?: boolean;
  [STORAGE_KEYS.PLATFORM_BAEKJOON_USERNAME]?: string;
  [STORAGE_KEYS.PLATFORM_PROGRAMMERS_USERNAME]?: string;
  [STORAGE_KEYS.PLATFORM_SWEA_NICKNAME]?: string;
  [STORAGE_KEYS.CAPTURE_MODE]?: boolean;
  [STORAGE_KEYS.CAPTURE_PLATFORM]?: CapturePlatformType;
}

export type StorageKey = keyof StorageData;

// ============================================
// Platform Types
// ============================================

// Platform display names for UI and API
export type PlatformType = '백준' | '프로그래머스' | 'SWEA' | 'goormlevel';

// Platform identifiers for capture mode (lowercase)
export type CapturePlatformType = 'baekjoon' | 'programmers' | 'swea' | 'goormlevel' | null;

export interface BaseProblemData {
  problemId: string;
  title: string;
  level: string;
  language: string;
  code: string;
  runtime: string;
  memory: string;
  submissionTime: string;
  length?: string;
  link?: string;
  examSequence?: string | number | null;
  difficulty?: string;
}

export interface BaekjoonProblemData extends BaseProblemData {
  submissionId: string;
  problemDescription: string;
  problemInput: string;
  problemOutput: string;
  problemTags: string[];
  result: string;
  codeLength: string;
}

export interface ProgrammersProblemData extends BaseProblemData {
  division: string;
  resultMessage: string;
  languageExtension: string;
  link: string;
}

export interface SWEAProblemData extends BaseProblemData {
  contestProbId: string;
  extension: string;
  length: string;
  link: string;
}

export interface GoormlevelProblemData extends BaseProblemData {
  examSequence: number | null;
  quizNumber: number;
  difficulty: string;
  link: string;
}

export type PlatformProblemData =
  | BaekjoonProblemData
  | ProgrammersProblemData
  | SWEAProblemData
  | GoormlevelProblemData;

// ============================================
// Upload Types
// ============================================

export interface ProblemInfo {
  problemId?: string;
  quizNumber?: number | string;
  title?: string;
  level?: string;
  difficulty?: string;
  bjLevel?: string;
  language?: string;
  runtime?: string;
  memory?: string;
  submissionTime?: string;
  problem_tags?: string[];
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
  division?: string;
  result_message?: string;
  resultMessage?: string;
  length?: string;
  link?: string;
  examSequence?: number | string | null;
}

export interface UploadProblemData {
  code: string;
  readme: string;
  directory: string;
  fileName: string;
  message: string;
  platform: PlatformType;
  problemInfo: ProblemInfo;
}

export interface UploadedFileInfo {
  path: string;
  sha: string;
}

export interface UploadResult {
  success: boolean;
  uploadedFiles?: {
    source: UploadedFileInfo;
    readme?: UploadedFileInfo;
  };
  uploadedFile?: UploadedFileInfo;
  directory?: string;
  commitSHA?: string;
}

export type UploadCallback = (branches: Record<string, string>, directory: string) => void;

// ============================================
// GitHub API Types
// ============================================

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
  email?: string;
}

export interface GitHubRepository {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
}

export interface GitHubReference {
  refSHA: string;
  ref: string;
}

export interface GitHubTreeItem {
  path: string;
  sha: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'blob' | 'tree' | 'commit';
}

export interface GitHubBlob {
  sha: string;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
}

// ============================================
// Django API Types
// ============================================

export interface DjangoSubmissionProblemData {
  problemId: string;
  title: string;
  level: string;
  language: string;
  code: string;
  runtime: string;
  memory: string;
  submissionTime: string;
  tags: string[];
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
  division?: string;
  resultMessage?: string;
  length?: string;
  link?: string;
  examSequence?: number | null;
}

export interface DjangoSubmissionMetadata {
  extensionVersion: string;
  timestamp: string;
  githubRepo: string;
  directory: string;
  fileName: string;
  commitMessage: string;
}

export interface DjangoSubmissionRequest {
  username: string;
  platform: PlatformType;
  problemData: DjangoSubmissionProblemData;
  metadata: DjangoSubmissionMetadata;
}

export interface DjangoSubmissionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  skipped?: boolean;
  statusCode?: number;
  message?: string;
}

export interface DjangoHealthCheckResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================
// Solved.ac API Types
// ============================================

export interface SolvedACDisplayName {
  language: string;
  name: string;
  short: string;
}

export interface SolvedACTag {
  key: string;
  displayNames: SolvedACDisplayName[];
}

export interface SolvedACProblem {
  problemId: number;
  titleKo: string;
  level: number;
  tags: SolvedACTag[];
  acceptedUserCount: number;
  averageTries: number;
}

// ============================================
// Chrome Extension Message Types
// ============================================

export interface BaseMessage {
  sender?: string;
  task?: string;
}

export interface SolvedApiCallMessage extends BaseMessage {
  sender: 'baekjoon';
  task: 'SolvedApiCall';
  problemId: string;
}

export interface OAuthResultMessage extends BaseMessage {
  closeWebPage: true;
  isSuccess: boolean;
  token?: string;
  username?: string;
  KEY?: string;
}

export interface CaptureUsernameMessage extends BaseMessage {
  sender: PlatformType;
  task: 'captureUsername';
  username: string;
}

export type ExtensionMessage = SolvedApiCallMessage | OAuthResultMessage | CaptureUsernameMessage | BaseMessage;

// ============================================
// Result Table Types (Baekjoon)
// ============================================

export interface ResultTableRow {
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

export type ResultCategory =
  | 'wait'
  | 'rejudge-wait'
  | 'no-judge'
  | 'compile'
  | 'judging'
  | 'ac'
  | 'pac'
  | 'pe'
  | 'wa'
  | 'awa'
  | 'tle'
  | 'mle'
  | 'ole'
  | 'rte'
  | 'ce'
  | 'co'
  | 'del';

// ============================================
// UI State Types
// ============================================

export interface UploadState {
  uploading: boolean;
}

export interface MultiloaderState {
  wrap: HTMLElement | null;
  nom: HTMLElement | null;
  denom: HTMLElement | null;
}

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

// ============================================
// Template Types
// ============================================

export interface TemplateData {
  platform: PlatformType;
  problemId: string;
  title: string;
  level: string;
  language: string;
  problemTags?: string[];
  memory?: string;
  runtime?: string;
  submissionTime?: string;
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
  division?: string;
  resultMessage?: string;
  link?: string;
  examSequence?: number;
}

// ============================================
// URL Constants Type
// ============================================

export interface UrlConstants {
  GITHUB_AUTHORIZATION_URL: string;
  GITHUB_ACCESS_TOKEN_URL: string;
  GITHUB_REDIRECT_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_API_USER_URL: string;
  GITHUB_API_REPOS_URL: string;
  SOLVED_AC_API_PROBLEM_SHOW_URL: string;
  BAEKJOON_PROBLEM_URL: string;
  BAEKJOON_SOURCE_DOWNLOAD_URL: string;
  BAEKJOON_STATUS_URL: string;
  SSAFY_API_DEFAULT_URL: string;
  SWEA_PROBLEM_DETAIL_URL: string;
}
