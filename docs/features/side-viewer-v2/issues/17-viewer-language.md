# 17: 뷰어 화면 문구를 한국어·영어로 고르기

**What to build:** 사이드 뷰어 mod가 보이는 모든 글을 macOS의 첫 번째 선호 언어에 따라 한국어 또는 영어로 보인다. herdr-git의 방식대로 언어를 고르는 순수 모듈(`i18n.js`)과 화면 영역별 문구 표(`messages-<영역>.js`, `{ en, ko }`)를 만들고, 지금 코드에 박힌 한국어 문구를 모두 표의 키로 옮긴다. 한국어 문구는 글자 그대로 두고 영어 문구를 새로 쓴다. 언어를 읽지 못하면 영어로 굳히지 않고 다시 읽는다.

**Blocked by:** 12 (integrated)

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-23, "구현 결정"의 "언어(AC-23)", "테스트 결정")

**결정 근거:** 2026-11-12 통합 검증 뒤 사용자: "사용하는 언어를 읽고 한국어나 영어로 지원을 해줄거야", "herdr-git처럼". 라우터 안내 범위 질문에 "라우터 안내도 바꾸기".

**파일 소유:** `mods/side-viewer/` 아래 문구가 있는 모든 모듈과 그 테스트(`document.js`, `edit-state.js`, `header.js`, `terminal-insert.js`, `viewer-tab.js`, `markdown-view.js`, `code-card.js`, `notice-view.js`, `image-view.js`, `main.js` 등 grep으로 찾은 곳), 새 `i18n.js`·`messages-*.js`와 그 테스트. `router/`, README·RECIPE는 고치지 않는다(18·19 몫). 문서에 쓸 내용(영어 문구 목록, 언어를 다시 읽는 간격)은 이 티켓 Comments에 남긴다.

**설계 계약:**
- 방식: `~/personal/herdr-git/mods/git-tools/i18n.js`(`pickLang`, `readAppleLanguages`, `translator`, `sentence`), `i18n.test.mjs`(표의 키가 모두 쓰이는지), `ui.js`의 `readSystemLang`, `main.js`의 `askLang`·`ASK_AGAIN`·`turnTo`·`rememberLang`
- 플랫폼: `~/.config/herdr-app/herdr.d.ts`(`exec`, `window`), `~/.config/herdr-app/AGENTS.md`(UI·Mods 절)
- 지금 문구의 뜻: 티켓 03·15(상태 글, 해요체), 07·16(알림, 합쇼체), 13·14(빈 파일), 06(그림 오류), v1 명세 AC-9(안내)

**검증 방법:**
- 경계 1: 언어 고르기(`ko-KR`·`ko`·`ko_KR.UTF-8`·`en-US`·빈 답·실패), 표의 키가 모두 쓰이고 쓰는 키가 모두 표에 있음, 한국어 문구가 지금과 글자 그대로인지(기존 테스트의 한국어 기대를 `ko`로 돌려 그대로 통과), 영어 문구, 값 채우기
- 경계 3: `herdr-app check mods/side-viewer`, 영어·한국어로 첫 장면을 그린 임시 사본 check
- 경계 4: 19에서 실제 앱(시스템 언어를 바꾸거나 언어를 고정한 사본으로)

- [ ] 언어를 고르는 순수 모듈과 문구 표가 있고, 코드에 박힌 한국어 화면 문구가 남지 않는다(grep으로 확인, 코드 언어 이름표·주석·테스트 기대는 예외)
- [ ] 첫 선호 언어가 한국어면 지금과 같은 한국어, 그 밖이면 영어로 보인다
- [ ] 언어를 읽지 못하면 다시 읽고, 그동안 영어로 굳지 않는다
- [ ] 머리줄 폭이 영어 문구에서도 v2 규칙(이름·폴더가 먼저 줄고 버튼은 남음)을 지킨다

**완료 조건:** 위 항목 전부, 경계 1·3 통과.
