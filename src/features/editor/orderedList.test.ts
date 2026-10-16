import { describe, expect, it } from "vitest";
import { orderedListEdit } from "./orderedList";

describe("ordered list keyboard edits", () => {
  it("creates a child on a blank line below a numbered parent", () => {
    const text = "6. 测试\n";
    expect(orderedListEdit(text, text.length, text.length, "child")).toEqual({ content: "6. 测试\n6.1 ", caret: text.length + 4 });
  });
  it("continues child and deeper siblings", () => {
    for (const [text, next] of [["6.1 子项", "6.2 "], ["6.1.9 子项", "6.1.10 "]]) {
      expect(orderedListEdit(text, text.length, text.length, "continue")?.content).toBe(`${text}\n${next}`);
    }
  });
  it("indents the empty sibling created by Shift+Enter beneath its previous parent", () => {
    for (const [text, expected] of [["6. 测试\n7. ", "6. 测试\n6.1 "], ["6.1 子项\n6.2 ", "6.1 子项\n6.1.1 "]]) {
      expect(orderedListEdit(text, text.length, text.length, "child")?.content).toBe(expected);
    }
  });
  it("adds subsequent child siblings on blank lines", () => {
    expect(orderedListEdit("6.1 子项\n", 7, 7, "child")?.content).toBe("6.1 子项\n6.2 ");
  });
  it("nests a numbered line while preserving its text", () => {
    expect(orderedListEdit("6. 测试", 5, 5, "child")).toEqual({ content: "6.1 测试", caret: 6 });
  });
  it("preserves existing delimiters, indentation and padding for Shift+Enter", () => {
    const text = "  009) 测试";
    expect(orderedListEdit(text, text.length, text.length, "continue")?.content).toBe(`${text}\n  010) `);
  });
  it("does not intercept regular lines, selections or separated lists", () => {
    expect(orderedListEdit("普通文本", 4, 4, "child")).toBeNull();
    expect(orderedListEdit("6. 测试", 3, 5, "child")).toBeNull();
    expect(orderedListEdit("6. 测试\n\n", 7, 7, "child")).toBeNull();
    expect(orderedListEdit("version 6.1", 11, 11, "continue")).toBeNull();
  });
});
