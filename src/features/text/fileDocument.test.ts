import { describe, expect, it } from "vitest";
import { getFileDocumentMode, isMarkdownFileName } from "./fileDocument";

describe("file document mode", () => {
  it("detects markdown names without overriding an explicit mode", () => {
    expect(isMarkdownFileName("README.MD")).toBe(true);
    expect(getFileDocumentMode({ fileName: "README.md" })).toBe("markdown");
    expect(getFileDocumentMode({ fileName: "README.md", documentMode: "text" })).toBe("text");
  });

  it("defaults ordinary and unnamed files to text", () => {
    expect(getFileDocumentMode({ fileName: "todo.txt", filePath: "D:\\Notes\\todo.txt" })).toBe("text");
    expect(getFileDocumentMode({ fileName: "" })).toBe("text");
  });
});
