// The cmd-click handler (mod.json link_handlers). A click on a path the side viewer can show
// opens it beside the clicked conversation, as a pick in the path picker does. Anything else
// passes on: on this Mac to Herdr's usual opener, the file's default app; in a remote space
// to nothing. link-target.js decides; this file asks Herdr.
import { panes, exec, machines, appHome, readTextFile } from "herdr";
import { accessOf } from "./adapters/out/file-access.js";
import { unavailable } from "./core/ports/remote-results.js";
import { openBeside } from "./adapters/out/open-beside.js";
import { linkOpening, linkFile, wantsHome, uriHost } from "./core/app/link-target.js";

// A handler has no cx to sleep with, so a wait is a `sleep` run on this Mac.
const sleep = (ms) => exec("sleep", [String(ms / 1000)]).catch(() => null);

// Clicks are handled one at a time. Two at once would both write request.json for the same
// viewer, and the second write, finding the first's, would refuse and split a new pane.
let queue = Promise.resolve();

export function handleLink(click) {
  const turn = queue.then(() => handle(click));
  queue = turn.catch(() => null);
  return turn;
}

async function handle({ link, source }) {
  const opening = linkOpening(source, panes());
  if (!opening || link?.kind !== "file") return "pass";
  const machine = source.machine ?? null;
  // A machine Herdr already lists as out of reach would only use up the click's 30 seconds.
  if (machine && unavailable(machines(), machine)) return "pass";
  let file;
  // Any failure here (a machine out of reach, a Windows machine) leaves the click to Herdr.
  try {
    const access = accessOf(machine);
    const groups = JSON.parse(await readTextFile(`${appHome()}/mods/side-viewer/extensions.json`));
    const home = wantsHome(link) ? await access.home() : null;
    const host = uriHost(link) ? await hostName(access) : null;
    file = linkFile({ link, cwd: source.cwd, home, host, groups });
    if (!file || !(await access.exists([file])).includes(file)) return "pass";
  } catch {
    return "pass";
  }
  // A split Herdr refuses (the conversation closed meanwhile) leaves the click to Herdr too.
  try {
    return (await openBeside({ ...opening, file, kind: "link", sleep })) ? "handled" : "pass";
  } catch {
    return "pass";
  }
}

// The host name of the terminal's machine, which a file URI it printed names (`ls --hyperlink`).
async function hostName(access) {
  const answer = await access.run("hostname", []);
  return answer.code === 0 ? answer.stdout.trim() || null : null;
}
