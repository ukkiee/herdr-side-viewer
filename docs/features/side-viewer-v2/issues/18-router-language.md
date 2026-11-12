# 18: 라우터 명령의 안내를 한국어·영어로 고르기

**What to build:** 라우터 명령(`--make-default`, `--restore`, `--status`)이 터미널에 찍는 한국어 안내(`mods/side-viewer/router/takeover.sh`의 "macOS 확인 창이 N번 뜹니다.", "바뀜", "유지를 선택함", "라우터에 남음", "바꿀 것이 없습니다.", 실패 줄 등)를 macOS의 첫 번째 선호 언어에 따라 한국어 또는 영어로 찍는다. 규칙은 17과 같다(`defaults read -g AppleLanguages` 첫 태그가 `ko`로 시작하면 한국어, 그 밖·빈 답·실패는 영어; 명령 한 번 실행 안에서는 한 번만 읽는다).

**Blocked by:** 12 (integrated)

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-23, "구현 결정"의 "언어(AC-23)", "테스트 결정")

**결정 근거:** 2026-11-12 통합 검증 뒤 사용자: "사용하는 언어를 읽고 한국어나 영어로 지원을 해줄거야", "herdr-git처럼". 라우터 안내 범위 질문에 "라우터 안내도 바꾸기".

**파일 소유:** `mods/side-viewer/router/takeover.sh`, `lib.sh`(필요할 때만), `router/router.test.mjs`. `main.swift`·`build.sh`·mod의 JS 모듈, README·RECIPE는 고치지 않는다. 문서에 쓸 내용(영어 안내 문구 목록)은 이 티켓 Comments에 남긴다.

**설계 계약:**
- 지금 안내와 종료 코드: `router/takeover.sh`, v1 명세 AC-5·AC-10, README "Take over the extensions"
- 시험 방식: `router/router.test.mjs`(가짜 명령을 PATH 앞에 두는 v1 방식)
- 언어 규칙: 17과 같음(명세 "언어(AC-23)")

**검증 방법:**
- 경계 2: 가짜 `defaults`(한국어 첫 태그, 영어 첫 태그, 빈 답, 실패)로 각 명령의 안내 줄과 종료 코드. 한국어 출력이 지금과 글자 그대로인지(기존 기대)
- 기본 앱을 바꾸는 실제 명령은 돌리지 않는다(가짜 `duti`·`lsregister` 등 기존 시험 장치만)

- [ ] 첫 선호 언어가 한국어면 지금과 같은 한국어 안내, 그 밖이면 영어 안내
- [ ] 종료 코드와 줄 순서·묶음(바뀜·유지·남음)은 그대로
- [ ] 언어를 읽지 못하면 영어

**완료 조건:** 위 항목 전부, 경계 2 통과.
