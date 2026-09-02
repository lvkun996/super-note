import { describe, expect, it } from "vitest";
import { deleteAtCarets, getDirectionalSelectionRange, insertAtCarets } from "./multiCaret";

describe("multi-caret editing", () => {
  it("preserves forward and backward selection direction", () => {
    expect(getDirectionalSelectionRange(3, 9)).toEqual({ start: 3, end: 9, direction: "forward" });
    expect(getDirectionalSelectionRange(9, 3)).toEqual({ start: 3, end: 9, direction: "backward" });
  });

  it("inserts the same text at every caret", () => {
    expect(insertAtCarets("one\ntwo\nthree", [1, 5, 9], "A")).toEqual({
      content: "oAne\ntAwo\ntAhree",
      carets: [2, 7, 12],
    });
  });

  it("deletes backward at every caret", () => {
    expect(deleteAtCarets("a1\nb2\nc3", [2, 5, 8], "backward")).toEqual({
      content: "a\nb\nc",
      carets: [1, 3, 5],
    });
  });

  it("deletes forward without deleting the same character twice", () => {
    expect(deleteAtCarets("abcd", [1, 1, 2], "forward")).toEqual({
      content: "ad",
      carets: [1],
    });
  });
});
