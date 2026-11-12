# 05: 코드 블록 카드

**What to build:** 문서 안 코드 블록을 Warp식 카드로 그린다. 언어 이름(아는 언어, "Shell", "Mermaid", "Code"), 블록 전체를 복사하는 버튼(누르면 잠시 체크 표시), 문법 색, 카드 안에서 접히는 긴 줄, 내용에 맞는 높이가 있다. 카드 안에는 스크롤이 없고 휠은 문서를 스크롤한다. 눌러도 커서가 생기지 않는다. 목록 안 코드는 항목 글자에 맞춰 들여 쓴 카드, 인용 안 코드는 인용 막대 안의 카드다. 어두운 테마는 그라데이션, 밝은 테마는 단색이다.

**Blocked by:** 04

**Status:** done

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-15)

**파일 소유:** 새 언어 이름표·셸 판정 모듈과 그 테스트, 새 코드 카드 모듈(연결 파일 소유). 연결 파일 자리: 마크다운 보기 모듈의 코드 블록 자리.

**설계 계약:**
- 코드 카드 모듈: 명세 "구현 결정"의 "코드 블록 카드"(키운 편집기를 잘라 보이기, 누름을 삼키는 막, 편집기 상태는 문서를 읽은 뒤 만들기), "카드 모양(시안 값)", `~/.config/herdr-app/gpui-kit.d.ts`의 `EditorState`·`Editor`·`PathBuilder`·`Background`·`svg`, `cx.write_to_clipboard`
- 이름표·셸 판정 모듈: 명세 "구현 결정"의 "언어 이름표와 셸 판정(순수)", v1 `views.js`의 색상 언어 표

**검증 방법:**
- 경계 1: 언어 → 색상 언어·이름표·셸 여부, 접힌 줄 수 어림(한글 두 칸)
- 경계 3: `herdr-app check mods/side-viewer`
- 경계 4: `docs/features/side-viewer-v2/code-sample.md`로 확인. 카드를 눌러도 커서가 없는지, 짧은 블록에 스크롤바가 없는지, 카드 위 휠이 문서를 스크롤하는지, 복사, 긴 줄 접힘, 목록·인용 안 카드, 밝은 테마

- [x] 카드 모양, 이름표, 복사 버튼, 문법 색 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 긴 줄이 접히고 높이가 맞으며 카드 안 스크롤이 없다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 휠이 문서를 스크롤하고 커서가 생기지 않는다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 목록·인용 안 코드 블록도 카드다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 밝은 테마에서는 단색 카드다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)

**완료 조건:** 위 항목 전부, 경계 1·3 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/05-code-block-cards`의 `06adadc`(이름표·색상 언어·셸 판정), `26280ce`(접힌 줄 수와 편집기 높이 어림), `88c8d66`(어두운 테마 그라데이션, 밝은 테마 단색), `16df9ab`(카드 그리기와 main.js 연결), `9ce6815`·`58ed1ad`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다.
- **완료 조건:** 경계 1·3 통과.
  - 작업자(`9ce6815`): `node --test mods/side-viewer/code-blocks.test.mjs mods/side-viewer/markdown-blocks.test.mjs` 37 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과, 첫 장면을 코드 블록 8개가 든 마크다운으로 바꾼 임시 사본의 check 통과. 그라데이션 분기와 인용 속 카드의 편집기 분기를 일부러 깨면 check가 실패해 두 분기가 실제로 그려진다는 것도 확인했다. 밝은 테마의 단색 분기는 check의 테마가 어두워 그려 보지 못했다.
  - 통합 담당(`58ed1ad`): `node --test mods/side-viewer/` 223 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **미실행:** 경계 4(`code-sample.md`로 커서 없음, 짧은 블록 스크롤바, 휠, 복사, 긴 줄 접힘, 목록·인용 안 카드, 밝은 테마). 티켓 12에서 확인한다.
- **자리(07용):** `mods/side-viewer/code-card.js`의 `renderActions(t, id, card, block)`에서 복사 버튼 앞에 `>_`를 넣는다. 셸 여부는 `card.shell`, 명령은 `block.text`. 뷰어 쪽 콜백이 필요하면 `renderMarkdown`의 ctx로 넘기는 길을 07이 만든다. 순수 모듈 `mods/side-viewer/code-blocks.js`: `codeLanguageOf(lang)` → `{label, language, shell}`, `wrappedRows`, `editorRows`, `cardFill`. `main.js`: `this.codeCards`(`CodeCards`), `prepareCards`를 `apply` 맨 앞과 `edited`에서 부른다. `renderMarkdown` 호출에 `codeCards` 속성.
- **남은 위험(경계 4에서 볼 것):** 줄 높이 21(명세 값)이 실제와 다르면 마지막 줄이 잘리거나 아래에 빈 공간이 남는다. 접힘 어림이 실제보다 적으면 마지막 줄이 잘린다(편집기 좌우 여백을 몰라 8px을 더 뺐다). 투명한 막이 누름만 삼키므로 Tab 같은 다른 포커스 경로는 막지 못한다. 편집기가 자기 바탕을 칠하면 그라데이션이 가려진다. 테마를 바꾸면 카드 색은 다음 재확인(최대 15초) 때 바뀐다.
- **절차 메모:** 작업자가 테스트 한 묶음을 셸 heredoc로 덧붙였다(계약은 Edit·Write 도구). 결과물에는 차이가 없다. Herdr 소스 사본에 gpui-kit 소스가 없어(`crates`에 `ghostty-sys`만) 편집기 동작은 명세의 관측을 따랐다.
- **문서 메모(12):** README: 마크다운 보기의 코드 블록은 카드로 보인다. 언어 이름(셸 계열은 Shell, mermaid는 Mermaid, 모르는 언어는 Code), 복사 버튼, 문법 색이 있고 긴 줄은 카드 안에서 접힌다. 카드 안 글자는 고르거나 고칠 수 없다. mermaid는 그림으로 그리지 않는다. RECIPE "Done when" 후보(`code-sample.md`): 언어별 이름표, 복사 → 붙여 넣기로 블록 전체와 체크 표시, 긴 줄 접힘, 한 줄짜리 sh에 스크롤바 없음, 카드 위 휠이 문서를 스크롤, 눌러도 커서 없음, 목록 속 카드 들여쓰기, 인용 속 카드가 막대 안, 밝은 테마 단색.

### 2026-11-12 완료 (주 진행자)

- 리뷰·재검토 모두 통과(마지막 sv2-rv10과 F-2 직접 재검토), 통합 검증(티켓 12·19) 통과, 최종 단계(change-review phase=final: PR 초안·회고 후보, 원본 해시 일치) 완료. 통합 head `d990852`: `node --test mods/side-viewer/` 362 통과·0 실패·0 skip·0 취소, `herdr-app check` 통과. push·PR은 하지 않았다(사용자: "pr 올리기전까지만").
