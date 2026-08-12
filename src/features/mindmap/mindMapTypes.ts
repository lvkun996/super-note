export type MindMapStructure = "balanced" | "right";
export type MindMapBranchShape = "curve" | "elbow" | "straight";
export type MindMapTopicShape = "rounded" | "pill" | "underline";
export type MindMapPalette = "rainbow" | "indigo" | "forest" | "sunset" | "mono";
export type MindMapFontFamily = "system" | "serif" | "mono";
export type MindMapTopicFill = "white" | "soft" | "solid";

export type MindMapStyle = {
  structure: MindMapStructure;
  branchShape: MindMapBranchShape;
  branchWidth: 1 | 2 | 3 | 4;
  coloredBranches: boolean;
  palette: MindMapPalette;
  topicShape: MindMapTopicShape;
  background: string;
  horizontalGap: number;
  verticalGap: number;
  fontFamily: MindMapFontFamily;
  fontScale: number;
  fontWeight: 500 | 600 | 700;
  textColor: string;
  topicFill: MindMapTopicFill;
};

export type MindMapNode = {
  id: string;
  parentId: string | null;
  text: string;
  collapsed?: boolean;
};

export type MindMapRelationAnchor = "auto" | "top" | "right" | "bottom" | "left";

export type MindMapCanvasLink = {
  id: string;
  nodeId: string;
  itemId: string;
  nodeAnchor: MindMapRelationAnchor;
  itemAnchor: MindMapRelationAnchor;
};

export type MindMapDocument = {
  rootId: string;
  originX: number;
  originY: number;
  nodes: MindMapNode[];
  canvasLinks: MindMapCanvasLink[];
  style: MindMapStyle;
};

export type SelectedMindMapNode = {
  tabId: string;
  nodeId: string;
  pane: string;
} | null;

export const MIND_MAP_PALETTES: Record<MindMapPalette, string[]> = {
  rainbow: ["#5b5bd6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"],
  indigo: ["#4338ca", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"],
  forest: ["#166534", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac"],
  sunset: ["#be123c", "#e11d48", "#f97316", "#f59e0b", "#eab308", "#fb7185"],
  mono: ["#1f2937", "#374151", "#4b5563", "#6b7280", "#9ca3af", "#111827"],
};

export const DEFAULT_MIND_MAP_STYLE: MindMapStyle = {
  structure: "balanced",
  branchShape: "curve",
  branchWidth: 3,
  coloredBranches: true,
  palette: "rainbow",
  topicShape: "rounded",
  background: "#ffffff",
  horizontalGap: 96,
  verticalGap: 24,
  fontFamily: "system",
  fontScale: 1,
  fontWeight: 600,
  textColor: "#172033",
  topicFill: "white",
};
