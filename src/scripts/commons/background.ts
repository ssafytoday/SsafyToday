import urls from '@/constants/url';
import { STORAGE_KEYS } from '@/constants/registry';
import type {
  ExtensionMessage,
  SolvedApiCallMessage,
  OAuthResultMessage,
  SolvedACProblem,
} from '@types';

/**
 * Solved.ac API를 통해 문제 데이터를 가져옵니다.
 * @param problemId - 백준 문제 번호
 * @returns Promise<SolvedACProblem>
 */
export async function SolvedApiCall(problemId: number): Promise<SolvedACProblem> {
  const response = await fetch(`${urls.SOLVED_AC_API_PROBLEM_SHOW_URL}${problemId}`, {
    method: 'GET',
  });
  return response.json();
}

/**
 * Extension 메시지 핸들러
 * OAuth 인증 결과와 Solved.ac API 호출을 처리합니다.
 *
 * @param request - 메시지 요청
 * @param _sender - 메시지 발신자
 * @param sendResponse - 응답 콜백
 * @returns true (비동기 응답을 위해)
 */
export function handleMessage(
  request: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: SolvedACProblem) => void
): boolean {
  // OAuth 성공 메시지 처리
  if (isOAuthSuccessMessage(request)) {
    /* Set username */
    chrome.storage.local.set({ [STORAGE_KEYS.USERNAME]: request.username }, () => {
      /* Set token */
      chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: request.token }, () => {
        /* Close pipe */
        chrome.storage.local.set({ [STORAGE_KEYS.PIPE]: false }, () => {
          console.log('Closed pipe.');

          /* Go to onboarding for UX */
          const urlOnboarding = `chrome-extension://${chrome.runtime.id}/settings.html`;
          chrome.tabs.create({ url: urlOnboarding, selected: true });
        });
      });
    });
  }
  // OAuth 실패 메시지 처리
  else if (isOAuthFailureMessage(request)) {
    console.error('Something went wrong while trying to authenticate your profile!');
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      }
    });
  }
  // Solved.ac API 호출 처리
  else if (isSolvedApiCallMessage(request)) {
    SolvedApiCall(parseInt(request.problemId, 10)).then((res) => sendResponse(res));
  }

  return true;
}

/**
 * OAuth 성공 메시지 타입 가드
 */
function isOAuthSuccessMessage(
  message: ExtensionMessage
): message is OAuthResultMessage & { isSuccess: true; token: string; username: string } {
  return (
    'closeWebPage' in message &&
    message.closeWebPage === true &&
    'isSuccess' in message &&
    message.isSuccess === true &&
    'token' in message &&
    'username' in message
  );
}

/**
 * OAuth 실패 메시지 타입 가드
 */
function isOAuthFailureMessage(
  message: ExtensionMessage
): message is OAuthResultMessage & { isSuccess: false } {
  return (
    'closeWebPage' in message &&
    message.closeWebPage === true &&
    'isSuccess' in message &&
    message.isSuccess === false
  );
}

/**
 * Solved.ac API 호출 메시지 타입 가드
 */
function isSolvedApiCallMessage(message: ExtensionMessage): message is SolvedApiCallMessage {
  return (
    'sender' in message &&
    message.sender === 'baekjoon' &&
    'task' in message &&
    message.task === 'SolvedApiCall'
  );
}

// 메시지 리스너 등록
chrome.runtime.onMessage.addListener(handleMessage);
