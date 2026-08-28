import { describe, expect, it } from "vitest";
import { buildSnoteFileName } from "./saveFileName";

describe("buildSnoteFileName", () => {
  it("uses the current tab title for a new Super Note file", () => {
    expect(buildSnoteFileName("本周计划")).toBe("本周计划.snote");
  });

  it("falls back to the unnamed text title when no usable title exists", () => {
    expect(buildSnoteFileName("  ")).toBe("未命名文本.snote");
    expect(buildSnoteFileName("CON")).toBe("未命名文本.snote");
  });

  it("sanitizes Windows file names and does not duplicate the extension", () => {
    expect(buildSnoteFileName('需求:第一版?.snote')).toBe("需求-第一版-.snote");
  });
});
