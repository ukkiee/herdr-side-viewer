# 08: 되돌리기가 라우터를 떠나지 않은 확장자를 "바뀜"이라고 하지 않는다

**What to build:** `--restore`를 돌린 사람이 출력만 보고 무엇이 실제로 돌아갔는지 안다. 라우터를 떠난 확장자만 `바뀜`에 찍히고, 요청해도 라우터에 남는 확장자(다른 앱이 맡지 않아 라우터만 맡고 있는 것. 두 Mac에서 `rbw`, `cp`)는 따로 한 줄로 알린다. 안내하는 확인 창 수는 실제로 뜨는 창 수와 같다. README와 RECIPE가 같은 사실을 적는다.

**Blocked by:** 01

**Status:** integrated

**명세:** `docs/features/side-viewer/spec.md` (AC-5의 경계 2. "구현 결정"의 "확장자 실측과 확인 창", "원래 앱 기록")

**파일 소유:** `mods/side-viewer/router/takeover.sh`와 `mods/side-viewer/router/router.test.mjs`(01의 소유 파일. 이 티켓은 되돌리기와 그 테스트만 고친다), `README.md`와 `RECIPE.md`(06의 소유 파일. 이 티켓은 아래 "수정" 4번의 문장만 고친다). `main.swift`, `open-original.sh`, `lib.sh`는 고치지 않는다.

**설계 계약:**
- `mods/side-viewer/router/takeover.sh`: 명세 AC-5, 명세 "구현 결정"의 "확장자 실측과 확인 창"·"원래 앱 기록", 티켓 01 Comments, 파일 머리의 사용법과 종료 코드 주석
- `mods/side-viewer/router/router.test.mjs`: 명세 "테스트 결정"의 경계 2(가짜 라우터와 임시 데이터 폴더로 실행해 어떤 요청이 갔는지와 출력을 본다)
- `README.md`, `RECIPE.md`: `~/.config/herdr-app/AGENTS.md`의 "Layouts and mods other people made" 절, 지금 문서의 글투

**검증 방법:**
- 경계 2: `node --test mods/side-viewer/router/router.test.mjs`
- 실패 검출력: 아래 "수정" 5번

이 티켓은 `원인 확정 → 결정 → 수정` 순서로 진행한다. 원인 확정과 결정은 주 진행자가 마쳤다(Comments). 작업자는 "수정"만 한다.

### 수정

1. `--restore`는 요청이 성공으로 끝난 파일 종류에서, 그 종류의 확장자마다 지금의 기본 앱을 다시 읽어 라우터를 떠난 것만 `바뀜`에 적는다. 아직 라우터인 확장자는 `바뀜`에 넣지 않고 별도의 한 줄(표준 출력)에 모아 적으며, 그 줄은 왜 남는지(이 확장자를 맡은 앱이 라우터뿐이다)를 말한다. 줄의 글은 지금 출력들의 글투(한국어, `이름: 확장자들`)를 따른다.
2. 기록이 없어 같은 파일 종류의 다른 확장자가 여는 앱으로 돌리려던 확장자만 있는 파일 종류에는 요청을 보내지 않는다. 그 앱은 그 파일 종류의 지금 앱이라 요청해도 바뀌는 것이 없고 확인 창도 뜨지 않는다(Comments의 원인). 이 확장자들은 1번의 "라우터에 남음" 줄에 바로 들어가고, `macOS 확인 창이 N번 뜹니다.`의 N에 세지 않는다. 기록된 확장자와 같은 파일 종류로 묶여 요청이 나가는 경우는 그대로 요청하고 1번으로 가린다. 기록도 없고 그런 형제도 없는 확장자(`mdx`, `jsonc`)는 지금처럼 TextEdit이나 미리보기로 요청한다.
3. 종료 코드의 뜻은 그대로 둔다(0 끝남 또는 할 일 없음, 1 실패, 3 "유지"가 있음). 라우터에 남은 확장자는 실패도 "유지"도 아니다. 요청할 것이 하나도 없고 남은 확장자만 있을 때의 출력과 종료 코드(0)도 테스트로 정한다. `--make-default`와 `--status`의 동작은 바꾸지 않는다.
4. 문서를 사실에 맞춘다. `README.md`의 Limits "Building alone can change a default"와 `RECIPE.md`의 Restore 문단이 지금은 그런 확장자가 형제의 앱으로 돌아간다고 적는다. 형제가 있는 것은 `--restore` 뒤에도 라우터에 남고(라우터가 계속 TextEdit이나 미리보기로 연다) 라우터 앱을 지우면 풀린다는 것, 형제가 없는 것은 TextEdit이나 미리보기로 간다는 것으로 고친다. 출력 줄이 새로 생기면 RECIPE의 출력 설명과 "Done when" 18번이 그것과 어긋나지 않게 한다.
5. 실패 검출력을 확인한다. 저장소 밖 사본에서 1번의 "다시 읽어 가리는" 부분을 빼면 새 테스트가 "`rbw`가 `바뀜`에 있다"는 이유로 실패하는지, 2번의 "요청을 보내지 않는" 부분을 빼면 요청 수나 창 수 안내의 단언이 실패하는지 본다. 바꾸기 전 사본과 diff로 의도한 줄만 바뀌었는지 대조하고 `sh -n`으로 구문을 확인한다.

- [x] `--restore`의 `바뀜`에는 라우터를 떠난 확장자만 있다
- [x] 라우터에 남는 확장자는 따로 한 줄로, 이유와 함께 알린다
- [x] 형제의 앱으로만 돌리려던 파일 종류에는 요청이 가지 않고 창 수 안내에도 세지 않는다
- [x] README와 RECIPE가 `--restore` 뒤 이 확장자들이 어떻게 되는지 사실대로 적는다
- [x] 실패 검출력 두 가지를 확인했다
- [x] `node --test mods/side-viewer/router/router.test.mjs`가 통과한다

**완료 조건:** 위 항목 전부와 전체 오프라인 검사(`node --test mods/side-viewer/`, 통합 담당 실행) 통과.

## Comments

### 원인 확정 (2026-11-11, mac-m5-pro, macOS 27.0, 기준 `73e7ea3`)

- **증상.** 실제 앱에서 `--restore`를 다섯 번 돌리는 동안 매번 `바뀜: rbw cp`(다섯 번째는 `바뀜: mdx png … jsonc rbw cp`)가 찍혔지만, 끝난 뒤 `--status`에서 `rbw`와 `cp`는 여전히 `dev.ukkiee.side-viewer-router`였다. 안내한 창 수(10번, 9번)는 실제로 뜬 수(8번, 7번)보다 2 많았다.
- **재현.** `SideViewerRouter --set-default-app rbw dev.warp.Warp-Stable`이 0.04초 만에 종료 코드 0으로 끝나고(창 없음) `rbw`의 기본 앱은 라우터 그대로다. 창이 뜨는 요청은 누를 때까지 기다린다(1초~24초).
- **원인.** macOS에 파일 종류로 물으면 `public.ruby-script`와 `public.c-plus-plus-source`의 앱은 이미 Warp다(`NSWorkspace.urlForApplication(toOpen: UTType)`). `--restore`가 형제(`rb`, `cpp`)의 앱으로 보내는 요청은 "그 파일 종류를 Warp로"라서 바꿀 것이 없는 성공이 된다. 그런데 `.rbw`, `.cp` 파일은 확장자를 직접 맡은 앱이 라우터뿐이라(빌드할 때 라우터가 이 확장자들을 맡겠다고 등록한다) 파일 종류의 앱과 상관없이 라우터로 온다. `run_plan`은 종료 코드 0이면 그 파일 종류의 확장자를 모두 `바뀜`에 넣고 다시 읽지 않는다.
- **넘겨받기 전에는.** 설치 전 이 Mac에서 `rbw`와 `cp`는 TextEdit, `rb`와 `cpp`는 Warp였다. 라우터는 기록이 없는 확장자를 TextEdit으로 열므로, 라우터에 남아 있어도 이 파일들이 열리는 앱은 설치 전과 같다.

### 결정 (주 진행자)

- 명세 AC-5는 되돌리기를 "라우터가 쥐고 있는 기록된 확장자 전부를 원래 앱으로 요청한다"로 정한다. `rbw`, `cp`는 기록이 없는 확장자라 AC-5의 글 밖이고, 형제의 앱으로 요청하는 동작은 최초 리뷰의 CO-1 수정에서 들어왔다. 명세를 바꿀 일은 아니다.
- 그 요청은 이 확장자를 라우터에서 떼지 못하고, 파일 종류 전체를 TextEdit으로 요청하면 떼어지더라도 형제(`rb`, `cpp`)의 앱을 바꾼다(CO-1이 막은 것). 그래서 떼는 방법을 찾지 않고 사실대로 알리는 쪽으로 정한다. 출력이 거짓이 아니게 하고, 뜨지 않는 창을 세지 않고, 문서를 고친다.

### 통합 기록 (2026-11-11, mac-m5-pro, Node v26.13.0, herdr-app 0.1.15)

- **결과.** 작업자(claude 프로필, worktree `ticket-08`)의 커밋 4개를 통합 브랜치에 fast-forward로 합쳤다. 결과 SHA `9133a58`(`a7c9445`, `cd2f743`, `41e3de6`, `9133a58`. 작업자의 `1a2ac5c`를 통합 tip 위로 옮긴 것). 고친 파일은 `takeover.sh`, `router.test.mjs`, `README.md`, `RECIPE.md`다.
- **출력.** 새 줄은 `라우터에 남음: rbw cp (이 확장자를 맡은 앱이 라우터뿐입니다)`이고 `바뀜`, `유지를 선택함` 다음에 온다. 요청할 것이 없으면 `바꿀 것이 없습니다.` 다음에 온다. `<ext>: 기록된 원래 앱이 없어 같은 파일 종류의 앱 <app> 으로 돌립니다.` 줄은 없어졌다.
- **요청을 보내지 않는 조건.** 기록이 없는 확장자의 앱이 "라우터가 쥐지 않은 형제가 지금 여는 앱"에서 왔고, 그 파일 종류의 바람이 모두 그런 것일 때다. 그 밖에는 요청하고, 성공한 뒤 확장자마다 다시 읽어 가린다.
- **테스트.** 고친 것 하나("restore asks nothing for an unrecorded extension whose file type already opens in its sibling's app, and says it stays with the router")와 새것 둘("restore leaves out of the window count a file type it asks nothing for, and still says what stays with the router", "restore lists under 바뀜 only the extensions that left the router, and says which stayed"). `node --test mods/side-viewer/router/router.test.mjs`: 통과 34, 실패 0, skip 0. `sh -n takeover.sh` 통과.
- **전체 오프라인 검사(통합 담당).** `node --test mods/side-viewer/`: 통과 155, 실패 0, skip 0. `herdr-app check mods/side-viewer`: `check passed`.
- **실패 검출력.** 작업자가 저장소 밖 사본에서 둘 다 확인했다(다시 읽기를 빼면 "restore lists under 바뀜 only…" 하나가 `바뀜: rb rbw`로 실패, 요청 안 보내기를 빼면 고친 테스트와 창 수 테스트 둘이 실패). 첫 번째는 주 진행자가 통합본의 사본에서 한 번 더 돌려 같은 실패(통과 33, 실패 1)를 봤다. 바꾼 것은 100행 한 줄이고 `sh -n`을 통과했다.
- **이 Mac의 실제 상태로 본 것.** 저장소의 `takeover.sh restore`를, 읽는 질문만 설치된 라우터에 넘기고 기본 앱 요청은 macOS에 보내지 않는 감싸개로 돌렸다. `macOS 확인 창이 7번 뜹니다.`(실제 확인 창 수와 같다), 보낼 요청 7개(`md`, `mdx`, `png`, `jpg`, `gif`, `webp`, `svg`), `라우터에 남음: rbw cp (…)`였고 기본 앱은 바뀌지 않았다.
- **보지 못한 것.** 고친 `--restore`를 실제 확인 창과 함께 끝까지 돌리는 것. 창 14번이 다시 필요해 하지 않았다. 설치된 라우터 앱은 아직 고치기 전의 스크립트를 담고 있다.

### 독립 재검토 (2026-11-11, 기준 `4833985` → head `83aa674`, codex 프로필의 작업자 `sv-rr2`)

대상은 그 사이에 바뀐 6개 파일이다(`open.test.mjs`의 RR-1 수정, 이 티켓의 `takeover.sh`·`router.test.mjs`·README·RECIPE, `preview.png`와 RECIPE의 그림 줄). 변경 작성자는 claude 계열이고 검토자는 다른 계열이다. 이전 보고서 원문이 이 머신에 없다는 한계는 그대로다.

| 대상 | 상태 | 근거 |
|---|---|---|
| RR-1(티켓 07) | 해결 | `open.test.mjs:98`이 요청의 `at`을 가짜 뷰어의 현재 시각으로 준다. 6초 지연을 넣고 `claim`을 지운 변이 둘을 모두 검출했다 |
| 수정 1 | 충족 | `takeover.sh:95`의 성공 갈래에서 확장자마다 다시 읽는다. 다시 요청해 성공한 경우도 이 갈래를 지난다 |
| 수정 2 | 충족 | `takeover.sh:221`에서 형제가 지금 여는 앱에서 온 것만 `now`이고, 한 종류에 `ask`가 하나라도 있으면 요청한다 |
| 수정 3 | 충족 | 빈 계획은 0, 실패 1, 유지 3, 그 밖 0. 남은 확장자는 실패도 유지도 아니다. 정상 종료 경로에 임시 파일이 남지 않는다. `--make-default`, `--status`에 회귀 없음 |
| 수정 4 | 일부 | README는 맞다. RECIPE에 아래 둘이 남았다 |

- **RS-1 (Minor, 수용).** `RECIPE.md`의 Restore 문단이 "요청마다 다시 읽는다"고 적지만 실제로는 성공한 요청 뒤에만 가린다(유지와 실패는 따로 나온다). "Done when" 18번의 "none of which has a recorded original app"은 늘 참이 아니다. 기록된 앱이 지워져 형제의 앱으로 다시 요청한 확장자는 기록이 있는 채로 `라우터에 남음`에 들어갈 수 있다(검토자가 사본의 기존 테스트 장면에서 확인).
- **RS-2 (Minor, 수용).** `RECIPE.md`에 남은 확장자를 라우터가 계속 TextEdit이나 미리보기로 열고 라우터 앱을 지우면 풀린다는 말이 없다(README에는 있다). 이 티켓의 "수정" 4번이 두 문서에 요구한 것이다.
- **범위 밖 관찰(기록만).** 이 변경 전부터, 기록된 앱이 지워져 다시 요청하는 경우의 창 수 안내는 1번인데 그 조합에서 실제로 창이 뜨는지는 본 적이 없다.
- **검토자가 돌린 것.** `router.test.mjs` 통과 34·실패 0·skip 0, `open.test.mjs` 통과 21·실패 0·skip 0, `sh -n takeover.sh` 통과. 사본에서 종료 코드 1·3·4·5·127의 임시 파일 정리 검사 5개를 더해 39개 통과, 변이 넷(위 RR-1의 둘, 다시 읽기 제거 33/1, 요청 생략 제거 32/2).
- **판정.** 통과(Blocking·Important 없음). RS-1과 RS-2는 수용해 새 작업자가 RECIPE만 고치고, 같은 검토자가 그 수정을 다시 본다.
