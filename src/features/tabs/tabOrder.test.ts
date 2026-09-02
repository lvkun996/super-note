import { describe, expect, it } from "vitest";
import { reorderTabsById, sortPinnedTabs, toggleTabPinned } from "./tabOrder";

const tabs = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("pinned tab groups", () => {
  it("pins the first tab too, and persists the flag through JSON", () => {
    const pinned = toggleTabPinned(tabs, "a");
    expect(pinned[0]).toEqual({ id: "a", pinned: true });
    expect(sortPinnedTabs(JSON.parse(JSON.stringify(pinned)))).toEqual(pinned);
    expect(tabs[0]).toEqual({ id: "a" });
  });

  it("groups multiple pins before regular tabs and supports unpinning", () => {
    const pinned = toggleTabPinned(toggleTabPinned(tabs, "c"), "d");
    expect(pinned.map((tab) => tab.id)).toEqual(["d", "c", "a", "b"]);
    const unpinned = toggleTabPinned(pinned, "d");
    expect(unpinned.map((tab) => tab.id)).toEqual(["c", "d", "a", "b"]);
    expect(unpinned[1]).toEqual({ id: "d", pinned: false });
  });

  it("restores stable groups and keeps dragging inside the pin boundary", () => {
    const restored = sortPinnedTabs([{ id: "a" }, { id: "b", pinned: true }, { id: "c", pinned: true }]);
    expect(restored.map((tab) => tab.id)).toEqual(["b", "c", "a"]);
    expect(reorderTabsById(restored, "a", "b", "before")).toBe(restored);
    expect(reorderTabsById(restored, "c", "b", "before").map((tab) => tab.id)).toEqual(["c", "b", "a"]);
    expect(toggleTabPinned(restored, "missing")).toBe(restored);
  });
});

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
