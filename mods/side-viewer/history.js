// One viewer's visit history: the file it shows and the files back returns to, oldest first.
// No Herdr imports, so it runs under `node --test`. Every function returns a new history.

export function start() {
  return { file: null, past: [] };
}

// Showing a file. The file already shown is not a new visit, so opening it twice does not
// make back return to the same file.
export function open(history, file) {
  if (typeof file !== "string" || !file) return { file: null, past: history.past };
  if (file === history.file) return history;
  const past = history.file ? [...history.past, history.file] : history.past;
  return { file, past };
}

export function canGoBack(history) {
  return history.past.length > 0;
}

// Returning to the file before this one. The file left behind is dropped, not kept for a
// forward step.
export function back(history) {
  if (!canGoBack(history)) return history;
  return { file: history.past[history.past.length - 1], past: history.past.slice(0, -1) };
}
