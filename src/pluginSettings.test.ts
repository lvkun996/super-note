import { describe, expect, it } from "vitest";
import { DEFAULT_PLUGIN_SETTINGS, getCanvasMode, normalizePluginSettings } from "./pluginSettings";

describe("independent mind-map plugin", () => {
  it("requires explicit opt-in, including old canvas-enabled workspaces", () => {
    expect(normalizePluginSettings()).toEqual(DEFAULT_PLUGIN_SETTINGS);
    expect(normalizePluginSettings({ canvas: true })).toEqual({ canvas: true, mindMap: false });
  });
  it("does not require enabling the canvas plugin", () => {
    expect(normalizePluginSettings({ mindMap: true })).toEqual({ canvas: false, mindMap: true });
    expect(normalizePluginSettings({ canvas: true, mindMap: false }).mindMap).toBe(false);
  });
  it("restores old mixed documents without removing any contents", () => {
    const doc = { mindMap: { rootId: "root" }, items: [{ text: "legacy" }] };
    expect(getCanvasMode(doc)).toBe("mindmap");
    expect(doc.items[0].text).toBe("legacy");
    expect(getCanvasMode({})).toBe("board");
  });
  it("keeps an empty mind-map document separate after deleting its map", () => {
    expect(getCanvasMode({ canvasMode: "mindmap" })).toBe("mindmap");
    expect(getCanvasMode({ canvasMode: "board" })).toBe("board");
  });
});
