export type NoteReferenceTarget = { id: string; title: string; kind: "file" | "canvas" };
const NOTE_URL = /^super-note:\/\/note\/([^/?#]+)$/;
const NOTE_LINK_START = "](super-note://note/";
const WHITESPACE = /\s/;

export function noteIdFromUrl(url: string) {
  const match = NOTE_URL.exec(url);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function createNoteReference(target: NoteReferenceTarget) {
  const title = target.title.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/([\[\]])/g, "\\$1");
  return `[${title}](super-note://note/${encodeURIComponent(target.id)})`;
}

export function getNoteReferences(content: string) {
  const lastMarker = content.lastIndexOf(NOTE_LINK_START);
  if (lastMarker < 0) return [];

  const references: { id: string; title: string; start: number; end: number }[] = [];
  let opening = -1;
  let urlEnd = -1;
  // Retain the first opening bracket in a title instead of retrying a
  // backtracking regex from every bracket in a long malformed reference.
  for (let index = 0; index <= lastMarker; index += 1) {
    const character = content[index];
    if (character === "\n") opening = -1;
    if (character === "[" && opening < 0) opening = index;
    if (character !== "]" || opening < 0) continue;

    if (content.startsWith(NOTE_LINK_START, index)) {
      const idStart = index + NOTE_LINK_START.length;
      // Malformed escaped markers can fall inside the last scanned URL.
      // Reuse its boundary rather than looking for the same terminator again.
      if (idStart > urlEnd) {
        urlEnd = idStart;
        while (urlEnd < content.length && content[urlEnd] !== ")" && !WHITESPACE.test(content[urlEnd])) urlEnd += 1;
      }
      if (urlEnd > idStart && content[urlEnd] === ")") {
        const id = noteIdFromUrl(content.slice(index + 2, urlEnd));
        if (id) {
          const title = content.slice(opening + 1, index).replace(/\\([\\\[\]])/g, "$1");
          references.push({ id, title, start: opening, end: urlEnd + 1 });
        }
        opening = -1;
        index = urlEnd;
        continue;
      }
    }
    if (content[index - 1] !== "\\") opening = -1;
  }
  return references;
}

export function getNoteReferenceQuery(content: string, start: number, end: number) {
  if (start !== end) return null;
  const prefix = content.slice(Math.max(0, start - 160), start);
  const match = /(?:^|[^\\$])\$([^\s$\[\]()]{0,80})$/.exec(prefix);
  if (!match) return null;
  return { start: start - match[1].length - 1, end: start, query: match[1] };
}

export function filterNoteTargets(targets: readonly NoteReferenceTarget[], ownId: string, query: string) {
  const needle = query.toLocaleLowerCase();
  const matches: NoteReferenceTarget[] = [];
  for (const target of targets) {
    if (target.id !== ownId && target.title.toLocaleLowerCase().includes(needle)) {
      matches.push(target);
      if (matches.length === 30) break;
    }
  }
  return matches;
}
