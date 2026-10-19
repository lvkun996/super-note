import { describe, expect, it } from "vitest";
import { clampEditorSelection, createTextHistoryEntry } from "./textHistory";

describe("text history snapshots", () => {
  it("infers the edit position on a middle line instead of the document end", () => {
    const entry = createTextHistoryEntry("A:abc\nB:def\nC:", "A:abc\nB:defg\nC:");
    expect(entry.before.selection.selectionStart).toBe(11);
    expect(entry.after.selection.selectionStart).toBe(12);
  });
  it("preserves backward selection, scrolling and independent multi-caret arrays", () => {
    const before = { selectionStart: 2, selectionEnd: 5, selectionDirection: "backward" as const, scrollTop: 200, scrollLeft: 20, carets: [2, 5] };
    const entry = createTextHistoryEntry("012345", "01X5", { before, after: { ...before, selectionStart: 3, selectionEnd: 3, carets: [3] } });
    before.carets[0] = 99;
    expect(entry.before.selection).toMatchObject({ selectionStart: 2, selectionEnd: 5, selectionDirection: "backward", scrollTop: 200, scrollLeft: 20, carets: [2, 5] });
    expect(entry.after.selection.carets).toEqual([3]);
  });
  it("bounds restored offsets after normalization or external transforms", () => {
    expect(clampEditorSelection({ selectionStart: 10, selectionEnd: 20, selectionDirection: "none", scrollTop: 0, scrollLeft: 0, carets: [-1, 12] }, 5)).toMatchObject({ selectionStart: 5, selectionEnd: 5, carets: [0, 5] });
  });
});
