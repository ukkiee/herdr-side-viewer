# 02: 원문 보기와 코드 보기에서 고치고 저장하기

**What to build:** 마크다운 원문 보기와 코드 보기에서 글을 고칠 수 있다. 고치면 머리줄에 "저장 안 됨"과 저장 버튼이 나타나고, cmd+S나 저장 버튼으로 파일에 쓴다. 저장하지 않은 수정은 그 뷰어 안에 파일별로 남아 다른 파일을 보고 돌아와도 되살아난다. 원문 보기는 긴 줄을 접고 코드 보기는 접지 않는다. 고친 뒤 렌더링으로 바꾸면 고친 내용으로 그린 문서가 보인다.

**Blocked by:** 01

**Status:** ready-for-agent

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

- [ ] 마크다운 원문 보기와 코드 보기에서 입력·삭제가 되고, 렌더링·이미지·안내 화면에서는 안 된다
- [ ] 고치면 "저장 안 됨"과 저장 버튼이 나타나고, 저장하거나 원래대로 되돌리면 사라진다
- [ ] cmd+S와 저장 버튼이 파일에 쓴다(마지막으로 읽은 내용을 `expected`로 넘긴다)
- [ ] 다른 파일로 갔다 돌아오면 고친 내용과 표시가 되살아난다
- [ ] 원문 보기는 긴 줄을 접고 코드 보기는 접지 않는다
- [ ] 고친 뒤 렌더링으로 바꾸면 고친 내용으로 그린다

**완료 조건:** 위 항목 전부, 경계 1·3 통과, 첫 단계의 cmd+S 확인 결과 기록.

## Comments

### 2026-11-12 첫 단계: cmd+S 실측(주 진행자와 사용자, 구현과 병행)

시험 mod(`"focusable": true`, 바깥 `v_flex`에 `track_focus(handle)`·`on_key_down`, 안에 `EditorState.new({readonly: false})`의 `Editor`)를 실제 Herdr 앱에 띄우고 사용자가 눌렀다. 기록은 mod가 파일에 남긴 키 이벤트다. 시험 mod와 pane은 끝난 뒤 지웠다.

- **바깥 핸들에 포커스:** cmd+S가 `on_key_down`에 `keystroke` `"cmd-s"`(`key` `"s"`, `key_char` 없음)로 왔다.
- **편집기에 포커스(`handle.is_focused()`는 `false`):** cmd+S가 바깥 `on_key_down`에 `"cmd-s"`로 왔고 편집기 글에 `s`가 들어가지 않았다. 일반 글자도 바깥 `on_key_down`에 먼저 오고, 같은 시각에 `EditorState.on("change")`가 오며 `value()`에 바뀐 글이 있다. `on("focus")`·`on("blur")`도 온다.
- **Herdr가 cmd+S를 가로채지 않았다.** 명세 "구현 결정"의 cmd+S 방식(`미확인`이던 부분)이 성립한다. 결과는 작업자 sv2-02에게 hc로 전달했다.
