// The handoff from open.sh to a viewer that is already showing. No Herdr imports, so it runs
// under `node --test`.
//
// open.sh writes REQUEST_FILE into the data folder, {"id": "...", "file": "/abs/path",
// "at": <unix seconds>}, and sends `side-viewer.show`. The viewer that takes the request
// creates answerFile(id) there. open.sh waits about 0.4 s for that file and opens a new pane
// when it does not appear, because the command only reaches viewers that are showing.

export const REQUEST_FILE = "request.json";

// The id becomes part of a file name, so it may not carry a path.
const ID = /^[A-Za-z0-9_-]+$/;

// open.sh stops waiting after about 0.4 s. A request older than this was left by an asker
// that has already opened the file some other way.
const MAX_AGE_SECONDS = 5;

export function answerFile(id) {
  return `answer-${id}`;
}

// `text` is what reading REQUEST_FILE gave (null when it is not there). `answered` is the id
// this viewer took last, `now` the time in milliseconds.
// Returns { id, file } for a request to take, or null.
export function requestFrom(text, { answered, now }) {
  if (typeof text !== "string") return null;
  let request;
  try {
    request = JSON.parse(text);
  } catch {
    return null;
  }
  if (!request || typeof request !== "object") return null;
  const { id, file, at } = request;
  if (typeof id !== "string" || !ID.test(id)) return null;
  if (typeof file !== "string" || !file.startsWith("/")) return null;
  if (typeof at !== "number" || Math.abs(now / 1000 - at) > MAX_AGE_SECONDS) return null;
  if (id === answered) return null;
  return { id, file };
}

// Takes the waiting request, if there is one for this viewer. `files` is the data folder's
// access: read(path) gives the text or null, create(path, text) makes a new file and rejects
// when the name is taken. Creating the answer is what takes the request, so of several
// viewers woken by one command only the first gets it, and none gets it once open.sh has
// given up and taken the name itself.
// Returns { id, file }, or null.
export async function takeRequest(files, { folder, answered, now }) {
  let text;
  try {
    text = await files.read(`${folder}/${REQUEST_FILE}`);
  } catch {
    return null;
  }
  const request = requestFrom(text, { answered, now });
  if (!request) return null;
  try {
    await files.create(`${folder}/${answerFile(request.id)}`, `${request.id}\n`);
  } catch {
    return null;
  }
  return request;
}
