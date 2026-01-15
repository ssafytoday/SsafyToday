/**
 * SSAFY Today 회원가입 페이지용 확장 확인 스크립트
 * 회원가입 페이지에서 확장 프로그램 설치 여부를 확인하고 응답
 */

const EXTENSION_VERSION = '3.3.0';

const EVENTS = {
  CHECK: 'SSAFY_TODAY_CHECK',
  RESPONSE: 'SSAFY_TODAY_RESPONSE',
  GET_CREDENTIALS: 'SSAFY_TODAY_GET_CREDENTIALS',
  CREDENTIALS: 'SSAFY_TODAY_CREDENTIALS',
  CAPTURE_MODE: 'SSAFY_TODAY_CAPTURE_MODE',
};

// 저장된 플랫폼 사용자명 가져오기
async function getStoredCredentials() {
  try {
    const result = await chrome.storage.local.get([
      'platform_baekjoon_username',
      'platform_programmers_username',
      'platform_swea_nickname',
      'baekjoonhub_username'  // GitHub username (기존 키)
    ]);
    // 프론트엔드가 기대하는 형식으로 변환
    return {
      baekjoon_username: result.platform_baekjoon_username || '',
      programmers_username: result.platform_programmers_username || '',
      swea_nickname: result.platform_swea_nickname || '',
      github_username: result.baekjoonhub_username || '',
    };
  } catch {
    return {};
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

console.log('[SsafyToday] Extension verification script loaded');
