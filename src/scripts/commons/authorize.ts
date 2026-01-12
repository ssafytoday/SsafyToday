import urls from '@/constants/url';
import { STORAGE_KEYS } from '@/constants/registry';
import type { OAuthResultMessage } from '@types';

/*
    (needs patch)
    IMPLEMENTATION OF AUTHENTICATION ROUTE AFTER REDIRECT FROM GITHUB.
*/

const KEY = STORAGE_KEYS.TOKEN;
const ACCESS_TOKEN_URL = urls.GITHUB_ACCESS_TOKEN_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const CLIENT_SECRET = urls.GITHUB_CLIENT_SECRET;

interface GitHubUserResponse {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
  email?: string;
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

/**
 * OAuth 인증 완료 처리
 * 토큰으로 사용자 정보를 가져와서 Background로 전송
 *
 * @param token - OAuth2 access token
 */
async function finish(token: string): Promise<void> {
  const AUTHENTICATION_URL = urls.GITHUB_API_USER_URL;
  try {
    const response = await fetch(AUTHENTICATION_URL, {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
      },
    });
    if (response.ok) {
      const { login: username }: GitHubUserResponse = await response.json();
      const message: OAuthResultMessage = {
        closeWebPage: true,
        isSuccess: true,
        token,
        username,
        KEY,
      };
      chrome.runtime.sendMessage(message);
    } else {
      console.error('Failed to fetch user data:', response.status, response.statusText);
      const message: OAuthResultMessage = {
        closeWebPage: true,
        isSuccess: false,
      };
      chrome.runtime.sendMessage(message);
    }
  } catch (error) {
    console.error('Error during authentication:', error);
    const message: OAuthResultMessage = {
      closeWebPage: true,
      isSuccess: false,
    };
    chrome.runtime.sendMessage(message);
  }
}

/**
 * GitHub에 access token 요청
 *
 * @param code - OAuth authorization code
 */
async function requestToken(code: string): Promise<void> {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('code', code);

  try {
    const response = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      body: params,
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data: GitHubTokenResponse = await response.json();
      finish(data.access_token);
    } else {
      console.error('Failed to request token:', response.status, response.statusText);
      const message: OAuthResultMessage = {
        closeWebPage: true,
        isSuccess: false,
      };
      chrome.runtime.sendMessage(message);
    }
  } catch (error) {
    console.error('Error during token request:', error);
    const message: OAuthResultMessage = {
      closeWebPage: true,
      isSuccess: false,
    };
    chrome.runtime.sendMessage(message);
  }
}

/**
 * URL에서 authorization code 파싱
 *
 * @param url - 현재 페이지 URL
 */
export default function parseAccessCode(url: string): void {
  if (url.match(/\?error=(.+)/)) {
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) {
        chrome.tabs.remove(tab.id, () => {});
      }
    });
  } else {
    const accessCode = url.match(/\?code=([\w/-]+)/);
    if (accessCode) {
      requestToken(accessCode[1]);
    }
  }
}

// 현재 URL 확인
const link = window.location.href;

/* Check for open pipe */
if (window.location.host === 'github.com') {
  chrome.storage.local.get(STORAGE_KEYS.PIPE, (data) => {
    if (data && data[STORAGE_KEYS.PIPE]) {
      parseAccessCode(link);
    }
  });
}
