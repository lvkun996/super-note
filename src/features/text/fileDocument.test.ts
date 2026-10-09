import { describe, expect, it } from "vitest";
import { formatOpenedFileContent, getFileDocumentMode, isJsonFileName, isMarkdownFileName } from "./fileDocument";

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

  it("formats valid JSON files when they are opened", () => {
    expect(isJsonFileName("settings.JSON")).toBe(true);
    expect(formatOpenedFileContent('{"name":"Super Note","items":[1,2]}', "settings.json")).toBe(
      '{\n  "name": "Super Note",\n  "items": [\n    1,\n    2\n  ]\n}',
    );
  });

  it("preserves non-JSON files and invalid JSON text", () => {
    expect(formatOpenedFileContent('{"compact":true}', "notes.txt")).toBe('{"compact":true}');
    expect(formatOpenedFileContent("{ invalid", "broken.json")).toBe("{ invalid");
  });

  it("normalizes existing text and Markdown files to the textarea's line breaks", () => {
    expect(formatOpenedFileContent("first\r\r\n\r\r\n232", "notes.txt")).toBe("first\n\n\n\n232");
    expect(formatOpenedFileContent("# title\r\n\r\ntext", "notes.md")).toBe("# title\n\ntext");
    expect(formatOpenedFileContent("{ invalid\r\n", "broken.json")).toBe("{ invalid\n");
  });
});
