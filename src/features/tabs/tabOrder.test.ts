import { describe, expect, it } from "vitest";
import { reorderTabsById } from "./tabOrder";

const tabs = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("reorderTabsById", () => {
  it("moves a tab before another tab", () => {
    expect(reorderTabsById(tabs, "d", "b", "before").map((tab) => tab.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("moves a tab after another tab", () => {
    expect(reorderTabsById(tabs, "a", "c", "after").map((tab) => tab.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("reorders only positions occupied by the current pane", () => {
    const paneIds = new Set(["a", "c", "d"]);
    expect(reorderTabsById(tabs, "d", "a", "before", paneIds).map((tab) => tab.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("preserves the original array for invalid and no-op moves", () => {
    expect(reorderTabsById(tabs, "a", "a", "before")).toBe(tabs);
    expect(reorderTabsById(tabs, "missing", "a", "before")).toBe(tabs);
  });
});
