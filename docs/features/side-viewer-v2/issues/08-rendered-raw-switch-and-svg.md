# 08: "렌더링 | 원문" 전환과 svg

**What to build:** 머리줄의 원문 전환을 "렌더링 | 원문" 두 칸 전환으로 바꾼다(cmd+E 없음). svg도 이 전환을 갖는다. 처음엔 그림이고, 원문은 고칠 수 있는 코드 보기다. 고친 뒤 렌더링으로 바꾸면 고친 svg로 그린 그림이 보인다. svgz는 전환이 없다.

**Blocked by:** 02

**Status:** done

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-12 전환 쪽, AC-18, AC-1과 AC-6의 svg 쪽)

**파일 소유:** 이미지 보기 모듈(01이 만든 것), svg 미리 보기 사본 처리. 연결 파일 자리: 머리줄 모듈의 두 칸 전환 자리, `views.js`의 svg 전환 가능 여부와 svgz.

**설계 계약:**
- 전환과 svg: 명세 "구현 결정"의 "svg 전환", "렌더링 미리 보기", AC-18
- 이미지 보기: v1 명세 "구현 결정"의 "이미지 그리기", `image-copies.js`
- 편집 규칙: 02의 편집 상태 모듈(같은 규칙을 쓴다)

**검증 방법:**
- 경계 1: `views.js`(svg는 전환 가능·고칠 수 있음, svgz는 아님), svg 미리 보기 사본 이름
- 경계 3: `herdr-app check mods/side-viewer`
- 경계 4: 마크다운과 svg에서 두 칸 전환, svg 고친 뒤 그림 확인과 저장, svgz

- [x] 마크다운과 svg 머리줄에 두 칸 전환이 있고 cmd+E는 없다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] svg는 그림으로 시작하고 원문에서 고칠 수 있다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 고친 svg가 저장 전에 그림에 반영된다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] svgz는 그림만 보인다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)

**완료 조건:** 위 항목 전부, 경계 1·3 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/08-rendered-raw-switch-and-svg`의 `6708bc5`(보기 판별: svg 원문·두 칸 전환, svgz는 그림만), `8da9ff1`(svg 미리 보기 사본 이름과 고를 그림), `cd199e6`(두 칸 전환과 svg 원문·미리 보기 연결, markdown-view.js의 쓰이지 않던 raw 분기 정리), `4b17c12`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다. 07·11과 겹친 줄은 작업자가 양쪽을 살려 풀었다(`raw`만 빼고 `onTerminal`·`onCheckbox`는 남김).
- **완료 조건:** 경계 1·3 통과.
  - 작업자(`4b17c12`): `node --test` views·image-copies·links·svg-preview 71 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과, 임시 사본 3개(svg 원문+고친 글, svg 미리 보기 그림, 마크다운 전환)의 check 통과. 전환 칸과 미리 보기를 일부러 깨면 check가 실패했다.
  - 통합 담당(`4b17c12`): `node --test mods/side-viewer/` 295 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **판단(주 진행자):** svg 원문은 긴 줄을 접는다. `GLOSSARY.md`의 "원문 보기"가 마크다운이나 svg의 원문이고 AC-7이 "원문 보기는 긴 줄을 접는다"라서다(AC-18의 "고칠 수 있는 코드 보기"는 고칠 수 있다는 뜻으로 읽었다). 1 MiB 넘는 svg는 글로 읽고 저장할 수 없어 그림만 보이고 전환이 없다. 이름이 `.svgz`인 파일은 안이 평문 svg여도 전환이 없다.
- **자리:** `mods/side-viewer/svg-preview.js`(순수): `PREVIEW_FOLDER`(`data/side-viewer/previews`, 디스크 사본 `images`와 분리, 권한 700), `previewName(file, text)`(사본 이름과 같은 모양이라 `olderCopies`·`staleCopies`로 정리), `pictureOf(content, text, preview)`. `views.js`: `imageState`, `switchable`, `editorOf("svg")` = `{soft_wrap: true, language: "xml"}`. `header.js`: `renderSwitch`가 "렌더링 | 원문" 두 칸. `main.js`: `readImage`·`read`가 svg 글을 읽어 막대·저장 규칙이 같다, `ensurePreview`, `dropOlder(path, under)`, `sweep`이 두 폴더를 정리, `renderBody`의 svg 분기.
- **미실행:** 경계 4(마크다운과 svg에서 두 칸 전환, svg 고친 뒤 그림 확인과 저장, svgz). 티켓 12에서 확인한다.
- **남은 위험(경계 4에서 볼 것):** `image()`가 previews 폴더의 사본을 그리는지, 고친 글이 깨진 svg일 때 무엇이 보이는지(mod 오류 포함), 두 칸 전환의 모양과 밝은 테마 대비, svg 원문에서 cmd+S·저장 버튼·충돌 막대, 미리 보기를 쓰는 동안 잠깐 보이는 "불러오는 중…".
- **리뷰 후보:** `rendered.svg`·`source.svg` 아이콘이 이제 쓰이지 않는다. `links.js`의 `rawMarkdown` 주석이 지금 코드와 맞지 않는다(함수는 `links.test.mjs`가 써서 남김).
- **절차 메모:** 작업자가 `views.test.mjs` 첫 편집을 heredoc·sed로 했다가 커밋 전에 되돌리고 Edit 도구로 다시 썼다(어느 커밋에도 없음). 작업자가 임시 폴더를 `rm -rf $S/$n`으로 지우려다 Claude Code 권한 확인에 걸렸고, 주 진행자가 승인하지 않아 자동 거부된 뒤 작업자가 고쳐 썼다.
- **문서 메모(12):** RECIPE "Done when" 후보: 마크다운·svg 머리줄에 "렌더링 | 원문" 두 칸 전환이 있고 cmd+E가 없다 / svg는 그림으로 열리고 원문에서 고칠 수 있다(xml 색, 줄 접기) / 고친 svg를 렌더링으로 바꾸면 저장 전에 고친 그림이 보이고 파일은 그대로, cmd+S로 저장된다 / svgz에는 전환이 없다. README: 데이터 폴더에 `data/side-viewer/previews/`(고친 svg 미리 보기)가 생기고 30일 정리는 images와 같다.

### 2026-11-12 완료 (주 진행자)

- 리뷰·재검토 모두 통과(마지막 sv2-rv10과 F-2 직접 재검토), 통합 검증(티켓 12·19) 통과, 최종 단계(change-review phase=final: PR 초안·회고 후보, 원본 해시 일치) 완료. 통합 head `d990852`: `node --test mods/side-viewer/` 362 통과·0 실패·0 skip·0 취소, `herdr-app check` 통과. push·PR은 하지 않았다(사용자: "pr 올리기전까지만").
