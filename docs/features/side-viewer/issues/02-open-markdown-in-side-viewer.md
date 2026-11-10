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

### 2026-11-11 구현 메모

- **분기 스크립트 약속.** `open.sh <파일> <앞에 있던 앱>`. 환경 변수(모두 선택): `SIDE_VIEWER_HERDR_APP`(기본 `$HOME/.local/bin/herdr-app`), `SIDE_VIEWER_DATA`, `HERDR_APP_HOME`, `SIDE_VIEWER_TIMEOUT`(초, 기본 5). 여는 명령은 `herdr-app do pane.split --direction right --mod side-viewer --props '{"file":"<경로>"}'`.
- **원래 앱으로 넘기는 경우.** 앞에 있던 앱이 Herdr가 아님, `herdr-app` 없음, mod가 Herdr 앱 홈(`mods/side-viewer/main.js`)에 설치돼 있지 않음, 경로에 제어 문자가 있음, 명령이 종료 코드 0이 아니거나 출력에 `"error"`가 있음, 5초 안에 끝나지 않음.
- **명세에 없던 추가 두 가지.** (1) mod 미설치 검사: 라우터만 빌드되고 mod가 아직 설치되지 않은 지금 같은 상태에서 클릭이 깨진 pane으로 가지 않게 한다. (2) 시간 제한: 명세 "Herdr 무응답"을 스크립트에서 지키려고 넣었다. 시간 초과로 포기한 뒤 Herdr가 늦게 pane을 만들면 뷰어와 원래 앱이 둘 다 열릴 수 있다.
- **Herdr 판별(명세의 `미확인`).** 이 머신에서 실행 중인 Herdr는 `lsappinfo` 기준 번들 경로 `/Users/…/Applications/Herdr.app`, 번들 ID `dev.herdr.app`을 보고한다. 경로 판별(`*Herdr.app*`)과 맞는다. 라우터가 실제 cmd-클릭 때 받는 값은 경계 4에서 확인해야 한다.
- **`herdr-app check`의 한계.** 첫 그리기만 본다. 파일 없이 뜨므로 "열 파일이 없습니다." 화면만 검사된다. 마크다운 그리기 경로는 첫 그리기에 마크다운을 넣은 임시 사본으로 따로 check를 통과시켜 확인했다(저장소에는 남기지 않음).
- **미검증.** 경계 4(실제 cmd-클릭, 새 pane의 모습, "불러오는 중…"이 실제로 보이는지, 1 MiB를 넘는 파일을 `readTextFile`이 어떻게 돌려주는지).
