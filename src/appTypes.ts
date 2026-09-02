import type { PluginSettings } from "./pluginSettings";
import type { MindMapDocument } from "./features/mindmap/mindMapTypes";

export type PaneKey = string;
export type TabLayout = "top" | "left";
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
export type CanvasSnapshot = {
  items: CanvasItem[];
  mindMap?: MindMapDocument;
};
export type FileDocumentMode = "text" | "markdown";
export type MarkdownRenderEnv = { filePath?: string };

export type CanvasTab = {
  id: string;
  pinned?: boolean;
  kind: "canvas";
  title: string;
  autoTitle: boolean;
  themeIndex: number;
  scale: number;
  panX: number;
  panY: number;
  items: CanvasItem[];
  mindMap?: MindMapDocument;
  history: CanvasSnapshot[];
  historyIndex: number;
  filePath?: string;
  lastKnownMtimeMs?: number;
  lastKnownSize?: number;
  dirty: boolean;
};

export type FileTab = {
  id: string;
  pinned?: boolean;
  kind: "file";
  title: string;
  fileName: string;
  filePath?: string;
  content: string;
  documentMode?: FileDocumentMode;
  fontSize?: number;
  themeIndex: number;
  lastKnownMtimeMs?: number;
  lastKnownSize?: number;
  dirty: boolean;
};

export type FileViewState = {
  editorScrollTop: number;
  editorScrollLeft: number;
  selectionStart: number;
  selectionEnd: number;
  selectionDirection: "forward" | "backward" | "none";
  markdownMode: "edit" | "preview";
  previewScrollTop: number;
  livePreviewScrollTop: number;
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
  | "fileFontReset"
  | "toggleFullscreen"
  | "save"
  | "search"
  | "quickOpen"
  | "undo"
  | "redo"
  | "redoAlt"
  | "paste"
  | "deleteSelected"
  | "previousTab"
  | "nextTab"
  | "toggleTabLayout"
  | "splitLeft"
  | "splitRight";

export type ShortcutConfig = Record<ShortcutAction, string>;

export type AppSettings = {
  handwritten: boolean;
  programmerMode: boolean;
  darkMode: boolean;
  followSystemTheme: boolean;
  tabLayout: TabLayout;
  sidebarWidth: number;
  defaultSaveDirectory: string;
  plugins: PluginSettings;
  shortcuts: ShortcutConfig;
};

export type PersistedCanvasTab = Omit<CanvasTab, "history" | "historyIndex">;
export type PersistedTab = PersistedCanvasTab | FileTab;

export type PersistedWorkspace = {
  version: 1 | 2 | 3 | 4 | 5;
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
  recentFiles?: RecentFile[];
  tabs: PersistedTab[];
};

export type RecentFile = {
  path: string;
  name: string;
  openedAt: number;
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
  tabId?: string;
  filePath?: string;
  itemId?: string;
  kind: "canvas-text" | "file" | "tab-title" | "recent-file";
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
