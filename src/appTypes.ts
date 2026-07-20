import type { PluginSettings } from "./pluginSettings";

export type PaneKey = string;
export type LegacyPaneKey = "left" | "right";
export type LegacyTabPlacement = LegacyPaneKey | "both";

export type CanvasTheme = {
  accent: string;
};

export type TextCanvasItem = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  text: string;
};

export type ImageCanvasItem = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  name: string;
};

export type CanvasItem = TextCanvasItem | ImageCanvasItem;
export type FileDocumentMode = "text" | "markdown";
export type MarkdownRenderEnv = { filePath?: string };

export type CanvasTab = {
  id: string;
  kind: "canvas";
  title: string;
  autoTitle: boolean;
  themeIndex: number;
  scale: number;
  panX: number;
  panY: number;
  items: CanvasItem[];
  history: CanvasItem[][];
  historyIndex: number;
  filePath?: string;
  dirty: boolean;
};

export type FileTab = {
  id: string;
  kind: "file";
  title: string;
  fileName: string;
  filePath?: string;
  content: string;
  documentMode?: FileDocumentMode;
  fontSize?: number;
  themeIndex: number;
  dirty: boolean;
};

export type NoteTab = CanvasTab | FileTab;

export type CanvasItemOverride = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
};

export type CanvasViewState = {
  scale: number;
  panX: number;
  panY: number;
  itemOverrides: Record<string, CanvasItemOverride>;
};

export type ShortcutAction =
  | "newCanvas"
  | "newText"
  | "closeTab"
  | "fileFontIncrease"
  | "fileFontDecrease"
  | "save"
  | "search"
  | "undo"
  | "redo"
  | "redoAlt"
  | "paste"
  | "deleteSelected"
  | "previousTab"
  | "nextTab"
  | "splitLeft"
  | "splitRight";

export type ShortcutConfig = Record<ShortcutAction, string>;

export type AppSettings = {
  handwritten: boolean;
  programmerMode: boolean;
  darkMode: boolean;
  followSystemTheme: boolean;
  plugins: PluginSettings;
  shortcuts: ShortcutConfig;
};

export type PersistedCanvasTab = Omit<CanvasTab, "history" | "historyIndex">;
export type PersistedTab = PersistedCanvasTab | FileTab;

export type PersistedWorkspace = {
  version: 1 | 2 | 3 | 4;
  savedAt: string;
  activeTabId: string;
  leftActiveTabId?: string;
  rightActiveTabId?: string | null;
  activePane?: PaneKey;
  splitView: boolean;
  splitTabId?: string | null;
  splitRatio?: number;
  tabPlacements?: Record<string, LegacyTabPlacement>;
  canvasViewStates?: Record<string, Partial<Record<PaneKey, CanvasViewState>>>;
  paneIds?: PaneKey[];
  paneActiveTabIds?: Record<PaneKey, string>;
  tabPaneIds?: Record<string, PaneKey[]>;
  paneWidths?: number[];
  settings?: Partial<AppSettings>;
  tabs: PersistedTab[];
};

export type NoteFilePayload = {
  type: "super-note-canvas";
  version: 1;
  tab: PersistedCanvasTab;
};

export type SelectedItem = {
  tabId: string;
  itemId: string;
  pane: PaneKey;
} | null;

export type ItemDragState = {
  mode: "item";
  tabId: string;
  pane: PaneKey;
  itemId: string;
  surface: HTMLDivElement;
  elements: HTMLElement[];
  scale: number;
  offsetX: number;
  offsetY: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
};

export type PanDragState = {
  mode: "pan";
  tabId: string;
  pane: PaneKey;
  surface: HTMLDivElement;
  scale: number;
  startX: number;
  startY: number;
  panX: number;
  panY: number;
  currentPanX: number;
  currentPanY: number;
};

export type SplitDragState = {
  mode: "split";
  container: HTMLElement;
  dividerIndex: number;
  startX: number;
  startWidths: number[];
  currentWidths: number[];
};

export type DragState = ItemDragState | PanDragState | SplitDragState;

export type SearchResult = {
  id: string;
  tabId: string;
  itemId?: string;
  kind: "canvas-text" | "file";
  title: string;
  preview: string;
  line?: number;
  selectionStart?: number;
  selectionEnd?: number;
};

export type TextSearchTarget = {
  tabId: string;
  selectionStart: number;
  selectionEnd: number;
  requestId: number;
};

export type TextSelection = {
  start: number;
  end: number;
};

export type ProgrammerAction = "format-json" | "minify-json" | "string-to-json";
