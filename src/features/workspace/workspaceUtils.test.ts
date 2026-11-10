import { describe, expect, it } from "vitest";
import type { PersistedWorkspace } from "../../appTypes";
import { restoreWorkspace } from "./restoreWorkspace";
import {
  CURRENT_WORKSPACE_VERSION,
  normalizeRecentFiles,
  rememberRecentFiles,
  selectWorkspaceCandidate,
} from "./workspaceUtils";

function workspace(savedAt: string): PersistedWorkspace {
  return {
    version: CURRENT_WORKSPACE_VERSION,
    savedAt,
    activeTabId: "",
    splitView: false,
    tabs: [],
  };
}

describe("workspace recovery", () => {
  it("prefers a valid primary workspace", () => {
    const primary = workspace("primary");
    const backup = workspace("backup");
    expect(selectWorkspaceCandidate(primary, backup)).toEqual({ workspace: primary, source: "primary" });
  });

  it("falls back to backup when primary is invalid", () => {
    const backup = workspace("backup");
    expect(selectWorkspaceCandidate({ version: 5 }, backup)).toEqual({ workspace: backup, source: "backup" });
  });

  it("retains saved pane assignments and repairs a selected tab in the wrong pane", () => {
    const file = (id: string) => ({ id, kind: "file" as const, fileName: `${id}.txt`, title: id, content: id, themeIndex: 0, dirty: false });
    const restored = restoreWorkspace({
      ...workspace("saved"),
      tabs: [file("one"), file("two"), file("three")],
      paneIds: ["left", "right", "unused"],
      tabPaneIds: { one: ["left", "missing"], two: ["right", "right"], three: ["right"] },
      paneActiveTabIds: { left: "three", right: "three" },
      activePane: "right",
    }, "pane-main");
    expect(restored.paneIds).toEqual(["left", "right"]);
    expect(restored.activePane).toBe("right");
    expect(restored.tabPaneIds).toEqual({ one: ["left"], two: ["right"], three: ["right"] });
    expect(restored.paneActiveTabIds).toEqual({ left: "one", right: "three" });
  });

  it("restores the shared tab and width of a legacy split workspace", () => {
    const restored = restoreWorkspace({
      ...workspace("saved"),
      version: 3,
      tabs: [{ id: "shared", kind: "file", fileName: "note.txt", title: "Note", content: "text", themeIndex: 0, dirty: false }],
      activePane: "right",
      splitTabId: "shared",
      splitRatio: 60,
    }, "pane-main");
    expect(restored.activePane).toBe("pane-right");
    expect(restored.paneWidths).toEqual([60, 40]);
    expect(restored.tabPaneIds.shared).toEqual(["pane-left", "pane-right"]);
    expect(restored.paneActiveTabIds).toEqual({ "pane-left": "shared", "pane-right": "shared" });
  });
});

describe("recent files", () => {
  it("deduplicates paths case-insensitively and keeps newest first", () => {
    expect(
      normalizeRecentFiles([
        { path: "C:\\Notes\\One.md", name: "One.md", openedAt: 2 },
        { path: "c:\\notes\\one.md", name: "old.md", openedAt: 1 },
        { path: "C:\\Notes\\Two.md", name: "Two.md", openedAt: 3 },
      ]).map((file) => file.name),
    ).toEqual(["Two.md", "One.md"]);
  });

  it("moves reopened files to the front", () => {
    const current = [{ path: "C:\\One.md", name: "One.md", openedAt: 1 }];
    expect(rememberRecentFiles(current, [{ path: "C:\\Two.md", name: "Two.md" }], 10)[0].name).toBe("Two.md");
  });
});
