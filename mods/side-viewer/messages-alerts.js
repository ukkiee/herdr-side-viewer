// The words of the viewer's notifications (herdr notify): a code block the `>_` button could
// not put into the terminal (terminal-insert.js) and a new viewer tab that could not be shown
// (viewer-tab.js). Keys start with "alerts.".

export const en = {
  "alerts.notInserted": "Not inserted into the terminal",
  "alerts.busy": "Another program ({program}) is running in the shell. Press again when it ends.",
  "alerts.insertFailed": "Couldn't insert into the terminal",
  "alerts.unprepared": "The shell didn't take the command (it was restarted, e.g. by exec zsh). If ;7~ is left in the input line, delete it and press again.",
  "alerts.unready": "The shell isn't ready for commands yet. Press again in a moment.",
  "alerts.remote": "Can't insert into a shell on another machine. Use the copy button and paste it.",
  "alerts.failed": "Couldn't open or find the shell pane.",
  "alerts.unplacedTitle": "Couldn't switch to the new tab",
  "alerts.unplacedBody": "The '{name}' tab was opened but couldn't be found to move or show. Pick it from the tab bar.",
};

export const ko = {
  "alerts.notInserted": "터미널에 넣지 않았습니다",
  "alerts.busy": "셸에서 다른 프로그램({program})이 실행 중입니다. 끝난 뒤 다시 누르세요.",
  "alerts.insertFailed": "터미널에 넣지 못했습니다",
  "alerts.unprepared": "셸이 명령을 받지 않았습니다(exec zsh 등으로 다시 시작됨). 입력 칸에 ;7~가 남았다면 지우고 다시 누르세요.",
  "alerts.unready": "셸이 아직 명령을 받을 준비가 되지 않았습니다. 잠시 뒤 다시 누르세요.",
  "alerts.remote": "다른 기계의 셸에는 넣을 수 없습니다. 복사 버튼으로 붙여 넣으세요.",
  "alerts.failed": "셸 pane을 열거나 찾지 못했습니다.",
  "alerts.unplacedTitle": "새 탭으로 넘어가지 못했습니다",
  "alerts.unplacedBody": "'{name}' 탭을 열었지만 찾지 못해 옮기거나 보이지 못했습니다. 탭 막대에서 고르세요.",
};
