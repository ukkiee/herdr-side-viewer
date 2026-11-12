// Merging the keys the mod expects (the repository's keys.json) into the person's keys.json.
// install.sh reads and writes the files; this only decides. No Herdr imports, so it runs
// under `node --test`.

// The lines to add by hand, one per key, each with the section it goes in.
function manual(wanted) {
  const lines = [];
  for (const [section, binds] of Object.entries(wanted)) {
    for (const [key, action] of Object.entries(binds)) {
      lines.push(`  in "${section}": ${JSON.stringify(key)}: ${JSON.stringify(action)}`);
    }
  }
  return lines;
}

// current: the text of the person's keys.json, or null when there is none.
// Returns the text to write (null: leave the file as it is) and the lines to tell the person.
export function mergeKeys(current, wanted) {
  if (current === null) {
    return { text: null, lines: ["No keys.json yet: once Herdr has written one, add by hand:", ...manual(wanted)] };
  }
  const keys = JSON.parse(current);
  const lines = [];
  for (const [section, binds] of Object.entries(wanted)) {
    for (const [key, action] of Object.entries(binds)) {
      (keys[section] ??= {})[key] = action;
      lines.push(`${key} → ${JSON.stringify(action)} (${section})`);
    }
  }
  return { text: JSON.stringify(keys, null, 2) + "\n", lines };
}
