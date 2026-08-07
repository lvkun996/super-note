import { describe, expect, it } from "vitest";
import { rememberTabVisit, resolveTabAfterClose } from "./tabHistory";

describe("tab visit history", () => {
  it("keeps the most recent visit at the end without duplicates", () => {
    expect(rememberTabVisit(["a", "b"], "a")).toEqual(["b", "a"]);
  });

  it("returns to the most recently visited open tab", () => {
    expect(resolveTabAfterClose(["b", "a", "new"], "new", ["a", "b", "new"])).toBe("a");
  });
});
