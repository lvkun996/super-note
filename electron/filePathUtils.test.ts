import { describe, expect, it } from "vitest";
import { appendExtensionIfMissing } from "./filePathUtils";

describe("save file extension handling", () => {
  it("preserves an extension explicitly entered by the user", () => {
    expect(appendExtensionIfMissing("C:\\Notes\\a.md", "txt")).toBe("C:\\Notes\\a.md");
  });

  it("adds the default extension when the name has none", () => {
    expect(appendExtensionIfMissing("C:\\Notes\\a", "md")).toBe("C:\\Notes\\a.md");
  });
});
