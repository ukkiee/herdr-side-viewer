// Opening a file beside a conversation, for the path picker (main.js openPicked) and a
// cmd-click (link.js). A side viewer showing in the conversation's tab takes it as a request
// (request.js) within about 0.4 s, else a new viewer splits off right of the conversation pane.
// Both carry the space value, so only a viewer of the conversation's space takes the file, and
// the conversation, which that viewer remembers as the tab's sent conversation.
import { run, panes, exec, appHome, readTextFile, writeTextFile } from "herdr";
import { openTargetOf, pickedRequest, pickedSplit } from "../../core/app/path-picker.js";
import { REQUEST_FILE, answerFile, CLEAR_ANSWERS } from "../../core/app/request.js";

// Opens `file`. Resolves true once a viewer took it or the split was asked for, false when
// nothing opened: only without a conversation, where no viewer took the request and there is
// no pane to split. A failed split rejects.
//   conversation: the conversation's pane address, or null (a layout's terminal block)
//   space: its space value (machine.js)
//   kind: the opener's word in the id ("picker", "link")
//   sleep(ms): waits; a view has cx.sleep, a link handler has no cx and runs `sleep`
//   settle(): runs once it is settled where the file goes, before a split
export async function openBeside({ file, conversation, space, kind, sleep, settle = () => {} }) {
  // One id names both the request and the split's opening.
  const at = Math.floor(Date.now() / 1000);
  const id = `${at}-${kind}-${Math.random().toString(36).slice(2, 10)}`;
  const split = () => {
    if (!conversation) return false;
    settle();
    run("pane.split", pickedSplit({ file, space, conversation, id }));
    return true;
  };
  if (conversation && openTargetOf({ conversation, panes: panes() }).split) return split();
  const folder = `${appHome()}/data/side-viewer`;
  const answer = `${folder}/${answerFile(id)}`;
  const taken = async () => (await readTextFile(answer).catch(() => null)) !== null;
  try {
    await exec("sh", ["-c", CLEAR_ANSWERS, "sh", folder]).catch(() => null);
    const request = `${folder}/${REQUEST_FILE}`;
    const before = await readTextFile(request).catch(() => null);
    await writeTextFile(request, `${JSON.stringify(pickedRequest({ id, file, at, space, conversation }))}\n`, before);
    run("side-viewer.show");
    for (let tries = 8; tries > 0; tries--) {
      await sleep(50);
      if (await taken()) {
        settle();
        return true;
      }
    }
  } catch {}
  // Taking the answer's name ends the request, so a viewer that wakes now cannot take the
  // file as well as the new pane, whatever cut the wait short. A viewer that took it first
  // leaves the name taken.
  try {
    await writeTextFile(answer, `${id}\n`, null);
  } catch {
    if (await taken()) {
      settle();
      return true;
    }
  }
  return split();
}
