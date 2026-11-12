# 14: 빈 마크다운·svg에 안내를 보이고 원문을 고를 수 있게 하기

**What to build:** 비었거나 공백뿐인 마크다운·svg 파일은 머리줄에 "렌더링 | 원문" 전환이 있고, 렌더링 쪽은 "이 파일은 비어 있습니다." 안내를 보인다. 원문을 고르면 빈(또는 그 공백의) 편집기가 열려 바로 쓸 수 있고(svg는 색상 언어 `xml`), 쓴 뒤 렌더링으로 바꾸면 쓴 글로 그린 문서·그림이 보인다. 빈 코드 파일은 티켓 13대로 빈 편집기다. 빈 svgz·그림은 안내만이다.

**Blocked by:** 13 (integrated)

**Status:** done

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-22, AC-1·AC-19의 빈 파일 문장, "구현 결정"의 "빈 파일(AC-22)")

**결정 근거:** 2026-11-12 손 확인 중 사용자: "empty.md도 안내는 해주되 고를 수 있게 해주는게 좋을거 같아. svg도 렌더링 원문 보이게". 티켓 13(빈 md를 안내 없이 빈 문서로)을 고친 결정이다.

**파일 소유:** `mods/side-viewer/views.js`와 그 테스트(빈 svg 판단, 연결 파일 자리), `mods/side-viewer/main.js`의 읽기·렌더링 분기 자리(빈 svg의 원문, 빈 문서의 렌더링 안내), `mods/side-viewer/markdown-view.js`의 빈 문서 렌더링 자리, `mods/side-viewer/image-view.js`·`svg-preview.js`의 필요한 자리, 그 테스트, README.md·README.ko.md·RECIPE.md의 빈 파일 문장.

**설계 계약:**
- 빈 파일 판단: 티켓 13의 `views.js`(`blockerOf`), `document.js`(`contentOf`), v1 명세 AC-9
- svg 원문·미리 보기: 티켓 08의 `views.js`(`imageState`·`switchable`·`editorOf`), `svg-preview.js`(`pictureOf`), `main.js`(`readImage`·`ensurePreview`·`renderBody`의 svg 분기)
- 편집 상태와 돌아오기: 티켓 02·03, 리뷰 F1·RV2-1의 `editedContentOf`
- 안내 문구: `document.js`의 `noticeFor("empty")`, `notice-view.js`

**검증 방법:**
- 경계 1: 0바이트·공백뿐인 md → 마크다운 보기(전환 있음), 0바이트·공백뿐인 svg → svg 보기(전환 있음, 원문 편집 가능, 그림 없음), svgz·png 0바이트 → 안내, 빈 렌더링이 안내를 보일지 정하는 순수 판단
- 경계 3: `herdr-app check mods/side-viewer`와 빈 md 렌더링(안내+전환), 빈 svg 렌더링(안내+전환), 빈 svg 원문 장면의 임시 사본 check
- 경계 4: `~/sv2-check/empty.md`와 `empty.svg`를 열어 안내와 전환, 원문에 써서 렌더링·cmd+S(12에서 다시 확인)

- [x] 빈·공백뿐인 md의 렌더링에 안내와 전환이 있고 원문에서 써서 저장할 수 있다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 빈·공백뿐인 svg의 렌더링에 안내와 전환이 있고 원문(xml)에서 써서 렌더링하면 그림, cmd+S로 저장된다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 빈 svgz·그림은 안내만이고 빈 코드 파일은 빈 편집기 그대로다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 고친 md·svg가 밖에서 비게 되거나 돌아올 때 F1·RV2-1 규칙이 깨지지 않는다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 문서의 빈 파일 문장이 새 동작과 맞다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)

**완료 조건:** 위 항목 전부, 경계 1·3 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/14-empty-notice`의 `ba576d5`(빈 md·svg 렌더링에 안내, 빈 svg는 원문만 있는 svg로), `dd9945b`(README·README.ko·RECIPE)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다.
- **완료 조건:** 경계 1·3 통과.
  - 작업자(`dd9945b`): `node --test mods/side-viewer/` 309 통과·0 실패·0 skip, `herdr-app check` 통과, 임시 사본 3개(빈 md 렌더링, 빈 svg 렌더링, 빈 svg 원문) check 통과. 새·바뀐 테스트 6개는 기준(`e18230e`)에서 실패했다. 안내·전환·원문 편집기 분기에 throw를 넣은 사본 5개는 check가 실패했다.
  - 통합 담당(`dd9945b`): `node --test mods/side-viewer/` 309 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **자리:** `views.js`의 `rendersEmpty(text)`, `blankSvg(file, probe)`(0바이트이거나 ASCII 공백뿐인 `.svg`, probe의 첫 4096바이트 안에서만 판단), `sourceOnlySvg(text)`, `blockerOf(found, probe, file)`. `main.js`의 `read`(blank svg는 글을 읽어 원문만 있는 svg), `ensurePreview`·`renderBody`(빈 글이면 안내). `markdown-view.js`의 빈 문서 안내.
- **바꾼 기존 테스트 기대:** `views.test.mjs`의 0바이트 `logo.svg`가 "empty"였던 기대를 `null`로.
- **동작 변화(손 확인에 넣음):** 고친 svg가 밖에서 0바이트가 되면 이제 "밖에서 바뀌었습니다" 막대가 뜬다(md·코드와 같아짐).
- **경계 사례:** 4096바이트를 넘는 공백뿐인 svg, NBSP 같은 비ASCII 공백뿐인 svg는 blank로 보지 않아 "열 수 없음" 안내가 나온다.
- **미실행(경계 4):** 빈 md·svg의 안내와 전환, 원문에 써서 렌더링(svg 미리 보기), 0바이트 파일 cmd+S(리뷰 R13-1과 같은 위험).

### 2026-11-12 리뷰 (주 진행자)

- **리뷰(`e18230e..dd9945b`, 새 컨텍스트 리뷰어 sv2-rv5):** 통과. 보고서: 실행 scratchpad의 `review/review14.md`.
- **판정:** R14-1(4 KiB를 넘는 공백뿐인 svg·비ASCII 공백 svg는 "열 수 없음") → 코드는 두고 명세 "빈 파일(AC-22)"에 판단 범위를 적음. R14-2(고친 글을 다 지우면 렌더링에 "비어 있음") → AC-6과 같은 규칙으로 명세에 적음. R14-Q1(명세 "상태와 실패"의 티켓 13 시절 문장) → 고침. R14-Q2(RECIPE "never on a notice" 문구) → 손 확인 뒤 README 문장(RV3-1~3)·preview.png 교체와 함께 고친다. 선택 개선 R14-O1·R14-O2는 남긴다.
- **확인:** 고친 svg가 밖에서 비면 막대가 뜨는 동작 변화는 AC-4에 맞다(전 동작이 AC-4를 어겼다).
- **실제 앱 필요:** 0바이트 md·svg·코드에서 cmd+S(R13-1), 빈 md·svg 안내 모양, 원문에 써서 렌더링한 미리 보기, 밖에서 비었을 때 막대.

### 2026-11-12 완료 (주 진행자)

- 리뷰·재검토 모두 통과(마지막 sv2-rv10과 F-2 직접 재검토), 통합 검증(티켓 12·19) 통과, 최종 단계(change-review phase=final: PR 초안·회고 후보, 원본 해시 일치) 완료. 통합 head `d990852`: `node --test mods/side-viewer/` 362 통과·0 실패·0 skip·0 취소, `herdr-app check` 통과. push·PR은 하지 않았다(사용자: "pr 올리기전까지만").
