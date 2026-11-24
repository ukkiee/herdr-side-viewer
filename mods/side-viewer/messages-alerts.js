// The words of the viewer's notifications (herdr notify): a code block the `>_` button could
// not put into the terminal (terminal-insert.js), a new viewer tab that could not be shown
// (viewer-tab.js) and a link to another machine's file the viewer cannot show (links.js).
// Keys start with "alerts.".

export const en = {
  "alerts.notInserted": "Not inserted into the terminal",
  "alerts.busy": "Another program ({program}) is running in the shell. Press again when it ends.",
  "alerts.insertFailed": "Couldn't insert into the terminal",
  "alerts.unprepared": "The shell didn't take the command (it was restarted, e.g. by exec zsh). If ;7~ is left in the input line, delete it and press again.",
  "alerts.unready": "The shell isn't ready for commands yet. Press again in a moment.",
  "alerts.noZsh": "There's no zsh on that machine, so it can't be inserted. Use the copy button and paste it.",
  "alerts.unreachable": "Can't reach the machine {machine}",
  "alerts.failed": "Couldn't open or find the shell pane.",
  "alerts.unplacedTitle": "Couldn't switch to the new tab",
  "alerts.unplacedBody": "The '{name}' tab was opened but couldn't be found to move or show. Pick it from the tab bar.",
  "alerts.unshown": "Can't show this file",
};

export const ko = {
  "alerts.notInserted": "터미널에 넣지 않았어요",
  "alerts.busy": "셸에서 다른 프로그램({program})이 실행 중이에요. 끝난 뒤 다시 누르세요.",
  "alerts.insertFailed": "터미널에 넣지 못했어요",
  "alerts.unprepared": "셸이 다시 시작돼서(exec zsh 등) 명령을 받지 않았어요. 입력 칸에 ;7~가 남았다면 지우고 다시 누르세요.",
  "alerts.unready": "셸이 아직 명령을 받을 준비가 안 됐어요. 잠시 뒤 다시 누르세요.",
  "alerts.noZsh": "그 기계에 zsh가 없어서 넣을 수 없어요. 복사 버튼으로 복사해서 붙여 넣으세요.",
  "alerts.unreachable": "{machine} 기계에 연결할 수 없어요.",
  "alerts.failed": "셸 pane을 열거나 찾지 못했어요.",
  "alerts.unplacedTitle": "새 탭으로 넘어가지 못했어요",
  "alerts.unplacedBody": "'{name}' 탭은 열었지만 찾지 못해서 자리를 옮기거나 보여 주지 못했어요. 탭 막대에서 고르세요.",
  "alerts.unshown": "이 파일은 보여 줄 수 없어요",
};
