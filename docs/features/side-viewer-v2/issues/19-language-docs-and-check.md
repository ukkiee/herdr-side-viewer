# 19: 언어 지원 문서·미리보기 그림·손 확인

**What to build:** README.md(영어)와 README.ko.md(한국어)를 언어 지원에 맞춘다: README.md의 화면 문구 인용은 영어 문구로, README.ko.md는 한국어 문구로, 두 문서 모두 언어를 고르는 규칙을 적는다. herdr-git처럼 영어 화면의 `preview.png`와 한국어 화면의 `preview.ko.png`를 두고 README.ko.md는 `preview.ko.png`를 쓴다. RECIPE에 언어 모듈·표를 적고 "Done when"에 언어 확인 단계를 더한다. 실제 앱에서 두 언어를 확인한다.

**Blocked by:** 17, 18

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-23, "구현 결정"의 "언어(AC-23)", "테스트 결정")

**결정 근거:** 2026-11-12 통합 검증 뒤 사용자: "사용하는 언어를 읽고 한국어나 영어로 지원을 해줄거야", "herdr-git처럼". 라우터 안내 범위 질문에 "라우터 안내도 바꾸기". 미리보기 그림은 사용자가 "일단 찍지말아봐"로 멈췄고, 언어 지원 뒤 두 언어로 찍는다(찍기 전에 사용자에게 묻는다).

**파일 소유:** `README.md`, `README.ko.md`, `RECIPE.md`, `preview.png`, `preview.ko.png`(새로).

**설계 계약:**
- 형식: `~/personal/herdr-git/README.md`·`README.ko.md`(언어 링크, `preview.ko.png`)
- 문구: 17·18 Comments의 영어 문구 목록, 명세 AC-23

**검증 방법:**
- 경계 4: 실제 앱에서 한국어와 영어 화면(머리줄, 상태 글, 안내, 알림, 코드 카드), 라우터 `--status` 안내 두 언어(기본 앱을 바꾸지 않는 명령만), 설치와 check
- 문서: README 두 개의 화면 문구 인용이 코드의 표와 글자 그대로인지 대조

- [ ] README.md는 영어 문구, README.ko.md는 한국어 문구로 화면을 말하고 언어 규칙을 적는다
- [ ] `preview.png`(영어)·`preview.ko.png`(한국어)가 v2 화면이다
- [ ] RECIPE에 언어 모듈과 확인 단계가 있다
- [ ] 실제 앱에서 두 언어가 확인됐다

**완료 조건:** 위 항목 전부. 확인하지 못한 항목은 이유와 함께 남긴다.
