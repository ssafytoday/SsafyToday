/**
 * ssafy.today 전송 실패 제출의 재시도 큐
 *
 * 문제: 가입(플랫폼 계정 연동) 전에 문제를 풀면 POST /api/submissions/가
 * 404 USER_NOT_FOUND로 실패해 그 풀이가 영구 미기록으로 남는다.
 *
 * 해결: 실패한 SubmissionData를 chrome.storage.local에 보관했다가
 * (1) 플랫폼 페이지 로드(PlatformHubBase 생성자), (2) ssafy.today에서
 * sync-credentials 성공 직후 — 즉 계정이 막 연동된 시점(force) — 재전송한다.
 * 원본 submissionTime을 보존하므로 백엔드 created_at 백데이트·중복 감지가
 * 정상 동작한다 (중복이면 200 duplicate → 큐에서 제거).
 *
 * 설계 원칙:
 * - 신원은 제출 시점에 고정한다. flush 시점의 저장 사용자명·계정으로 빈
 *   platformUsername/ssafyUsername을 보충하지 않는다 — 공유 PC·계정 전환에서
 *   남의 계정으로 코드가 귀속된다. 신원 없는 페이로드는 큐에 넣지 않는다.
 * - USER_NOT_FOUND(미가입/미연동)는 큐의 존재 이유이므로 시도 횟수를 소모하지
 *   않는다. 30일 수명(MAX_AGE_MS)만 적용된다.
 * - 저장소 쓰기는 항상 병합(mergeWriteQueue) — flush가 네트워크 전송 중인 동안
 *   다른 탭이 enqueue한 항목을 스냅샷 덮어쓰기로 삼키지 않는다.
 * - 전송 전에 lastAttemptAt을 먼저 기록(claim)해 다른 탭의 동시 flush가 같은
 *   항목을 중복 POST하지 않게 한다.
 */
import { SsafyAPIService, type SubmissionData } from "./ssafy-api";
import log from "@/commons/logger";

const STORAGE_KEY = "ssafy_pending_submissions";
const MAX_ENTRIES = 50;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30일 지나면 폐기
// USER_NOT_FOUND 외의 실패(네트워크 등)가 이 횟수에 도달하면 폐기
const MAX_ATTEMPTS = 20;
const RETRY_INTERVAL_MS = 30 * 60 * 1000; // 항목당 최소 재시도 간격

interface PendingEntry {
  data: SubmissionData;
  enqueuedAt: number;
  lastAttemptAt: number; // 0 = 큐 등록 후 아직 재시도 안 됨 (즉시 재시도 허용)
  attempts: number;
}

// 페이지 로드당 1회만 flush (여러 훅에서 불려도 중복 실행 방지)
let flushedThisPageLoad = false;
// 실행 중 재진입 방지 — force가 페이지 로드 가드를 넘을 수 있게 되면서 필요해졌다
let flushInProgress = false;

async function readQueue(): Promise<PendingEntry[]> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const queue = result[STORAGE_KEY];
    return Array.isArray(queue) ? (queue as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingEntry[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: queue });
}

function entryKey(data: SubmissionData): string {
  return `${data.platform}|${data.problemData.problemId}|${data.problemData.language}`;
}

function entryId(entry: PendingEntry): string {
  return `${entryKey(entry.data)}|${entry.enqueuedAt}`;
}

/**
 * 저장소의 현재 큐와 병합해서 쓴다. snapshot에 없던 항목(= 읽은 뒤 다른
 * 탭/컨텍스트가 enqueue한 것)은 보존하고, 같은 key가 겹치면 신규 쪽을 우선한다.
 * (완전한 락은 아니지만 경합 창을 수 초~수십 초에서 ms 단위로 줄인다)
 */
async function mergeWriteQueue(snapshot: PendingEntry[], desired: PendingEntry[]): Promise<void> {
  const snapshotIds = new Set(snapshot.map(entryId));
  const current = await readQueue();
  const newcomers = current.filter((e) => !snapshotIds.has(entryId(e)));
  const byKey = new Map<string, PendingEntry>();
  for (const e of [...desired, ...newcomers]) {
    byKey.set(entryKey(e.data), e); // 뒤에 오는 newcomers(더 최신 enqueue)가 우선
  }
  let merged = [...byKey.values()];
  if (merged.length > MAX_ENTRIES) {
    merged = merged.slice(merged.length - MAX_ENTRIES);
  }
  await writeQueue(merged);
}

/**
 * 전송 실패한 제출을 큐에 저장 (같은 플랫폼·문제·언어는 최신 것으로 대체)
 */
export async function enqueuePendingSubmission(data: SubmissionData): Promise<void> {
  try {
    // 신원(플랫폼 사용자명 또는 ssafy.today 계정)이 전혀 없는 페이로드는 어떤
    // 재시도로도 성공할 수 없고, flush 시점 보충은 오귀속을 만들므로 하지 않는다 — 버린다.
    if (!data.platformUsername && !data.username && !data.ssafyUsername && !data.ssafyEmail) {
      log.debug("Skipping pending enqueue: no identity in payload");
      return;
    }
    const now = Date.now();
    const key = entryKey(data);
    const snapshot = await readQueue();
    const desired = snapshot.filter((e) => entryKey(e.data) !== key);
    // lastAttemptAt=0: 방금의 원 전송 실패가 1차 시도 — 다음 flush에서 즉시 재시도
    desired.push({ data, enqueuedAt: now, lastAttemptAt: 0, attempts: 1 });
    await mergeWriteQueue(snapshot, desired);
    log.info(`Pending submission queued (${key})`);
  } catch (e) {
    log.warn("Failed to enqueue pending submission:", e);
  }
}

/**
 * 전송이 확정된 제출을 큐에서 지운다 (선기록(write-ahead)의 짝).
 */
export async function removePendingSubmission(data: SubmissionData): Promise<void> {
  try {
    const key = entryKey(data);
    const snapshot = await readQueue();
    if (!snapshot.some((e) => entryKey(e.data) === key)) return;
    await mergeWriteQueue(
      snapshot,
      snapshot.filter((e) => entryKey(e.data) !== key)
    );
  } catch (e) {
    // 지우기 실패는 무해하다 — 다음 flush 에서 재전송되고 백엔드가 중복으로 흡수한다.
    log.debug("Failed to remove pending submission:", e);
  }
}

/**
 * 큐의 제출들을 재전송. 성공(중복 포함)·INVALID_REQUEST(영구 실패)는 제거,
 * USER_NOT_FOUND(아직 미연동)는 시도 횟수 소모 없이 보존, 그 외 실패는 카운트.
 * @param options.force 재시도 간격(30분)과 **페이지 로드당 1회 가드**를 모두 무시하고
 *   전부 시도 — 계정 연동/복구가 방금 성립한 순간용.
 *
 *   force가 페이지 로드 가드까지 넘는 이유: ssafy.today 진입 시 자동 sync가 이미
 *   한 번 flush를 태우므로, 그 뒤 사용자가 연동을 고쳐도 가드에 막혀 재전송이
 *   조용히 no-op이 됐다(2026-08-11 실측). 연동이 바뀐 직후가 재전송이 성공하는
 *   유일한 순간이라 여기서 막히면 밀린 제출이 30분 뒤 다른 페이지 로드까지 방치된다.
 */
export async function flushPendingSubmissions(options: { force?: boolean } = {}): Promise<void> {
  if (flushedThisPageLoad && !options.force) return;
  if (flushInProgress) return;
  flushedThisPageLoad = true;
  flushInProgress = true;

  try {
    const now = Date.now();
    const snapshot = await readQueue();
    if (snapshot.length === 0) return;

    const kept: PendingEntry[] = [];
    const toSend: PendingEntry[] = [];
    for (const entry of snapshot) {
      if (now - entry.enqueuedAt > MAX_AGE_MS || entry.attempts >= MAX_ATTEMPTS) {
        log.warn(`Dropping stale pending submission (${entryKey(entry.data)})`);
        continue;
      }
      if (!options.force && now - entry.lastAttemptAt < RETRY_INTERVAL_MS) {
        kept.push(entry);
        continue;
      }
      toSend.push({ ...entry, lastAttemptAt: now });
    }

    if (toSend.length === 0) {
      if (kept.length !== snapshot.length) {
        await mergeWriteQueue(snapshot, kept);
      }
      return;
    }

    // 전송 전에 lastAttemptAt부터 기록(claim) — 다른 탭의 동시 flush가
    // 재시도 간격 가드에 걸려 같은 항목을 중복 POST하지 않게 한다
    await mergeWriteQueue(snapshot, [...kept, ...toSend]);

    const survivors: PendingEntry[] = [];
    for (const entry of toSend) {
      const result = await SsafyAPIService.sendSubmission(entry.data);

      if (result.success) {
        log.info(`Pending submission delivered (${entryKey(entry.data)})`);
        continue; // 큐에서 제거
      }
      if (result.errorCode === "INVALID_REQUEST") {
        // 페이로드 자체가 거부됨 — 재시도해도 영원히 실패하므로 폐기
        log.warn(`Dropping invalid pending submission (${entryKey(entry.data)}):`, result.error);
        continue;
      }
      // USER_NOT_FOUND는 '아직 가입/연동 전'이라는 정상 대기 상태 — 시도 횟수를
      // 소모하지 않는다 (30일 수명만 적용). 그 외(네트워크 등)만 카운트.
      const attempts = result.errorCode === "USER_NOT_FOUND" ? entry.attempts : entry.attempts + 1;
      survivors.push({ ...entry, attempts });
    }

    await mergeWriteQueue(snapshot, [...kept, ...survivors]);
    log.info(`Pending submission flush done, ${kept.length + survivors.length} left in queue`);
  } catch (e) {
    log.warn("Failed to flush pending submissions:", e);
  } finally {
    flushInProgress = false;
  }
}
