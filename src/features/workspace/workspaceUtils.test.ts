import { describe, expect, it } from "vitest";
import type { PersistedWorkspace } from "../../appTypes";
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
