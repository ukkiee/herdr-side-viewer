# 02: 원문 보기와 코드 보기에서 고치고 저장하기

**What to build:** 마크다운 원문 보기와 코드 보기에서 글을 고칠 수 있다. 고치면 머리줄에 "저장 안 됨"과 저장 버튼이 나타나고, cmd+S나 저장 버튼으로 파일에 쓴다. 저장하지 않은 수정은 그 뷰어 안에 파일별로 남아 다른 파일을 보고 돌아와도 되살아난다. 원문 보기는 긴 줄을 접고 코드 보기는 접지 않는다. 고친 뒤 렌더링으로 바꾸면 고친 내용으로 그린 문서가 보인다.

**Blocked by:** 01

**Status:** done

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-1 마크다운·코드 쪽, AC-2, AC-3, AC-6 마크다운 쪽, AC-7)

**파일 소유:** 새 편집 상태 모듈과 그 테스트(연결 파일 소유), `mods/side-viewer/views.js`와 그 테스트(연결 파일 소유, "고칠 수 있는지" 판단 추가), `mods/side-viewer/mod.json`(`"focusable": true`). 연결 파일 자리: `main.js`의 편집 상태 연결·키 처리·파일별 보관, 머리줄 모듈의 "저장 안 됨"·저장 버튼 자리.

**설계 계약:**
- 편집 상태 모듈: 명세 "구현 결정"의 "편집 상태", "저장", AC-2·AC-3
- 키 처리: 명세 "구현 결정"의 "cmd+S", `~/.config/herdr-app/AGENTS.md`의 포커스·`on_key_down` 설명(`"focusable"`, `track_focus`)
- 저장: `~/.config/herdr-app/herdr.d.ts`의 `writeTextFile(path, text, expected)`
- `views.js`: v1 명세 "구현 결정"의 "보기 판별", 이 명세의 "보기 판별"
- 편집기 상태: 명세 "구현 결정"의 "고칠 수 있는 보기"(그리는 도중에 만들지 않는다)

**검증 방법:**
- 첫 단계: 실제 앱에서 cmd+S가 mod의 `on_key_down`까지 오는지 확인한다. 오지 않으면 저장 버튼으로 진행하고 결과를 티켓 Comments와 사용자에게 알린다.
- 경계 1: 편집 상태(저장 안 됨 판단, 되돌리면 사라짐, 파일별 보관·복원, 고친 내용이 없을 때 cmd+S는 아무 일 없음), `views.js`(고칠 수 있는 보기)
- 경계 3: `herdr-app check mods/side-viewer`
- 경계 4: 마크다운 원문과 코드 파일을 고쳐 저장, 다른 파일로 갔다 돌아오기, 원문 줄 접기, 렌더링 미리 보기

- [x] 마크다운 원문 보기와 코드 보기에서 입력·삭제가 되고, 렌더링·이미지·안내 화면에서는 안 된다 (경계 1과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 고치면 "저장 안 됨"과 저장 버튼이 나타나고, 저장하거나 원래대로 되돌리면 사라진다 (경계 1과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] cmd+S와 저장 버튼이 파일에 쓴다(마지막으로 읽은 내용을 `expected`로 넘긴다) (경계 1과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 다른 파일로 갔다 돌아오면 고친 내용과 표시가 되살아난다 (경계 1과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 원문 보기는 긴 줄을 접고 코드 보기는 접지 않는다 (경계 1과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 고친 뒤 렌더링으로 바꾸면 고친 내용으로 그린다 (경계 1과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)

**완료 조건:** 위 항목 전부, 경계 1·3 통과, 첫 단계의 cmd+S 확인 결과 기록.

## Comments

### 2026-11-12 첫 단계: cmd+S 실측(주 진행자와 사용자, 구현과 병행)

시험 mod(`"focusable": true`, 바깥 `v_flex`에 `track_focus(handle)`·`on_key_down`, 안에 `EditorState.new({readonly: false})`의 `Editor`)를 실제 Herdr 앱에 띄우고 사용자가 눌렀다. 기록은 mod가 파일에 남긴 키 이벤트다. 시험 mod와 pane은 끝난 뒤 지웠다.

- **바깥 핸들에 포커스:** cmd+S가 `on_key_down`에 `keystroke` `"cmd-s"`(`key` `"s"`, `key_char` 없음)로 왔다.
- **편집기에 포커스(`handle.is_focused()`는 `false`):** cmd+S가 바깥 `on_key_down`에 `"cmd-s"`로 왔고 편집기 글에 `s`가 들어가지 않았다. 일반 글자도 바깥 `on_key_down`에 먼저 오고, 같은 시각에 `EditorState.on("change")`가 오며 `value()`에 바뀐 글이 있다. `on("focus")`·`on("blur")`도 온다.
- **Herdr가 cmd+S를 가로채지 않았다.** 명세 "구현 결정"의 cmd+S 방식(`미확인`이던 부분)이 성립한다. 결과는 작업자 sv2-02에게 hc로 전달했다.

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/02-edit-and-save`의 `e24ae77`(편집 상태 모듈), `250ede2`(보기 판별), `2b9ce90`(main·header·mod.json 연결), `221d225`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다.
- **완료 조건:** 경계 1·3 통과, cmd+S 첫 단계 결과는 위 Comments에 있다.
  - 작업자(`2b9ce90`): `node --test mods/side-viewer/views.test.mjs mods/side-viewer/edit-state.test.mjs` 32 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과. 작업자가 상태를 "마크다운 원문 + 저장 안 됨"으로 바꾼 임시 사본의 check도 통과했고, 그 사본의 저장 버튼을 일부러 깨면 check가 실패해 그 장면이 실제로 그려진다는 것도 확인했다.
  - 통합 담당(`221d225`): `node --test mods/side-viewer/` 167 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **미실행:** 경계 4 전부(입력·저장, 다른 파일 갔다 오기, 원문 줄 접기, 렌더링 미리 보기, 이 mod에서 cmd+S로 실제 저장, `"focus"` 명령 뒤 포커스, 렌더링으로 바꾼 뒤 cmd+S). 티켓 12에서 확인한다.
- **자리(뒤 티켓용):**
  - `mods/side-viewer/edit-state.js`: 상태는 `{ [file]: { disk, text } }`(고친 내용이 있는 파일만 항목). 공개 함수 `noEdits`, `unsaved`, `shownText`, `typed`(원래대로 되돌리면 항목 삭제), `saveOf`(`{path, text, expected}` 또는 null), `saved`(저장 중에 더 친 글은 저장 안 됨으로 남음). 03은 디스크 변경·저장 결과 해석·막대 버튼 뒤 상태를, 10은 한 파일 항목 꺼내기·넣기를, 11은 체크박스 바꾼 글 합치기를 더한다.
  - `mods/side-viewer/views.js`: `editable(state, raw)`(code는 항상, markdown은 raw일 때만), `editorOf(state)`(markdown `{soft_wrap: true}`, code `{soft_wrap: false}`). 08이 svg 원문을 더할 자리.
  - `mods/side-viewer/main.js`: `apply(file, content, cx)`가 읽은 직후 편집기를 만든다. `makeEditor`는 `readonly: false`와 `on("change")` → `edited`. `save(cx)`는 `writeTextFile(path, text, expected)`이고 거부·실패는 지금 조용히 삼킨다(03이 막대로 바꿀 자리). `keyDown`은 `"cmd-s"`를 본다. 루트가 `track_focus(this.focus)`와 `on_key_down`을 갖는다. `renderBody`는 `editable`이면 `renderCode`로 원문 편집기를 그린다.
  - `mods/side-viewer/header.js`: 폴더와 `renderSwitch` 사이 `renderUnsaved`("저장 안 됨" + 글자 버튼 "저장", 툴팁 "저장 (⌘S)").
- **남은 위험(03의 몫):** 고친 내용이 있는 파일이 밖에서 바뀌면 지금은 화면이 고친 내용을 유지하고 저장이 조용히 거부된다. 마크다운 원문은 다시 읽을 때 편집기를 새로 만들어 커서·스크롤이 처음으로 간다. 고친 내용이 있는 파일이 지워지면 본문이 "더 이상 없습니다" 안내로 바뀌고 머리줄의 "저장 안 됨"은 남는다. 1 MiB 사전 차단은 없다.
- **그 밖의 관찰:** 마크다운 원문 편집기는 색상 언어 없이 그린다. 마크다운 원문 편집기는 테마를 바꿔도 다시 만들지 않는다(코드 보기는 v1처럼 다시 만든다). `markdown-view.js`의 raw 분기는 이제 쓰이지 않는다(정리는 04 통합 뒤).
- **문서 메모(12):** 마크다운 원문 보기와 코드 보기에서 고칠 수 있다. 고치면 머리줄에 "저장 안 됨"과 "저장" 버튼이 나오고 cmd+S나 버튼으로 저장한다. 저장하지 않은 수정은 그 뷰어 안에 파일별로 남고 pane을 닫으면 사라진다(묻지 않음). RECIPE "Done when" 후보: 원문·코드에서 입력 → "저장 안 됨" → cmd+S → 표시가 사라지고 파일이 바뀜 / 되돌리면 표시가 사라짐 / 다른 파일 갔다 와서 수정 복원 / 원문은 긴 줄 접힘, 코드는 안 접힘 / 고친 뒤 렌더링에 반영되고 파일은 그대로 / 렌더링으로 바꾼 뒤 cmd+S.

### 2026-11-12 완료 (주 진행자)

- 리뷰·재검토 모두 통과(마지막 sv2-rv10과 F-2 직접 재검토), 통합 검증(티켓 12·19) 통과, 최종 단계(change-review phase=final: PR 초안·회고 후보, 원본 해시 일치) 완료. 통합 head `d990852`: `node --test mods/side-viewer/` 362 통과·0 실패·0 skip·0 취소, `herdr-app check` 통과. push·PR은 하지 않았다(사용자: "pr 올리기전까지만").
