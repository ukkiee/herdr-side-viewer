# 01: 머리줄과 보기별 그리기를 main.js에서 떼기

**What to build:** 사이드 뷰어의 동작과 모양은 그대로 두고, `main.js`에서 머리줄 그리기와 보기별(마크다운, 코드, 이미지, 안내) 그리기를 각각의 모듈로 옮긴다. `main.js`는 상태, 읽기, 요청 받기, 감시만 맡는다. 뒤 티켓들이 같은 파일의 같은 자리에서 부딪히지 않게 하는 사전 정리다.

**Blocked by:** None (can start immediately)

**Status:** integrated

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-19, 명세의 "연결 파일" 표)

**파일 소유:** `mods/side-viewer/main.js`(연결 파일 소유), 새 머리줄 모듈(연결 파일 소유), 새 마크다운 보기 모듈(만들기만 하고 소유는 04), 새 코드 보기·이미지 보기·안내 그리기 모듈. 모두 `mods/side-viewer/` 아래.

**설계 계약:**
- `main.js`와 새 모듈들: v1 명세 `docs/features/side-viewer/spec.md`의 "구현 결정"("화면", "기록", "새로고침", "이미지 그리기"), 플랫폼 계약 `~/.config/herdr-app/AGENTS.md`의 UI 절과 `herdr.d.ts`
- 모듈 나누기 자체: 없음(확인한 곳: `AGENTS.md`, `CLAUDE.md`, `docs/adr/`, `docs/agents/`, `GLOSSARY.md`)

**검증 방법:**
- 경계 1: 기존 `node --test mods/side-viewer/` 전부 통과(테스트를 고치지 않고)
- 경계 2: 기존 분기 스크립트 테스트 통과
- 경계 3: `herdr-app check mods/side-viewer`
- 경계 4: 실제 앱에서 마크다운·코드·이미지 하나씩 열어 v1과 같은지 확인(12에서 다시 확인)

- [x] 머리줄과 보기별 그리기가 각자의 모듈에 있고 `main.js`는 그 모듈을 부르기만 한다
- [x] 화면과 동작이 v1과 같다 (diff 대조: 그리기 코드를 인자만 바꿔 그대로 옮김. 실제 앱 확인(경계 4)은 미실행, 12에서 한다)
- [x] 기존 테스트와 check가 그대로 통과한다

**완료 조건:** 위 항목 전부, 경계 1·2·3 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/01-split-header-and-views`의 `da7dae1`(구현)과 `574866a`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다. 통합 tip `574866a`.
- **완료 조건:** 경계 1·2·3 통과. 테스트 파일은 고치지 않았다(`git diff 3366403..da7dae1 -- '*.test.mjs'` 비어 있음).
  - 작업자(`da7dae1`): `node --test mods/side-viewer/` 155 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과.
  - 통합 담당(`574866a`, 통합 브랜치 작업 트리): `node --test mods/side-viewer/` 155 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **미실행:** 경계 4(마크다운·코드·이미지를 실제 앱에서 열어 v1과 비교). `herdr-app check`는 파일 없는 안내 화면만 그리므로 세 보기 모듈은 실제로 그려 보지 못했다. 티켓 12에서 확인한다.
- **새 모듈(뒤 티켓이 고칠 자리):**
  - `mods/side-viewer/header.js`: `renderHeader(t, header)`. `header`는 `{file, canGoBack, state, raw, onBack, onToggleRaw, onOriginal, onFinder}`. 순서는 뒤로 가기 → 이름 → 폴더 → `renderSwitch`(원문 전환) → `renderActions`(원래 앱, Finder). 02의 "저장 안 됨·저장"은 폴더와 `renderSwitch` 사이, 08은 `renderSwitch`, 10의 새 탭은 `renderActions` 맨 앞.
  - `mods/side-viewer/markdown-view.js`: `renderMarkdown(t, {text, raw, generation, onLink})`. 04가 블록 그리기로 바꾸는 곳.
  - `mods/side-viewer/code-view.js`: `renderCode(t, content)`. 편집기 상태는 `main.js`가 읽은 뒤 만든다.
  - `mods/side-viewer/image-view.js`: `renderImage(t, {content, room, onRoom})`. 폭(`room`)은 `main.js`의 `setRoom`이 들고 있다.
  - `mods/side-viewer/notice-view.js`: `renderNotice(t, state)`.
- **문서 메모:** 없음. `install.sh`는 폴더 전체를 복사하므로 새 모듈도 설치된다.
