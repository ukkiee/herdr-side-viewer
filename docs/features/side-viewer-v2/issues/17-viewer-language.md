# 17: 뷰어 화면 문구를 한국어·영어로 고르기

**What to build:** 사이드 뷰어 mod가 보이는 모든 글을 macOS의 첫 번째 선호 언어에 따라 한국어 또는 영어로 보인다. herdr-git의 방식대로 언어를 고르는 순수 모듈(`i18n.js`)과 화면 영역별 문구 표(`messages-<영역>.js`, `{ en, ko }`)를 만들고, 지금 코드에 박힌 한국어 문구를 모두 표의 키로 옮긴다. 한국어 문구는 글자 그대로 두고 영어 문구를 새로 쓴다. 언어를 읽지 못하면 영어로 굳히지 않고 다시 읽는다.

**Blocked by:** 12 (integrated)

**Status:** integrated

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

- [x] 언어를 고르는 순수 모듈과 문구 표가 있고, 코드에 박힌 한국어 화면 문구가 남지 않는다(grep으로 확인, 코드 언어 이름표·주석·테스트 기대는 예외) (경계 1·3과 코드 대조. 실제 앱 확인은 19에서)
- [x] 첫 선호 언어가 한국어면 지금과 같은 한국어, 그 밖이면 영어로 보인다 (경계 1·3과 코드 대조. 실제 앱 확인은 19에서)
- [x] 언어를 읽지 못하면 다시 읽고, 그동안 영어로 굳지 않는다 (경계 1·3과 코드 대조. 실제 앱 확인은 19에서)
- [x] 머리줄 폭이 영어 문구에서도 v2 규칙(이름·폴더가 먼저 줄고 버튼은 남음)을 지킨다 (경계 1·3과 코드 대조. 실제 앱 확인은 19에서)

**완료 조건:** 위 항목 전부, 경계 1·3 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/17-viewer-language`(통합 tip `f79f318` 병합 포함, `d170ee3`)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다.
- **자리:** `i18n.js`(herdr-git 꼴: `pickLang`, `readAppleLanguages`, `translator`), 문구 표 `messages-header.js`(머리줄 전환·버튼·툴팁·상태 글 17개), `messages-body.js`(안내·그림 오류 8개), `messages-alerts.js`(`>_`·새 탭 알림 9개), 모두 34개. 순수 모듈은 번역기 `tr`을 마지막 인자로 받는다(뷰어 코드의 `t`는 테마). 모든 호출이 `tr`을 넘기는지 소스를 훑는 테스트가 있다. 언어는 뷰어가 뜰 때 `defaults read -g AppleLanguages`로 읽어 Herdr 공유 상태 `side-viewer.lang`에 두고 모든 뷰어(뷰어 탭 포함)가 같이 쓴다. 바뀌면 모든 뷰어가 다시 그린다. 못 읽으면 1초·3초·10초 뒤, 그다음 15초마다 다시 읽고 그동안 앞서 정한 언어(처음이면 영어)를 쓴다.
- **영어 문구(주요):** `Rendered | Source`, `Open in New Tab`, `Open in Original App`, `Show in Finder`, `Save`·`Save (⌘S)`, `Reload`·`Discard my edits and reload`, `Overwrite`·`Overwrite with mine`, `Edited`, `Changed on disk`, `File deleted`, `No write permission`, `Too large to save`, `Couldn't save`, `This file is empty.`, `This file no longer exists.`, `Can't read this file.`, `The viewer can't open this kind of file.`, `Too large to open in the viewer.`, `Couldn't read image: {src}`, 알림 `Not inserted into the terminal` 외. 전체 표: 실행 scratchpad의 `reports/sv2-17.md`.
- **완료 조건:** 경계 1·3 통과.
  - 작업자(`d170ee3`): 관련 테스트 6개 파일 157 통과·0 실패·0 skip, `herdr-app check` 통과, 영어·한국어 첫 장면 임시 사본 check 둘 다 통과(머리줄 문구 10개가 각 언어로). 새 테스트는 단언 단위로 실패한 뒤 고쳤다. 코드에 남은 한국어 화면 문구 0줄(기존 주석 한 줄 예외).
  - 통합 담당(`d170ee3`): `node --test mods/side-viewer/` 361 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **문서(19)로:** 시스템 언어를 바꿔도 이미 열린 뷰어는 스스로 다시 읽지 않고, 새 뷰어를 열면 그 뷰어가 읽은 언어를 모두가 따른다.
- **실제 앱에서 볼 것(19):** 좁은 뷰어의 영어 머리줄 폭, 공유 상태가 앱을 다시 켠 뒤에도 남는지(아니면 새 뷰어가 잠깐 영어), 영어 알림이 잘리는지.
- **절차:** 작업자가 저장소 밖 임시 스크립트를 heredoc으로 한 번 만들었고, 테스트 파일에 빈 heredoc 덧붙이기를 한 번 실행했다(붙은 것 없음, 스스로 보고). 저장소 파일 편집은 Edit·Write.
