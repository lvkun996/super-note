import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { formatContentForSave, LARGE_TEXT_PREVIEW_BYTES, readTextFilePreview } from "./fileContent";

describe("file save formatting", () => {
  it("formats valid JSON only when saving a JSON file", () => {
    expect(formatContentForSave("D:\\Notes\\settings.json", '{"name":"Super Note","items":[1,2]}')).toBe(
      '{\n  "name": "Super Note",\n  "items": [\n    1,\n    2\n  ]\n}',
    );
  });

  it("keeps invalid JSON and non-JSON text unchanged", () => {
    expect(formatContentForSave("D:\\Notes\\broken.json", "{ invalid")).toBe("{ invalid");
    expect(formatContentForSave("D:\\Notes\\notes.txt", '{"compact":true}')).toBe('{"compact":true}');
  });

  it("reads only a bounded preview for large text files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "super-note-preview-"));
    const filePath = path.join(directory, "large.txt");
    try {
      await writeFile(filePath, "a".repeat(LARGE_TEXT_PREVIEW_BYTES + 1), "utf8");
      await expect(readTextFilePreview(filePath, LARGE_TEXT_PREVIEW_BYTES + 1)).resolves.toEqual({
        content: "a".repeat(LARGE_TEXT_PREVIEW_BYTES),
        truncated: true,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
