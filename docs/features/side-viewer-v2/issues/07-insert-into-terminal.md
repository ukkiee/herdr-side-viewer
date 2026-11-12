# 07: 셸 블록을 터미널에 넣기

**What to build:** 셸 계열 코드 블록 카드의 `>_` 버튼을 누르면 뷰어 아래에 셸 pane을 열고 명령을 입력 칸에 넣는다. Enter는 누르지 않고 클립보드는 바뀌지 않는다. 셸 폴더는 옆 대화 터미널의 폴더(뷰어 탭이면 문서 폴더)이고, 다시 누르면 살아 있는 같은 셸 pane에 넣는다. 셸이 다른 프로그램을 실행 중이면 넣지 않고 이유를 알린다.

**Blocked by:** 05

**Status:** integrated

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-16)

**파일 소유:** 새 터미널 넣기 모듈(순수 결정 부분)과 그 테스트, 그 모듈의 Herdr 호출 부분. 연결 파일 자리: 코드 카드 모듈의 `>_` 버튼 자리.

**설계 계약:**
- 터미널 넣기 모듈: 명세 "구현 결정"의 "터미널에 넣기", AC-16, `hc --skill`과 `herdr-app --skill`의 명령 설명(`pane.split`, `hc get`, `hc keys`)
- 넣는 방법: 없음(확인한 곳: `AGENTS.md`, `CLAUDE.md`, `docs/adr/`, `docs/agents/`, `GLOSSARY.md`). 첫 단계 실측 결과를 이 티켓 Comments에 남긴다

**검증 방법:**
- 첫 단계: 클립보드 없이 Enter 없이 셸 입력 칸에 넣는 방법을 실측한다(후보: `hc keys`, zsh `print -z`). 조건을 채우는 방법이 없으면 구현을 멈추고 사용자에게 묻는다.
- 경계 1: 폴더 결정(대화 옆, 뷰어 탭), 셸 pane 재사용 판단, 바쁨 판단, 실행할 명령 목록
- 경계 4: 입력 칸에 들어가고 실행되지 않는지, 클립보드가 그대로인지, 두 번째 누름이 같은 pane에 가는지, 바쁜 셸(오래 도는 명령 실행 중)에서 넣지 않고 이유가 보이는지

- [x] 첫 단계 실측 결과가 Comments에 있다
- [x] 셸 계열 블록에만 `>_`가 있다 (경계 1·3과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 명령이 입력 칸에 들어가고 Enter·클립보드 변화가 없다 (백그라운드 zsh 실측과 경계 1. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 폴더와 pane 재사용이 명세대로다 (경계 1과 코드 대조. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 바쁜 셸에는 넣지 않고 이유를 알린다 (경계 1과 코드 대조. 바쁜 셸 재현은 12에서 사용자에게 보여 준다)

**완료 조건:** 위 항목 전부, 경계 1 통과.

## Comments

### 2026-11-12 첫 단계 실측(주 진행자, 구현 전)

hc 0.1.20의 백그라운드 zsh 터미널(`hc run --bg`, 로그인 셸 `/bin/zsh -l`)에서 시험했다. Herdr 창은 건드리지 않았다.

- **`hc keys`로 한 글자씩: 조건을 채우지 못한다.** 영문자·숫자·공백(`space`)·`'`·`` ` ``·`- / . = , ; [ \`는 들어가지만 `"` `|` `$` `>` `&` `~`와 한글은 `unknown key`로 거부된다. `shift+4`는 `$`가 아니라 `4`를 넣는다(shift는 영문자에만 걸린다).
- **`hc send`로 `print -z`: 조건을 채운다.** `hc send <t> " print -z -- '<명령, '는 '\''로>'"`를 보내면 `print -z` 줄만 실행되고, 다음 프롬프트의 입력 칸에 명령이 그대로 들어간 채 실행되지 않는다. 시험 명령 `echo "a b" | wc -c > /dev/null; ls $HOME ~ 한글 & echo 'q' \`pwd\``가 글자 그대로 들어갔다. 시험 전후 `pbpaste`의 해시가 같아 클립보드는 바뀌지 않았다(`hc send`는 터미널 입력으로 붙여 넣는다).
- **남는 흔적:** `print -z …` 줄이 화면 기록에 한 줄 남는다. 앞에 공백을 두면 이 Mac의 zsh(`histignorespace` 켜짐)에서는 셸 기록에 남지 않는다. zsh 전용이다(bash·fish는 같은 방법이 없다).
- **바쁨 판단:** zsh는 hc 상태(`status`)를 보고하지 않아 `hc get`의 `status`는 늘 `null`이다. 대신 `hc get --json`의 `foreground`가 가른다: 쉬는 셸은 `foreground.name`이 `zsh`(`argv` `["/bin/zsh","-l"]`), `sleep 20` 실행 중에는 `foreground.name`이 `sleep`이다.
- **주의(구현 때 확인):** `hc send`는 사람이 입력 칸에 쓰던 글(draft)이 있으면 마지막 키 뒤 최대 60초 기다린 뒤 그 글 뒤에 이어 붙여 실행한다. 입력 칸에 글이 남아 있으면 `print -z` 줄이 그 글과 합쳐질 수 있다. zsh의 `push-line`(기본 alt+q)으로 쓰던 글을 먼저 밀어 두는 방법 등을 구현 때 정한다.
- mod에서는 `herdr`의 `hc(args)`로 hc를 부를 수 있다(`~/.config/herdr-app/herdr.d.ts`).

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/07-insert-into-terminal`의 `284af87`(넣을 hc 명령과 인용), `5cb38a7`(바쁨 알림 문구), `79a0ea9`(셸 폴더), `b14ce9c`(뷰어·셸 pane 찾기와 여는 인자), `8371835`(막 연 셸은 draft 밀기 없이), `9f8ee0a`(`>_` 버튼과 연결), `6281c88`·`616766f`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다.
- **완료 조건:** 경계 1 통과(경계 3도 통과).
  - 작업자(`6281c88`): `node --test mods/side-viewer/terminal-insert.test.mjs mods/side-viewer/code-blocks.test.mjs` 32 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과, sh·js·언어 없음·목록 속 zsh 블록이 든 임시 사본의 check 통과(`>_`는 셸 블록 3개에만). 숨은 백그라운드 zsh 터미널 2개에서 따옴표·한글·기호·여러 줄·`\n`이 그대로 입력 칸에 들어가고 실행되지 않았으며, 클립보드 해시가 시험 전후 같았다. 시험 터미널은 지웠다(`hc ls --all`에 `sv2-07-probe` 0개, 주 진행자도 확인).
  - 통합 담당(`616766f`): `node --test mods/side-viewer/` 270 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **방법:** 셸 pane은 `run("pane.split", {direction: "down", pane: <뷰어>, argv: [/bin/zsh -c 'cd -- "$1"; exec /bin/zsh -l' … <폴더>]})`로 연다(`pane.split`에 folder 인자가 없다). 새 pane은 split 전후 `panes()`를 비교해 최대 5초 찾는다. 뷰어 pane은 props의 pane → 키보드가 있는 side-viewer → 그 탭의 유일한 side-viewer 순서로 찾는다. 폴더는 뷰어 탭이면 문서 폴더(`this.viewerTab`), 대화 옆이면 같은 탭 터미널 pane 중 에이전트 pane을 먼저 골라 그 `cwd`, 없으면 홈. 넣기는 `hc keys <t> alt+q`(zsh push-line, 막 연 셸에는 보내지 않음) 뒤 `hc send <t> " print -rz -- '<명령>'"`. 바쁨은 `hc get`의 foreground가 zsh가 아닐 때(bash·fish도 넣지 않음).
- **결정(주 진행자 수용, 명세에 없던 것):** 넣은 뒤 셸 pane에 키보드를 준다(확인하고 바로 Enter를 누르게). 바쁜 셸 알림은 Herdr `notify()`로 제목 "터미널에 넣지 않았습니다", 본문 "셸에서 다른 프로그램(<이름>)이 실행 중입니다. 끝난 뒤 다시 누르세요."를 띄운다.
- **미실행:** 경계 4(입력 칸에 들어가고 실행되지 않는지, 클립보드, 두 번째 누름이 같은 pane에 가는지, 바쁜 셸). 티켓 12에서 사용자와 확인하고 바쁜 셸은 실제로 재현해 보여 준다: `>_`로 연 셸에서 `sleep 30`을 실행한 채 다시 `>_` → 알림이 뜨고 입력 칸이 그대로인지 → sleep이 끝난 뒤 다시 눌러 같은 pane에 들어가는지.
- **남은 위험(경계 4에서 볼 것):** split의 argv가 그대로 실행되는지, 새 pane이 5초 안에 `panes()`에 보이는지, 클릭 때 focused pane이 뷰어인지. 사람이 쳐 둔 글이 있으면 `hc send`가 최대 60초 기다릴 수 있다. vi 키맵이면 쓰던 글이 넣은 줄과 합쳐질 수 있다. `print -rz` 줄이 화면에 한 줄 남는다.
- **문서 메모(12):** README: 셸 계열(sh, shell, bash, zsh, fish, console, 언어 없음) 코드 카드의 `>_`는 명령을 뷰어 아래 셸 pane의 입력 칸에 넣는다. Enter는 누르지 않고 클립보드는 그대로다. 셸은 zsh로 열리고 대화 옆이면 대화 터미널의 폴더, 뷰어 탭이면 문서 폴더에서 시작한다. 다시 누르면 같은 셸 pane에 넣는다. 셸이 다른 프로그램을 실행 중이면 넣지 않고 알림으로 이유를 알린다. 쓰던 글은 zsh의 push-line(alt+q)으로 밀어 두었다가 돌려준다(vi 키맵은 예외). `print -rz` 줄이 화면에 한 줄 남는다. RECIPE "Done when" 후보: 셸 블록에만 `>_` / 누르면 아래 셸 pane이 열리고 입력 칸에 들어가며 실행되지 않음 / 클립보드 그대로 / 두 번째 누름이 같은 pane / `sleep 30` 중에 누르면 넣지 않고 알림 / 셸에 쓰던 글이 있을 때 누르면 넣은 명령을 지운 뒤 그 글이 돌아옴.
