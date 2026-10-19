import { describe, expect, it } from "vitest";
import { createCanvasPayload, createCanvasTab, createTabFromOpenedFile, restoreTab, stripTab } from "./tabDocument";
import { cloneCanvasSnapshot, HISTORY_LIMIT, pushHistory } from "../history/historyModel";
import { createMindMap } from "../mindmap/mindMapModel";

describe("extracted document and history boundaries", () => {
  it("round trips saved canvases without persisting undo history", () => {
    const tab = createCanvasTab(2);
    tab.items = [{ id: "text", type: "text", text: "笔记", x: 1, y: 2, width: 100, height: 30 }];
    tab.mindMap = createMindMap({ x: 320, y: 240 });
    const payload = createCanvasPayload(tab);
    expect(payload.tab).not.toHaveProperty("history");
    expect(payload.tab).not.toHaveProperty("historyIndex");
    expect(payload.tab.dirty).toBe(false);
    const opened = createTabFromOpenedFile({ name: "notes.snote", path: "C:\\notes.snote", content: JSON.stringify(payload) }, 3);
    expect(opened.kind).toBe("canvas");
    if (opened.kind !== "canvas") throw new Error("Expected a canvas");
    expect(opened.items).toEqual(tab.items);
    expect(opened.mindMap).toEqual(tab.mindMap);
    expect(opened.history).toEqual([cloneCanvasSnapshot(tab.items, tab.mindMap)]);
    expect(opened.id).not.toBe(tab.id);
    expect(opened.filePath).toBe("C:\\notes.snote");
    expect(tab.dirty).toBe(true);
  });

  it("discards redo snapshots after branching and keeps snapshots independent", () => {
    const tab = createCanvasTab(0);
    const items = [{ id: "text", type: "text" as const, text: "first", x: 0, y: 0, width: 10, height: 10 }];
    Object.assign(tab, pushHistory(tab, items));
    const map = createMindMap({ x: 320, y: 240 });
    Object.assign(tab, pushHistory(tab, items, map));
    tab.historyIndex = 0;
    const branch = pushHistory(tab, items, map);
    items[0].text = "mutated";
    map.nodes[0].text = "mutated";
    expect(branch.history).toHaveLength(2);
    expect(branch.historyIndex).toBe(1);
    expect(branch.history[1].items[0]).toHaveProperty("text", "first");
    expect(branch.history[1].mindMap?.nodes[0].text).not.toBe("mutated");
  });

  it("bounds canvas history while retaining the newest snapshot", () => {
    const tab = createCanvasTab(0);
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) Object.assign(tab, pushHistory(tab, []));
    expect(tab.history).toHaveLength(HISTORY_LIMIT);
    expect(tab.historyIndex).toBe(HISTORY_LIMIT - 1);
  });

  it("restores legacy text with normalized newlines and keeps its unsaved status", () => {
    const tab = restoreTab({ id: "old", kind: "file", title: "Old", fileName: "old.md", content: "甲\r\n乙\r丙", themeIndex: 0, dirty: true });
    expect(tab).toMatchObject({ content: "甲\n乙\n丙", documentMode: "markdown", dirty: true, fontSize: 13 });
    expect(stripTab(tab)).toBe(tab);
  });

  it("preserves malformed canvas files as editable text instead of losing content", () => {
    const tab = createTabFromOpenedFile({ name: "broken.snote", content: "{invalid" }, 0);
    expect(tab).toMatchObject({ kind: "file", content: "{invalid", dirty: false });
  });
});

