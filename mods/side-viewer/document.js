// What the side viewer shows for a file and the text read from it. No Herdr imports, so it
// runs under `node --test`.

const MARKDOWN = /\.(md|markdown|mdx)$/i;

const NOTICES = {
  none: "열 파일이 없습니다.",
  loading: "불러오는 중…",
  empty: "이 파일은 비어 있습니다.",
  missing: "이 파일은 더 이상 없습니다.",
  unreadable: "이 파일을 읽을 수 없습니다.",
  unsupported: "이 종류의 파일은 뷰어에서 열 수 없습니다.",
};

// The text shown in place of the content, or null for a state that draws the content.
export function noticeFor(state) {
  return NOTICES[state] ?? null;
}

// `text` is what reading the file gave: a string, or null when the file is not there.
// Returns { state, text? }; "markdown" is the only state with content to draw.
export function contentOf(file, text) {
  if (!file) return { state: "none" };
  const name = file.slice(file.lastIndexOf("/") + 1);
  if (!MARKDOWN.test(name)) return { state: "unsupported" };
  if (text === null || text === undefined) return { state: "missing" };
  if (text.trim() === "") return { state: "empty" };
  return { state: "markdown", text };
}

// The header's two parts: the file name, and its folder with the home folder shortened to "~".
export function labelOf(file, home) {
  const cut = file.lastIndexOf("/");
  const name = file.slice(cut + 1);
  let folder = file.slice(0, cut) || "/";
  if (home && (folder === home || folder.startsWith(home + "/"))) folder = "~" + folder.slice(home.length);
  return { name, folder };
}
