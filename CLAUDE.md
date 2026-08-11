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
- **버전**: `package.json`·`src/manifest.json` 모두 `3.x` (현재 3.5.x). 작업 브랜치는
  `develop`이고 `v3.5.4`부터는 그 HEAD에 `v3.5.x` 태그를 달아 릴리스한다.
- **`README.md`는 갱신 안 된 옛 BaekjoonHub 문서**다(GitHub 동기화만 설명, ssafy.today
  연동·AI 힌트 언급 없음, 스토어 링크도 원조 BaekjoonHub 것). **신뢰하지 말 것.**
  실제 연동 계약은 `ssafy-advisor/docs/contract/`가 소스 오브 트루스.

## 백엔드 연동 지점

`ssafy.today`(nginx :8000 → FastAPI :9000)로 나가는 요청. URL은 소스에 하드코딩
(`src/scripts/commons/`, dev/prod 스위치 없음). 상세 계약은 아래 문서 참조.

| 요청 | 인증 | 소스 | 백엔드 계약 |
|------|------|------|------------|
| `POST /api/submissions/` | **비인증** — body의 `ssafyUsername`/`ssafyEmail`(1순위) 또는 `platformUsername`(폴백)로 사용자 매칭 (`username`은 항상 빈 문자열, `metadata`는 `extensionVersion`+`timestamp`뿐) | `ssafy-api.ts`, `upload-service.ts`, `ssafy-account.ts` | `docs/contract/apis-extension.md` |
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

- **계정 폴백 신원 — v3.5.10 신설.** 제출 전송은 비인증이라 플랫폼 페이지에서는
  신원이 플랫폼 닉네임뿐이었고, 닉네임이 어긋나면 제출이 매번 유실됐다. 이제
  ssafy.today 방문 시 `auth/check/` 응답의 `username`·`email`을
  `ssafy-account.ts`가 `chrome.storage.local`에 캐시하고(`ssafy_account_username`
  ·`ssafy_account_email`), `upload-service.ts`가 제출 페이로드에 `ssafyUsername`
  ·`ssafyEmail`로 함께 실어 보낸다. 백엔드는 이 계정을 **먼저** 조회하고 못 찾을
  때만 기존 `platformUsername` → `username` 사슬을 탄다(순수 추가라 구버전
  익스텐션은 그대로 동작). 로그아웃이 확인되면 캐시를 즉시 비운다 — 공유 PC에서
  이전 사용자에게 풀이가 귀속되는 것을 막는다(네트워크 오류는 로그아웃이 아니므로
  비우지 않는다). 계약: `ssafy-advisor/docs/contract/apis-extension.md` §3.1/§5.1.

- ⚠️ **백준(acmicpc.net)은 2026-04-28자로 채점 서비스를 종료했다.** 모든 경로가
  "BOJ 채점 서비스 준비 중" 안내 페이지로 대체돼 `findUsername()`·`#status-table`이
  전부 없다 — `baekjoon.ts`는 "Could not find username after multiple retries"를 남기고
  조용히 끝난다(정상). 백엔드 로그도 `백준` 제출이 2026-04-27을 마지막으로 0건이다.
  **이건 익스텐션 버그가 아니다** — 백준 파서를 "고치려" 들지 말 것.

- **연동 불일치(stale link) 복구 — v3.5.9 신설.** 등록된 플랫폼 계정명과 플랫폼 화면이
  보여주는 값이 어긋나면(닉네임 변경·다른 계정 로그인·가입 시 오기입) 제출이 **매번**
  404 USER_NOT_FOUND로 떨어지는데, `sync-credentials`가 **채움 전용**이라 자가 복구가
  아예 불가능했다. 학생에겐 플랫폼 페이지의 붉은 토스트만 잠깐 보이고 ssafy.today는
  "연동됨 ✓"으로 표시돼(setup 페이지는 DB 값을 보여준다) 원인 파악이 사실상 불가능했다.
  - 서버는 이제 어긋난 필드를 `mismatched: {<model_field>: {stored, incoming}}` 로 **보고**하고,
    요청에 `repair`(true 또는 짧은 키 배열)가 있을 때만 덮어쓴다
    (`ssafy-advisor/docs/contract/auth-session.md §2.3`).
  - `ssafy-verify.ts`가 그 보고를 받아 ssafy.today 우하단에 배너를 띄우고
    (`#ssafy-today-link-mismatch`), **사용자가 "연동 고치기"를 눌렀을 때만** `repair`를 보낸다.
    자동으로 덮어쓰지 않는 이유는 공유 브라우저에서 남의 플랫폼 세션 값이 내 계정에
    연동되는 오염을 막기 위해서다(2026-07-17 서버 정책). 프론트가 자체 UI를 붙일 수 있게
    `SSAFY_TODAY_LINK_MISMATCH` / `SSAFY_TODAY_REPAIR_LINK` / `SSAFY_TODAY_REPAIR_RESULT`
    postMessage 채널도 열어 뒀다.
  - 복구 성공 직후 `flushPendingSubmissions({force: true})`로 밀린 제출을 재전송한다.
    이때 `force`는 재시도 간격(30분)뿐 아니라 **페이지 로드당 1회 가드**도 넘긴다 —
    ssafy.today 진입 시 자동 sync가 이미 flush를 한 번 태우므로, 넘기지 않으면 복구 직후
    재전송이 조용히 no-op이 된다(2026-08-11 실측으로 잡은 버그).
- **SWEA는 결과 페이지로 이동하지 않는다**(v3.5.8, 업스트림 BaekjoonHub `e473954` 이식).
  정답 팝업을 감지하면 `problemSolver.do`/`problemPassedUser.do`를 **fetch + DOMParser**로
  읽어 풀이 화면(`solvingProblem.do`)에서 파싱·전송까지 끝낸다(`tryUploadInPlace`).
  결과 페이지 전체 로드(~0.7–3초)가 제출 체인에서 빠진다.
  - `parseData(root, resultUrl)`는 이제 파싱 기준 문서와 URL을 인자로 받는다
    (기본값 `document`/현재 주소 — 결과 페이지에 직접 진입한 기존 경로와 하위 호환).
    로그인 유저 닉네임(`getNickname()`)만은 fetch 문서가 아니라 **현재 화면 GNB**에서 읽는다.
  - **fetch/파싱 실패 시에만** 기존 방식(결과 페이지 이동)으로 폴백한다. 전송 단계 오류는
    페이지를 옮겨도 동일하게 실패하므로 폴백하지 않는다.
  - 처리 후 페이지가 유지되므로 결과 팝업이 닫히면 감지를 재무장한다
    (`rearmAfterPopupClose` — 팝업이 떠 있는 동안 재무장하면 같은 `pass입니다` 텍스트로
    즉시 재트리거돼 루프가 된다). 그래서 잠갔던 팝업 버튼도 반드시 되돌려야 한다.
- **중복 제출 방지 없음**: git 제거와 함께 SHA 캐시 기반 중복 가드도 삭제됐다(사용자 결정).
  정답 페이지를 새로고침하거나 여러 탭에서 열면 같은 제출이 반복 POST될 수 있다.
  위 SWEA 재무장 때문에 **같은 화면에서 연속 재제출하면 매번 기록**된다(업스트림은 SHA
  dedup으로 스킵되지만 이 포크엔 그 가드가 없다).

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
