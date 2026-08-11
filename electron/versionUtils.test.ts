import { describe, expect, it } from "vitest";
import { isNewerVersion } from "./versionUtils";

describe("update version comparison", () => {
  it("accepts only a strictly newer semantic version", () => {
    expect(isNewerVersion("0.1.12", "0.1.11")).toBe(true);
    expect(isNewerVersion("0.1.11", "0.1.11")).toBe(false);
    expect(isNewerVersion("0.1.10", "0.1.11")).toBe(false);
  });

  it("rejects malformed versions", () => {
    expect(isNewerVersion("latest", "0.1.11")).toBe(false);
  });
});
