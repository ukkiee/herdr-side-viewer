# 09: 코드 묶음에 html 넣기

**What to build:** 코드 묶음에 `html`·`htm`을 넣는다. 코드 묶음을 넘겨받은 Mac에서 html 파일을 cmd-클릭하면 코드 보기(고칠 수 있음)로 열린다. macOS가 html 파일 종류에 묶는 형제 확장자와 넘겨받기 확인 창 수를 실측해 목록과 넘겨받기 전 안내에 반영한다. 기본 앱은 바꾸지 않는다.

**Blocked by:** 02

**Status:** done

**명세:** `docs/features/side-viewer-v2/spec.md` (AC-17)

**파일 소유:** `mods/side-viewer/extensions.json`(연결 파일 소유), 라우터 빌드·분기 스크립트 테스트 중 확장자 목록을 보는 부분. 연결 파일 자리: `views.js`의 `html` 색상 언어. README의 확장자 표는 고치지 않고 쓸 내용을 Comments에 남긴다(12가 반영).

**설계 계약:**
- 확장자 목록: v1 명세 "구현 결정"의 "넘겨받은 확장자 목록은 한 곳에 둔다", "확장자 실측과 확인 창", ADR `docs/adr/0001-cmd-click-through-a-default-app-router.md`
- `html` 결정: 이 명세 "구현 결정"의 "html"

**검증 방법:**
- 실측: 확장자 종류 조회(기본 앱을 바꾸지 않는 방법)로 html 종류의 형제 확장자를 확인하고 결과를 Comments에 남긴다
- 경계 1: `views.js`(html·htm → 코드 보기, 색상 언어)
- 경계 2: 분기 스크립트·라우터 테스트가 새 목록으로 통과
- 경계 4: 12에서 사용자가 코드 묶음을 넘겨받은 뒤 확인

- [x] 목록에 `html`·`htm`(과 실측한 형제)이 있다 (`html htm shtml shtm`)
- [x] 넘겨받기 전 안내의 확인 창 수가 새 목록에 맞다 (`takeover.sh`가 목록과 파일 종류로 매번 센다. html 가족은 창 하나, 라우터 테스트로 확인)
- [x] html이 코드 보기로 판별된다 (경계 1)
- [x] 기본 앱을 바꾸는 명령을 실행하지 않았다 (작업자 보고와 실측 명령 목록: 조회 전용 Swift `UTType`·`NSWorkspace.urlForApplication(toOpen:)`)

**완료 조건:** 위 항목 전부, 경계 1·2 통과.

## Comments

### 2026-11-12 통합 (주 진행자)

- **실측(조회 전용, 작업자):** Swift `UTType(filenameExtension:)`·`UTType.tags`로 조회했다. `public.html`이 묶는 확장자는 `html htm shtml shtm` 넷이다. `xhtml`·`xht`는 다른 종류(`public.xhtml`)라 넣지 않았다. 기존 code 목록 37개 중 `public.html`에 속한 것은 없다. 이 Mac의 html 기본 앱은 브라우저 Dia(`company.thebrowser.dia`)다(읽기만 함).
- **확인 창 수:** html 가족은 창 하나다. code 묶음 27종 → 28종, `--make-default code` 전체 최대 34번 → 35번, 기본 넘겨받기(마크다운·이미지)는 7번 그대로. `takeover.sh`는 목록과 파일 종류로 매번 세므로 고치지 않았다.
- **결과:** 브랜치 `sv2/09-html-in-code-group`의 `bdf6cd6`(목록과 색상 언어 `html`), `a9b8c4e`(라우터 테스트: html 가족이 창 하나로 넘어가고 돌아옴), `18f2f56`(통합 tip 반영)를 `feat/side-viewer-v2`에 fast-forward로 합쳤다. `open.sh`는 확장자를 거르지 않아 `open.test.mjs`는 바꾸지 않았다.
- **완료 조건:** 경계 1·2 통과.
  - 작업자(`18f2f56`): `node --test` views·open·router·original·links 5개 파일 106 통과·0 실패·0 skip, `herdr-app check mods/side-viewer` 통과.
  - 통합 담당(`18f2f56`): `node --test mods/side-viewer/` 192 통과·0 실패·0 skip·0 취소, `herdr-app check mods/side-viewer` 통과.
- **미실행:** 경계 4(코드 묶음을 넘겨받은 Mac에서 html cmd-클릭). 티켓 12에서 사용자가 넘겨받기를 고른 뒤 확인한다. 색상 언어 `html`은 Herdr 바이너리에 syntect HTML 문법이 있는 것만 확인했고 화면의 색은 보지 않았다.
- **위험(`미확인`, 명세 그대로):** 기본 브라우저를 바꾸면 macOS가 html을 브라우저로 되가져갈 수 있다.
- **문서 메모(12):** README 확장자 표 code 줄에 `html` `htm` `shtml` `shtm`를 더한다. README의 빠진 확장자 설명에서 `html`을 빼고, code 묶음 주의로 "기본 브라우저를 바꾸면 macOS가 html을 브라우저로 되가져갈 수 있다(미확인)", `shtml`·`shtm`은 같은 파일 종류라 함께 넘어온다, `xhtml`은 다른 종류라 들어가지 않는다를 적는다. 창 수 34 → 35번, code 묶음 27 → 28종. RECIPE의 언어 이름 목록에 `html`을 더하고, 제외 항목의 "`html` (tied to …)"를 지우고 형제 목록에 `htm shtml shtm`을 더한다. v1 명세의 "`html`은 넣지 않는다"는 v2 AC-17이 덮는다.

### 2026-11-12 완료 (주 진행자)

- 리뷰·재검토 모두 통과(마지막 sv2-rv10과 F-2 직접 재검토), 통합 검증(티켓 12·19) 통과, 최종 단계(change-review phase=final: PR 초안·회고 후보, 원본 해시 일치) 완료. 통합 head `d990852`: `node --test mods/side-viewer/` 362 통과·0 실패·0 skip·0 취소, `herdr-app check` 통과. push·PR은 하지 않았다(사용자: "pr 올리기전까지만").
