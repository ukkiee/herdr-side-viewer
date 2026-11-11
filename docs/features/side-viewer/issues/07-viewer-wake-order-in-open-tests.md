# 07: 늦게 깨어나는 뷰어 테스트의 순서를 시계가 아니라 장면으로 정한다

**What to build:** `open.test.mjs`의 "늦게 깨어나는 뷰어" 테스트 두 개가 어느 머신에서 돌려도 이름이 말하는 순서(분기 스크립트가 먼저 포기하거나 새 pane을 요청하고, 뷰어가 그 뒤에 깨어난다)로 실행된다. 반대 순서(Herdr 명령은 멈췄지만 보이는 뷰어가 먼저 요청을 가져감)도 테스트 하나로 고정한다. 분기 스크립트의 동작은 바꾸지 않는다.

**Blocked by:** 02, 03

**Status:** done

**명세:** `docs/features/side-viewer/spec.md` (AC-11, AC-2의 경계 2. 사용자 스토리 14)

**파일 소유:** `mods/side-viewer/open.test.mjs`(02의 소유 파일. 이 티켓은 아래 "수정"에 적은 장면과 그 장면이 쓰는 가짜 도구만 고친다). `mods/side-viewer/open.sh`와 `request.js`는 고치지 않는다.

**설계 계약:**
- `mods/side-viewer/open.test.mjs`: 명세 "테스트 결정"의 경계 2(가짜 `herdr-app`·`open`과 임시 데이터 폴더로 실행해 어떤 명령이 불렸는지 본다), 명세 "구현 결정"의 "뷰어에 넘기는 약속", 티켓 03 Comments의 "가져가기는 응답 파일을 먼저 만든 쪽이 이긴다"·"Herdr 무응답"

**검증 방법:**
- 경계 2: `node --test mods/side-viewer/open.test.mjs`를 연속 5번 돌려 모두 통과
- 실패 검출력: 아래 "수정"의 3번

이 티켓은 `원인 확정 → 결정 → 수정` 순서로 진행한다. 원인 확정과 결정은 주 진행자가 마쳤다(Comments). 작업자는 "수정"만 한다.

### 수정

1. "a viewer that wakes after Herdr was given up on does not take the file as well"와 "a viewer that wakes after the new pane was asked for does not take the file as well"에서 뷰어가 깨어나는 시점을 타이머 두 개의 경쟁이 아니라 장면의 순서로 정한다(예: `open.sh`가 끝난 뒤에 테스트가 가짜 뷰어를 직접 깨운다). 요청이 아직 유효한 시간(`request.js`의 5초) 안에 깨워서, 뷰어가 파일을 가져가지 못하는 이유가 "분기 스크립트가 응답 이름을 먼저 차지했다" 하나뿐이게 한다. 쓰지 않게 된 지연 옵션은 지운다.
2. 반대 순서의 테스트를 하나 더한다: Herdr 명령이 시간 제한까지 끝나지 않지만 보이는 뷰어가 그 전에 요청을 가져간 경우, 파일은 뷰어에만 보이고 원래 앱은 불리지 않으며 `pane.split`도 불리지 않는다.
3. 실패 검출력을 확인한다. `open.sh`를 임시로 바꿔 (a) 시간 초과 갈래에서 응답 이름을 차지하지 않게 하면 1번의 첫 테스트가 "뷰어도 파일을 가져갔다"로 실패하고, (b) 같은 갈래에서 차지 실패를 무시하고 원래 앱을 열게 하면 2번의 테스트가 "원래 앱도 열렸다"로 실패하는지 본다. 바꾸기 전 사본과 diff로 의도한 변경만 들어갔는지 대조하고, 확인 뒤 되돌려 `git diff -- mods/side-viewer/open.sh`가 비어 있게 한다.

- [x] 두 "늦게 깨어나는 뷰어" 테스트의 순서가 타이머 경쟁에 기대지 않는다
- [x] Herdr 명령이 멈춘 동안 뷰어가 먼저 가져간 경우의 테스트가 있다
- [x] 실패 검출력 (a), (b)를 확인했고 `open.sh`는 바뀌지 않았다
- [x] `node --test mods/side-viewer/open.test.mjs`가 이 Mac에서 연속 5번 통과한다

**완료 조건:** 위 항목 전부와 전체 오프라인 검사(`node --test mods/side-viewer/`, 통합 담당 실행) 통과.

## Comments

### 원인 확정 (2026-11-11, mac-m5-pro, Node v26.13.0, 기준 `a91bf3b`)

- **증상.** `node --test mods/side-viewer/`가 152개 중 `open.test.mjs:263` 하나만 실패한다. `w.openArgs()`가 `[]`다. 원래 Mac에서는 통과했다.
- **원인.** 테스트 장면이 두 사건을 같은 1초에 놓는다. `open.sh`는 `SIDE_VIEWER_TIMEOUT=1`을 `sleep 0.05` 20번으로 세고, 가짜 뷰어는 `sleep 1` 뒤 Node를 띄운다. 어느 쪽이 먼저인지는 머신의 프로세스 생성 비용이 정한다. 이 Mac에서는 `sleep 0.05` 한 번이 0.07~0.08초라 대기가 1.23~1.25초 걸리고, 가짜 뷰어는 1.15~1.18초에 깨어난다. 그래서 뷰어가 먼저 요청을 가져가고, `open.sh`는 응답 이름을 차지하지 못해 원래 앱을 열지 않고 끝난다.
- **제품 동작은 맞다.** 수정하지 않은 `open.sh`로 뷰어 지연만 바꿔 20번 돌렸다(Herdr 5초 멈춤, 시간 제한 1초).

  | 뷰어 지연 | 뷰어가 깨어난 때 | `open.sh`가 끝난 때 | 뷰어 | 원래 앱 |
  |---|---|---|---|---|
  | 0.5초 | 665~794ms | 1278~1335ms | 5번 모두 가져감 | 안 열림 |
  | 1초 | 1152~1177ms | 1253~1327ms | 5번 모두 가져감 | 안 열림 |
  | 1.5초 | 1671~1692ms | 1381~1461ms | 5번 모두 못 가져감 | 5번 모두 열림 |
  | 2초 | 2160~2183ms | 1388~1436ms | 5번 모두 못 가져감 | 5번 모두 열림 |

  20번 모두 파일을 받은 쪽은 정확히 하나였다. 클릭이 사라지거나 두 곳에 열린 적이 없다.
- **같은 구조의 다른 테스트.** `open.test.mjs:158`도 뷰어 지연 1초와 응답 대기(0.05초 × 8)의 순서를 타이머에 맡긴다. 여유가 커서 이 Mac에서도 통과하지만 같은 이유로 뒤집힐 수 있다.
- **관측만 한 것.** `SIDE_VIEWER_TIMEOUT`은 시계가 아니라 `sleep` 횟수로 세므로 이 Mac에서는 약 25% 길다(기본 5초면 약 6초). 명세는 기다리는 시간을 정하지 않았다. 이 티켓에서 고치지 않는다.

### 결정 (주 진행자)

- 명세 대조: AC-11과 사용자 스토리 14는 "클릭이 사라지지 않는다"를 요구한다. 뷰어가 먼저 가져간 경우 파일은 뷰어에 보이므로 요구를 지킨다. 명세와 `open.sh`는 바꾸지 않는다.
- 고칠 것은 테스트다. 테스트 이름이 말하는 순서를 장면이 보장하지 않았다. 지연 값만 늘리는 것은 같은 경쟁을 남기므로 하지 않는다.
- 이 Mac에서 우연히 지나간 반대 순서(시간 초과 갈래의 `claim || exit 0`)는 지금 어떤 테스트도 고정하지 않는다. 테스트를 하나 더한다.

### 통합 기록 (2026-11-11, mac-m5-pro)

- 결과 SHA `8dfc485`(`ticket/07-viewer-wake-order`, 기준 `0c89fd5`), `feat/side-viewer`에 fast-forward로 통합. 커밋 `28eb475`, `8dfc485`. 바뀐 파일은 `mods/side-viewer/open.test.mjs` 하나(+32/−17)이고 `open.sh`·`request.js`의 diff는 비어 있다.
- 고친 방법. 늦게 깨어나는 뷰어는 가짜 `herdr-app`이 깨우지 않고(`viewersShowing(1, { asleep: true })`), `open.sh`가 끝난 뒤 테스트가 `wakeViewers()`로 직접 깨운다. 지연 옵션(`after`, `viewer-delay`)과 `sleep 1.6` 두 번은 지웠다. 반대 순서 테스트 "a viewer that takes the file while Herdr has not answered keeps it, and nothing else opens"를 더했다.
- 실패 검출력(작업자 실행, 사본과 diff로 한 줄 변경 확인, `sh -n` 통과 뒤 되돌림). (a) `open.sh` 82행의 `claim || exit 0`을 지우면 "wakes after Herdr was given up on"이 `the viewer took the file as well`로 실패. (b) 같은 행을 `claim`으로 바꾸면 새 테스트만 `the original app opened as well`로 실패(20 통과, 1 실패).
- 작업자 검사: `node --test mods/side-viewer/open.test.mjs` 연속 5번, 매번 통과 21, 실패 0, skip 0.
- 전체 오프라인 검사(통합 브랜치 `8dfc485`, 주 진행자 실행): `node --test mods/side-viewer/` 연속 3번, 매번 통과 153, 실패 0, skip 0(고치기 전 `a91bf3b`에서는 통과 151, 실패 1). `herdr-app check mods/side-viewer` 통과(`herdr-app 0.1.15`).
- 완료 조건 근거: 체크박스 네 개와 전체 오프라인 검사 통과.
- 남은 조건(알려진 한계). 반대 순서 테스트는 가짜 뷰어의 Node가 뜨는 시간(약 0.1초)이 시간 제한 1초보다 짧다는 데 기댄다. `open.sh`를 바꾸지 않고는 없앨 수 없다.
- 미검증: 새 pane 갈래의 마지막 `claim || exit 0`(`open.sh` 86행)을 지웠을 때의 검출력은 이 티켓에서 확인하지 않았다.

### 재검토 발견 RR-1 (2026-11-11, 독립 검토자: codex 프로필, GPT 계열)

재검토 범위는 `1998a64..4833985`의 `mods/` 변경 6개 파일이다. 판정은 통과(Blocking·Important 없음), RE-1·RE-2 해결, 신규 Minor 1건.

- **RR-1 (Minor, 수용).** 늦게 깨어나는 뷰어 테스트 두 개(`open.test.mjs`의 "wakes after the new pane was asked for", "wakes after Herdr was given up on")는 요청을 쓴 때부터 `wakeViewers()` 안의 `takeRequest()`까지 5초를 넘기면 `open.sh`가 응답 이름을 차지하지 않아도 통과한다. `request.js`가 만료된 요청을 응답 파일을 만들기 전에 거절하기 때문이다. 위 "수정" 1번의 조건("못 가져가는 이유가 응답 이름을 먼저 차지했다 하나뿐")이 시계에 기대고 있다.
- **근거(검토자가 `git archive 4833985` 사본에서 재현).** `open.sh` 82·86행의 `claim`을 지우면 관련 테스트 셋이 실패한다(18 통과, 3 실패). 같은 사본에서 `wakeViewers()` 앞에 6초를 멈추면 늦게 깨어나는 두 테스트가 통과한다(20 통과, 1 실패). 82행만 되돌리고 86행만 지운 채 같은 지연을 두면 파일 전체가 통과한다(21 통과, 0 실패). 주 진행자가 `request.js`의 순서(시각 검사 뒤 `create`)를 소스로 확인했다.
- **함께 확인된 것.** 지연이 없으면 86행의 `claim`을 지운 변이도 잡힌다(위 통합 기록의 미검증 항목).
- **고칠 것.** 늦게 깨어나는 장면에서 가짜 뷰어가 쓰는 현재 시각을 요청이 유효한 시각으로 장면이 정한다(벽시계가 아니라 요청의 `at`에서 얻는다). 그 뒤 82행과 86행의 `claim`을 각각 지운 변이가 `wakeViewers()` 앞에 6초를 멈춰도 실패하는지 저장소 밖 사본에서 확인한다.
- **남기는 한계.** 반대 순서 테스트가 가짜 뷰어의 Node 기동이 1초보다 빠르다는 데 기대는 것은 검토자도 같은 한계로 보았다. `open.sh`를 바꾸지 않고는 없앨 수 없어 그대로 둔다.

### RR-1 수정의 통합과 재검토 (2026-11-11)

- 결과 SHA `5f2f282`(`ticket/07-request-expiry`, 기준 `43ec5be`), `feat/side-viewer`에 fast-forward로 통합. 바뀐 파일은 `mods/side-viewer/open.test.mjs` 하나(+8/−5). `wakeViewers()`가 `request.json`의 `at`을 읽어 가짜 뷰어의 현재 시각(`FAKE_NOW`)으로 넘긴다. Herdr 명령이 깨우는 다른 장면은 벽시계를 그대로 쓴다.
- 작업자 검사: `node --test mods/side-viewer/open.test.mjs` 연속 3번, 매번 통과 21, 실패 0, skip 0. 고치기 전 사본에서는 82행 변이가 6초 지연 아래 잡히지 않는 것(Red)을 먼저 확인했다.
- 전체 오프라인 검사(통합 브랜치 `5f2f282`, 주 진행자 실행): `node --test mods/side-viewer/` 통과 153, 실패 0, skip 0. `herdr-app check mods/side-viewer` 통과.
- 재검토(주 진행자의 직접 검토. 13줄짜리 테스트 변경이라 작업자를 더 띄우지 않았다). `git archive HEAD` 사본에서 `wakeViewers()` 앞에 6초를 멈춘 채 다시 돌렸다.

  | 사본 | 결과 | 실패한 테스트와 이유 |
  |---|---|---|
  | 변이 없음 | 21 통과, 0 실패 | 없음 |
  | (a) 82행 `claim` 삭제 | 19 통과, 2 실패 | "wakes after Herdr was given up on": `the viewer took the file as well` / 반대 순서 테스트: `the original app opened as well` |
  | (b) 86행 `claim` 삭제 | 20 통과, 1 실패 | "wakes after the new pane was asked for": `the viewer took the file as well` |

- 상태표: RE-1 해결, RE-2 해결, RR-1 해결. 신규 발견 없음. 판정 통과(실제 앱 확인은 티켓 06에 남아 있다).
- 한계: 이 마지막 재검토는 티켓을 쓴 주 진행자가 했다. 독립 검토자(GPT 계열)는 `4833985`까지 보았다.
