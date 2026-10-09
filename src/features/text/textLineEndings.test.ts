import { describe, expect, it } from "vitest";
import { normalizeTextLineEndings, normalizeTextLineEndingOffsets } from "./textLineEndings";

describe("textarea-compatible line endings", () => {
  it.each([
    ["first\n\n232", "first\n\n232"],
    ["first\r\n\r\n232", "first\n\n232"],
    ["first\r\r232", "first\n\n232"],
    ["first\r\r\n\r\r\n232", "first\n\n\n\n232"],
    ["\t你好 😀\r\n\r", "\t你好 😀\n\n"],
    ["", ""],
  ])("normalizes %j without dropping blank lines or other text", (input, output) => {
    expect(normalizeTextLineEndings(input)).toBe(output);
    expect(normalizeTextLineEndings(output)).toBe(output);
  });

  it("maps unsorted, duplicate and CRLF-boundary offsets like normalized prefixes", () => {
    const content = "a\r\nb\r\r\nc\r末尾";
    const offsets = [content.length, 3, 0, 2, 3, 7, 5, -1, content.length + 5];
    expect(normalizeTextLineEndingOffsets(content, offsets)).toEqual(offsets.map((offset) =>
      normalizeTextLineEndings(content.slice(0, Math.max(0, Math.min(offset, content.length)))).length,
    ));
    expect(normalizeTextLineEndingOffsets(content, [])).toEqual([]);
  });
});
