# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 정체 (SsafyToday 크롬 익스텐션)

BaekjoonHub 포크를 리브랜딩한 **Chrome MV3 확장** (`name: SsafyToday`). 유일한 목적은
**SSAFY 백엔드(`ssafy.today`) 연동 — 제출 기록 전송 · 플랫폼 계정 동기화 · AI 힌트**다.

- **git 연동은 2026-08-06 전면 제거됐다.** 포크 원본의 GitHub 자동 푸시(OAuth·GitHub API·
  저장소 커밋·README/디렉토리/커밋 메시지 템플릿·SHA 기반 중복 제출 방지)와 GitHub/GitLab
  사용자명 캡처가 모두 삭제됐다. 삭제 전 상태가 필요하면 `git show <이 변경 직전 커밋>`.
  → 그 결과 `sync-credentials` 페이로드는 **`baekjoon`·`programmers`·`swea` 3키뿐**이고,
  `User.github_username`/`gitlab_username`은 익스텐션이 더 이상 채우지 않는다
  (백엔드는 키가 없으면 기존 값을 건드리지 않으므로 기존 사용자 데이터는 보존).

- **별도 git 리포**다: 리모트 `github.com/ssafytoday/SsafyToday`. `C:\srv` 모노리포
  (`getCurrentThread/ssafy-srv`)는 이 폴더를 **의도적으로 추적하지 않는다**(untracked).
  이 리포 변경은 여기서 따로 커밋·푸시한다 — 모노리포 커밋에 섞지 않는다.
- **버전**: `package.json`·`src/manifest.json` 모두 `3.x` (현재 3.5.x). 단 git 태그는
  `v1.2.8`에서 끊겨 있고 **`v3.x` 태그가 없다** — 3.x 릴리스는 태그 트리거 Action을
  거치지 않고 배포됐다는 뜻(아래 배포 절 참조).
- **`README.md`는 갱신 안 된 옛 BaekjoonHub 문서**다(GitHub 동기화만 설명, ssafy.today
  연동·AI 힌트 언급 없음, 스토어 링크도 원조 BaekjoonHub 것). **신뢰하지 말 것.**
  실제 연동 계약은 `ssafy-advisor/docs/contract/`가 소스 오브 트루스.

## 백엔드 연동 지점

`ssafy.today`(nginx :8000 → FastAPI :9000)로 나가는 요청. URL은 소스에 하드코딩
(`src/scripts/commons/`, dev/prod 스위치 없음). 상세 계약은 아래 문서 참조.

| 요청 | 인증 | 소스 | 백엔드 계약 |
|------|------|------|------------|
| `POST /api/submissions/` | **비인증** — body의 `platformUsername`을 `User.*_username`과 exact 매칭 (`username`은 항상 빈 문자열, `metadata`는 `extensionVersion`+`timestamp`뿐) | `ssafy-api.ts`, `upload-service.ts` | `docs/contract/apis-extension.md` |
| `POST /api/accounts/sync-credentials/` | **세션 쿠키 + CSRF** — `X-CSRFToken` 헤더 필수(csrftoken 쿠키 값), 로그인 감지는 `GET /api/accounts/auth/check/`. 페이로드는 `baekjoon`·`programmers`·`swea` 3키 | `ssafy-verify.ts` | `docs/contract/auth-session.md §2.3` |
| `POST /ssafytoday/v1/chat/completions` (SSE) | 비인증 | `hint-websocket.ts`(이름과 달리 HTTP SSE) | `docs/contract/realtime.md §3` |

- 인증 정합 주의: `sync-credentials`는 세션 인증된 POST라 **CSRF 헤더가 없으면 항상 403**.
  익스텐션은 csrftoken 쿠키를 읽어(없으면 `GET /api/accounts/auth/csrf/`로 부트스트랩)
  `X-CSRFToken`으로 보낸다. 로그인 여부는 통계가 붙은 무거운 `auth/me/` 대신 경량
  `auth/check/`(`{authenticated: bool}`)로 확인한다. 프론트(`ssafy-frontend`)와 동일 패턴.
- **AI 힌트 백엔드**: 2026-07-12 **llama.cpp(:8083, `llama-server` 서비스가 Disabled)에서
  백엔드 FastAPI의 gemini-webapi 체인으로 전환**됨. nginx `/ssafytoday/` 블록이 `local_llm`
  대신 `django_app`(:9000)으로 프록시하고 `app/api/routes/extension_hint.py`가 OpenAI
  chat.completions 형태를 재현한다. **익스텐션은 무수정** — 요청/응답 형태 동일.
- 제출 사슬: 학생이 플랫폼에서 문제를 풀면 content script가 사용자명·제출을 캡처 →
  `sync-credentials`로 `User`에 플랫폼 계정 연동 → 이후 제출이 `platformUsername` 매칭으로
  기록된다. 연동이 안 돼 있으면 `POST /api/submissions/`가 404 USER_NOT_FOUND
  (이 경우 `pending-submissions.ts` 큐에 쌓였다가 연동 직후 재전송된다).
- **중복 제출 방지 없음**: git 제거와 함께 SHA 캐시 기반 중복 가드도 삭제됐다(사용자 결정).
  정답 페이지를 새로고침하거나 여러 탭에서 열면 같은 제출이 반복 POST될 수 있다.

## 빌드 · 배포

```bash
npm run dev       # 개발 (vite)
npm run build     # tsc --noEmit + vite build → dist/ (@crxjs가 manifest 기반 번들)
npm run package   # build + build.mjs → packages/SsafyToday-v{version}.zip
```

- 배포처: **크롬 웹스토어**
  `https://chromewebstore.google.com/detail/ssafytoday/jggahimpefpcecjhbhhhlalhbmpkbghm`
- **개발용 로드**: `chrome://extensions`에서 압축해제 로드(`dist/`). 소스 수정 후
  `npm run build` → 확장 **새로고침(⟳)**. manifest에 `key`/`update_url` 없음.

### GitHub Actions (`.github/workflows/`)

| 워크플로 | 트리거 | 동작 |
|----------|--------|------|
| `pull-request.yml` | PR | `npm run build` 빌드 체크만 |
| `release.yml` | **`v*` 태그 푸시** | `npm run package` → GitHub Release 생성 + zip 첨부 → **크롬 웹스토어 업로드**(시크릿 설정 시) |

- zip 파일명은 **태그가 아니라 `package.json` version**에서 나온다(`build.mjs:25-26`).
  → 태그 전에 `package.json` + `src/manifest.json` 버전을 **함께** 올려야 하고 태그와 일치시킨다.
- 웹스토어 업로드 스텝은 **시크릿 3개가 모두 설정된 경우에만** 실행된다(`release.yml`의 gate).
  미설정 시 조용히 건너뛰고 GitHub Release는 정상 생성 → 기존 수동 배포 흐름과 호환.

### 배포 절차 (이 수정을 사용자에게 반영)

1. `package.json` + `src/manifest.json` 버전 범프 (예: 3.5.3 → 3.5.4, 둘 다).
2. 커밋 후 `v3.5.4` 태그 푸시 → `release.yml`이 zip 빌드 + GitHub Release + 웹스토어 업로드.
   (로컬 확인은 `npm run package` → `packages/SsafyToday-v3.5.4.zip`.)
3. 검수(수 시간~수일) → 사용자 자동 업데이트. 같은 버전 재업로드는 스토어가 거부하므로 1 필수.

### 크롬 웹스토어 자동 업로드 (`release.yml` 시크릿)

업로드 스텝은 아래 **저장소 시크릿 3개**를 쓴다 (GitHub → Settings → Secrets and variables → Actions):

| 시크릿 | 내용 |
|--------|------|
| `CHROME_CLIENT_ID` | Google Cloud OAuth 2.0 클라이언트 ID |
| `CHROME_CLIENT_SECRET` | 그 클라이언트 시크릿 |
| `CHROME_REFRESH_TOKEN` | 스토어 아이템 소유 계정으로 `chromewebstore` 스코프 승인해 발급한 refresh token |

- **저장소 변수(옵션)** `CHROME_AUTO_PUBLISH=true` → 업로드 후 **자동 게시(검수 제출)**까지.
  미설정(기본): 업로드(초안)만 하고 게시는 대시보드에서 수동 클릭.
- extension id는 워크플로에 하드코딩(`jggahimpefpcecjhbhhhlalhbmpkbghm`, 공개값).
- 업로드는 표준 CLI `chrome-webstore-upload-cli@3`(env: `EXTENSION_ID`/`CLIENT_ID`/`CLIENT_SECRET`/`REFRESH_TOKEN`)로 수행.

**자격증명 발급 (한 번만):**
1. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 생성/선택 → **Chrome Web Store API** 사용 설정.
2. OAuth 동의 화면 구성(External, 본인을 테스트 사용자로 추가).
3. **사용자 인증 정보 → OAuth 클라이언트 ID 만들기** → 유형 **데스크톱 앱** → `client_id` + `client_secret` 확보.
4. refresh token 발급: 위 client로 스코프 `https://www.googleapis.com/auth/chromewebstore`를
   **스토어 아이템 소유 Google 계정**으로 승인 → refresh token 획득
   (loopback OAuth 플로우 또는 `chrome-webstore-upload` 문서의 키 발급 가이드 사용).
5. 위 3개 값을 GitHub 저장소 시크릿으로 등록.

> 비밀번호 입력·OAuth 동의 승인·시크릿 값 입력은 계정 소유자(사람)만 수행한다 — 자동화 불가.

## 구조 (`packages/`는 모노레포 아님 — build.mjs 출력 디렉토리)

```
src/
├── manifest.json           # MV3, content_scripts 대상: ssafy.today·acmicpc·programmers·swea (4개)
├── scripts/
│   ├── commons/            # 백엔드 연동 핵심: ssafy-api·ssafy-verify·hint-websocket·upload-service·platformhub-base
│   ├── baekjoon/ programmers/ swexpertacademy/   # 플랫폼별 파서·수집기
│   └── constants/ (url·config·registry)
build.mjs                   # dist/ → packages/SsafyToday-v{version}.zip (fflate)
```

- 제출 경로는 `<플랫폼>.ts` → `parsing.ts` → `PlatformHubBase.smartUpload` →
  `UploadService.sendToSsafyTodayDirect` → `POST /api/submissions/` 한 갈래뿐이다.
- `npm run lint`는 **TS 마이그레이션 이전부터 깨져 있다** — `eslint.config.js`가 `**/*.js`만
  대상으로 잡아 "all files ignored"로 실패한다. 검증은 `npm run build`(tsc + vite)로 한다.
