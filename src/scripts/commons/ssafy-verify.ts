/**
 * SSAFY Today 회원가입 페이지용 확장 확인 스크립트
 * 회원가입 페이지에서 확장 프로그램 설치 여부를 확인하고 응답
 * 로그인 상태에서 플랫폼 credential 자동 동기화
 */

// manifest.json에서 버전을 동적으로 로드
const manifest = chrome.runtime.getManifest();
const EXTENSION_VERSION = manifest.version;

const EVENTS = {
  CHECK: 'SSAFY_TODAY_CHECK',
  RESPONSE: 'SSAFY_TODAY_RESPONSE',
  GET_CREDENTIALS: 'SSAFY_TODAY_GET_CREDENTIALS',
  CREDENTIALS: 'SSAFY_TODAY_CREDENTIALS',
  CAPTURE_MODE: 'SSAFY_TODAY_CAPTURE_MODE',
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
      'platform_gitlab_username',
      'platform_github_username',
      'baekjoonhub_username'  // GitHub username (기존 키, fallback)
    ]);
    // 프론트엔드가 기대하는 형식으로 변환
    return {
      baekjoon_username: result.platform_baekjoon_username || '',
      programmers_username: result.platform_programmers_username || '',
      swea_nickname: result.platform_swea_nickname || '',
      gitlab_username: result.platform_gitlab_username || '',
      github_username: result.platform_github_username || result.baekjoonhub_username || '',
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
    gitlab: credentials.gitlab_username,
    github: credentials.github_username,
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

  // 캡처 모드 활성화 (플랫폼 방문 시 사용자명 수집)
  if (type === EVENTS.CAPTURE_MODE) {
    const { platform } = event.data;
    // 캡처 모드 설정 저장
    await chrome.storage.local.set({ capture_mode: platform });
  }
});

// 자동 동기화 초기화
initAutoSync();

console.log('[SsafyToday] Extension verification script loaded');
