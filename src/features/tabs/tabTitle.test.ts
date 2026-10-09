import { afterEach, describe, expect, it } from "vitest";
import { setUiLanguage } from "../../../electron/uiLanguage";
import type { FileTab } from "../../appTypes";
import { getTabDisplayTitle, getTextTitlePrefix } from "./tabTitle";

function fileTab(content: string, overrides: Partial<FileTab> = {}): FileTab {
  return { id: "tab", kind: "file", title: "未命名文本", fileName: "untitled.txt", content, themeIndex: 0, dirty: true, ...overrides };
}

afterEach(() => setUiLanguage("zh-CN"));

describe("content-derived tab titles", () => {
  it.each([
    "", " \t\r\n ", "  hello \t world \n", "1234567890123   ",
    "1234567890123   x", "1234567890123456", "  😀你好\t🌍 hello\nthere",
    "\u00a0\uFEFFabc\u2028def\u3000ghi  ",
  ])("preserves whitespace normalization and Unicode characters for %j", (content) => {
    const expected = Array.from(content.replace(/\s+/g, " ").trim()).slice(0, 14).join("");
    expect(getTextTitlePrefix(content)).toBe(expected);
  });

  it("uses only the short prefix of a large document", () => {
    expect(getTextTitlePrefix("12345678901234" + "尾部内容".repeat(250_000))).toBe("12345678901234");
  });

  it("preserves explicit names and saved-file names", () => {
    expect(getTabDisplayTitle(fileTab("body", { title: "My note" }))).toBe("My note");
    expect(getTabDisplayTitle(fileTab("body", { filePath: "D:/untitled.txt" }))).toBe("未命名文本");
    expect(getTabDisplayTitle(fileTab(" \t "))).toBe("未命名文本");
    expect(getTabDisplayTitle(fileTab("hello world"))).toBe("hello world...");
  });

  it("recognizes the English untitled prefix", () => {
    setUiLanguage("en-US");
    expect(getTabDisplayTitle(fileTab("hello", { title: "Untitled Text" }))).toBe("hello...");
  });
});
