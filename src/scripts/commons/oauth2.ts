import { saveObjectInLocalStorage } from './storage';
import urls from '@/constants/url';
import { STORAGE_KEYS } from '@/constants/registry';

const AUTHORIZATION_URL = urls.GITHUB_AUTHORIZATION_URL;
const CLIENT_ID = urls.GITHUB_CLIENT_ID;
const REDIRECT_URL = urls.GITHUB_REDIRECT_URL;
const SCOPES: string[] = ['repo'];

/**
 * GitHub OAuth2 인증 시작
 * 사용자를 GitHub 인증 페이지로 리다이렉트합니다.
 */
export default function beginOAuth2(): void {
  let url = `${AUTHORIZATION_URL}?client_id=${CLIENT_ID}&redirect_uri${REDIRECT_URL}&scope=`;

  for (let i = 0; i < SCOPES.length; i += 1) {
    url += SCOPES[i];
  }

  saveObjectInLocalStorage({ [STORAGE_KEYS.PIPE]: true }).then(() => {
    // opening pipe temporarily
    chrome.tabs.create({ url, selected: true }, () => {
      window.close();
      chrome.tabs.getCurrent(() => {
        // chrome.tabs.remove(tab.id, function () {});
      });
    });
  });
}
