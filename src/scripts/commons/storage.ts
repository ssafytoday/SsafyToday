import { log, isNull } from './util';
import { STORAGE_KEYS } from '@/constants/registry';
import { GitHub } from './github';
import EnhancedTemplateService from './enhancedtemplate';
import type {
  StorageData,
  StorageKey,
  StorageStats,
  GitHubTreeItem,
  PlatformType,
} from '@types';

/**
 * 현재 익스텐션의 버전정보를 반환합니다.
 * @returns 현재 익스텐션의 버전정보
 */
export function getVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * Chrome의 Local StorageArea에서 개체 가져오기
 * @param key - Storage key
 */
export async function getObjectFromLocalStorage<K extends StorageKey>(
  key: K
): Promise<StorageData[K] | undefined>;
export async function getObjectFromLocalStorage<K extends StorageKey>(
  key: K[]
): Promise<Partial<Pick<StorageData, K>>>;
export async function getObjectFromLocalStorage<K extends StorageKey>(
  key: K | K[]
): Promise<StorageData[K] | Partial<Pick<StorageData, K>> | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key as string | string[], (value) => {
        if (Array.isArray(key)) {
          resolve(value as Partial<Pick<StorageData, K>>);
        } else {
          resolve(value[key as string] as StorageData[K] | undefined);
        }
      });
    } catch (ex) {
      console.error(ex);
      resolve(undefined);
    }
  });
}

/**
 * Chrome의 Local StorageArea에 개체 저장
 * @param obj - 저장할 객체
 */
export async function saveObjectInLocalStorage(
  obj: Partial<StorageData>
): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(obj, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
      resolve();
    }
  });
}

/**
 * Chrome Local StorageArea에서 개체 제거
 * @param keys - 제거할 키 또는 키 배열
 */
export async function removeObjectFromLocalStorage(
  keys: string | string[]
): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
      resolve();
    }
  });
}

/**
 * Chrome의 Sync StorageArea에서 개체 가져오기
 * @param key - Storage key
 */
export async function getObjectFromSyncStorage<K extends StorageKey>(
  key: K
): Promise<StorageData[K] | undefined> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(key as string, (value) => {
        resolve(value[key as string] as StorageData[K] | undefined);
      });
    } catch (ex) {
      console.error(ex);
      resolve(undefined);
    }
  });
}

/**
 * Chrome의 Sync StorageArea에 개체 저장
 * @param obj - 저장할 객체
 */
export async function saveObjectInSyncStorage(
  obj: Partial<StorageData>
): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set(obj, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
      resolve();
    }
  });
}

/**
 * Chrome Sync StorageArea에서 개체 제거
 * @param keys - 제거할 키 또는 키 배열
 */
export async function removeObjectFromSyncStorage(
  keys: string | string[]
): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.remove(keys, () => {
        resolve();
      });
    } catch (ex) {
      console.error(ex);
      resolve();
    }
  });
}

export async function getToken(): Promise<string | undefined> {
  return getObjectFromLocalStorage(STORAGE_KEYS.TOKEN);
}

export async function getGithubUsername(): Promise<string | undefined> {
  return getObjectFromLocalStorage(STORAGE_KEYS.USERNAME);
}

export async function getStats(): Promise<StorageStats | undefined> {
  return getObjectFromLocalStorage(STORAGE_KEYS.STATS);
}

export async function getHook(): Promise<string | undefined> {
  return getObjectFromLocalStorage(STORAGE_KEYS.HOOK);
}

/** settings.html 의 분기 처리 dis_option에서 설정된 값을 반환합니다. */
export async function getOrgOption(): Promise<string> {
  try {
    const option = await getObjectFromLocalStorage(STORAGE_KEYS.ORG_OPTION);
    return option || 'platform';
  } catch (_ex) {
    console.log('The way it works has changed with updates. Update your storage.');
    await saveObjectInLocalStorage({ [STORAGE_KEYS.ORG_OPTION]: 'platform' });
    return 'platform';
  }
}

export async function getModeType(): Promise<string | undefined> {
  return getObjectFromLocalStorage(STORAGE_KEYS.MODE_TYPE);
}

export async function saveToken(token: string): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.TOKEN]: token });
}

export async function saveStats(stats: StorageStats): Promise<void> {
  return saveObjectInLocalStorage({ [STORAGE_KEYS.STATS]: stats });
}

/**
 * 백준 랭크 경로 필터
 */
export function _baekjoonRankRemoverFilter(path: string): string {
  return path.replace(/\/(Unrated|Silver|Bronze|Gold|Platinum|Diamond|Ruby|Master)\//g, '/');
}

/**
 * 프로그래머스 랭크 경로 필터
 */
export function _programmersRankRemoverFilter(path: string): string {
  return path.replace(/\/(lv[0-9]|unrated)\//g, '/');
}

/**
 * 백준 공백 경로 필터
 */
export function _baekjoonSpaceRemoverFilter(path: string): string {
  return path.replace(/( | |&nbsp|&#160|&#8197|%E2%80%85|%20)/g, '');
}

/**
 * SWEA 랭크 경로 필터
 */
export function _swexpertacademyRankRemoveFilter(path: string): string {
  return path.replace(/\/D([0-8]+)\//g, '/');
}

type NestedObject = { [key: string]: NestedObject | string };

/**
 * 객체의 경로에 데이터를 업데이트합니다.
 */
export function updateObjectDatafromPath(
  obj: NestedObject,
  path: string,
  data: string
): void {
  let current: NestedObject = obj;
  const pathArray = _swexpertacademyRankRemoveFilter(
    _baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path)))
  )
    .split('/')
    .filter((p) => p !== '');

  for (const p of pathArray.slice(0, -1)) {
    if (isNull(current[p]) || typeof current[p] === 'string') {
      current[p] = {};
    }
    current = current[p] as NestedObject;
  }

  const lastKey = pathArray[pathArray.length - 1];
  if (lastKey) {
    current[lastKey] = data;
  }
}

/**
 * 객체의 경로에서 데이터를 가져옵니다.
 */
export function getObjectDatafromPath(obj: NestedObject, path: string): string | null {
  let current: NestedObject | string = obj;
  const pathArray = _swexpertacademyRankRemoveFilter(
    _baekjoonSpaceRemoverFilter(_programmersRankRemoverFilter(_baekjoonRankRemoverFilter(path)))
  )
    .split('/')
    .filter((p) => p !== '');

  for (const p of pathArray.slice(0, -1)) {
    if (typeof current === 'string' || isNull((current as NestedObject)[p])) {
      return null;
    }
    current = (current as NestedObject)[p];
  }

  const lastKey = pathArray[pathArray.length - 1];
  if (lastKey && typeof current === 'object' && current !== null) {
    const value = current[lastKey];
    return typeof value === 'string' ? value : null;
  }
  return null;
}

export async function updateStatsSHAfromPath(path: string, sha: string): Promise<void> {
  const stats = await getStats();
  if (stats) {
    updateObjectDatafromPath(stats.submission as NestedObject, path, sha);
    await saveStats(stats);
  }
}

export async function getStatsSHAfromPath(path: string): Promise<string | null> {
  const stats = await getStats();
  if (stats) {
    return getObjectDatafromPath(stats.submission as NestedObject, path);
  }
  return null;
}

export async function updateLocalStorageStats(): Promise<StorageStats | undefined> {
  const hook = await getHook();
  const token = await getToken();

  if (!hook || !token) {
    return undefined;
  }

  const git = new GitHub(hook, token);
  const stats = await getStats();

  if (!stats) {
    return undefined;
  }

  const treeItems: GitHubTreeItem[] = [];

  const tree = await git.getTree();
  if (tree) {
    tree.forEach((item: GitHubTreeItem) => {
      if (item.type === 'blob') {
        treeItems.push(item);
      }
    });
  }

  const { submission } = stats;
  treeItems.forEach((item) => {
    updateObjectDatafromPath(submission as NestedObject, `${hook}/${item.path}`, item.sha);
  });

  const defaultBranch = await git.getDefaultBranchOnRepo();
  if (!stats.branches) {
    stats.branches = {};
  }
  stats.branches[hook] = defaultBranch;
  await saveStats(stats);
  log('update stats', stats);
  return stats;
}

// Template data is a flexible object for directory template generation
// It includes common problem fields plus additional template-specific properties
type TemplateData = {
  problemId?: string;
  title?: string;
  level?: string;
  language?: string;
  runtime?: string;
  memory?: string;
  submissionTime?: string;
  length?: string;
  link?: string;
  examSequence?: string | number | null;
  difficulty?: string;
  division?: string;
  problem_tags?: string[];
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
  result_message?: string;
} | null;

export async function getDirNameByOrgOption(
  dirName: string,
  language: string,
  data: TemplateData = null
): Promise<string> {
  try {
    let platform: PlatformType | '' = '';
    if (dirName.startsWith('백준/')) {
      platform = '백준';
    } else if (dirName.startsWith('프로그래머스/')) {
      platform = '프로그래머스';
    } else if (dirName.startsWith('SWEA/')) {
      platform = 'SWEA';
    } else if (dirName.startsWith('goormlevel/')) {
      platform = 'goormlevel';
    }

    const orgOption = await getOrgOption();
    const customTemplate = await getObjectFromLocalStorage(STORAGE_KEYS.DIR_TEMPLATE);

    if (orgOption === 'custom' && platform) {
      return EnhancedTemplateService.getDirNameWithTemplate(
        platform,
        dirName,
        language,
        data,
        true,
        customTemplate || '',
        'custom'
      );
    }
    if (orgOption === 'language') {
      return `${language}/${dirName}`;
    }

    return dirName;
  } catch (error) {
    console.error('디렉토리 구조 생성 중 오류가 발생했습니다:', error);
    return dirName;
  }
}

export function initializeStorage(): void {
  getObjectFromLocalStorage(STORAGE_KEYS.IS_SYNC).then((data) => {
    const keys: StorageKey[] = [
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USERNAME,
      STORAGE_KEYS.PIPE,
      STORAGE_KEYS.STATS,
      STORAGE_KEYS.HOOK,
      STORAGE_KEYS.MODE_TYPE,
    ];
    if (data) {
      console.log('BaekjoonHub Local storage already synced!');
      return;
    }

    keys.forEach((key) => {
      chrome.storage.sync.get(key, (syncData) => {
        saveObjectInLocalStorage({ [key]: syncData[key] });
      });
    });

    saveObjectInLocalStorage({ [STORAGE_KEYS.IS_SYNC]: true }).then(() => {
      console.log('BaekjoonHub Synced to local values');
    });
  });

  getStats().then((stats) => {
    const newStats: StorageStats = stats || {
      version: '0.0.0',
      branches: {},
      submission: {},
      problems: {},
    };

    if (isNull(newStats.version)) newStats.version = '0.0.0';
    if (isNull(newStats.branches) || newStats.version !== getVersion()) newStats.branches = {};
    if (isNull(newStats.submission) || newStats.version !== getVersion()) newStats.submission = {};
    if (isNull(newStats.problems) || newStats.version !== getVersion()) newStats.problems = {};

    newStats.version = getVersion();
    saveStats(newStats);
  });
}
