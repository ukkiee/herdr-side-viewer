# 인계: 사이드 뷰어 구현 (2026-11-11)

이 문서는 다른 머신에서 `/feature-build`를 이어가기 위한 것이다. 원래 작업은 `ukyi`의 다른 Mac(Herdr의 "This computer", 경로 `~/workspace/herdr-md`)에서 했고, 이 저장소는 git bundle로 옮겨 왔다. 원격 저장소는 없다.

## 지휘 스킬 단계

- 실행 중인 스킬: `feature-build`(직접 호출 `/feature-build`로 시작한다. Skill 도구로 부르지 않는다).
- 커밋 질문의 답: **"커밋·브랜치·worktree까지", 작업이 끝나면 worktree 정리.** 다시 묻지 않는다.
- 진행 단계: 구현(티켓 01~06의 코드·문서) 통합 완료 → `phase=review` 완료 → 수정 → `phase=re-review` 판정 **통과** → 재검토의 Minor 2건 수정(`0cbbaeb`) → **지금: 기능 전체 통합 검증(티켓 06의 실제 앱 확인)** → 남은 것: `phase=final`, 티켓 `Status: done`, 정리.
- 통합 기준: 브랜치 `feat/side-viewer`, 기준 SHA `e22ae7b`(`main`). 인계 시점의 head는 이 문서를 넣은 커밋이고, 코드의 마지막 변경은 `0cbbaeb`다.
- 티켓 상태: 01~05 `integrated`, 06 `ready-for-agent`(설치 스크립트·문서는 통합됨, 실제 앱 확인이 남음).
- 원본 해시 대조는 새 실행이므로 다시 한다.

## 승인 범위

- 커밋: 통합 브랜치와 티켓별 브랜치·worktree에 커밋 허용. 작성자는 `ukkiee <ukkiee90@gmail.com>`(이 저장소의 로컬 git 설정). 커밋 메시지에 도구·에이전트 귀속 문구를 넣지 않는다.
- push, PR, 원격 저장소 생성: **승인받지 않았다.** 하지 않는다.
- 이 Mac의 기본 앱 설정을 바꾸는 명령(`--make-default`, `--restore`, `--set-default-app`): 원래 Mac에서는 사용자가 허락했다. 새 Mac에서는 확인 창이 사용자에게 뜨므로 **실행 전에 사용자에게 알리고 무엇을 누를지 안내한다.**
- 작업 위임: 내장 서브에이전트 대신 **Herdr 작업자**(herdr-parallel 절차, hc 백엔드)를 쓴다. `herdr-core` 스킬이 이 Mac에 없으면 `bunx skills add herdrdev/herdr-core --skill herdr-core -g -y`로 설치해야 하고, 설치는 사용자에게 먼저 묻는다.
- Herdr 창을 화면 자동화로 조작하지 않는다(원래 Mac에서 사용자의 입력과 충돌했다).

## Herdr 소유 기록

- 백엔드: `hc`. 이번 실행이 띄운 작업자는 모두 결과를 회수하고 종료했다(구현 3, 리뷰 3, 수정 2, 재검토 1). 남은 작업자: **없음.**
- `profile-setup-notice: setup`(프로필 미설정 안내를 이미 한 번 했다).

## 실제 앱에서 확인된 것 (원래 Mac, 사용자 확인)

- cmd-클릭이 에이전트 창에서 절대·상대·줄 번호·코드 표기 경로를 모두 기본 앱으로 넘긴다.
- 넘겨받기로 확장자 30개가 라우터로 바뀌었고, 확인 창은 파일 종류마다 한 번씩 뜬다(약 26번, 같은 종류는 한 창).
- 확인 창에서 "유지"를 고르면 요청이 `The file couldn’t be opened.`로 끝나고 기본 앱은 그대로다. 원래 앱을 고르면 3초 만에 바뀐다(`json` → WebStorm으로 확인).
- 사용자가 "잘되는 거 확인했다"고 한 것: cmd-클릭으로 사이드 뷰어가 열린다(01~05 통합본, 어느 항목까지 봤는지는 구체적으로 받지 못했다).
- **다른 머신의 터미널에 나온 경로는 cmd-클릭으로 열리지 않는다**(사용자 확인). mod가 설치되지 않은 Mac에서 사이드 뷰어 pane이 있는 탭을 보면 `no mod folder ~/.config/herdr-app/mods/side-viewer` 오류가 보인다.

## 남은 일

### 1. 이 Mac에 설치

`./install.sh`를 실행한다(mod 복사, `herdr-app check`, 라우터 빌드. 기본 앱은 바꾸지 않는다). 이 Mac에는 아직 mod도 라우터도 없다. 설치 전후 `--status`를 비교해 둔다.

### 2. 확인 창이 필요 없는 실제 확인 8가지 (사용자가 직접 클릭)

시험 파일을 만든다(저장소에 커밋하지 않는다. `verify/`는 추적하지 않는 폴더로 두고 끝나면 지운다):

- `verify/links.md`: 상대 링크(`sub/other.md`), `https` 링크, 로컬 스크립트 링크(`run.sh`)가 든 문서. `verify/sub/other.md`는 `../links.md`로 돌아가는 링크.
- `verify/sample.jsx`(코드), `verify/table.csv`(색 없는 글), `verify/picture.webp`(이미지. `~/.config/herdr-app/update-notes-media/`의 파일을 복사하면 된다).
- `verify/empty.md`(빈 파일), `verify/big.md`(1 MB 초과), `verify/fake.png`(글자만 든 파일).
- `verify/live.md`: 5초마다 한 줄씩 덧붙이는 백그라운드 작업을 돌린다. `verify/vanish.md`: 20초 간격으로 지웠다 다시 만든다. 사용자가 준비됐다고 할 때 시작한다(원래 Mac에서는 사용자가 보기 전에 8분짜리 작업이 끝나 버렸다).

확인 항목(RECIPE.md "Done when"의 6~13번에 대응): 자동 새로고침(깜박임·스크롤 튐 없음), 삭제 안내와 복원, 링크 세 종류(스크립트는 Finder 위치만), 코드와 색 없는 글, 이미지와 좁힐 때 축소, 안내 세 가지와 빈 문서의 머리줄 버튼 둘, 머리줄 버튼 세 개, 다른 탭에서 새 pane.

**이 단계는 마크다운 묶음이 넘겨받아져 있어야 cmd-클릭으로 열린다.** 그래서 3번의 `--make-default`(마크다운·이미지)를 먼저 해야 한다. 코드 파일(`sample.jsx`, `table.csv`)은 `--make-default code`를 하지 않았다면 cmd-클릭 대신 뷰어를 직접 여는 명령으로 확인하거나 사용자에게 `code` 묶음을 넘겨받을지 묻는다.

### 3. 확인 창이 뜨는 확인 (사용자에게 미리 알린다)

- `--make-default`: 먼저 `macOS 확인 창이 N번 뜹니다.`가 찍히는지, 실제 창 수가 N과 같은지. 한 창에서는 "유지"를 골라 `유지를 선택함` 줄과 종료 코드 3, 표준 오류의 `[domain code]` 값을 기록한다(CO-3: 이 값으로 "유지"와 다른 실패를 구분하도록 `main.swift`와 `takeover.sh`를 고칠지 정한다).
- 형제 규칙: 빌드만으로 라우터가 쥐게 된 확장자(원래 Mac에서는 `rbw`, `cp`)를 `--restore`가 형제의 앱으로 돌리는지와, 그때 형제(`rb`, `cpp`)의 기본 앱이 바뀌지 않는지. 전체 되돌리기는 창이 많으므로 사용자와 범위를 정한다.
- Finder에서 넘겨받은 파일을 열면 원래 앱에서 열리는지(AC-4).

### 4. 마무리

- 확인 결과를 티켓 06의 Comments에 적고 체크박스를 채운다. 명세의 `미확인`(Herdr 판별 방식, 이미지 폴더 제약, 줄 번호 전달)을 확인된 사실로 고친다.
- `preview.png`: 사이드 뷰어가 열린 화면을 `herdr-app shot`으로 찍어 저장소 루트에 두고, `RECIPE.md` 첫 문단 아래에 `![Side Viewer](preview.png)`를 넣는다(리뷰 SP-3/ST-2).
- 코드를 고쳤으면 영향 범위를 재검토한 뒤 `change-review`를 `caller=feature-build`, `phase=final`로 부른다. 통과하면 티켓 01~06을 `Status: done`으로 기록한다.
- `feat/side-viewer`를 `main`에 합칠지는 사용자에게 묻는다(승인받지 않았다).

## 리뷰 기록 요약

- 최초 리뷰(세 관점): Blocking 없음. Important 1건(CO-1: 되돌리기가 넘겨받지 않은 종류를 TextEdit으로 요청)과 Minor 여럿 → `1738b80..1998a64`에서 14묶음 수정.
- 재검토: 판정 **통과**(미검증 범위: 실제 앱 확인 8항목). 신규 Minor 2건(RE-1, RE-2) → `0cbbaeb`에서 수정. 이 작은 수정은 주 진행자가 diff를 읽어 확인했다.
- 합의로 보류한 것: CO-3("유지"와 실패의 구분, 실제 오류 코드 관측 뒤 결정), `preview.png`, 번들 ID 문자열의 세 곳 중복, 감시 판단 모듈 분리, Linux용 갈래, `fallback` 이름, RECIPE의 명령 표기.
- 리뷰어와 작성자가 같은 모델 계열(Claude)이었다는 한계가 있다.
- 마지막 검사: `node --test mods/side-viewer/` 통과 152, 실패 0, skip 0. `herdr-app check mods/side-viewer` 통과(`0cbbaeb`).

## 알아 둘 사실

- `herdr-app check`는 mod 폴더에 `gpui-kit.d.ts`와 `jsconfig.json`을 쓴다. `.gitignore`에 있다.
- mod는 확장자 목록을 앱 홈의 `mods/side-viewer/extensions.json`에서 실행 중에 읽는다. 설치되지 않은 상태에서는 모든 파일이 "열 수 없습니다" 안내가 된다.
- 라우터는 `herdr-app`을 `$HOME/.local/bin/herdr-app`에서만 찾는다(이 Mac에는 그 경로가 있다).
- 원래 Mac은 확장자 31개가 라우터에 넘어간 채로 두었다(사용자 합의). 그 Mac을 되돌리는 것은 그 Mac에서 `--restore`로 한다.

## 다음 기능 후보 (이번 범위 아님)

사용자가 다른 머신의 파일도 사이드로 열고 싶어 한다. cmd-클릭은 원격 경로에 통하지 않으므로, 사용자가 고른 방향은 **사이드 뷰어 안의 경로 목록을 마우스로 눌러 여는 방식**이다(목록이 길어질 때의 대책: 중복 제거와 최근순, 처음 5~8개만 표시, 열 수 있는 종류만, 필터, 평소에는 머리줄에 접어 둠). 뷰어의 원격 파일 읽기(`readTextFile`의 `on`, 주기적 재확인, 원격 이미지 가져오기)도 필요하다. 이번 구현이 끝난 뒤 `/feature-plan`으로 따로 계획한다. Herdr에 "터미널 경로 클릭을 mod가 받는 이벤트"를 요청하는 것(`herdr-app feedback`)도 사용자에게 제안해 두었다.

## 이 Mac(mac-m5-pro)에서 먼저 볼 것: 테스트 1개 실패

옮긴 직후 이 Mac에서 `node --test mods/side-viewer/`를 돌리면 152개 중 1개가 실패한다(원래 Mac에서는 3번 모두 통과, 이 Mac에서는 3번 모두 실패. Node v26.13.0).

- 테스트: `mods/side-viewer/open.test.mjs:263` "a viewer that wakes after Herdr was given up on does not take the file as well"
- 증상: `w.openArgs()`가 `["-b", "com.apple.TextEdit", "/work/notes/plan.md"]`이어야 하는데 `[]`다. 즉 `herdr-app`이 5초 멈추고 `SIDE_VIEWER_TIMEOUT=1`인 상황에서 원래 앱이 불리지 않았다.
- 원인은 확정하지 않았다. 시간에 기대는 테스트라 머신 속도·`sleep` 정밀도 차이일 수도 있고, `open.sh`의 응답 대기와 시간 제한 사이에 실제 경합이 있을 수도 있다(AC-11 "클릭을 잃지 않는다"와 관련). 통합 검증 전에 `원인 확정 → 결정 → 수정` 순서로 다룬다. 원인을 모른 채 테스트만 느슨하게 고치지 않는다.
