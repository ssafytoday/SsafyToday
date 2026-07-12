# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 정체 (SsafyToday 크롬 익스텐션)

BaekjoonHub 포크를 리브랜딩한 **Chrome MV3 확장** (`name: SsafyToday`). 원래 목적(GitHub
자동 푸시)에 더해 **SSAFY 백엔드(`ssafy.today`) 연동 — 제출 기록 전송 · 플랫폼 계정 동기화 ·
AI 힌트**가 얹혀 있다.

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
| `POST /api/submissions/` | **비인증** — body의 `platformUsername`을 `User.*_username`과 exact 매칭 | `ssafy-api.ts`, `upload-service.ts` | `docs/contract/apis-extension.md` |
| `POST /api/accounts/sync-credentials/` | **세션 쿠키 + CSRF** — `X-CSRFToken` 헤더 필수(csrftoken 쿠키 값), 로그인 감지는 `GET /api/accounts/auth/check/` | `ssafy-verify.ts` | `docs/contract/auth-session.md §2.3` |
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
  기록된다. 연동이 안 돼 있으면 `POST /api/submissions/`가 404 USER_NOT_FOUND.

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
| `release.yml` | **`v*` 태그 푸시** | `npm run package` → **GitHub Release 생성 + zip 첨부**(`softprops/action-gh-release`) |

- **`release.yml`은 크롬 웹스토어에 자동 업로드하지 않는다.** GitHub Release에 zip을
  올리는 데서 끝나고, **스토어 업로드는 사람이 수동으로** 대시보드에 올린다.
  (웹스토어 자동화 스텝·시크릿 없음.)
- zip 파일명은 **태그가 아니라 `package.json` version**에서 나온다(`build.mjs:25-26`).
  → 태그 전에 `package.json` + `src/manifest.json` 버전을 **함께** 올려야 하고 태그와 일치시킨다.

### 배포 절차 (이 수정을 사용자에게 반영)

1. `package.json` + `src/manifest.json` 버전 범프 (예: 3.5.3 → 3.5.4, 둘 다).
2. `npm run package` → `packages/SsafyToday-v3.5.4.zip` (또는 커밋 후 `v3.5.4` 태그 푸시 →
   Action이 Release로 만들어 줌).
3. 그 zip을 **크롬 웹스토어 개발자 대시보드에 수동 업로드** → 검수(수 시간~수일) →
   사용자 자동 업데이트. (같은 버전 재업로드는 스토어가 거부하므로 1의 범프 필수.)

> 웹스토어 업로드까지 완전 자동화하려면 `release.yml`에 `chrome-webstore-upload-cli`
> 스텝 + 스토어 시크릿(client id/secret/refresh token)을 추가하면 된다 (현재 미구성).

## 구조 (`packages/`는 모노레포 아님 — build.mjs 출력 디렉토리)

```
src/
├── manifest.json           # MV3, content_scripts 대상: ssafy.today·acmicpc·programmers·swea·github·lab.ssafy
├── scripts/
│   ├── commons/            # 백엔드 연동 핵심: ssafy-api·ssafy-verify·hint-websocket·upload-service·platformhub-base
│   ├── baekjoon/ programmers/ swexpertacademy/ github/ gitlab/   # 플랫폼별 파서·수집기
│   └── constants/ (url·config·registry)
build.mjs                   # dist/ → packages/SsafyToday-v{version}.zip (fflate)
```
