import { describe, expect, it } from "vitest";
import type { CanvasTab, FileTab, RecentFile } from "../../appTypes";
import { findTextMatches, getQuickOpenResults, searchWorkspace } from "./searchModel";

function fileTab(id: string, content: string, overrides: Partial<FileTab> = {}): FileTab {
  return { id, kind: "file", title: id, fileName: `${id}.txt`, content, themeIndex: 0, dirty: false, ...overrides };
}

function recentFile(path: string): RecentFile {
  return { path, name: path.split("/").at(-1)!, openedAt: 1 };
}

describe("bounded text search", () => {
  it("preserves line numbers and absolute selection offsets across mixed line endings", () => {
    const content = "a\r\nFoO foo\rb\nFOO";
    expect(findTextMatches(content, " foo ")).toEqual([
      { line: 2, preview: "FoO foo", selectionStart: 3, selectionEnd: 6 },
      { line: 2, preview: "FoO foo", selectionStart: 7, selectionEnd: 10 },
      { line: 4, preview: "FOO", selectionStart: 13, selectionEnd: 16 },
    ]);
  });

  it("finds non-overlapping matches and preserves UTF-16 offsets after emoji", () => {
    expect(findTextMatches("😀aaaa", "aa").map((match) => [match.selectionStart, match.selectionEnd])).toEqual([[2, 4], [4, 6]]);
  });

  it("caps results on both many lines and a single long line", () => {
    const manyLines = findTextMatches("hit\n".repeat(100_000), "hit");
    expect(manyLines).toHaveLength(80);
    expect(manyLines.at(-1)).toMatchObject({ line: 80, selectionStart: 316, selectionEnd: 319 });
    expect(findTextMatches("hit ".repeat(100_000), "hit", 3).map((match) => match.selectionStart)).toEqual([0, 4, 8]);
  });

  it("handles empty queries and does not match across lines", () => {
    expect(findTextMatches("text", " \t ")).toEqual([]);
    expect(findTextMatches("a\nb", "a\nb")).toEqual([]);
    expect(findTextMatches("a\n", "a", 0)).toEqual([]);
  });
});

describe("workspace search", () => {
  it("searches only the selected tab in current-page mode", () => {
    const tabs = [fileTab("a", "hit"), fileTab("b", "hit hit")];
    const results = searchWorkspace({ tabs, recentFiles: [recentFile("D:/hit.txt")], query: "hit", scope: "current", activeTabId: "b" });
    expect(results.map((result) => [result.tabId, result.selectionStart])).toEqual([["b", 0], ["b", 4]]);
  });

  it("keeps title results first and shares the limit with text matches", () => {
    const results = searchWorkspace({ tabs: [fileTab("hit", "hit hit hit")], recentFiles: [], query: "hit", scope: "all", activeTabId: "hit", limit: 2 });
    expect(results.map((result) => result.kind)).toEqual(["tab-title", "file"]);
    expect(results[1].id).toBe("hit:match:0");
  });

  it("stops before reading later tabs once enough results are found", () => {
    const unread = fileTab("later", "hit");
    Object.defineProperty(unread, "title", { get: () => { throw new Error("must not read later tabs"); } });
    expect(searchWorkspace({ tabs: [fileTab("first", "hit\n".repeat(100)), unread], recentFiles: [], query: "hit", scope: "all", activeTabId: "first" })).toHaveLength(80);
  });

  it("includes canvas text and excludes recent files already open regardless of path case", () => {
    const canvas: CanvasTab = {
      id: "canvas", kind: "canvas", title: "Board", autoTitle: false, scale: 1, panX: 0, panY: 0, themeIndex: 0, dirty: false, history: [], historyIndex: 0,
      items: [{ id: "note", type: "text", text: "A HIT here", x: 0, y: 0, width: 100, height: 50 }],
    };
    const results = searchWorkspace({ tabs: [canvas, fileTab("saved", "", { filePath: "D:/HIT.txt" })], recentFiles: [recentFile("d:/hit.txt"), recentFile("D:/other-hit.txt")], query: "hit", scope: "all", activeTabId: "canvas" });
    expect(results.map((result) => result.id)).toEqual(["canvas:note", "recent:d:/other-hit.txt"]);
  });
});

describe("quick open", () => {
  it("keeps open tabs before recent files and filters names and paths", () => {
    const tabs = [fileTab("note", "", { filePath: "D:/notes/open.txt" })];
    const recent = [recentFile("d:/NOTES/open.txt"), recentFile("D:/notes/closed.txt")];
    expect(getQuickOpenResults(tabs, recent, " NOTES ").map((result) => result.id)).toEqual(["tab:note", "recent:d:/notes/closed.txt"]);
  });

  it("does not scan remaining tabs after filling the limit", () => {
    const unread = fileTab("later", "");
    Object.defineProperty(unread, "title", { get: () => { throw new Error("must not read later tabs"); } });
    const tabs = [...Array.from({ length: 40 }, (_, index) => fileTab(`tab-${index}`, "")), unread];
    expect(getQuickOpenResults(tabs, [], "")).toHaveLength(40);
    expect(getQuickOpenResults(tabs, [], "", 0)).toEqual([]);
  });
});
