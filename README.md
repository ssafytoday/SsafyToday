<h1 align="center">
  <img src="assets/thumbnail.png" alt="SsafyToday" width="400">
  <br>
  SsafyToday — 코딩 풀이를 ssafy.today에 자동 기록
  <br>
  <br>
</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"/></a>
  <a href="https://chromewebstore.google.com/detail/ssafytoday/jggahimpefpcecjhbhhhlalhbmpkbghm"><img src="https://img.shields.io/chrome-web-store/v/jggahimpefpcecjhbhhhlalhbmpkbghm.svg" alt="chrome-webstore"/></a>
</p>

## SsafyToday란?

SSAFY 교육생을 위한 Chrome 확장(MV3)입니다. 백준·프로그래머스·SW Expert Academy에서 문제를
맞히면 제출 기록을 **[ssafy.today](https://ssafy.today)** 로 자동 전송하고, 문제 페이지에서
AI 힌트를 제공합니다.

> **git 연동은 2026-08-06 제거됐습니다.** 이 확장은 [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub)
> 포크에서 출발했지만, GitHub 자동 푸시(OAuth·저장소 커밋·README 생성)와 GitHub/GitLab
> 사용자명 캡처는 모두 삭제됐습니다. 저장소 연결 설정이 필요 없습니다.

## 하는 일

| 기능 | 설명 |
|------|------|
| 제출 기록 전송 | 정답 처리된 제출을 `POST https://ssafy.today/api/submissions/` 로 전송 |
| 플랫폼 계정 동기화 | 백준 ID·프로그래머스 닉네임·SWEA 닉네임을 수집해 ssafy.today 계정에 연동 |
| AI 힌트 | 문제 페이지에서 힌트 UI 제공 (팝업/설정의 토글로 켜고 끔) |
| 재시도 큐 | 계정 연동 전 제출은 큐에 보관했다가 연동 직후 자동 재전송 |

## 수집 항목

| 플랫폼 | 문제 정보 | 제출 정보 |
|--------|-----------|-----------|
| 백준 | 제목 · 번호 · 링크 · 난이도 · 태그 · 문제/입력/출력 설명 | 코드 · 언어 · 메모리 · 실행 시간 · 제출 시각 |
| 프로그래머스 | 제목 · 번호 · 링크 · 난이도 · 구분 · 채점 결과 | 코드 · 언어 · 메모리 · 실행 시간 · 제출 시각 |
| SW Expert Academy | 제목 · 번호 · 링크 · 난이도 | 코드 · 언어 · 메모리 · 실행 시간 · 코드 길이 · 제출 시각 |

## 설치

크롬 웹스토어: **[SsafyToday](https://chromewebstore.google.com/detail/ssafytoday/jggahimpefpcecjhbhhhlalhbmpkbghm)**

설치 후 [ssafy.today](https://ssafy.today)에 로그인한 상태로 각 플랫폼에 한 번씩 방문하면
사용자명이 자동으로 수집·연동됩니다. 연동 전에 푼 문제도 연동 직후 재전송됩니다.

## 개발

```bash
npm install
npm run dev       # vite 개발 서버
npm run build     # tsc --noEmit + vite build → dist/
npm run package   # build + packages/SsafyToday-v{version}.zip
```

개발용 로드: `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램을 로드** → `dist/`
선택. 소스 수정 후 `npm run build` 하고 확장을 새로고침(⟳)하세요.

> `npm run lint`는 TypeScript 마이그레이션 이전 설정(`eslint.config.js`가 `**/*.js`만 대상)이라
> 동작하지 않습니다. 검증은 `npm run build`로 하세요.

자세한 내부 구조·배포 절차는 [`CLAUDE.md`](CLAUDE.md)를 참고하세요.

## 라이선스

MIT — [LICENSE](LICENSE) 참조. 원저작물 [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub)의
MIT 라이선스를 승계합니다.
