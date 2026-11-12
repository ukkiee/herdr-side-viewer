# 14: 빈 마크다운·svg에 안내를 보이고 원문을 고를 수 있게 하기

**What to build:** 비었거나 공백뿐인 마크다운·svg 파일은 머리줄에 "렌더링 | 원문" 전환이 있고, 렌더링 쪽은 "이 파일은 비어 있습니다." 안내를 보인다. 원문을 고르면 빈(또는 그 공백의) 편집기가 열려 바로 쓸 수 있고(svg는 색상 언어 `xml`), 쓴 뒤 렌더링으로 바꾸면 쓴 글로 그린 문서·그림이 보인다. 빈 코드 파일은 티켓 13대로 빈 편집기다. 빈 svgz·그림은 안내만이다.

**Blocked by:** 13 (integrated)

**Status:** ready-for-agent

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

- [ ] 빈·공백뿐인 md의 렌더링에 안내와 전환이 있고 원문에서 써서 저장할 수 있다
- [ ] 빈·공백뿐인 svg의 렌더링에 안내와 전환이 있고 원문(xml)에서 써서 렌더링하면 그림, cmd+S로 저장된다
- [ ] 빈 svgz·그림은 안내만이고 빈 코드 파일은 빈 편집기 그대로다
- [ ] 고친 md·svg가 밖에서 비게 되거나 돌아올 때 F1·RV2-1 규칙이 깨지지 않는다
- [ ] 문서의 빈 파일 문장이 새 동작과 맞다

**완료 조건:** 위 항목 전부, 경계 1·3 통과.
