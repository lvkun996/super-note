import { describe, expect, it } from "vitest";
import { getWindowMaterial } from "./windowMaterial";

describe("native window backdrop compatibility", () => {
  it.each(["10.0.22621", "10.0.22631", "10.0.26100"])("uses acrylic on supported Windows %s", (release) => {
    expect(getWindowMaterial("win32", release, true)).toBe("acrylic");
  });
  it.each([
    ["win32", "10.0.22000", true],
    ["win32", "10.0.19045", true],
    ["win32", "6.1.7601", true],
    ["win32", "10.0.22631", false],
    ["darwin", "24.0.0", true],
    ["linux", "6.8.0", true],
    ["win32", "unknown", true],
  ])("keeps the opaque fallback for %s %s with API availability %s", (platform, release, available) => {
    expect(getWindowMaterial(platform, release, available)).toBeUndefined();
  });
});
