# 16: 셸에 명령을 넣을 때 화면에 줄을 남기지 않기

**What to build:** `>_`가 셸 입력 칸에 명령을 넣는 방식을 바꾼다. 뷰어가 셸 pane을 처음 열면, `ctrl+alt+F12`(`hc keys`가 보내는 `^[[24;7~`)에 "데이터 폴더의 넘김 파일을 읽어 입력 칸(BUFFER)에 넣고 커서를 끝에 두며, 쓰던 글이 있으면 push-line으로 밀어 두는" zsh 위젯을 거는 한 줄을 보내고 화면을 지운다(`clear`). 그 뒤 `>_`는 명령을 그 파일에 쓰고 그 키만 누른다. 화면에 `print -rz` 줄이 남지 않고, Enter·클립보드를 쓰지 않으며, vi 키맵에서도 쓰던 글이 실행되지 않는다. 바쁜 셸에는 지금처럼 넣지 않고 알린다.

**Blocked by:** 07 (integrated)

**Status:** integrated

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-16, "구현 결정"의 "터미널에 넣기")

**결정 근거:** 2026-11-12 손 확인(RECIPE v2 18번) 중 사용자: "print -rz는 보여지는게 어쩔 수 없는거야?" → 주 진행자가 숨은 시험 셸에서 위젯 방식을 실측(줄 안 남음, Enter·클립보드 없음, 쓰던 글 push-line·복원, vi 키맵에서도 실행 안 됨) → 사용자가 "새 방식으로 바꾸기"를 골랐다. 실측 기록: 실행 scratchpad의 `live-check.md`.

**파일 소유:** `mods/side-viewer/terminal-insert.js`와 그 테스트(넣는 명령·준비 줄·위젯 정의를 만드는 순수 부분), `mods/side-viewer/shell-pane.js`(준비 여부 기억, 파일 쓰기, 키 보내기), README.md·README.ko.md·RECIPE.md의 `print -rz`·push-line(alt+q)·vi 키맵 한계 문장.

**설계 계약:**
- 넣기: 티켓 07의 `terminal-insert.js`·`shell-pane.js`와 Comments(첫 단계 실측, 바쁨은 `hc get`의 foreground가 zsh가 아닐 때), 리뷰 CR-4(vi 키맵)
- 플랫폼: `~/.config/herdr-app/herdr.d.ts`(`hc(args)`, `writeTextFile`, `appHome`), `hc --skill`(`hc keys` 키 이름: F12까지, `ctrl+alt+f12`)

**검증 방법:**
- 경계 1: 준비 줄(위젯 정의 + 키 묶기 + clear)의 모양과 넘김 파일 경로 인용, 새 셸·이미 준비된 셸·셸이 바뀐 경우(준비를 다시 하는지)의 명령 목록, 바쁨이면 아무것도 보내지 않음
- 경계 3: `herdr-app check mods/side-viewer`
- 숨은 백그라운드 zsh(`hc run --bg`)에서: 준비 줄 뒤 화면에 준비 줄이 남지 않음, 넣은 명령이 입력 칸에만 있고 실행 안 됨, 클립보드 해시 그대로, 쓰던 글이 push-line으로 밀렸다가 돌아옴, `bindkey -v`에서도 쓰던 글이 실행 안 됨. 시험 터미널은 지운다.
- 경계 4: 12에서 18~20번 다시 확인

- [x] 처음 연 셸에 준비 줄을 보내고 지워 화면에 남지 않는다 (경계 1·3과 숨은 셸 실측. 실제 앱 확인은 미실행, 12에서 한다)
- [x] `>_`가 파일에 쓰고 키 하나로 넣어 화면에 줄이 남지 않는다 (경계 1·3과 숨은 셸 실측. 실제 앱 확인은 미실행, 12에서 한다)
- [x] Enter·클립보드를 쓰지 않고 쓰던 글이 돌아온다(vi 키맵 포함) (경계 1·3과 숨은 셸 실측. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 바쁜 셸에는 넣지 않고 알린다(지금 그대로) (경계 1·3과 숨은 셸 실측. 실제 앱 확인은 미실행, 12에서 한다)
- [x] 문서의 `print -rz`·vi 키맵 한계 문장이 새 동작과 맞다 (경계 1·3과 숨은 셸 실측. 실제 앱 확인은 미실행, 12에서 한다)

**완료 조건:** 위 항목 전부, 경계 1·3 통과, 숨은 셸 실측 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **결과:** 브랜치 `sv2/16-insert-without-trace`의 `0719d4a`(순수 부분), `e9160e7`(shell-pane 연결), `f5b3382`·`706e474`(README·README.ko·RECIPE)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다. `0719d4a` 하나만으로는 check가 깨진다(`shell-pane.js`가 없어진 export를 부름). `e9160e7`부터 정상.
- **자리:** `terminal-insert.js`의 `insertFolderOf`·`insertFileOf`(`appHome/data/side-viewer/shell/<터미널>.txt`), `INSERT_KEY = "ctrl+alt+f12"`, `prepareLine`(위젯 `_side_viewer_insert`: 쓰던 글은 push-line, 파일 글을 BUFFER로, 읽은 뒤 파일을 지움, emacs·viins·vicmd에 묶고 `clear`), `insertText`, `insertPlan`(바쁨이면 알림만; 준비한 zsh pid와 같으면 키만; 다르면 새 셸은 준비 줄→키, 아니면 alt+q→준비 줄→키), `shellState`의 ready에 `pid`. `shell-pane.js`의 `send`(파일 쓰기→계획의 hc 명령→`prepared` 기억→pane에 키보드)와 `write`(`umask 077` 폴더, `writeTextFile(file, text, readTextFile 결과)` 두 번 시도).
- **완료 조건:** 경계 1·3과 숨은 셸 실측 통과.
  - 작업자(`706e474`): `node --test mods/side-viewer/` 321 통과·0 실패·0 skip, `herdr-app check` 통과. 숨은 백그라운드 zsh에서 준비 줄이 화면에 남지 않음, 명령(여러 줄 포함)이 입력 칸에만 있고 실행 안 됨, 쓰던 글이 push-line으로 밀렸다가 돌아옴, `bindkey -v`에서도 실행 안 됨, 클립보드 해시 그대로. 덤으로 중첩 zsh 다시 준비와 바쁨 알림. 시험 터미널 2개 정리. 새 테스트가 기준에서 실패한 것은 export가 없어 모듈을 불러오는 단계였다(단언 단위 실패는 아님).
  - 통합 담당(`706e474`): `node --test mods/side-viewer/` 321 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **남은 위험(실제 앱):** Herdr pane을 위로 스크롤하면 준비 줄이 보이는지(`hc read`에는 없었다). 셸 pane 안에서 새 zsh를 띄운 뒤 첫 `>_`는 alt+q로 쓰던 글을 미는데, 그 zsh가 vi 키맵이면 쓰던 글이 준비 줄과 함께 실행될 수 있다(README Limits에 적음).
- **절차:** 작업자가 테스트 import 한 줄을 `sed -i`로 고쳤다(계약의 셸 편집 금지 위반, 스스로 보고). 결과는 위 검사로 확인했다.
