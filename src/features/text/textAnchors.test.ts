import { describe, expect, it } from "vitest";
import { createTextAnchor, normalizeTextAnchors, updateTextAnchors } from "./textAnchors";

describe("text anchors", () => {
  it("trims selection whitespace and creates a readable label", () => {
    expect(createTextAnchor("  first\nsecond  ", 0, 16, "a")).toEqual({
      id: "a",
      start: 2,
      end: 14,
      label: "first second",
    });
  });

  it("moves anchors when text is inserted before them", () => {
    const anchors = [{ id: "a", start: 6, end: 11, label: "world" }];
    expect(updateTextAnchors("hello world", "say hello world", anchors)).toEqual([
      { id: "a", start: 10, end: 15, label: "world" },
    ]);
  });

  it("updates the anchored range when editing inside it", () => {
    const anchors = [{ id: "a", start: 0, end: 5, label: "hello" }];
    expect(updateTextAnchors("hello world", "helXXlo world", anchors)).toEqual([
      { id: "a", start: 0, end: 7, label: "helXXlo" },
    ]);
  });

  it("removes anchors whose selected text was deleted", () => {
    const anchors = [{ id: "a", start: 6, end: 11, label: "world" }];
    expect(updateTextAnchors("hello world", "hello ", anchors)).toEqual([]);
  });

  it("filters invalid and duplicate persisted anchors", () => {
    expect(normalizeTextAnchors([
      { id: "a", start: 0, end: 5 },
      { id: "b", start: 0, end: 5 },
      { id: "", start: 0, end: 2 },
    ], "hello")).toEqual([{ id: "a", start: 0, end: 5, label: "hello" }]);
  });
});
