export type NoteReferenceTarget = { id: string; title: string; kind: "file" | "canvas" };
const NOTE_URL = /^super-note:\/\/note\/([^/?#]+)$/;
const REFERENCE = /\[([^\]\n]*(?:\\\][^\]\n]*)*)\]\((super-note:\/\/note\/[^\s)]+)\)/g;

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
  return Array.from(content.matchAll(REFERENCE)).flatMap(match => {
    const id = noteIdFromUrl(match[2]);
    return id ? [{ id, title: match[1].replace(/\\([\\\[\]])/g, "$1"), start: match.index!, end: match.index! + match[0].length }] : [];
  });
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
  return targets.filter(target => target.id !== ownId && target.title.toLocaleLowerCase().includes(needle)).slice(0, 30);
}
