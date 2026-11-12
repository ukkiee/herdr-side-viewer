# 06: 마크다운 본문 그림

**What to build:** 줄 하나를 차지하는 로컬 그림(문서 폴더 기준 상대 경로, 절대 경로)을 문서 안에 그린다. pane 폭에 맞추되 원래보다 키우지 않고 높이는 최대 420, 가운데 정렬이다. 읽을 수 없으면 "그림을 못 읽음: <경로>"를 보여 준다.

**Blocked by:** 04

**Status:** integrated

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-14)

**파일 소유:** 새 본문 그림 경로 풀기·크기 맞춤 모듈과 그 테스트. 연결 파일 자리: 마크다운 보기 모듈의 그림 자리. v1 `mods/side-viewer/image-copies.js`는 쓰기만 하고 고치지 않는다(고쳐야 하면 Comments에 이유를 남긴다).

**설계 계약:**
- 경로 풀기·크기 맞춤: 명세 "구현 결정"의 "본문 그림", AC-14
- 사본: v1 명세 "구현 결정"의 "이미지 그리기", `image-copies.js`의 머리 바이트 확인·사본 이름·30일 정리

**검증 방법:**
- 경계 1: 상대·절대 경로 풀기(`..` 포함), 원격 주소 제외, 맞춤 크기(폭, 420, 원래 크기)
- 경계 3: `herdr-app check mods/side-viewer`
- 경계 4: `docs/features/side-viewer-v2/markdown-sample.md`의 그림, 없는 그림 경로

- [x] 로컬 그림이 문서 안에 맞춤 크기로 보인다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 읽을 수 없는 그림은 안내가 보이고 오류가 없다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 원격 그림은 그리지 않는다(범위 밖) (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)

**완료 조건:** 위 항목 전부, 경계 1·3 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/06-images-in-markdown`의 `f3e4390`(경로 풀기·크기 맞춤 순수 모듈), `5307ca9`(사본 loader·그림 자리·main.js 연결), `a1c67fe`·`2e41359`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다. 05와 같은 줄(`renderMarkdown` 호출, ctx, `edited`)을 고쳐 충돌했고, 작업자가 새 tip을 병합하며 양쪽 줄을 모두 살렸다.
- **완료 조건:** 경계 1·3 통과.
  - 작업자(`2e41359`): `node --test` markdown-images·image-copies·markdown-blocks·code-blocks 65 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과, 첫 장면에 그림 다섯 상태(준비됨, 실패, 원격, 목록 안 대기, 크기 모름)와 `sh` 코드 블록을 함께 넣은 임시 사본의 check 통과(05 카드와 06 그림을 한 장면에). 그림 준비 분기를 일부러 깨면 check가 실패했다.
  - 통합 담당(`2e41359`): `node --test mods/side-viewer/` 232 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **결정(주 진행자 수용):** 원격(스킴이 있거나 `//`로 시작) 그림은 안내 없이 그리지 않는다. TextView에 그대로 두면 주소를 받아와 그릴 수 있어(미확인) 범위 밖 조건을 어기고 파일만 열어도 네트워크 요청이 나갈 수 있어서다. 문단 속 그림은 TextView에 그대로 둔다(범위 밖).
- **미실행:** 경계 4(`markdown-sample.md` 64행 그림, 없는 그림 경로, 좁은 pane). 티켓 12에서 확인한다.
- **자리:** `mods/side-viewer/markdown-images.js`(순수): `imageFileOf(src, file)`, `imageBoxOf(size, room)`(`MAX_HEIGHT` 420, 원래보다 키우지 않음), `imagesOf(blocks)`. `mods/side-viewer/markdown-image-loader.js`: `MarkdownImages`(`prepare`, `forDocument`). v1과 같은 사본 흐름(PROBE → `blockerOf` → `kindOf` → `copyName` → `COPY` → `sizeOf`), 30일 정리와 옛 사본 지우기는 main.js의 `sweep`·`dropOlder`를 함께 쓴다. `image-copies.js`는 고치지 않았다.
- **남은 위험(경계 4에서 볼 것):** 블록 폭 보고 전까지 그림 자리 높이가 0이라 처음 열 때 그림이 뒤늦게 나온다. 그림 파일만 바뀌고 문서 글이 그대로면 문서를 다시 열거나 글이 바뀔 때까지 옛 그림이 남는다(문서를 연 뒤 생긴 그림 파일도 같다). 원격 그림 자리에 빈 블록 하나만큼 간격이 남는다.
- **문서 메모(12):** README: 마크다운 본문의 줄 하나짜리 로컬 그림은 데이터 폴더 사본으로 그리고 이미지 보기와 같은 30일 규칙을 따른다. 원격 그림과 문단 속 그림은 그리지 않는다. RECIPE "Done when" 후보: 시험 문서의 그림, 없는 경로의 "그림을 못 읽음: <경로>", 좁은 pane에서 그림이 줄어드는지.
