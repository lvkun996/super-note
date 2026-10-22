import { describe, expect, it } from "vitest";
import { appendTextHistory, applyBufferedTextEdit, bufferTextEdit, limitTextHistory } from "./textHistoryBuffer";

describe("bounded incremental text history", () => {
  it("stores only the change in a long document and reverses it exactly", () => {
    const original = "中文🙂\n".repeat(200000);
    const next = original.slice(0, 400000) + "X" + original.slice(400000);
    const edit = bufferTextEdit(original, next);
    expect(edit.removed).toBe(""); expect(edit.inserted).toBe("X");
    expect(applyBufferedTextEdit(next, edit, true)).toBe(original);
    expect(applyBufferedTextEdit(original, edit, false)).toBe(next);
  });
  it("merges composition replacements while retaining the initial backward selection", () => {
    const before = { selectionStart: 2, selectionEnd: 4, selectionDirection: "backward" as const, scrollTop: 180, scrollLeft: 0, carets: [2, 4] };
    const after = { ...before, selectionStart: 3, selectionEnd: 3, carets: [] };
    const first = bufferTextEdit("abXXcd", "abncd", { before, after, group: "ime" });
    const second = bufferTextEdit("abncd", "ab你cd", { before: after, after, group: "ime" });
    const history = appendTextHistory([first], second, "abncd");
    expect(history).toHaveLength(1);
    expect(history[0].before).toMatchObject(before);
    expect(applyBufferedTextEdit("ab你cd", history[0], true)).toBe("abXXcd");
    expect(applyBufferedTextEdit("abXXcd", history[0], false)).toBe("ab你cd");
  });
  it("keeps normal undo steps separate and trims by bytes without losing the newest edit", () => {
    const first = bufferTextEdit("", "a"), second = bufferTextEdit("a", "ab");
    expect(appendTextHistory([first], second, "a")).toHaveLength(2);
    expect(limitTextHistory([first, second], 300)).toEqual([second]);
    const paste = bufferTextEdit("a", "x".repeat(10000));
    expect(limitTextHistory([first, paste], 1)).toEqual([paste]);
    expect(() => applyBufferedTextEdit("different", second, true)).toThrow();
  });
  it("validates native edit hints for insertion, deletion and falls back for distributed edits", () => {
    const selection = (start: number, end = start) => ({ selectionStart: start, selectionEnd: end, selectionDirection: "none" as const, scrollTop: 0, scrollLeft: 0 });
    for (const [before, after, start, end, caret] of [
      ["abc", "abXc", 2, 2, 3], ["abc", "ac", 2, 2, 1], ["abc", "ac", 1, 1, 1],
      ["abXXcd", "ab你cd", 2, 4, 3], ["a\nb\nc", "Xa\nXb\nXc", 0, 0, 1],
    ] as const) {
      const edit = bufferTextEdit(before, after, { before: selection(start, end), after: selection(caret) });
      expect(applyBufferedTextEdit(after, edit, true)).toBe(before);
      expect(applyBufferedTextEdit(before, edit, false)).toBe(after);
    }
  });
});
