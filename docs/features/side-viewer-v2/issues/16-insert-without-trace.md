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

### 2026-11-12 리뷰 (주 진행자)

- **리뷰(`c5851f3..d2c89e7`: 체크 표시·L-1·15·16, 새 컨텍스트 리뷰어 sv2-rv6):** 수정 필요. 보고서: 실행 scratchpad의 `review/review-rv6.md`.
- **판정:**
  - RV6-1(Important, 받아들임): 셸 pane에서 `exec zsh`를 하면 pid가 같아 `insertPlan`이 준비된 셸로 보고 키만 보낸다. 새 zsh에는 위젯이 없어 입력 칸에 `;7~`가 들어가고 알림이 없다. `exec`가 pid를 바꾸지 않는 것을 확인했다. 작업자의 "exec zsh면 다시 준비"는 중첩 `zsh`만 실측한 것이었다. 고친 뒤: 키 뒤에 넘김 파일이 지워지지 않았으면 알림을 띄우고 다음 누름에서 다시 준비, 지난 넘김 파일이 남아 있으면 다시 준비.
  - RV6-2(Minor, 받아들임): 준비 줄 직후의 키가 zle 밖에 도착하면 화면에 찍힐 수 있다. 준비하는 누름은 준비 줄 안에서 바로 넣는다.
  - RV6-5(Optional, 받아들임): 위젯 안 `$f` 따옴표.
  - RV6-6(받아들임, 주 진행자 결정): 다른 기계의 셸이면 넘김 파일이 그 기계에 없어 조용히 아무것도 안 된다. 명세에 다른 기계 언급이 없고 `writeTextFile`에 `on`이 없으니, 그 경우는 보내지 않고 실패 알림으로 한다.
  - RV6-7(Optional): 다시 준비할 때의 `clear`는 README Limits에 있어 그대로 둔다.
  - RV6-3·RV6-4(문서·주석): 아래 수정에 함께 넣는다(RV3-1~3, R14-Q2 포함).
- **수정:** 새 작업자 sv2-fix4(worktree `sv2/review-fixes-4`, 기준 `d2c89e7`).

### 2026-11-12 리뷰 수정 통합 (주 진행자)

- **결과:** 브랜치 `sv2/review-fixes-4`의 `30cfc9e`(RV6-1·2·5·6), `27bb767`(RV6-3 주석), `30eb01c`(README·README.ko·RECIPE: RV6-1 동작, RV3-1·RV3-2·RV3-3, R14-Q2)와 통합 tip을 합친 `3555f4f`를 `feat/side-viewer-v2`에 fast-forward로 합쳤다.
- **자리:** `terminal-insert.js`의 `shellOf`(`{pid, argv}`), `isRemote`(주소에 `/`), `insertPlan`(원격·바쁨이면 알림만; 같은 zsh이고 남은 파일이 없으면 키와 `wait` 500ms; 아니면 새 셸 `[send]`, 그 밖 `[alt+q, send]`와 `wait` 3000ms; 준비 줄 끝에서 `print -rz`로 바로 넣음), `pressOutcome`(파일이 남으면 `prepared`를 비우고, 키 뒤면 `unprepared`, 준비 줄 뒤면 `unready` 알림; `unready`는 `4a38bc6`), `noticeOf`의 `remote`·`unprepared`·`unready` 문구. `shell-pane.js`의 `send`(쓰기 전 남은 파일 확인, 누른 뒤 50ms마다 `untaken`, 남으면 파일 지움), 뷰어 pane이 원격이면 split 전에 거절.
- **완료 조건:**
  - 작업자(`30eb01c`): 관련 테스트 115 통과, 전체 327 통과·0 실패·0 skip, 커밋 3개 모두 `herdr-app check` 통과. 새·바뀐 테스트 13개가 빈 스텁에서 단언 단위로 실패. 숨은 백그라운드 zsh 실측: 새 셸 첫 누름(준비 줄 하나로 들어가고 화면에 준비 줄·키 글자 없음), 같은 zsh 두 번째 누름, `exec /bin/zsh -l`(pid·argv 같음) 뒤 키는 파일이 남고 `;7~`(사후 확인이 잡는 경우) 뒤 다시 준비해 들어감, `exec zsh`(argv 바뀜)는 다시 준비해 들어감, emacs 쓰던 글은 명령 뒤에 돌아옴, `bindkey -v`의 viins·vicmd에서 쓰던 글이 실행되지 않음, 클립보드 해시 같음. 시험 터미널 2개 정리.
  - 통합 담당(`3555f4f`): `node --test mods/side-viewer/` 327 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **남은 위험(실제 앱):** 무거운 프롬프트(precmd)로 zle이 0.5초 넘게 늦거나 rc가 3초를 넘기면 명령이 안 들어갔는데도 실패 알림이 뜬다(늦게 온 키는 파일이 없어 그냥 지나감). 사후 확인 동안(최대 3초) 다른 누름은 버려진다. 같은 argv로 `exec`한 뒤 `;7~`를 지우지 않고 다시 누르면 그것이 쓰던 글로 돌아온다(알림이 안내). 원격 공간은 실측하지 않았다.
- **주 진행자 결정(RV6-6):** 다른 기계의 셸은 알림으로 거절한다. 명세 "터미널에 넣기"에 적었다.

### 2026-11-12 재검토·실제 앱 (주 진행자)

- **재검토(`d2c89e7..917a781`, sv2-rv7):** 통과. RV6-1~6, RV3-1~3, R14-Q2 해결, RV6-7 결정대로. 신규 RV7-1(Minor: 준비 줄이 늦을 때 알림이 `;7~`·exec zsh를 말함)·RV7-2(Optional: 옛 설명) → sv2-fix5 `4a38bc6`로 고침(`unready` 알림 "셸이 아직 명령을 받을 준비가 되지 않았습니다. 잠시 뒤 다시 누르세요."). RV7-3(대기 끝 순간의 좁은 경합)은 고치지 않음. 통합 담당(`4a38bc6`): 328 통과·0 실패·0 skip·0 취소, check 통과.
- **재검토(`917a781..4a38bc6`, sv2-rv8):** 통과, 결함 없음. RV8-1(이 티켓의 `unready` 누락)은 이 기록으로 고침. RV8-2(Optional: `terminal-insert.js` 주석과 RECIPE의 "no key was sent"를 "the insert key was not sent"로 좁히기)는 남김. 보고서: 실행 scratchpad의 `review/rereview-rv7.md`, `rereview-rv8.md`.
- **실제 앱(`917a781` 설치본, RECIPE v2 18~20·24번과 20번의 exec zsh):** 통과. 화면에 준비 줄이 남지 않음, 클립보드 그대로, `exec zsh` 뒤 argv가 `["zsh"]`로 바뀌어 다시 준비해 들어감, 같은 인자로 다시 `exec zsh`하면 알림과 `;7~`(설계대로) 뒤 다음 누름에 들어감, 같은 zsh에서 누를 때마다 다시 준비하지 않음. 기록: 실행 scratchpad의 `live-check.md`.
