export type EditorSelectionState = {
  selectionStart: number;
  selectionEnd: number;
  selectionDirection: "forward" | "backward" | "none";
  scrollTop: number;
  scrollLeft: number;
  carets?: number[];
};

export type TextEditMetadata = { before: EditorSelectionState; after: EditorSelectionState; group?: string };
export type TextHistoryEntry = {
  before: { content: string; selection: EditorSelectionState };
  after: { content: string; selection: EditorSelectionState };
  group?: string;
};
export type TextHistoryRestore = { tabId: string; requestId: number; content: string; selection: EditorSelectionState };

export function captureEditorSelection(editor: HTMLTextAreaElement, carets?: number[]): EditorSelectionState {
  return {
    selectionStart: editor.selectionStart, selectionEnd: editor.selectionEnd,
    selectionDirection: editor.selectionDirection, scrollTop: editor.scrollTop, scrollLeft: editor.scrollLeft,
    ...(carets?.length ? { carets: [...carets] } : {}),
  };
}

export function clampEditorSelection(state: EditorSelectionState, length: number): EditorSelectionState {
  const start = Math.max(0, Math.min(state.selectionStart, length));
  return { ...state, selectionStart: start, selectionEnd: Math.max(start, Math.min(state.selectionEnd, length)), carets: state.carets?.map(offset => Math.max(0, Math.min(offset, length))) };
}

// External transformations may not have a mounted editor. Infer the changed
// range so undo still returns to the edit, rather than the end of the document.
export function createTextHistoryEntry(before: string, after: string, metadata?: TextEditMetadata): TextHistoryEntry {
  if (metadata) return {
    before: { content: before, selection: clampEditorSelection(metadata.before, before.length) },
    after: { content: after, selection: clampEditorSelection(metadata.after, after.length) },
    group: metadata.group,
  };
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let previousEnd = before.length, nextEnd = after.length;
  while (previousEnd > start && nextEnd > start && before[previousEnd - 1] === after[nextEnd - 1]) { previousEnd--; nextEnd--; }
  const fallback = (selectionStart: number, selectionEnd = selectionStart): EditorSelectionState => ({ selectionStart, selectionEnd, selectionDirection: "none", scrollTop: 0, scrollLeft: 0 });
  return {
    before: { content: before, selection: fallback(start, previousEnd) },
    after: { content: after, selection: fallback(nextEnd) },
  };
}
