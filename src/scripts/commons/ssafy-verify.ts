/**
 * SSAFY Today 회원가입 페이지용 확장 확인 스크립트
 * 회원가입 페이지에서 확장 프로그램 설치 여부를 확인하고 응답
 * 로그인 상태에서 플랫폼 credential 자동 동기화
 */

// manifest.json에서 버전을 동적으로 로드
import { flushPendingSubmissions } from './pending-submissions';

const manifest = chrome.runtime.getManifest();
const EXTENSION_VERSION = manifest.version;

const EVENTS = {
  CHECK: 'SSAFY_TODAY_CHECK',
  RESPONSE: 'SSAFY_TODAY_RESPONSE',
  GET_CREDENTIALS: 'SSAFY_TODAY_GET_CREDENTIALS',
  CREDENTIALS: 'SSAFY_TODAY_CREDENTIALS',
  CAPTURE_MODE: 'SSAFY_TODAY_CAPTURE_MODE',
  // 등록된 플랫폼 계정명이 실제 플랫폼 화면의 값과 어긋났을 때 페이지에 알린다.
  // (프론트가 자체 UI를 붙일 수 있게 열어두는 채널 — 익스텐션도 자체 배너를 띄운다)
  LINK_MISMATCH: 'SSAFY_TODAY_LINK_MISMATCH',
  REPAIR_LINK: 'SSAFY_TODAY_REPAIR_LINK',
  REPAIR_RESULT: 'SSAFY_TODAY_REPAIR_RESULT',
};

/** sync-credentials 가 돌려주는 필드별 불일치 상세 */
interface MismatchDetail {
  stored: string;
  incoming: string;
}
type MismatchMap = Record<string, MismatchDetail>;

// 백엔드 model field → 사용자에게 보일 플랫폼 이름 / repair 요청용 짧은 키
const FIELD_LABEL: Record<string, string> = {
  baekjoon_username: '백준',
  programmers_username: '프로그래머스',
  swea_nickname: 'SWEA',
};
const FIELD_TO_SHORT_KEY: Record<string, string> = {
  baekjoon_username: 'baekjoon',
  programmers_username: 'programmers',
  swea_nickname: 'swea',
};

const SYNC_API_URL = 'https://ssafy.today/api/accounts/sync-credentials/';
// 로그인 여부만 필요하므로 통계 집계가 붙은 무거운 auth/me/ 대신 경량 auth/check/ 사용.
// auth/check/는 양쪽 상태 모두 유효한 JSON({authenticated, user})을 돌려준다
// (auth/me/의 비인증 응답은 0바이트 바디라 json() 파싱이 불가).
const AUTH_CHECK_URL = 'https://ssafy.today/api/accounts/auth/check/';
const CSRF_BOOTSTRAP_URL = 'https://ssafy.today/api/accounts/auth/csrf/';
const SYNC_SESSION_KEY = 'ssafy_credentials_synced';

// 저장된 플랫폼 사용자명 가져오기
async function getStoredCredentials() {
  try {
    const result = await chrome.storage.local.get([
      'platform_baekjoon_username',
      'platform_programmers_username',
      'platform_swea_nickname',
    ]);
    // 프론트엔드가 기대하는 형식으로 변환
    return {
      baekjoon_username: result.platform_baekjoon_username || '',
      programmers_username: result.platform_programmers_username || '',
      swea_nickname: result.platform_swea_nickname || '',
    };
  } catch {
    return {};
  }
}

// API 전송용 credential 포맷 (키 이름 변환)
async function getCredentialsForAPI() {
  const credentials = await getStoredCredentials();
  return {
    baekjoon: credentials.baekjoon_username,
    programmers: credentials.programmers_username,
    swea: credentials.swea_nickname,
  };
}

// 로그인 상태 확인 — 서버 세션을 직접 조회한다.
// (기존 DOM 셀렉터 휴리스틱은 Vue3 프론트 마크업과 맞지 않아 항상 미로그인으로 오판했음)
// auth/check/는 인증/비인증 모두 200 + {authenticated: bool} JSON을 반환한다.
async function isLoggedIn(): Promise<boolean> {
  try {
    const response = await fetch(AUTH_CHECK_URL, { credentials: 'include' });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.authenticated === true;
  } catch {
    return false;
  }
}

// csrftoken 쿠키 파싱 — HttpOnly가 아니므로(Django 호환 설계) content script에서 읽을 수 있다
function readCsrfCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// CSRF 토큰 확보 — 쿠키에 없으면 프론트와 동일한 부트스트랩 엔드포인트로 발급받는다
async function getCsrfToken(): Promise<string> {
  let token = readCsrfCookie();
  if (!token) {
    try {
      await fetch(CSRF_BOOTSTRAP_URL, { credentials: 'include' });
      token = readCsrfCookie();
    } catch {
      // 네트워크 오류 — 빈 토큰으로 진행하면 서버가 403으로 알려준다
    }
  }
  return token;
}

// 동기화할 credential이 있는지 확인
function hasCredentialsToSync(credentials: Record<string, string>): boolean {
  return Object.values(credentials).some(value => value && value.trim() !== '');
}

/**
 * 연동 불일치를 알리는 배너를 띄운다.
 *
 * 왜 필요한가: 등록된 플랫폼 계정명이 실제 플랫폼 화면의 값과 어긋나면
 * `POST /api/submissions/`가 매번 404 USER_NOT_FOUND로 떨어져 **푼 문제가 전혀
 * 기록되지 않는다**. 그런데 학생에게 보이는 신호는 플랫폼 페이지에서 잠깐 뜨는
 * 토스트뿐이라, 대부분 "익스텐션이 고장났다"고만 인지하고 끝난다. 여기서
 * 원인과 복구 버튼을 같이 보여준다.
 *
 * 자동으로 덮어쓰지 않는 이유: 공유 브라우저에서 남의 플랫폼 세션이 남긴 값이
 * 내 계정에 연동되는 오염을 막기 위해서다(2026-07-17 서버 정책). 그래서 덮어쓰기는
 * 반드시 사용자가 버튼을 눌렀을 때만(`repair`) 일어난다.
 */
function showMismatchBanner(mismatched: MismatchMap): void {
  const fields = Object.keys(mismatched).filter(f => f in FIELD_LABEL);
  if (fields.length === 0) return;

  const existing = document.getElementById('ssafy-today-link-mismatch');
  if (existing) existing.remove();

  const box = document.createElement('div');
  box.id = 'ssafy-today-link-mismatch';
  box.style.cssText = [
    'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483000',
    'max-width:360px', 'padding:14px 16px', 'border-radius:12px',
    'background:#1f2430', 'color:#f4f6fb', 'box-shadow:0 8px 28px rgba(0,0,0,.35)',
    'font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = '제출 기록이 저장되지 않고 있습니다';
  title.style.cssText = 'font-weight:700;font-size:14px;margin-bottom:6px;color:#ffb4a2';
  box.appendChild(title);

  const body = document.createElement('div');
  body.style.cssText = 'margin-bottom:10px';
  for (const field of fields) {
    const { stored, incoming } = mismatched[field];
    const line = document.createElement('div');
    line.textContent =
      `${FIELD_LABEL[field]}: 등록된 계정은 "${stored}" 인데 현재 로그인한 계정은 "${incoming}" 입니다.`;
    line.style.cssText = 'margin-bottom:4px;word-break:break-all';
    body.appendChild(line);
  }
  const hint = document.createElement('div');
  hint.textContent = '연동을 현재 계정으로 맞추면 그동안 밀린 제출도 함께 전송됩니다.';
  hint.style.cssText = 'opacity:.75;margin-top:6px';
  body.appendChild(hint);
  box.appendChild(body);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  const later = document.createElement('button');
  later.textContent = '나중에';
  later.style.cssText =
    'padding:6px 12px;border-radius:8px;border:1px solid #4a5164;background:transparent;color:#cfd5e3;cursor:pointer';
  later.addEventListener('click', () => box.remove());

  const fix = document.createElement('button');
  fix.textContent = '연동 고치기';
  fix.style.cssText =
    'padding:6px 12px;border-radius:8px;border:0;background:#4c8dff;color:#fff;font-weight:600;cursor:pointer';
  fix.addEventListener('click', async () => {
    fix.disabled = true;
    fix.textContent = '고치는 중...';
    const result = await repairCredentials(fields);
    if (result.ok) {
      box.textContent = '';
      const done = document.createElement('div');
      done.textContent = '연동을 맞췄습니다. 밀린 제출을 전송했습니다 — 새로고침하면 반영됩니다.';
      done.style.cssText = 'font-weight:600;color:#9ae6b4';
      box.appendChild(done);
      setTimeout(() => box.remove(), 8000);
    } else {
      fix.disabled = false;
      fix.textContent = '다시 시도';
      const err = document.createElement('div');
      err.textContent = result.message;
      err.style.cssText = 'margin-top:8px;color:#ffb4a2';
      box.appendChild(err);
    }
  });

  actions.appendChild(later);
  actions.appendChild(fix);
  box.appendChild(actions);
  document.body.appendChild(box);
}

/**
 * 어긋난 연동을 현재 플랫폼 계정으로 덮어쓴다 (사용자 명시 행위 전용).
 * 성공하면 그동안 USER_NOT_FOUND로 큐에 쌓여 있던 제출을 즉시 재전송한다.
 */
async function repairCredentials(fields: string[]): Promise<{ ok: boolean; message: string }> {
  try {
    const credentials = await getCredentialsForAPI();
    const repair = fields.map(f => FIELD_TO_SHORT_KEY[f]).filter(Boolean);
    if (repair.length === 0) return { ok: false, message: '복구할 플랫폼이 없습니다.' };

    const csrfToken = await getCsrfToken();
    const response = await fetch(SYNC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      credentials: 'include',
      body: JSON.stringify({ ...credentials, repair }),
    });
    if (!response.ok) {
      return { ok: false, message: `서버 오류(${response.status})로 실패했습니다.` };
    }
    const result = await response.json();
    if (!Array.isArray(result?.repaired) || result.repaired.length === 0) {
      // 타 계정이 이미 그 값을 연동한 경우 서버가 conflicts로 거절한다 —
      // 익스텐션이 임의로 뺏을 수 없으므로 사람이 개입해야 한다.
      const conflicts: string[] = Array.isArray(result?.conflicts) ? result.conflicts : [];
      const message = conflicts.length
        ? `이미 다른 계정이 연동한 값입니다(${conflicts
            .map(f => FIELD_LABEL[f] || f)
            .join(', ')}). 관리자에게 문의해주세요.`
        : '서버가 연동을 갱신하지 않았습니다.';
      window.postMessage({ type: EVENTS.REPAIR_RESULT, ok: false, result }, '*');
      return { ok: false, message };
    }

    console.log('[SsafyToday] Platform link repaired:', result.repaired);
    // 연동이 막 맞춰진 시점 — 30분 재시도 간격을 건너뛰고 큐를 즉시 비운다
    await flushPendingSubmissions({ force: true });
    window.postMessage({ type: EVENTS.REPAIR_RESULT, ok: true, result }, '*');
    return { ok: true, message: '연동을 맞췄습니다.' };
  } catch (error) {
    console.error('[SsafyToday] Error repairing credentials:', error);
    return { ok: false, message: '네트워크 오류로 실패했습니다.' };
  }
}

// 플랫폼 credential을 서버에 동기화
async function syncCredentialsToServer(): Promise<void> {
  // 세션당 1회만 실행
  if (sessionStorage.getItem(SYNC_SESSION_KEY)) {
    console.log('[SsafyToday] Credentials already synced this session');
    return;
  }

  const credentials = await getCredentialsForAPI();

  // 동기화할 credential이 없으면 스킵
  if (!hasCredentialsToSync(credentials)) {
    console.log('[SsafyToday] No credentials to sync');
    sessionStorage.setItem(SYNC_SESSION_KEY, 'no_credentials');
    return;
  }

  try {
    console.log('[SsafyToday] Syncing credentials to server...');

    // 백엔드는 세션 인증된 POST에 CSRF 헤더를 요구한다 (없으면 403 "CSRF Failed")
    const csrfToken = await getCsrfToken();

    const response = await fetch(SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',  // 세션 쿠키 포함
      body: JSON.stringify(credentials)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[SsafyToday] Credentials synced successfully:', result);
      sessionStorage.setItem(SYNC_SESSION_KEY, 'success');
      // 계정이 막 연동된 시점 — 연동 전 실패로 큐에 쌓인 제출들을 재전송.
      // force: 방금 실패한(30분 미경과) 항목도 이 순간에는 성공할 수 있으므로
      // 재시도 간격 가드를 건너뛴다
      void flushPendingSubmissions({ force: true });

      // 등록값과 실제 플랫폼 계정이 어긋나면 제출이 영구히 기록되지 않는다.
      // 서버는 보고만 하고 고치지 않으므로(공유 브라우저 오염 방지) 여기서
      // 사용자에게 원인과 복구 버튼을 보여준다.
      const mismatched: MismatchMap = result?.mismatched || {};
      const actionable = Object.keys(mismatched).filter(f => f in FIELD_LABEL);
      if (actionable.length > 0) {
        console.warn('[SsafyToday] Platform link mismatch detected:', mismatched);
        window.postMessage({ type: EVENTS.LINK_MISMATCH, mismatched }, '*');
        showMismatchBanner(mismatched);
      }
    } else if (response.status === 401 || response.status === 403) {
      // 인증 실패 - 로그인되지 않은 상태
      console.log('[SsafyToday] Not authenticated, skipping sync');
      sessionStorage.setItem(SYNC_SESSION_KEY, 'not_authenticated');
    } else {
      console.warn('[SsafyToday] Sync failed with status:', response.status);
      // 실패해도 세션 동안 재시도하지 않음
      sessionStorage.setItem(SYNC_SESSION_KEY, 'failed');
    }
  } catch (error) {
    console.error('[SsafyToday] Error syncing credentials:', error);
    // 네트워크 오류 시에도 세션 동안 재시도하지 않음
    sessionStorage.setItem(SYNC_SESSION_KEY, 'error');
  }
}

// 페이지 로드 완료 후 자동 동기화 실행
function initAutoSync(): void {
  // DOM이 로드된 후 로그인 상태 확인 및 동기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkAndSync, 500);  // DOM 렌더링 대기
    });
  } else {
    setTimeout(checkAndSync, 500);
  }
}

async function checkAndSync(): Promise<void> {
  if (await isLoggedIn()) {
    console.log('[SsafyToday] User is logged in, attempting credential sync');
    syncCredentialsToServer();
  } else {
    // 미로그인은 sessionStorage에 마킹하지 않는다 — 같은 탭에서 나중에
    // 로그인하면 다음 페이지 로드에서 자연히 재시도된다.
    console.log('[SsafyToday] User is not logged in, skipping sync');
  }
}

// 메시지 핸들러
window.addEventListener('message', async (event) => {
  // 같은 윈도우에서 온 메시지만 처리
  if (event.source !== window) return;

  const { type } = event.data || {};

  // 확장 프로그램 확인 요청
  if (type === EVENTS.CHECK) {
    window.postMessage({
      type: EVENTS.RESPONSE,
      verified: true,
      version: EXTENSION_VERSION
    }, '*');
  }

  // 플랫폼 사용자명 요청
  if (type === EVENTS.GET_CREDENTIALS) {
    const credentials = await getStoredCredentials();
    window.postMessage({
      type: EVENTS.CREDENTIALS,
      ...credentials
    }, '*');
  }

  // 연동 복구 요청 — 프론트엔드가 자체 UI로 버튼을 달았을 때의 진입점.
  // 익스텐션 배너와 같은 경로를 타므로 동작이 갈라지지 않는다.
  if (type === EVENTS.REPAIR_LINK) {
    const fields: string[] = Array.isArray(event.data?.fields)
      ? event.data.fields
      : Object.keys(FIELD_LABEL);
    const result = await repairCredentials(fields);
    window.postMessage({ type: EVENTS.REPAIR_RESULT, ...result }, '*');
  }

  // 캡처 모드 요청 — 프론트엔드(useExtensionComm)가 여전히 보내지만 no-op이다.
  // 백준·프로그래머스·SWEA content script는 방문 즉시 무조건 사용자명을 저장하므로
  // 별도 플래그가 필요 없고, 이 플래그를 읽던 github/gitlab 스크립트는 제거됐다.
  if (type === EVENTS.CAPTURE_MODE) {
    console.log('[SsafyToday] CAPTURE_MODE is a no-op; usernames are captured on visit');
  }
});

// 자동 동기화 초기화
initAutoSync();

console.log('[SsafyToday] Extension verification script loaded');
