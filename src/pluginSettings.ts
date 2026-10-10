export type PluginSettings = {
  canvas: boolean;
  mindMap: boolean;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  canvas: false,
  mindMap: false,
};

export function normalizePluginSettings(value?: Partial<PluginSettings>): PluginSettings {
  return {
    canvas: Boolean(value?.canvas),
    mindMap: Boolean(value?.mindMap),
  };
}

// Preserve mixed legacy boards as a mind-map document, including all items.
export function getCanvasMode(tab: { canvasMode?: "board" | "mindmap"; mindMap?: unknown }) {
  return tab.mindMap || tab.canvasMode === "mindmap" ? "mindmap" : "board";
}
