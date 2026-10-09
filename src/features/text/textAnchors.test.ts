import { describe, expect, it } from "vitest";
import { createTextAnchor, normalizeTextAnchors, normalizeTextAnchorsForEditor, updateTextAnchors } from "./textAnchors";

describe("text anchors", () => {
  it("preserves anchor targets across persisted CRLF normalization", () => {
    const content = "first\r\r\n\r\r\n232\r\nlast";
    const start = content.indexOf("232");
    expect(normalizeTextAnchorsForEditor([
      { id: "a", start, end: start + 3, label: "232" },
      { id: "b", start: content.indexOf("last"), end: content.length, label: "last" },
    ], content)).toEqual([
      { id: "a", start: 9, end: 12, label: "232" },
      { id: "b", start: 13, end: 17, label: "last" },
    ]);
  });
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
