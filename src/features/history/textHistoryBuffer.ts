import { createTextHistoryEntry, type EditorSelectionState, type TextEditMetadata } from "./textHistory";
import { HISTORY_LIMIT } from "./historyModel";

export type BufferedTextEdit = {
  start: number; removed: string; inserted: string;
  before: EditorSelectionState; after: EditorSelectionState;
  group?: string; time: number;
};
export const TEXT_HISTORY_BYTES = 8 * 1024 * 1024;

export function bufferTextEdit(before: string, after: string, metadata?: TextEditMetadata, time = Date.now()): BufferedTextEdit {
  let start = 0, oldEnd = before.length, newEnd = after.length;
  // Native input supplies an edit boundary. Validate it with native string
  // comparisons instead of scanning a large document character by character.
  const hintStart = metadata ? Math.min(metadata.before.selectionStart, metadata.after.selectionStart) : -1;
  const hintOldEnd = metadata ? Math.max(metadata.before.selectionEnd, before.length - after.length + metadata.after.selectionStart) : -1;
  const hintNewEnd = hintOldEnd + after.length - before.length;
  if (hintStart >= 0 && hintOldEnd >= hintStart && hintNewEnd >= hintStart && hintOldEnd <= before.length && hintNewEnd <= after.length &&
      before.slice(0, hintStart) === after.slice(0, hintStart) && before.slice(hintOldEnd) === after.slice(hintNewEnd)) {
    start = hintStart; oldEnd = hintOldEnd; newEnd = hintNewEnd;
  } else {
    while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
    while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  }
  const snapshot = createTextHistoryEntry(before, after, metadata);
  return { start, removed: before.slice(start, oldEnd), inserted: after.slice(start, newEnd), before: snapshot.before.selection, after: snapshot.after.selection, group: metadata?.group, time };
}

export function applyBufferedTextEdit(content: string, edit: BufferedTextEdit, undo: boolean) {
  const expected = undo ? edit.inserted : edit.removed;
  const replacement = undo ? edit.removed : edit.inserted;
  if (content.slice(edit.start, edit.start + expected.length) !== expected) throw new Error("Text history does not match current document");
  return content.slice(0, edit.start) + replacement + content.slice(edit.start + expected.length);
}

export function limitTextHistory(history: BufferedTextEdit[], budget = TEXT_HISTORY_BYTES) {
  let bytes = 0, start = history.length;
  while (start > 0 && history.length - start < HISTORY_LIMIT) {
    const edit = history[start - 1];
    const cost = (edit.inserted.length + edit.removed.length) * 2 + 256;
    // Keep at least one reversible transaction even when a paste exceeds budget.
    if (start < history.length && bytes + cost > budget) break;
    bytes += cost; start--;
  }
  return history.slice(start);
}

export function appendTextHistory(history: BufferedTextEdit[], edit: BufferedTextEdit, currentBefore: string) {
  const last = history.at(-1);
  // Preserve the existing per-edit undo granularity. Only explicit IME groups
  // merge; memory savings come from deltas rather than changing user behavior.
  if (last && edit.group && edit.group === last.group) {
    const original = applyBufferedTextEdit(currentBefore, last, true);
    const final = applyBufferedTextEdit(currentBefore, edit, false);
    const merged = bufferTextEdit(original, final, { before: last.before, after: edit.after, group: edit.group }, edit.time);
    return limitTextHistory([...history.slice(0, -1), merged]);
  }
  return limitTextHistory([...history, edit]);
}
