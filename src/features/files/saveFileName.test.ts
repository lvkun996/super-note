import { describe, expect, it } from "vitest";
import { buildSaveFileName } from "./saveFileName";

describe("buildSaveFileName", () => {
  it("uses the current tab title for a new text file", () => {
    expect(buildSaveFileName("本周计划", "txt")).toBe("本周计划.txt");
  });

  it("falls back to the unnamed text title when no usable title exists", () => {
    expect(buildSaveFileName("  ", "txt")).toBe("未命名文本.txt");
    expect(buildSaveFileName("CON", "txt")).toBe("未命名文本.txt");
  });

  it("sanitizes Windows file names and does not duplicate the extension", () => {
    expect(buildSaveFileName('需求:第一版?.txt', ".txt")).toBe("需求-第一版-.txt");
    expect(buildSaveFileName("说明.md", "md", "未命名 Markdown")).toBe("说明.md");
  });
});
