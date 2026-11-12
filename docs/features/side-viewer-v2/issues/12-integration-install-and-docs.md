# 12: 통합 검증, 설치, 문서

**What to build:** v2 전체를 합쳐 검증하고 설치하고 문서를 갱신한다. 저장소의 모든 테스트와 check를 돌리고, RECIPE "Done when"에 v2 손 확인 목록을 더해 사용자와 함께 실제 앱에서 확인한다. 바쁜 셸 상황은 실제로 만들어 사용자에게 보여 준다. README에 편집, 뷰어 탭, 새 마크다운 보기, `html`을 적고, 이 Mac에서 코드 묶음을 넘겨받는 방법을 안내한다(실행 여부는 사용자가 고른다).

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11

**Status:** ready-for-agent

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-19, AC-20, 그리고 AC-1~AC-21의 경계 4)

**파일 소유:** `README.md`, `RECIPE.md`(연결 파일 소유), `install.sh`(필요할 때만). 다른 티켓 Comments의 문서 메모를 반영한다.

**설계 계약:**
- 설치: v1 명세 AC-10, `install.sh`
- 문서: v1 `RECIPE.md`의 "Done when" 형식, 이 명세 전체
- 기본 앱 안내: v1 명세 AC-5, README의 "Take over the extensions" 절. 기본 앱을 바꾸는 명령은 사용자에게 알리고 누를 버튼을 말한 뒤 사용자가 실행한다

**검증 방법:**
- 경계 1·2: 저장소의 모든 `node --test`
- 경계 3: 설치된 mod의 `herdr-app check`
- 경계 4: RECIPE "Done when"의 v2 목록 전체와 v1 목록 회귀. 사용자가 실제 앱에서 누른다. Herdr 창은 화면 자동화하지 않는다

- [ ] 모든 테스트와 check 통과
- [ ] RECIPE "Done when"에 v2 목록이 있고 전부 확인됐다(바쁜 셸 재현 포함)
- [ ] v1 목록에 회귀가 없다
- [ ] README가 v2 동작과 `html`을 적고 코드 묶음 넘겨받기 방법을 안내한다
- [ ] 설치 스크립트로 v2가 설치되고 check를 통과한다

**완료 조건:** 위 항목 전부. 확인하지 못한 항목은 이유와 함께 남긴다.

## Comments

### 2026-11-12 문서 부분 통합 (주 진행자)

- **결과:** 브랜치 `sv2/12-docs`의 `7310ffd`(README: 편집·저장, 새 탭으로 열기, 마크다운 보기, 코드 묶음 넘겨받기 안내와 창 수 최대 35번, 확장자 표 `html htm shtml shtm`, 범위 밖과 html 브라우저 위험, 데이터 폴더의 `previews/`·`handoff-<id>.json`), `56ae028`(RECIPE: v2 모듈과 동작, "Done when"을 v1·v2로 나누고 v2 손 확인 29개, v1 5·7·12·13·14번 갱신)을 `feat/side-viewer-v2`에 fast-forward로 합쳤다. `install.sh`는 폴더 전체를 복사해 고치지 않았다.
- **검사:** 작업자(`56ae028`)와 통합 담당 모두 `node --test mods/side-viewer/` 295 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과. 문서 속 한국어 UI 문구 36개, 경로 11개, 모듈 24개, 아이콘 8개가 코드·저장소에 있는지 작업자가 대조했다.
- **남은 것(이 티켓을 `integrated`로 두지 않은 이유):** 전체 리뷰, 설치(`./install.sh`)와 설치된 mod의 check, RECIPE "Done when" v2·v1 손 확인(경계 4), 바쁜 셸 재현을 사용자에게 보여 주기, 코드 묶음 넘겨받기 안내(실행은 사용자가 고름).
- **작업자가 짚은 것:** RECIPE v2 20번(셸에 쓰던 글이 돌아옴)은 zsh 동작에서 추론한 단계라 실측이 없다. 9·26번은 15초 재확인 틈을 쓰므로 타이밍이 어긋나면 다시 한다. 안내 화면에도 `새 탭으로 열기`가 보인다(명세와 충돌하지 않음).
