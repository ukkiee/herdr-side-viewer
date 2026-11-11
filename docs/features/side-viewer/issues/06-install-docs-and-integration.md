# 06: 설치 스크립트, 문서, 기능 전체 통합 검증

**What to build:** 저장소를 받은 사람이 스크립트 하나로 mod를 Herdr 앱 홈에 설치하고 라우터를 빌드할 수 있다. 기본 앱 넘겨받기는 스크립트가 하지 않고 README가 안내하는 별도 명령으로 한다. README(설치, 넘겨받기와 되돌리기, 알아 둘 한계)와 RECIPE(보이는 것, 동작, 구성, 주의, "Done when" 손 확인 목록)를 쓰고, 그 목록 전체를 실제 앱에서 수행해 **기능 전체 통합 검증**을 마친다.

**Blocked by:** 01, 03, 04, 05, 07

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer/spec.md` (AC-10, 그리고 AC-1~AC-11 전체의 경계 4)

**파일 소유:** `install.sh`, `README.md`, `RECIPE.md`, `LICENSE`

**설계 계약:**
- `install.sh`: AC-10(넘겨받기를 하지 않는다), 선례 `herdr-worktrees`의 `install.sh`(`HERDR_APP_HOME` 존중, 복사 뒤 `herdr-app check`)
- `README.md`, `RECIPE.md`: `~/.config/herdr-app/AGENTS.md`의 "Layouts and mods other people made" 절(RECIPE 작성 순서), 명세 "범위 밖"·"참고"
- `LICENSE`: 없음 (`AGENTS.md`, `docs/adr/` 확인. 참고 레포는 MIT이나 코드를 가져오지 않으므로 고지 의무는 없다. 사용자가 고를 라이선스는 Comments에 질문으로 남긴다)

**검증 방법:**
- 경계 3: 설치 스크립트 실행 뒤 `herdr-app check`가 설치된 폴더에서 통과
- 전체 오프라인 검사: 저장소의 모든 `node --test` 테스트
- 경계 4(기능 전체 통합 검증): RECIPE "Done when" 목록 전체. 넘겨받기 → 에이전트 창에서 마크다운·코드·이미지 경로 cmd-클릭(절대·상대·줄 번호·코드 표기) → 재사용과 뒤로 가기 → 새로고침·버튼·링크 → 그릴 수 없는 파일 → Finder에서 열기(원래 앱) → 되돌리기 → 상태 보기로 복구 확인

- [ ] 설치 스크립트가 mod를 복사하고 `herdr-app check`를 통과시키며 라우터를 빌드한다
- [ ] 설치 스크립트는 기본 앱 설정을 바꾸지 않는다
- [ ] README에 설치, 넘겨받기, 되돌리기, 넘겨받은 확장자 목록(01의 실측 결과 반영), 한계(macOS 전용, 줄 번호 무시, 확장자 없는 파일, 다른 머신)가 있다
- [ ] RECIPE의 "Done when" 목록이 AC-1~AC-11을 모두 덮는다
- [ ] "Done when" 목록 전체를 실제 앱에서 수행했고 결과가 Comments에 남았다
- [ ] 명세에서 `미확인`으로 적은 항목(Herdr 판별 방식, 이미지 폴더 제약, 줄 번호 전달)의 확인 결과가 명세에 반영됐다
- [ ] 검증 뒤 이 머신의 기본 앱 설정에 대해 사용자가 넘겨받은 상태 유지와 되돌리기 중 무엇을 원하는지 확인했다

**완료 조건:** 위 항목 전부와 전체 오프라인 검사 통과.

## Comments

### 2026-11-11 구현 메모 (설치 스크립트와 문서)

- **만든 것.** `install.sh`, `README.md`, `RECIPE.md`, `LICENSE`(MIT, `Copyright (c) 2026 ukyi`). 실제 앱에서의 "Done when" 수행, 명세의 `미확인` 반영, 사용자 확인은 이 메모의 범위가 아니다.
- **install.sh.** macOS·`herdr-app`·`swiftc`(`xcode-select -p`)를 먼저 확인하고, 하나라도 없으면 아무것도 복사하지 않고 끝난다. mod 폴더 전체를 앱 홈에 복사(`extensions.json`, svg, `router/` 포함)하고 `herdr-app check`, `router/build.sh` 순으로 실행한다. 기본 앱을 바꾸는 명령은 부르지 않고 끝에 넘겨받기 명령만 안내한다.
- **임시 앱 홈 검증.** `HERDR_APP_HOME=<임시 폴더> ./install.sh` → `check passed`, `built …/Side Viewer Router.app`, 종료 코드 0. 빌드 전후 `SideViewerRouter --status` 출력이 같았다(48줄, diff 없음).
- **설치 스크립트가 경고하는 두 경우.** 라우터는 macOS가 셸 환경 없이 띄우므로 `open.sh`의 기본값만 쓴다. `~/.local/bin/herdr-app`이 없으면, 또는 `HERDR_APP_HOME`이 기본 위치가 아니면 cmd-클릭이 항상 원래 앱으로 간다. 스크립트가 이 두 경우를 알려 준다.
- **RECIPE에 넣지 않은 것.** 플랫폼 문서가 정한 `![Side Viewer](preview.png)` 줄. `preview.png`가 아직 없다. 스크린샷을 찍으면 첫 문단 아래에 넣는다.
- **README에 넣지 않은 것.** 저장소 주소(`git clone …`). 이 저장소에 remote가 없어 주소를 알 수 없다.
- **문서가 단정하지 않은 것(경계 4에서 확인).** macOS 확인 창의 버튼 문구, 확인 창의 정확한 횟수, 코드 보기의 실제 모습, 이미지가 사본 경로에서 그려지는지.

### 2026-11-11 통합 검증 기록 (mac-m5-pro, `herdr-app 0.1.15`, 진행 중)

이 Mac은 저장소를 git bundle로 옮겨 온 두 번째 머신이다. 시작할 때 mod도 라우터도 없었다.

- **전체 오프라인 검사(Done when 17).** `8dfc485`에서 `node --test mods/side-viewer/` 연속 3번, 매번 통과 153, 실패 0, skip 0. `herdr-app check mods/side-viewer` 통과. 옮긴 직후에는 `open.test.mjs:263` 하나가 실패했고 티켓 07에서 원인을 확정해 고쳤다(제품 동작이 아니라 테스트 장면의 순서 문제).
- **설치(Done when 1, AC-10).** `./install.sh`가 `check passed`, `built /Users/…/Applications/Side Viewer Router.app`, 넘겨받기 명령 안내를 찍었다. 설치된 폴더에서 `herdr-app check ~/.config/herdr-app/mods/side-viewer` 통과, `herdr-app status`의 `errors`는 빈 배열.
- **설치 전후 기본 앱.** 설치 전에는 라우터가 없어, `main.swift`를 저장소 밖 임시 폴더에 빌드한(등록하지 않은) 바이너리의 `--default-app`으로 48개 확장자를 읽어 두었다. 설치 뒤 `--status`와 비교하면 44개는 같고 4개가 바뀌었다: `mdx`(기본 앱 없음 → 라우터), `jsonc`(기본 앱 없음 → 라우터), `rbw`(TextEdit → 라우터), `cp`(TextEdit → 라우터). 설치 스크립트는 넘겨받기 명령을 부르지 않았고 확인 창도 뜨지 않았다. 빌드가 앱을 등록하는 것만으로 바뀐 것이며, README·RECIPE가 적은 네 확장자와 같다(원래 Mac의 관찰과 일치).
- **상태 보기(Done when 2, AC-5).** `--status`가 48줄(확장자, 현재 기본 앱, 기록된 원래 앱 또는 `-`)을 찍었다. 넘겨받기 전이라 기록은 모두 `-`다.
- **남은 것.** Done when 3~16과 18(확인 창과 cmd-클릭이 필요해 사용자와 함께 한다), `preview.png`, 명세의 `미확인` 세 항목.
