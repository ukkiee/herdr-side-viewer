# 04: Warp식 블록 마크다운 보기

**What to build:** 마크다운 렌더링을 TextView 한 장에서 블록마다 그리는 방식으로 바꾼다. 폭 제한 없이 pane 폭을 쓰고 본문은 13pt이며, 맨 위에 폴더와 파일 이름이 있다. 제목, 문단, 목록(점 단계, 번호, 체크박스 모양), 표(내용 폭, 정렬), 구분선, 인용(안의 블록 포함), 각주를 명세대로 그린다. 코드 블록과 그림은 이 티켓에서 자리만 두고 기존처럼 보여 준다(카드는 05, 그림은 06).

**Blocked by:** 01

**Status:** integrated

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-12 본문 쪽, AC-13)

**파일 소유:** 새 마크다운 블록 해석 모듈과 그 테스트(연결 파일 소유), 마크다운 보기 모듈(연결 파일 소유, 01이 만든 것을 블록 그리기로 바꿈).

**설계 계약:**
- 블록 해석 모듈: 명세 "구현 결정"의 "마크다운 블록 해석", AC-13
- 마크다운 보기 모듈: AC-12·AC-13의 수치, 명세 "구현 결정"의 "화면", v1 명세 AC-7(문서 안 링크)
- 링크 동작: v1 `mods/side-viewer/links.js`와 v1 명세 AC-7

**검증 방법:**
- 경계 1: 해석(제목 단계, 목록 단계·번호·체크박스, 빈 줄로 나뉜 다른 종류 목록, 들여 쓴 줄 이어짐, 표 칸 정렬, 인용 안 블록, 줄 하나짜리 그림, 각주 정의, 코드 블록 언어, 목록 항목 아래 코드)
- 경계 3: `herdr-app check mods/side-viewer`
- 경계 4: `docs/features/side-viewer-v2/markdown-sample.md`, v1 명세, README를 열어 확인. 문서 안 링크가 v1처럼 동작하는지

- [x] 폭 제한 없는 13pt 본문과 맨 위 폴더·이름 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 제목·목록·표·구분선·인용·각주가 명세대로 보인다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 문서 안 링크가 v1처럼 동작한다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 코드 블록과 그림 자리가 비지 않는다(임시로 기존 모양) (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)

**완료 조건:** 위 항목 전부, 경계 1·3 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/04-warp-style-blocks`의 `fb1f143`(블록 해석 모듈), `f25a716`(블록 그리기와 문서 맨 위 폴더·이름), `d71ac7c`(저장 전 글로 다시 그릴 때 옛 글을 그리지 않게 블록 id에 글 해시), `00d78d3`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다. 02와 같은 `renderMarkdown` 호출에 `file: this.file` 한 줄만 더해 충돌은 없었다.
- **완료 조건:** 경계 1·3 통과.
  - 작업자(`d71ac7c`): `node --test mods/side-viewer/markdown-blocks.test.mjs` 23 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과. 첫 장면을 모든 블록이 든 마크다운으로 바꾼 임시 사본의 check도 통과했고, 그 사본에 없는 메서드를 넣으면 실패해 check가 블록 그리기를 실제로 거친다는 것도 확인했다.
  - 통합 담당(`00d78d3`): `node --test mods/side-viewer/` 190 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **미실행:** 경계 4(시험 문서·v1 명세·README를 열어 모양과 링크 확인). 티켓 12에서 확인한다.
- **자리(뒤 티켓용):**
  - `mods/side-viewer/markdown-blocks.js`: `parseMarkdown(text)` → `{ blocks, footnotes, references }`. 블록 종류 heading, paragraph, list, quote, table, rule, image, code. 목록 항목은 `{kind: bullet|ordered|task, number?, checked?, blocks}`, 표는 `{align, header, rows}`, 각주 위첨자는 `withFootnoteMarks`. 줄마다 원문 줄 번호(`at`)를 인용·목록 안까지 들고 다니지만 블록에는 아직 내보내지 않는다. 11이 체크박스 항목에 줄 번호 필드를 더한다.
  - `mods/side-viewer/markdown-view.js`: 05는 `renderCodeBlock`(지금 TextView 펜스 블록), 06은 `renderImageBlock`(지금 TextView `![alt](<src>)`), 11은 `renderCheckbox`(모양만). 블록 id는 `side-viewer-md-<generation>-<key>-<글 해시>`.
- **남은 위험(경계 4에서 볼 것):** 제목 크기·굵기, 인용의 흐린 글자, 각주의 작은 글자가 감싼 div에서 TextView로 상속되는지 확인하지 못했다(안 먹으면 제목이 본문 크기로 보인다). TextView 자체 여백 때문에 문단 간격이 벌어질 수 있다. 꾸밈이 든 표 칸(TextView)의 폭. 글이 바뀌면(저장 전 미리 보기) 드래그로 고른 글자가 풀린다.
- **정리할 것:** `markdown-view.js`의 raw 분기(`rawMarkdown` TextView)는 02 통합 뒤 쓰이지 않는다. 원문 전환을 맡는 08이 정리한다.
- **문서 메모(12):** README: 마크다운 보기는 읽기 폭 제한 없이 pane 폭을 쓰고 블록마다 그린다. 수식·HTML 태그·GitHub 알림 상자·정의 목록은 그리지 않는다. RECIPE "Done when" 후보: `markdown-sample.md`에서 제목 4단계 크기, 점 두 단계·번호·체크박스, 빈 줄로 나뉜 목록이 따로 보이는지, 표 정렬과 줄 사이 선, 구분선, 인용 막대, 각주 위첨자와 끝 목록, 문서 맨 위 폴더·이름, 링크(같은 폴더 md는 뷰어, 웹은 브라우저), 참조식 링크 `[x][ref]`.
