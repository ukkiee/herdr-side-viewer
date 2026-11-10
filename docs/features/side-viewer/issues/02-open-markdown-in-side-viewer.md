# 02: 마크다운을 사이드 뷰어로 열기

**What to build:** 에이전트 대화의 마크다운 경로를 cmd-클릭하면 포커스된 pane 오른쪽에 사이드 뷰어가 생기고 렌더링된 문서를 보여 준다. 라우터가 분기 스크립트를 부르고, 스크립트는 Herdr가 앞에 있으면 사이드 뷰어 pane을 열고, 아니면 원래 앱으로 넘긴다. `herdr-app`이 없거나 명령이 오류를 내도 원래 앱으로 넘긴다. 뷰어는 머리줄(파일 이름, 폴더)과 본문, "불러오는 중…"·빈 파일 안내를 가진다.

**Blocked by:** 01

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer/spec.md` (AC-1, AC-4, AC-11)

**파일 소유:** `mods/side-viewer/main.js`, `mods/side-viewer/mod.json`, `mods/side-viewer/open.sh`와 그 테스트. 라우터가 분기 스크립트를 부르도록 `mods/side-viewer/router/`의 호출부만 고친다(01의 소유, 01 완료 뒤).

**설계 계약:**
- `mods/side-viewer/main.js`, `mod.json`: `~/.config/herdr-app/AGENTS.md`의 "Mods" 절과 `herdr.d.ts`(플랫폼 계약), 명세 "구현 결정"의 화면·플랫폼 제약 항목
- `mods/side-viewer/open.sh`: 명세 "구현 결정"의 "분기는 스크립트가 한다"·"Herdr 판별"·"뷰어에 넘기는 약속", `docs/adr/0001-cmd-click-through-a-default-app-router.md`

**검증 방법:**
- 경계 2: 가짜 `herdr-app`·`open`으로 분기 스크립트를 실행해 (a) Herdr가 앞이면 오른쪽 분할 명령, (b) 다른 앱이 앞이면 원래 앱, (c) `herdr-app` 없음·명령 오류면 원래 앱이 불리는지 확인
- 경계 3: `herdr-app check mods/side-viewer`
- 경계 4: 실제 앱에서 마크다운 경로 cmd-클릭

- [ ] Herdr가 앞이고 탭에 사이드 뷰어가 없을 때 마크다운 파일이 오른쪽 새 pane에 렌더링되어 보인다
- [ ] Herdr가 앞이 아닐 때 같은 파일이 원래 앱에서 열리고 사이드 뷰어는 열리지 않는다
- [ ] `herdr-app`이 없거나 명령이 오류를 내면 원래 앱에서 열린다
- [ ] 읽는 동안 "불러오는 중…", 빈 파일이면 "이 파일은 비어 있습니다."가 보인다
- [ ] `herdr-app check`가 통과한다

**완료 조건:** 위 항목 전부, 경계 2 테스트와 경계 3 통과, 경계 4의 해당 항목 확인.

## Comments
