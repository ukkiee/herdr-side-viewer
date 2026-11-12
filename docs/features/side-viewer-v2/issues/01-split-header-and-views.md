# 01: 머리줄과 보기별 그리기를 main.js에서 떼기

**What to build:** 사이드 뷰어의 동작과 모양은 그대로 두고, `main.js`에서 머리줄 그리기와 보기별(마크다운, 코드, 이미지, 안내) 그리기를 각각의 모듈로 옮긴다. `main.js`는 상태, 읽기, 요청 받기, 감시만 맡는다. 뒤 티켓들이 같은 파일의 같은 자리에서 부딪히지 않게 하는 사전 정리다.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

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

- [ ] 머리줄과 보기별 그리기가 각자의 모듈에 있고 `main.js`는 그 모듈을 부르기만 한다
- [ ] 화면과 동작이 v1과 같다
- [ ] 기존 테스트와 check가 그대로 통과한다

**완료 조건:** 위 항목 전부, 경계 1·2·3 통과.
