import { getStats, saveStats } from '@/commons/storage';
import { log, isNull } from '@/commons/util';
import type { StorageStats, SolvedACProblem } from '@types';

interface CacheData {
  id: string | number;
  save_date?: number;
  [key: string]: unknown;
}

interface ProblemCacheData extends CacheData {
  problemDescription?: string;
  problemInput?: string;
  problemOutput?: string;
}

interface SubmitCodeCacheData extends CacheData {
  data?: string;
}

interface SolvedACCacheData extends CacheData {
  data?: SolvedACProblem;
}

type CacheEntry = ProblemCacheData | SubmitCodeCacheData | SolvedACCacheData;

interface StatsWithCache extends StorageStats {
  [key: string]: unknown;
}

export class TTLCacheStats {
  private name: string;
  private stats: StatsWithCache | null;
  private saveTimer: ReturnType<typeof setTimeout> | null;

  constructor(name: string) {
    this.name = name;
    this.stats = null;
    this.saveTimer = null;
  }

  async forceLoad(): Promise<void> {
    this.stats = (await getStats()) as StatsWithCache | null;
    if (this.stats && isNull(this.stats[this.name])) {
      this.stats[this.name] = {};
    }
  }

  async load(): Promise<void> {
    if (this.stats === null) {
      await this.forceLoad();
    }
  }

  async save(): Promise<void> {
    // 부하가 많이 일어나는 것을 막기 위해 1초에 한번만 저장
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(async () => {
      if (!this.stats) return;
      const clone = this.stats[this.name]; // 얇은 복사
      console.log('Saving stats...', clone);
      await this.forceLoad(); // 최신화
      if (this.stats) {
        this.stats[this.name] = clone; // 업데이트
        await saveStats(this.stats as StorageStats);
      }
      this.saveTimer = null;
    }, 1000);
  }

  async expired(): Promise<void> {
    await this.load();
    if (!this.stats) return;

    const cache = this.stats[this.name] as Record<string, CacheEntry | number>;
    if (!cache.last_check_date) {
      cache.last_check_date = Date.now();
      this.save();
      log('Initialized stats date', cache.last_check_date);
      return;
    }

    const dateYesterday = Date.now() - 86400000; // 1day
    log('금일 로컬스토리지 정리를 완료하였습니다.');
    if (dateYesterday < (cache.last_check_date as number)) return;

    // 1 주가 지난 문제 내용은 삭제
    const dateWeekAgo = Date.now() - 7 * 86400000;
    log('stats before deletion', this.stats);
    log('date a week ago', dateWeekAgo);

    for (const [key, value] of Object.entries(cache)) {
      if (key === 'last_check_date') continue;
      // 무한 방치를 막기 위해 저장일자가 null이면 삭제
      if (!value || typeof value !== 'object' || !(value as CacheEntry).save_date) {
        delete cache[key];
      } else {
        const saveDate = (value as CacheEntry).save_date as number;
        // 1주가 지난 코드는 삭제
        if (dateWeekAgo > saveDate) {
          delete cache[key];
        }
      }
    }
    cache.last_check_date = Date.now();
    log('stats after deletion', this.stats);
    await this.save();
  }

  async update(data: CacheData): Promise<void> {
    await this.expired();
    await this.load();
    if (!this.stats) return;

    const cache = this.stats[this.name] as Record<string, CacheEntry>;
    cache[String(data.id)] = {
      ...data,
      save_date: Date.now(),
    };
    log('date', cache[String(data.id)].save_date);
    log('stats', this.stats);
    await this.save();
  }

  async get(id: string | number): Promise<CacheEntry | null> {
    await this.load();
    if (!this.stats) return null;

    const cur = this.stats[this.name] as Record<string, CacheEntry>;
    if (isNull(cur)) return null;
    return cur[String(id)] || null;
  }
}

const problemCache = new TTLCacheStats('problem');
const submitCodeCache = new TTLCacheStats('scode');
const SolvedACCache = new TTLCacheStats('solvedac');

interface ProblemData {
  problemId: string | number;
  problem_description?: string;
  problem_input?: string;
  problem_output?: string;
}

export async function updateProblemData(problem: ProblemData): Promise<void> {
  const data: ProblemCacheData = {
    id: problem.problemId,
    problemDescription: problem.problem_description,
    problemInput: problem.problem_input,
    problemOutput: problem.problem_output,
  };
  await problemCache.update(data);
}

export async function getProblemData(problemId: string | number): Promise<ProblemCacheData | null> {
  return problemCache.get(problemId) as Promise<ProblemCacheData | null>;
}

export async function updateSubmitCodeData(obj: {
  submissionId: string | number;
  code: string;
}): Promise<void> {
  const data: SubmitCodeCacheData = {
    id: obj.submissionId,
    data: obj.code,
  };
  await submitCodeCache.update(data);
}

export async function getSubmitCodeData(submissionId: string | number): Promise<string | undefined> {
  const result = (await submitCodeCache.get(submissionId)) as SubmitCodeCacheData | null;
  return result?.data;
}

export async function updateSolvedACData(obj: {
  problemId: string | number;
  jsonData: SolvedACProblem;
}): Promise<void> {
  const data: SolvedACCacheData = {
    id: obj.problemId,
    data: obj.jsonData,
  };
  await SolvedACCache.update(data);
}

export async function getSolvedACData(
  problemId: string | number
): Promise<SolvedACProblem | undefined> {
  const result = (await SolvedACCache.get(problemId)) as SolvedACCacheData | null;
  return result?.data;
}
