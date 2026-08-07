import { describe, expect, it } from "vitest";
import { hasExternalFileChange } from "./fileState";

describe("external file changes", () => {
  it("does not report a change before a baseline exists", () => {
    expect(hasExternalFileChange({}, { exists: true, mtimeMs: 10, size: 20 })).toBe(false);
  });

  it("detects modified metadata and deletion", () => {
    const known = { lastKnownMtimeMs: 10, lastKnownSize: 20 };
    expect(hasExternalFileChange(known, { exists: true, mtimeMs: 11, size: 20 })).toBe(true);
    expect(hasExternalFileChange(known, { exists: false })).toBe(true);
  });

  it("accepts unchanged metadata", () => {
    expect(
      hasExternalFileChange(
        { lastKnownMtimeMs: 10, lastKnownSize: 20 },
        { exists: true, mtimeMs: 10, size: 20 },
      ),
    ).toBe(false);
  });
});
