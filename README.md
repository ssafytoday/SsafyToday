# SsafyToday

코드를 GitHub에 자동으로 동기화하는 Chrome 확장 프로그램입니다.

## 지원 플랫폼

- [백준](https://www.acmicpc.net/)
- [프로그래머스](https://programmers.co.kr/)
- [SW Expert Academy](https://swexpertacademy.com/)
- [goormlevel](https://level.goorm.io/)

## 설치 및 연동

1. 크롬에서 설치 후 우측 상단의 popup 버튼을 클릭합니다.
2. "Authorize with GitHub" 버튼을 누르고 인증을 완료하면 Repository 연동 화면이 표시됩니다.
3. Repository를 신규로 만들거나 기존 Repository에 연동할 수 있습니다.
4. 디렉토리 구조를 플랫폼별 또는 언어별로 설정할 수 있습니다.
5. Get Started 버튼을 누르면 연동이 완료됩니다.
6. 이후 제출화면이 감지되면 자동으로 업로드됩니다.

## 작동 원리

SsafyToday는 GitHub API를 이용합니다. 코드가 제출되면 정답 여부를 식별하고, 제출된 코드와 메타데이터를 파싱해서 GitHub API를 통해 Repository에 반영합니다.

### 업로드 시점

- 기본적으로 풀이 채점 후 정답임을 감지하여 작동합니다.
- SW Expert Academy는 정답을 맞추면 "SsafyToday로 업로드" 버튼이 생깁니다.

### 백준 제출 기준

백준의 경우 "내 제출" 목록을 정렬해서 가장 적합한 제출을 업로드합니다:

1. 서브태스크가 있는 문제일 경우 점수가 더 높은 제출
2. 실행시간이 짧은 제출
3. 사용메모리가 적은 제출
4. 코드길이가 짧은 제출
5. 제출번호가 더 큰 제출 (최신 제출)

## 저장되는 정보

| 플랫폼 | 문제 메타 정보 | 사용자 제출 정보 |
|--------|----------------|------------------|
| 백준 | 제목, ID, 링크, 등급, 설명, 언어, 분류 | 코드, 메모리, 실행 시간 |
| 프로그래머스 | 제목, ID, 링크, 등급, 설명, 언어 | 코드, 메모리, 실행 시간 |
| SW Expert Academy | 제목, ID, 링크, 등급, 언어 | 코드, 메모리, 실행 시간, 코드 길이 |
| goormlevel | 제목, 시험 ID, 문제 ID, 링크, 언어 | 코드, 메모리, 실행 시간 |

## 링크

- [버그 신고](https://github.com/ssafytoday/SsafyToday/issues)

## 크레딧

이 프로젝트는 [BaekjoonHub](https://github.com/BaekjoonHub/BaekjoonHub)를 기반으로 제작되었습니다.
