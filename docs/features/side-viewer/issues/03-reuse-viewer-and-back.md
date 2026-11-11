# 03: 열린 뷰어 재사용과 뒤로 가기

**What to build:** 현재 탭에 사이드 뷰어가 보이는 상태에서 다른 파일을 cmd-클릭하면 pane이 더 생기지 않고 그 뷰어의 내용만 바뀐다. 뷰어는 방문 기록을 쌓고, 머리줄의 뒤로 가기로 직전 파일로 돌아간다. 기록이 없으면 뒤로 가기는 보이지 않는다.

**Blocked by:** 02

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer/spec.md` (AC-2)

**파일 소유:** 방문 기록 모듈과 요청 해석 모듈(새 파일, `mods/side-viewer/` 아래)과 그 테스트. 연결 파일: `mods/side-viewer/main.js`의 요청 수신·뒤로 가기 자리, `mods/side-viewer/open.sh`의 응답 대기 자리.

**설계 계약:**
- 방문 기록·요청 해석 모듈: 명세 "구현 결정"의 "기록"·"뷰어에 넘기는 약속"
- `main.js`, `open.sh`의 해당 자리: 명세의 연결 파일 표(소유 02, 병합 규칙)와 `~/.config/herdr-app/AGENTS.md`의 "`<mod>.<command>` reaches shown copies only"

**검증 방법:**
- 경계 1: 방문 기록(쌓기, 꺼내기, 같은 파일 재방문은 쌓지 않음, 빈 기록)과 요청 해석(깨진 요청 포함) 단위 테스트
- 경계 2: 보이는 뷰어가 응답하면 분할 명령이 불리지 않고, 응답이 없으면 불리는지 확인
- 경계 4: 실제 앱에서 두 파일을 연달아 cmd-클릭하고 뒤로 가기

- [ ] 사이드 뷰어가 보일 때 다른 파일을 열면 pane 수가 그대로이고 내용만 바뀐다
- [ ] 뒤로 가기가 직전 파일을 다시 보여 준다
- [ ] 기록이 없으면 뒤로 가기가 보이지 않는다
- [ ] 다른 탭에 있는(보이지 않는) 뷰어는 요청을 가져가지 않고, 현재 탭에 새 pane이 생긴다
- [ ] `herdr-app check`가 통과한다

**완료 조건:** 위 항목 전부, 경계 1·2 테스트와 경계 3 통과.

## Comments

### 2026-11-11 구현 메모

- **요청·응답 약속.** `open.sh`가 데이터 폴더에 `request.json`(`{"id","file","at"}`, `at`은 유닉스 초, id는 `<초>-<pid>`)을 쓰고 `herdr-app do side-viewer.show`를 보낸다. 요청을 가져간 뷰어는 같은 폴더에 `answer-<id>`를 새로 만든다. 형식은 `request.js`가 정하고, `open.test.mjs`의 가짜 뷰어가 `request.js`의 `takeRequest`로 요청을 읽어 두 쪽을 묶는다.
- **가져가기는 응답 파일을 먼저 만든 쪽이 이긴다.** 뷰어는 `writeTextFile(path, text, null)`(새 파일만 만든다)로 응답을 만든다. 한 탭에 뷰어가 둘이면 먼저 만든 하나만 내용을 바꾼다(어느 쪽인지는 정해지지 않는다). `open.sh`는 약 0.4초(0.05초 × 8) 기다린 뒤 같은 이름을 스스로 차지하고 `pane.split`으로 간다. 그래서 늦게 깨어난 뷰어가 새 pane과 함께 파일을 또 가져가지 않는다.
- **무시하는 요청.** 깨진 JSON, id가 `[A-Za-z0-9_-]+`가 아님, 파일이 절대 경로가 아님, `at`이 없거나 5초 넘게 차이 남, 이 사본이 직전에 가져간 id.
- **응답 파일 정리.** 응답 파일은 바로 지우지 않는다(둘째 뷰어의 재처리를 막는다). `open.sh`가 실행될 때 1분 넘은 `answer-*`를 지운다.
- **Herdr 무응답.** `side-viewer.show`가 `SIDE_VIEWER_TIMEOUT`을 다 쓰고 실패하면 `pane.split`을 다시 시도하지 않고 바로 원래 앱으로 넘긴다(기다림이 두 배가 되지 않게). 그 밖의 실패(명령 오류)는 기다리지 않고 `pane.split`으로 간다.
- **방문 기록.** `history.js`. `show(file, cx)`만 기록을 쌓고, `goBack(cx)`은 쌓지 않는다. 뒤로 가기로 떠난 파일은 버린다(앞으로 가기 없음).
- **데이터 폴더.** mod는 `appHome()/data/side-viewer`만 본다. `SIDE_VIEWER_DATA`로 다른 폴더를 주면 `open.sh`와 mod가 어긋난다(테스트 전용 변수).
- **미검증(경계 4).** `herdr-app do side-viewer.show`가 `nextCommand()`를 `"show"`로 깨우는지, 보이는 사본이 없을 때 그 명령이 오류를 내는지, `writeTextFile(…, null)`이 이미 있는 파일에서 실제로 거절하는지, 다른 탭의 뷰어가 요청을 받지 않는지. 플랫폼 문서상 `mod.json`에 추가 선언은 필요 없다(`focusable`은 키보드 포커스용).
