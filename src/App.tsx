import {
  App as AntApp,
  Button,
  ConfigProvider,
  Dropdown,
  Empty,
  Input,
  Modal,
  Switch,
  Tabs,
  Tooltip,
  Typography,
  theme,
} from "antd";
import type { MenuProps, TabsProps } from "antd";
import {
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  BorderOutlined,
  MinusOutlined,
  MoonOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  QuestionCircleOutlined,
  RedoOutlined,
  SaveOutlined,
  SearchOutlined,
  SplitCellsOutlined,
  SunOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";

const HISTORY_LIMIT = 80;
const LONG_PRESS_MS = 160;
const STORAGE_KEY = "super-note-workspace";
const DEFAULT_TEXT_FONT_SIZE = 18;
const INITIAL_PANE_ID = "pane-main";

type PaneKey = string;
type LegacyPaneKey = "left" | "right";
type LegacyTabPlacement = LegacyPaneKey | "both";

type CanvasTheme = {
  accent: string;
};

type TextCanvasItem = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  text: string;
};

type ImageCanvasItem = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  name: string;
};

type CanvasItem = TextCanvasItem | ImageCanvasItem;

type CanvasTab = {
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

type FileTab = {
  id: string;
  kind: "file";
  title: string;
  fileName: string;
  filePath?: string;
  content: string;
  themeIndex: number;
  dirty: boolean;
};

type NoteTab = CanvasTab | FileTab;

type CanvasItemOverride = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
};

type CanvasViewState = {
  scale: number;
  panX: number;
  panY: number;
  itemOverrides: Record<string, CanvasItemOverride>;
};

type ShortcutAction = "save" | "search" | "undo" | "redo" | "redoAlt" | "paste" | "deleteSelected" | "splitLeft" | "splitRight";
type ShortcutConfig = Record<ShortcutAction, string>;

type AppSettings = {
  handwritten: boolean;
  programmerMode: boolean;
  darkMode: boolean;
  followSystemTheme: boolean;
  shortcuts: ShortcutConfig;
};

type PersistedCanvasTab = Omit<CanvasTab, "history" | "historyIndex">;
type PersistedTab = PersistedCanvasTab | FileTab;

type PersistedWorkspace = {
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

type NoteFilePayload = {
  type: "super-note-canvas";
  version: 1;
  tab: PersistedCanvasTab;
};

type SelectedItem = {
  tabId: string;
  itemId: string;
  pane: PaneKey;
} | null;

type ItemDragState = {
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

type PanDragState = {
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

type SplitDragState = {
  mode: "split";
  container: HTMLElement;
  dividerIndex: number;
  startX: number;
  startWidths: number[];
  currentWidths: number[];
};

type DragState = ItemDragState | PanDragState | SplitDragState;

type SearchResult = {
  id: string;
  tabId: string;
  itemId?: string;
  kind: "canvas-text" | "file";
  title: string;
  preview: string;
  line?: number;
};

type ProgrammerAction = "format-json" | "minify-json" | "string-to-json";

const canvasThemes: CanvasTheme[] = [
  { accent: "#1677ff" },
  { accent: "#13c2c2" },
  { accent: "#722ed1" },
  { accent: "#fa8c16" },
  { accent: "#eb2f96" },
  { accent: "#52c41a" },
];

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  save: "Ctrl+S",
  search: "Ctrl+F",
  undo: "Ctrl+Z",
  redo: "Ctrl+Y",
  redoAlt: "Ctrl+Shift+Z",
  paste: "Ctrl+V",
  deleteSelected: "Backspace",
  splitLeft: "Ctrl+Left",
  splitRight: "Ctrl+Right",
};

const DEFAULT_SETTINGS: AppSettings = {
  handwritten: false,
  programmerMode: false,
  darkMode: false,
  followSystemTheme: false,
  shortcuts: DEFAULT_SHORTCUTS,
};

const SHORTCUT_ROWS: Array<{ action: ShortcutAction; label: string; desc: string }> = [
  { action: "save", label: "保存当前标签", desc: "保存当前文件或画板" },
  { action: "search", label: "全局搜索", desc: "打开全局搜索面板" },
  { action: "undo", label: "撤销", desc: "撤销画板变更" },
  { action: "redo", label: "重做", desc: "重做画板变更" },
  { action: "redoAlt", label: "重做备用", desc: "兼容常见编辑器快捷键" },
  { action: "paste", label: "粘贴", desc: "粘贴文字或图片" },
  { action: "deleteSelected", label: "删除选中元素", desc: "删除画板中选中的元素" },
  { action: "splitLeft", label: "向左分割视图", desc: "把当前标签分割到左侧视图" },
  { action: "splitRight", label: "向右分割视图", desc: "把当前标签分割到右侧视图" },
];

const makeId = () => crypto.randomUUID();

function cloneItems(items: CanvasItem[]) {
  return items.map((item) => ({ ...item }));
}

function truncateTitle(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) {
    return "未知";
  }
  return clean.length > 14 ? `${clean.slice(0, 14)}...` : clean;
}

function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function deriveCanvasTitle(tab: CanvasTab, items: CanvasItem[]) {
  if (!tab.autoTitle) {
    return tab.title;
  }
  const textItem = items.find((item): item is TextCanvasItem => item.type === "text" && item.text.trim().length > 0);
  return textItem ? truncateTitle(textItem.text) : "未知";
}

function pushHistory(tab: CanvasTab, nextItems: CanvasItem[]) {
  const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
  nextHistory.push(cloneItems(nextItems));
  const limited = nextHistory.slice(-HISTORY_LIMIT);
  return {
    history: limited,
    historyIndex: limited.length - 1,
  };
}

function createCanvasTab(themeIndex: number, dirty = true): CanvasTab {
  const items: CanvasItem[] = [];
  return {
    id: makeId(),
    kind: "canvas",
    title: "未知",
    autoTitle: true,
    themeIndex,
    scale: 1,
    panX: 0,
    panY: 0,
    items,
    history: [items],
    historyIndex: 0,
    dirty,
  };
}

function createFileTab(file: OpenedFile, themeIndex: number): FileTab {
  return {
    id: makeId(),
    kind: "file",
    title: file.name,
    fileName: file.name,
    filePath: file.path,
    content: file.content,
    themeIndex,
    dirty: false,
  };
}

function restoreTab(tab: PersistedTab): NoteTab {
  if (tab.kind === "canvas") {
    const items = cloneItems(tab.items ?? []);
    return {
      ...tab,
      title: tab.title || "未知",
      autoTitle: tab.autoTitle ?? true,
      scale: tab.scale || 1,
      panX: tab.panX ?? 0,
      panY: tab.panY ?? 0,
      items,
      history: [items],
      historyIndex: 0,
      dirty: tab.dirty ?? false,
    };
  }
  return {
    ...tab,
    dirty: tab.dirty ?? false,
  };
}

function stripTab(tab: NoteTab): PersistedTab {
  if (tab.kind === "canvas") {
    const { history: _history, historyIndex: _historyIndex, ...rest } = tab;
    return rest;
  }
  return tab;
}

function createCanvasPayload(tab: CanvasTab): NoteFilePayload {
  const persisted = stripTab({ ...tab, dirty: false }) as PersistedCanvasTab;
  return {
    type: "super-note-canvas",
    version: 1,
    tab: persisted,
  };
}

function isPersistedWorkspace(value: unknown): value is PersistedWorkspace {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PersistedWorkspace>;
  return (candidate.version === 1 || candidate.version === 2 || candidate.version === 3 || candidate.version === 4) && Array.isArray(candidate.tabs);
}

function parseNoteFile(file: OpenedFile, themeIndex: number): NoteTab | null {
  try {
    const payload = JSON.parse(file.content) as Partial<NoteFilePayload>;
    if (payload.type !== "super-note-canvas" || !payload.tab || payload.tab.kind !== "canvas") {
      return null;
    }
    const restored = restoreTab({
      ...payload.tab,
      id: makeId(),
      title: file.name,
      autoTitle: false,
      themeIndex,
      filePath: file.path,
      dirty: false,
    }) as CanvasTab;
    return restored;
  } catch {
    return null;
  }
}

function createTabFromOpenedFile(file: OpenedFile, themeIndex: number): NoteTab {
  const noteTab = file.name.toLowerCase().endsWith(".snote") ? parseNoteFile(file, themeIndex) : null;
  return noteTab ?? createFileTab(file, themeIndex);
}

function normalizeViewState(tab: CanvasTab, state?: Partial<CanvasViewState>): CanvasViewState {
  return {
    scale: state?.scale || tab.scale || 1,
    panX: state?.panX ?? tab.panX ?? 0,
    panY: state?.panY ?? tab.panY ?? 0,
    itemOverrides: state?.itemOverrides ?? {},
  };
}

function getTextFontSize(item: TextCanvasItem) {
  return item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
}

function getItemLayout(item: CanvasItem, viewState: CanvasViewState) {
  const override = viewState.itemOverrides[item.id];
  if (item.type === "text") {
    return {
      ...item,
      x: override?.x ?? item.x,
      y: override?.y ?? item.y,
      width: override?.width ?? item.width,
      height: override?.height ?? item.height,
      fontSize: override?.fontSize ?? getTextFontSize(item),
    };
  }
  return {
    ...item,
    x: override?.x ?? item.x,
    y: override?.y ?? item.y,
    width: override?.width ?? item.width,
    height: override?.height ?? item.height,
  };
}

function getPointOnCanvas(clientX: number, clientY: number, surface: HTMLDivElement | null, scale: number) {
  if (!surface) {
    return { x: 120, y: 120 };
  }
  const rect = surface.getBoundingClientRect();
  return {
    x: Math.max(0, Math.round((clientX - rect.left) / scale)),
    y: Math.max(0, Math.round((clientY - rect.top) / scale)),
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeShortcut(value: string) {
  const clean = value.trim();
  if (!clean) {
    return "";
  }
  const rawParts = clean
    .replace(/Command/gi, "Meta")
    .replace(/Cmd/gi, "Meta")
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers = new Set<string>();
  let key = "";
  rawParts.forEach((part) => {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      modifiers.add("Ctrl");
    } else if (lower === "meta" || lower === "win" || lower === "super") {
      modifiers.add("Meta");
    } else if (lower === "alt" || lower === "option") {
      modifiers.add("Alt");
    } else if (lower === "shift") {
      modifiers.add("Shift");
    } else if (lower === "left" || lower === "arrowleft") {
      key = "Left";
    } else if (lower === "right" || lower === "arrowright") {
      key = "Right";
    } else if (part.length === 1) {
      key = part.toUpperCase();
    } else {
      key = part[0].toUpperCase() + part.slice(1);
    }
  });
  return ["Ctrl", "Meta", "Alt", "Shift"].filter((part) => modifiers.has(part)).concat(key ? [key] : []).join("+");
}

function shortcutFromEvent(event: KeyboardEvent | React.KeyboardEvent) {
  const key = event.key;
  if (["Control", "Meta", "Alt", "Shift"].includes(key)) {
    return "";
  }
  const normalizedKey = key === " " ? "Space" : key === "ArrowLeft" ? "Left" : key === "ArrowRight" ? "Right" : key.length === 1 ? key.toUpperCase() : key;
  return [
    event.ctrlKey ? "Ctrl" : "",
    event.metaKey ? "Meta" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    normalizedKey,
  ]
    .filter(Boolean)
    .join("+");
}

function shortcutMatches(event: KeyboardEvent, shortcut: string) {
  return normalizeShortcut(shortcutFromEvent(event)) === normalizeShortcut(shortcut);
}

function normalizeSettings(value?: Partial<AppSettings>): AppSettings {
  const shortcuts = {
    ...DEFAULT_SHORTCUTS,
    ...(value?.shortcuts ?? {}),
  };
  if (!value?.shortcuts?.deleteSelected || value.shortcuts.deleteSelected === "Delete") {
    shortcuts.deleteSelected = DEFAULT_SHORTCUTS.deleteSelected;
  }

  return {
    handwritten: Boolean(value?.handwritten),
    programmerMode: Boolean(value?.programmerMode),
    darkMode: Boolean(value?.darkMode),
    followSystemTheme: Boolean(value?.followSystemTheme),
    shortcuts,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizePaneWidths(widths: number[], count: number) {
  if (count <= 0) {
    return [];
  }
  if (widths.length !== count || widths.some((width) => !Number.isFinite(width) || width <= 0)) {
    return Array.from({ length: count }, () => 100 / count);
  }
  const total = widths.reduce((sum, width) => sum + width, 0);
  return widths.map((width) => (width / total) * 100);
}

function insertPaneWidth(widths: number[], paneIndex: number, direction: "left" | "right") {
  const normalized = normalizePaneWidths(widths, widths.length);
  const sourceWidth = normalized[paneIndex] ?? 100;
  const half = sourceWidth / 2;
  const next = [...normalized];
  next.splice(direction === "left" ? paneIndex : paneIndex + 1, 0, half);
  next[direction === "left" ? paneIndex + 1 : paneIndex] = half;
  return normalizePaneWidths(next, next.length);
}

function removePaneWidth(widths: number[], paneIndex: number) {
  if (widths.length <= 1) {
    return [100];
  }
  const next = normalizePaneWidths(widths, widths.length);
  const removed = next[paneIndex];
  next.splice(paneIndex, 1);
  const targetIndex = paneIndex > 0 ? paneIndex - 1 : 0;
  next[targetIndex] += removed;
  return normalizePaneWidths(next, next.length);
}

function makePaneGridTemplate(widths: number[]) {
  return widths.flatMap((width, index) => [
    `minmax(0, ${width}fr)`,
    ...(index < widths.length - 1 ? ["7px"] : []),
  ]).join(" ");
}

function makePreview(text: string, query: string) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index < 0) {
    return text.slice(0, 80);
  }
  const start = Math.max(0, index - 28);
  const end = Math.min(text.length, index + query.length + 36);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function renderHighlightedText(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) {
    return text;
  }
  const regex = new RegExp(`(${escapeRegExp(needle)})`, "gi");
  return text.split(regex).map((part, index) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="search-mark">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function transformJsonText(text: string, action: ProgrammerAction) {
  if (action === "format-json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return JSON.stringify(text, null, 2);
    }
  }
  if (action === "minify-json") {
    return JSON.stringify(JSON.parse(text));
  }

  const first = JSON.parse(text);
  const parsed = typeof first === "string" ? JSON.parse(first) : first;
  return JSON.stringify(parsed, null, 2);
}

function focusTextEditor(itemId: string, pane: PaneKey, placeAtEnd = false) {
  window.setTimeout(() => {
    const editor = document.querySelector<HTMLTextAreaElement>(`.canvas-viewport[data-pane="${pane}"] textarea[data-item-id="${itemId}"]`);
    if (!editor) {
      return;
    }
    window.requestAnimationFrame(() => {
      editor.focus({ preventScroll: true });
      if (placeAtEnd) {
        const end = editor.value.replace(/[\r\n]+$/g, "").length;
        editor.setSelectionRange(end, end);
        editor.scrollLeft = editor.scrollWidth;
      }
    });
  }, 0);
}

function AppShell() {
  const { message, modal } = AntApp.useApp();
  const [tabs, setTabs] = useState<NoteTab[]>(() => [createCanvasTab(0)]);
  const [paneIds, setPaneIds] = useState<PaneKey[]>([INITIAL_PANE_ID]);
  const [paneActiveTabIds, setPaneActiveTabIds] = useState<Record<PaneKey, string>>(() => ({ [INITIAL_PANE_ID]: tabs[0].id }));
  const [activePane, setActivePane] = useState<PaneKey>(INITIAL_PANE_ID);
  const [tabPaneIds, setTabPaneIds] = useState<Record<string, PaneKey[]>>(() => ({ [tabs[0].id]: [INITIAL_PANE_ID] }));
  const [paneWidths, setPaneWidths] = useState<number[]>([100]);
  const [canvasViewStates, setCanvasViewStates] = useState<Record<string, Partial<Record<PaneKey, CanvasViewState>>>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [editingText, setEditingText] = useState<{ itemId: string; pane: PaneKey } | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [activeSearchResultId, setActiveSearchResultId] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo>({
    version: "0.1.3",
    author: "kunkun",
    desc: "认识自身平凡后，依旧拥有改变世界的勇气",
  });
  const lastCanvasPoint = useRef<Record<string, { x: number; y: number }>>({});
  const draggingRef = useRef<DragState | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const effectiveDarkMode = settings.followSystemTheme ? systemDarkMode : settings.darkMode;

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchValue("");
    setActiveSearchResultId(null);
  }, []);

  const getTabPanes = useCallback(
    (tabId: string) => tabPaneIds[tabId]?.filter((paneId) => paneIds.includes(paneId)) ?? [paneIds[0]],
    [paneIds, tabPaneIds],
  );

  const paneTabs = useMemo<Record<PaneKey, NoteTab[]>>(() => {
    const next: Record<PaneKey, NoteTab[]> = {};
    paneIds.forEach((paneId) => {
      next[paneId] = tabs.filter((tab) => getTabPanes(tab.id).includes(paneId));
    });
    return next;
  }, [getTabPanes, paneIds, tabs]);

  const activeTabsByPane = useMemo<Record<PaneKey, NoteTab | null>>(() => {
    const next: Record<PaneKey, NoteTab | null> = {};
    paneIds.forEach((paneId) => {
      const available = paneTabs[paneId] ?? [];
      next[paneId] = available.find((tab) => tab.id === paneActiveTabIds[paneId]) ?? available[0] ?? null;
    });
    return next;
  }, [paneActiveTabIds, paneIds, paneTabs]);

  const splitView = paneIds.length > 1;
  const activeTab = activeTabsByPane[activePane] ?? activeTabsByPane[paneIds[0]] ?? tabs[0];
  const activeTabId = activeTab?.id ?? tabs[0]?.id ?? "";

  const getPaneViewState = useCallback(
    (tab: CanvasTab, pane: PaneKey) => normalizeViewState(tab, canvasViewStates[tab.id]?.[pane]),
    [canvasViewStates],
  );

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const setPaneViewState = useCallback(
    (tabId: string, pane: PaneKey, updater: (state: CanvasViewState) => CanvasViewState) => {
      const tab = tabs.find((item): item is CanvasTab => item.id === tabId && item.kind === "canvas");
      if (!tab) {
        return;
      }
      setCanvasViewStates((current) => {
        const currentForTab = current[tabId] ?? {};
        const baseState = normalizeViewState(tab, currentForTab[pane]);
        return {
          ...current,
          [tabId]: {
            ...currentForTab,
            [pane]: updater(baseState),
          },
        };
      });
    },
    [tabs],
  );

  const focusTabInPane = useCallback((tabId: string, pane: PaneKey) => {
    setPaneActiveTabIds((current) => ({ ...current, [pane]: tabId }));
    setActivePane(pane);
  }, []);

  const scheduleDragPaint = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const dragging = draggingRef.current;
      if (!dragging || dragging.mode === "split") {
        return;
      }

      if (dragging.mode === "pan") {
        dragging.surface.style.transform = `translate3d(${dragging.currentPanX}px, ${dragging.currentPanY}px, 0) scale(${dragging.scale})`;
        dragging.surface.parentElement?.style.setProperty("--canvas-pan-x", `${dragging.currentPanX}px`);
        dragging.surface.parentElement?.style.setProperty("--canvas-pan-y", `${dragging.currentPanY}px`);
        return;
      }

      const dx = dragging.currentX - dragging.originX;
      const dy = dragging.currentY - dragging.originY;
      dragging.elements.forEach((element) => {
        element.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
    });
  }, []);

  const persistWorkspace = useCallback(() => {
    const workspace: PersistedWorkspace = {
      version: 4,
      savedAt: new Date().toISOString(),
      activeTabId,
      activePane,
      splitView,
      paneIds,
      paneActiveTabIds,
      tabPaneIds,
      paneWidths,
      canvasViewStates,
      settings,
      tabs: tabs.map(stripTab),
    };

    if (window.superNote) {
      window.superNote.saveWorkspace(workspace).catch(() => undefined);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    }
  }, [activePane, activeTabId, canvasViewStates, paneActiveTabIds, paneIds, paneWidths, settings, splitView, tabPaneIds, tabs]);

  useEffect(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => persistWorkspace(), 250);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [persistWorkspace]);

  useEffect(() => {
    if (!searchValue.trim()) {
      setActiveSearchResultId(null);
    }
  }, [searchValue]);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) {
      return;
    }
    const update = () => setSystemDarkMode(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const populatedPaneIds = paneIds.filter((paneId) => (paneTabs[paneId]?.length ?? 0) > 0);
    const retainedPaneIds = populatedPaneIds.length > 0 ? populatedPaneIds : [paneIds[0]];

    if (retainedPaneIds.length !== paneIds.length) {
      const retained = new Set(retainedPaneIds);
      setPaneIds(retainedPaneIds);
      setPaneWidths((current) => normalizePaneWidths(current.filter((_, index) => retained.has(paneIds[index])), retainedPaneIds.length));
      setTabPaneIds((current) => {
        const next: Record<string, PaneKey[]> = {};
        tabs.forEach((tab) => {
          const validPanes = (current[tab.id] ?? []).filter((paneId) => retained.has(paneId));
          next[tab.id] = validPanes.length > 0 ? validPanes : [retainedPaneIds[0]];
        });
        return next;
      });
      if (!retained.has(activePane)) {
        setActivePane(retainedPaneIds[0]);
      }
      return;
    }

    setPaneWidths((current) => {
      const normalized = normalizePaneWidths(current, paneIds.length);
      return normalized.some((width, index) => Math.abs(width - (current[index] ?? 0)) > 0.001) ? normalized : current;
    });
    setPaneActiveTabIds((current) => {
      let changed = Object.keys(current).some((paneId) => !paneIds.includes(paneId));
      const next: Record<PaneKey, string> = {};
      paneIds.forEach((paneId) => {
        const available = paneTabs[paneId] ?? [];
        const currentId = current[paneId];
        const nextId = available.some((tab) => tab.id === currentId) ? currentId : available[0]?.id;
        if (nextId) {
          next[paneId] = nextId;
        }
        if (nextId !== currentId) {
          changed = true;
        }
      });
      return changed ? next : current;
    });
    if (!paneIds.includes(activePane)) {
      setActivePane(paneIds[0]);
    }
  }, [activePane, paneIds, paneTabs, tabs]);

  const updateCanvasTab = useCallback((tabId: string, updater: (tab: CanvasTab) => CanvasTab) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId && tab.kind === "canvas" ? updater(tab) : tab)));
  }, []);

  const updateFileContent = useCallback((tabId: string, content: string) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId && tab.kind === "file" ? { ...tab, content, dirty: true } : tab)));
  }, []);

  const commitCanvasItems = useCallback(
    (tabId: string, itemUpdater: (items: CanvasItem[]) => CanvasItem[]) => {
      updateCanvasTab(tabId, (tab) => {
        const nextItems = itemUpdater(cloneItems(tab.items));
        return {
          ...tab,
          title: deriveCanvasTitle(tab, nextItems),
          items: nextItems,
          dirty: true,
          ...pushHistory(tab, nextItems),
        };
      });
    },
    [updateCanvasTab],
  );

  const updateCanvasItems = useCallback(
    (tabId: string, itemUpdater: (items: CanvasItem[]) => CanvasItem[], dirty = true) => {
      updateCanvasTab(tabId, (tab) => {
        const nextItems = itemUpdater(cloneItems(tab.items));
        return {
          ...tab,
          title: deriveCanvasTitle(tab, nextItems),
          items: nextItems,
          dirty: dirty ? true : tab.dirty,
        };
      });
    },
    [updateCanvasTab],
  );

  const bringCanvasItemToFront = useCallback(
    (tabId: string, itemId: string) => {
      updateCanvasTab(tabId, (tab) => {
        const index = tab.items.findIndex((item) => item.id === itemId);
        if (index < 0 || index === tab.items.length - 1) {
          return tab;
        }
        const nextItems = [...tab.items.slice(0, index), ...tab.items.slice(index + 1), tab.items[index]];
        return {
          ...tab,
          items: nextItems,
          dirty: true,
        };
      });
    },
    [updateCanvasTab],
  );

  const addCanvasTab = useCallback(() => {
    const nextTab = createCanvasTab(tabs.length);
    const targetPane = paneIds.includes(activePane) ? activePane : paneIds[0];
    setTabs((current) => [...current, nextTab]);
    setTabPaneIds((current) => ({ ...current, [nextTab.id]: [targetPane] }));
    focusTabInPane(nextTab.id, targetPane);
    setSelectedItem(null);
  }, [activePane, focusTabInPane, paneIds, tabs.length]);

  const openFilesAsTabs = useCallback(
    (files: OpenedFile[], targetPane?: PaneKey) => {
      if (files.length === 0) {
        return;
      }
      setTabs((current) => {
        const nextTabs = files.map((file, index) => createTabFromOpenedFile(file, current.length + index));
        const destination = targetPane && paneIds.includes(targetPane) ? targetPane : activePane;
        setTabPaneIds((placements) => {
          const next = { ...placements };
          nextTabs.forEach((tab) => {
            next[tab.id] = [destination];
          });
          return next;
        });
        focusTabInPane(nextTabs[0].id, destination);
        setSelectedItem(null);
        return [...current, ...nextTabs];
      });
    },
    [activePane, focusTabInPane, paneIds],
  );

  const openExistingFile = useCallback(async () => {
    if (!window.superNote) {
      message.warning("当前环境不支持系统文件选择器");
      return;
    }
    const result = await window.superNote.openFile();
    if (!result.canceled) {
      openFilesAsTabs(result.files);
    }
  }, [message, openFilesAsTabs]);

  const splitTab = useCallback(
    (tabId: string, sourcePane: PaneKey, direction: "left" | "right") => {
      const sourceIndex = paneIds.indexOf(sourcePane);
      if (sourceIndex < 0) {
        return;
      }
      const nextPaneId = `pane-${makeId()}`;
      const insertIndex = direction === "left" ? sourceIndex : sourceIndex + 1;
      setPaneIds((current) => {
        const next = [...current];
        next.splice(insertIndex, 0, nextPaneId);
        return next;
      });
      setPaneWidths((current) => insertPaneWidth(current, sourceIndex, direction));
      setTabPaneIds((current) => ({
        ...current,
        [tabId]: Array.from(new Set([...(current[tabId] ?? [sourcePane]), nextPaneId])),
      }));
      setPaneActiveTabIds((current) => ({ ...current, [nextPaneId]: tabId }));
      setActivePane(nextPaneId);
      setSelectedItem(null);
    },
    [paneIds],
  );

  const autoSplitTab = useCallback(
    (direction: "left" | "right") => {
      if (activeTab) {
        splitTab(activeTab.id, activePane, direction);
      }
    },
    [activePane, activeTab, splitTab],
  );

  const closePane = useCallback(
    (paneId: PaneKey) => {
      if (paneIds.length <= 1) {
        return;
      }
      const paneIndex = paneIds.indexOf(paneId);
      if (paneIndex < 0) {
        return;
      }
      const fallbackPane = paneIds[paneIndex > 0 ? paneIndex - 1 : 1];
      setTabPaneIds((current) => {
        const next: Record<string, PaneKey[]> = {};
        tabs.forEach((tab) => {
          const remaining = (current[tab.id] ?? [paneIds[0]]).filter((item) => item !== paneId);
          next[tab.id] = remaining.length > 0 ? remaining : [fallbackPane];
        });
        return next;
      });
      setPaneIds((current) => current.filter((item) => item !== paneId));
      setPaneWidths((current) => removePaneWidth(current, paneIndex));
      setPaneActiveTabIds((current) => {
        const { [paneId]: _removed, ...rest } = current;
        return rest;
      });
      setCanvasViewStates((current) => {
        const next: typeof current = {};
        Object.entries(current).forEach(([tabId, states]) => {
          const { [paneId]: _removed, ...rest } = states;
          next[tabId] = rest;
        });
        return next;
      });
      if (activePane === paneId) {
        setActivePane(fallbackPane);
      }
    },
    [activePane, paneIds, tabs],
  );

  const moveTabToPane = useCallback(
    (tabId: string, sourcePane: PaneKey, targetPane: PaneKey) => {
      if (sourcePane === targetPane) {
        focusTabInPane(tabId, targetPane);
        return;
      }
      setTabPaneIds((current) => {
        const withoutSource = (current[tabId] ?? [sourcePane]).filter((paneId) => paneId !== sourcePane);
        return { ...current, [tabId]: Array.from(new Set([...withoutSource, targetPane])) };
      });
      focusTabInPane(tabId, targetPane);
    },
    [focusTabInPane],
  );

  const closeTab = useCallback(
    (targetId: string, pane?: PaneKey) => {
      const target = tabs.find((tab) => tab.id === targetId);
      if (!target) {
        return;
      }

      const targetPanes = getTabPanes(targetId);
      if (pane && targetPanes.length > 1) {
        setTabPaneIds((current) => ({
          ...current,
          [targetId]: (current[targetId] ?? targetPanes).filter((paneId) => paneId !== pane),
        }));
        if (selectedItem?.tabId === targetId && selectedItem.pane === pane) {
          setSelectedItem(null);
        }
        return;
      }

      const doClose = () => {
        setTabs((current) => {
          if (current.length === 1) {
            const replacement = createCanvasTab(0);
            const replacementPane = pane && paneIds.includes(pane) ? pane : activePane;
            setPaneIds([replacementPane]);
            setPaneWidths([100]);
            setPaneActiveTabIds({ [replacementPane]: replacement.id });
            setActivePane(replacementPane);
            setTabPaneIds({ [replacement.id]: [replacementPane] });
            setCanvasViewStates({});
            setSelectedItem(null);
            return [replacement];
          }

          const currentIndex = current.findIndex((tab) => tab.id === targetId);
          const next = current.filter((tab) => tab.id !== targetId);
          const fallback = next[Math.max(0, currentIndex - 1)]?.id ?? next[0]?.id;
          setPaneActiveTabIds((activeIds) => {
            const updated = { ...activeIds };
            Object.entries(updated).forEach(([paneId, activeId]) => {
              if (activeId === targetId && fallback) {
                updated[paneId] = fallback;
              }
            });
            return updated;
          });
          setTabPaneIds((placements) => {
            const { [targetId]: _removed, ...rest } = placements;
            return rest;
          });
          setCanvasViewStates((states) => {
            const { [targetId]: _removed, ...rest } = states;
            return rest;
          });
          if (selectedItem?.tabId === targetId) {
            setSelectedItem(null);
          }
          return next;
        });
      };

      if (!target.dirty) {
        doClose();
        return;
      }

      modal.confirm({
        title: "当前文件还没有保存",
        content: "是否关闭？未保存的修改会丢失。",
        okText: "关闭",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: doClose,
      });
    },
    [activePane, getTabPanes, modal, paneIds, selectedItem, tabs],
  );

  const saveCurrentTab = useCallback(async () => {
    if (!activeTab) {
      return;
    }
    if (document.activeElement instanceof HTMLTextAreaElement && document.activeElement.classList.contains("text-note-editor")) {
      document.activeElement.blur();
    }
    setEditingText(null);

    try {
      if (activeTab.kind === "file") {
        const result = await window.superNote?.saveFile({
          path: activeTab.filePath,
          content: activeTab.content,
          defaultName: activeTab.fileName || "untitled.txt",
          filters: [
            { name: "Text", extensions: ["txt", "md", "json", "csv", "log", "ts", "tsx", "js", "jsx", "css", "html"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });
        if (!result || result.canceled) {
          return;
        }
        if (!result.ok) {
          throw new Error(result.error ?? "保存失败");
        }
        setTabs((current) =>
          current.map((tab) =>
            tab.id === activeTab.id && tab.kind === "file"
              ? {
                  ...tab,
                  filePath: result.path,
                  fileName: result.name ?? getFileName(result.path ?? tab.fileName),
                  title: result.name ?? getFileName(result.path ?? tab.title),
                  dirty: false,
                }
              : tab,
          ),
        );
        message.success("已保存到本地文件");
        return;
      }

      const payload = JSON.stringify(createCanvasPayload(activeTab), null, 2);
      const result = await window.superNote?.saveFile({
        path: activeTab.filePath,
        content: payload,
        defaultName: `${activeTab.title === "未知" ? "untitled" : activeTab.title}.snote`,
        filters: [
          { name: "Super Note", extensions: ["snote"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!result || result.canceled) {
        return;
      }
      if (!result.ok) {
        throw new Error(result.error ?? "保存失败");
      }
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTab.id && tab.kind === "canvas"
            ? {
                ...tab,
                filePath: result.path,
                title: result.name ?? getFileName(result.path ?? tab.title),
                autoTitle: false,
                dirty: false,
              }
            : tab,
        ),
      );
      message.success("已保存为 Super Note 文件");
    } catch (error) {
      message.error(`保存失败：${String(error)}`);
    }
  }, [activeTab, message]);

  const undo = useCallback(() => {
    if (activeTab?.kind !== "canvas") {
      return;
    }
    updateCanvasTab(activeTab.id, (tab) => {
      if (tab.historyIndex <= 0) {
        return tab;
      }
      const nextIndex = tab.historyIndex - 1;
      const nextItems = cloneItems(tab.history[nextIndex]);
      return {
        ...tab,
        title: deriveCanvasTitle(tab, nextItems),
        items: nextItems,
        dirty: true,
        historyIndex: nextIndex,
      };
    });
  }, [activeTab, updateCanvasTab]);

  const redo = useCallback(() => {
    if (activeTab?.kind !== "canvas") {
      return;
    }
    updateCanvasTab(activeTab.id, (tab) => {
      if (tab.historyIndex >= tab.history.length - 1) {
        return tab;
      }
      const nextIndex = tab.historyIndex + 1;
      const nextItems = cloneItems(tab.history[nextIndex]);
      return {
        ...tab,
        title: deriveCanvasTitle(tab, nextItems),
        items: nextItems,
        dirty: true,
        historyIndex: nextIndex,
      };
    });
  }, [activeTab, updateCanvasTab]);

  const addTextItem = useCallback(
    (tabId: string, pane: PaneKey, x: number, y: number, text = "") => {
      const id = makeId();
      setEditingText({ itemId: id, pane });
      setSelectedItem({ tabId, itemId: id, pane });
      commitCanvasItems(tabId, (items) => [
        ...items,
        {
          id,
          type: "text",
          x,
          y,
          width: 260,
          height: 96,
          fontSize: DEFAULT_TEXT_FONT_SIZE,
          text,
        },
      ]);
      focusTextEditor(id, pane, true);
    },
    [commitCanvasItems],
  );

  const addImageItem = useCallback(
    (tabId: string, pane: PaneKey, point: { x: number; y: number }, file: File, src: string) => {
      const id = makeId();
      setSelectedItem({ tabId, itemId: id, pane });
      commitCanvasItems(tabId, (items) => [
        ...items,
        {
          id,
          type: "image",
          x: point.x,
          y: point.y,
          width: 320,
          height: 220,
          src,
          name: file.name,
        },
      ]);
    },
    [commitCanvasItems],
  );

  const deleteCanvasItem = useCallback(
    (tabId: string, itemId: string) => {
      commitCanvasItems(tabId, (items) => items.filter((item) => item.id !== itemId));
      setCanvasViewStates((current) => {
        const currentForTab = current[tabId];
        if (!currentForTab) {
          return current;
        }
        const nextForTab: Partial<Record<PaneKey, CanvasViewState>> = {};
        Object.entries(currentForTab).forEach(([pane, state]) => {
          if (state) {
            const { [itemId]: _removed, ...itemOverrides } = state.itemOverrides;
            nextForTab[pane] = { ...state, itemOverrides };
          }
        });
        return { ...current, [tabId]: nextForTab };
      });
      if (selectedItem?.tabId === tabId && selectedItem.itemId === itemId) {
        setSelectedItem(null);
      }
      if (editingText?.itemId === itemId) {
        setEditingText(null);
      }
    },
    [commitCanvasItems, editingText, selectedItem],
  );

  const editCanvasItem = useCallback(
    (tabId: string, itemId: string, pane: PaneKey) => {
      const tab = tabs.find((item): item is CanvasTab => item.id === tabId && item.kind === "canvas");
      const item = tab?.items.find((canvasItem) => canvasItem.id === itemId);
      setSelectedItem({ tabId, itemId, pane });
      if (item?.type === "text") {
        setEditingText({ itemId, pane });
        focusTextEditor(itemId, pane, true);
      } else {
        message.info("图片元素目前支持移动、缩放和删除");
      }
    },
    [message, tabs],
  );

  const applyProgrammerAction = useCallback(
    (tabId: string, itemId: string, action: ProgrammerAction) => {
      try {
        const tab = tabs.find((item): item is CanvasTab => item.id === tabId && item.kind === "canvas");
        const item = tab?.items.find((canvasItem): canvasItem is TextCanvasItem => canvasItem.id === itemId && canvasItem.type === "text");
        if (!item) {
          message.warning("程序员工具仅支持文字元素");
          return;
        }
        const nextText = transformJsonText(item.text, action);
        commitCanvasItems(tabId, (items) => items.map((canvasItem) => (canvasItem.id === itemId && canvasItem.type === "text" ? { ...canvasItem, text: nextText } : canvasItem)));
      } catch (error) {
        message.error(`JSON 处理失败：${String(error)}`);
      }
    },
    [commitCanvasItems, message, tabs],
  );

  const handleCanvasDoubleClick = useCallback(
    (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      const point = getPointOnCanvas(event.clientX, event.clientY, event.currentTarget, viewState.scale);
      focusTabInPane(tab.id, pane);
      addTextItem(tab.id, pane, point.x, point.y);
    },
    [addTextItem, focusTabInPane],
  );

  const scaleSelectedItem = useCallback(
    (tabId: string, pane: PaneKey, itemId: string, deltaY: number) => {
      const tab = tabs.find((item): item is CanvasTab => item.id === tabId && item.kind === "canvas");
      const item = tab?.items.find((canvasItem) => canvasItem.id === itemId);
      if (!tab || !item) {
        return;
      }

      const factor = deltaY > 0 ? 0.92 : 1.08;
      const usePaneOverride = getTabPanes(tabId).length > 1;

      if (usePaneOverride) {
        setPaneViewState(tabId, pane, (state) => {
          const layout = getItemLayout(item, state);
          const nextOverride: CanvasItemOverride = {
            width: Math.max(item.type === "text" ? 80 : 80, Math.round(layout.width * factor)),
            height: Math.max(item.type === "text" ? 36 : 60, Math.round(layout.height * factor)),
            ...(item.type === "text" ? { fontSize: Math.max(11, Math.round(((layout as TextCanvasItem).fontSize ?? DEFAULT_TEXT_FONT_SIZE) * factor)) } : {}),
          };
          return {
            ...state,
            itemOverrides: {
              ...state.itemOverrides,
              [itemId]: nextOverride,
            },
          };
        });
        return;
      }

      commitCanvasItems(tabId, (items) =>
        items.map((canvasItem) => {
          if (canvasItem.id !== itemId) {
            return canvasItem;
          }
          const minWidth = canvasItem.type === "text" ? 80 : 80;
          const minHeight = canvasItem.type === "text" ? 36 : 60;
          return {
            ...canvasItem,
            width: Math.max(minWidth, Math.round(canvasItem.width * factor)),
            height: Math.max(minHeight, Math.round(canvasItem.height * factor)),
            ...(canvasItem.type === "text" ? { fontSize: Math.max(11, Math.round(getTextFontSize(canvasItem) * factor)) } : {}),
          };
        }),
      );
    },
    [commitCanvasItems, getTabPanes, setPaneViewState, tabs],
  );

  const handleCanvasWheel = useCallback(
    (tab: CanvasTab, pane: PaneKey, event: React.WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();

      if (selectedItem?.tabId === tab.id && selectedItem.pane === pane) {
        scaleSelectedItem(tab.id, pane, selectedItem.itemId, event.deltaY);
        return;
      }

      const direction = event.deltaY > 0 ? -0.08 : 0.08;
      setPaneViewState(tab.id, pane, (current) => ({
        ...current,
        scale: Math.min(2.4, Math.max(0.35, Number((current.scale + direction).toFixed(2)))),
      }));
    },
    [scaleSelectedItem, selectedItem, setPaneViewState],
  );

  const handleCanvasDrop = useCallback(
    async (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      focusTabInPane(tab.id, pane);
      const files = Array.from(event.dataTransfer.files);
      const text = event.dataTransfer.getData("text/plain");
      const surface = event.currentTarget.querySelector<HTMLDivElement>(".canvas-surface");
      const point = getPointOnCanvas(event.clientX, event.clientY, surface, viewState.scale);

      if (files.length === 0 && text.trim()) {
        addTextItem(tab.id, pane, point.x, point.y, text);
        return;
      }

      const fileTabs: OpenedFile[] = [];
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          const src = await readFileAsDataUrl(file);
          addImageItem(tab.id, pane, point, file, src);
        } else {
          const filePath = window.superNote?.getPathForFile?.(file) || (file as File & { path?: string }).path;
          fileTabs.push({
            path: filePath,
            name: file.name,
            content: await file.text(),
          });
        }
      }

      if (fileTabs.length > 0) {
        openFilesAsTabs(fileTabs, pane);
      }
    },
    [addImageItem, addTextItem, focusTabInPane, openFilesAsTabs],
  );

  const readClipboardText = useCallback(async () => {
    if (window.superNote?.readClipboardText) {
      return window.superNote.readClipboardText();
    }
    return navigator.clipboard?.readText?.() ?? "";
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await readClipboardText();
      if (!text.trim()) {
        message.warning("剪贴板没有可粘贴的文字");
        return;
      }

      if (activeTab?.kind === "canvas") {
        const pane = activePane;
        const point = lastCanvasPoint.current[`${pane}:${activeTab.id}`] ?? { x: 160, y: 160 };
        addTextItem(activeTab.id, pane, point.x, point.y, text);
        return;
      }

      if (activeTab?.kind === "file") {
        updateFileContent(activeTab.id, `${activeTab.content}${activeTab.content ? "\n" : ""}${text}`);
      }
    } catch (error) {
      message.error(`粘贴失败：${String(error)}`);
    }
  }, [activePane, activeTab, addTextItem, message, readClipboardText, updateFileContent]);

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const tab = tabs.find((item) => item.id === activeTabId);
      if (!tab || tab.kind !== "canvas") {
        return;
      }
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) {
        return;
      }

      const pane = activePane;
      const imageFile = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith("image/"));
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const point = lastCanvasPoint.current[`${pane}:${tab.id}`] ?? { x: 160, y: 160 };

      if (imageFile) {
        event.preventDefault();
        readFileAsDataUrl(imageFile).then((src) => addImageItem(tab.id, pane, point, imageFile, src));
        return;
      }

      if (text.trim()) {
        event.preventDefault();
        addTextItem(tab.id, pane, point.x, point.y, text);
      }
    },
    [activePane, activeTabId, addImageItem, addTextItem, tabs],
  );

  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        closeSearch();
        return;
      }

      const activeElement = document.activeElement;
      const isTyping = activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement;

      if (shortcutMatches(event, settings.shortcuts.save)) {
        event.preventDefault();
        saveCurrentTab();
      } else if (shortcutMatches(event, settings.shortcuts.search)) {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => document.getElementById("global-search-input")?.focus(), 0);
      } else if (!searchOpen && shortcutMatches(event, settings.shortcuts.splitLeft)) {
        event.preventDefault();
        autoSplitTab("left");
      } else if (!searchOpen && shortcutMatches(event, settings.shortcuts.splitRight)) {
        event.preventDefault();
        autoSplitTab("right");
      } else if (!isTyping && shortcutMatches(event, settings.shortcuts.paste)) {
        event.preventDefault();
        pasteFromClipboard();
      } else if (!isTyping && shortcutMatches(event, settings.shortcuts.deleteSelected)) {
        event.preventDefault();
        if (selectedItem) {
          deleteCanvasItem(selectedItem.tabId, selectedItem.itemId);
        }
      } else if (!isTyping && shortcutMatches(event, settings.shortcuts.undo)) {
        event.preventDefault();
        undo();
      } else if (!isTyping && (shortcutMatches(event, settings.shortcuts.redo) || shortcutMatches(event, settings.shortcuts.redoAlt))) {
        event.preventDefault();
        redo();
      }
    },
    [autoSplitTab, closeSearch, deleteCanvasItem, pasteFromClipboard, redo, saveCurrentTab, searchOpen, selectedItem, settings.shortcuts, undo],
  );

  const startItemDrag = useCallback(
    (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, item: CanvasItem, event: React.MouseEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (document.activeElement instanceof HTMLTextAreaElement && document.activeElement.classList.contains("text-note-editor")) {
        document.activeElement.blur();
      }
      setEditingText(null);
      focusTabInPane(tab.id, pane);
      setSelectedItem({ tabId: tab.id, itemId: item.id, pane });
      bringCanvasItemToFront(tab.id, item.id);
      clearHoldTimer();

      const surface = event.currentTarget.closest<HTMLDivElement>(".canvas-surface");
      if (!surface) {
        return;
      }
      const elements = Array.from(surface.querySelectorAll<HTMLElement>(`[data-item-id="${item.id}"]`));
      const layout = getItemLayout(item, viewState);
      const point = getPointOnCanvas(event.clientX, event.clientY, surface, viewState.scale);
      draggingRef.current = {
        mode: "item",
        tabId: tab.id,
        pane,
        itemId: item.id,
        surface,
        elements,
        scale: viewState.scale,
        offsetX: point.x - layout.x,
        offsetY: point.y - layout.y,
        originX: layout.x,
        originY: layout.y,
        currentX: layout.x,
        currentY: layout.y,
        moved: false,
      };
    },
    [bringCanvasItemToFront, clearHoldTimer, focusTabInPane],
  );

  const startCanvasPan = useCallback(
    (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.target !== event.currentTarget) {
        return;
      }
      focusTabInPane(tab.id, pane);
      setSelectedItem(null);
      clearHoldTimer();
      const surface = event.currentTarget;

      holdTimerRef.current = window.setTimeout(() => {
        draggingRef.current = {
          mode: "pan",
          tabId: tab.id,
          pane,
          surface,
          scale: viewState.scale,
          startX: event.clientX,
          startY: event.clientY,
          panX: viewState.panX,
          panY: viewState.panY,
          currentPanX: viewState.panX,
          currentPanY: viewState.panY,
        };
        holdTimerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [clearHoldTimer, focusTabInPane],
  );

  const startSplitResize = useCallback(
    (dividerIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      clearHoldTimer();
      const container = event.currentTarget.closest<HTMLElement>(".app-shell");
      if (!container) {
        return;
      }
      holdTimerRef.current = window.setTimeout(() => {
        draggingRef.current = {
          mode: "split",
          container,
          dividerIndex,
          startX: event.clientX,
          startWidths: [...paneWidths],
          currentWidths: [...paneWidths],
        };
        holdTimerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [clearHoldTimer, paneWidths],
  );

  useEffect(() => {
    async function loadWorkspace() {
      try {
        let workspace: unknown = null;
        if (window.superNote) {
          const result = await window.superNote.loadWorkspace();
          if (result.ok) {
            workspace = result.workspace;
          }
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          workspace = raw ? JSON.parse(raw) : null;
        }

        if (isPersistedWorkspace(workspace) && workspace.tabs.length > 0) {
          const restored = workspace.tabs.map(restoreTab);
          let restoredPaneIds: PaneKey[];
          let restoredTabPaneIds: Record<string, PaneKey[]> = {};
          let restoredActiveTabIds: Record<PaneKey, string> = {};
          let restoredActivePane: PaneKey;
          let restoredPaneWidths: number[];
          let restoredViewStates: Record<string, Partial<Record<PaneKey, CanvasViewState>>> = {};

          if (workspace.version === 4 && Array.isArray(workspace.paneIds) && workspace.paneIds.length > 0) {
            restoredPaneIds = Array.from(new Set(workspace.paneIds.filter((paneId): paneId is string => typeof paneId === "string" && paneId.length > 0)));
            restored.forEach((tab) => {
              const validPanes = (workspace.tabPaneIds?.[tab.id] ?? []).filter((paneId) => restoredPaneIds.includes(paneId));
              restoredTabPaneIds[tab.id] = validPanes.length > 0 ? Array.from(new Set(validPanes)) : [restoredPaneIds[0]];
            });
            const populated = restoredPaneIds.filter((paneId) => restored.some((tab) => restoredTabPaneIds[tab.id].includes(paneId)));
            restoredPaneIds = populated.length > 0 ? populated : [restoredPaneIds[0]];
            restored.forEach((tab) => {
              restoredTabPaneIds[tab.id] = restoredTabPaneIds[tab.id].filter((paneId) => restoredPaneIds.includes(paneId));
              if (restoredTabPaneIds[tab.id].length === 0) {
                restoredTabPaneIds[tab.id] = [restoredPaneIds[0]];
              }
            });
            restoredPaneIds.forEach((paneId) => {
              const available = restored.filter((tab) => restoredTabPaneIds[tab.id].includes(paneId));
              const preferred = workspace.paneActiveTabIds?.[paneId];
              restoredActiveTabIds[paneId] = available.some((tab) => tab.id === preferred) ? preferred! : available[0].id;
            });
            restoredActivePane = restoredPaneIds.includes(workspace.activePane ?? "") ? workspace.activePane! : restoredPaneIds[0];
            restoredPaneWidths = normalizePaneWidths(workspace.paneWidths ?? [], restoredPaneIds.length);
            restoredViewStates = workspace.canvasViewStates ?? {};
          } else {
            const leftPane = "pane-left";
            const rightPane = "pane-right";
            const hasRightPane = Boolean(
              workspace.splitView ||
              workspace.splitTabId ||
              Object.values(workspace.tabPlacements ?? {}).some((placement) => placement === "right" || placement === "both"),
            );
            restoredPaneIds = hasRightPane ? [leftPane, rightPane] : [leftPane];
            restored.forEach((tab) => {
              const placement = workspace.tabPlacements?.[tab.id] ?? (workspace.splitTabId === tab.id ? "both" : "left");
              restoredTabPaneIds[tab.id] = placement === "both" && hasRightPane
                ? [leftPane, rightPane]
                : placement === "right" && hasRightPane
                  ? [rightPane]
                  : [leftPane];
            });
            const leftAvailable = restored.filter((tab) => restoredTabPaneIds[tab.id].includes(leftPane));
            const rightAvailable = restored.filter((tab) => restoredTabPaneIds[tab.id].includes(rightPane));
            restoredActiveTabIds[leftPane] = leftAvailable.some((tab) => tab.id === workspace.leftActiveTabId)
              ? workspace.leftActiveTabId!
              : leftAvailable[0]?.id ?? restored[0].id;
            if (hasRightPane) {
              restoredActiveTabIds[rightPane] = rightAvailable.some((tab) => tab.id === workspace.rightActiveTabId)
                ? workspace.rightActiveTabId!
                : rightAvailable[0]?.id ?? restoredActiveTabIds[leftPane];
            }
            restoredActivePane = workspace.activePane === "right" && hasRightPane ? rightPane : leftPane;
            const leftWidth = clamp(workspace.splitRatio ?? 50, 12, 88);
            restoredPaneWidths = hasRightPane ? [leftWidth, 100 - leftWidth] : [100];
            Object.entries(workspace.canvasViewStates ?? {}).forEach(([tabId, states]) => {
              restoredViewStates[tabId] = {
                ...(states.left ? { [leftPane]: states.left } : {}),
                ...(hasRightPane && states.right ? { [rightPane]: states.right } : {}),
              };
            });
          }

          setTabs(restored);
          setPaneIds(restoredPaneIds);
          setTabPaneIds(restoredTabPaneIds);
          setPaneActiveTabIds(restoredActiveTabIds);
          setActivePane(restoredActivePane);
          setPaneWidths(restoredPaneWidths);
          setCanvasViewStates(restoredViewStates);
          setSettings(normalizeSettings(workspace.settings));
        }
      } catch (error) {
        message.warning(`加载上次内容失败：${String(error)}`);
      }
    }

    loadWorkspace();
    window.superNote?.getAppInfo().then(setAppInfo).catch(() => undefined);
  }, [message]);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("paste", handlePaste);
    };
  }, [handleGlobalKeyDown, handlePaste]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const dragging = draggingRef.current;
      if (!dragging) {
        return;
      }

      if (dragging.mode === "split") {
        const rect = dragging.container.getBoundingClientRect();
        const usableWidth = Math.max(1, rect.width - (dragging.startWidths.length - 1) * 7);
        const delta = ((event.clientX - dragging.startX) / usableWidth) * 100;
        const leftIndex = dragging.dividerIndex;
        const rightIndex = leftIndex + 1;
        const pairWidth = dragging.startWidths[leftIndex] + dragging.startWidths[rightIndex];
        const minPaneWidth = Math.min(18, 80 / dragging.startWidths.length);
        const leftWidth = clamp(dragging.startWidths[leftIndex] + delta, minPaneWidth, pairWidth - minPaneWidth);
        const nextWidths = [...dragging.startWidths];
        nextWidths[leftIndex] = leftWidth;
        nextWidths[rightIndex] = pairWidth - leftWidth;
        dragging.currentWidths = nextWidths;
        dragging.container.style.setProperty("--pane-grid", makePaneGridTemplate(nextWidths));
        return;
      }

      if (dragging.mode === "pan") {
        dragging.currentPanX = dragging.panX + event.clientX - dragging.startX;
        dragging.currentPanY = dragging.panY + event.clientY - dragging.startY;
        scheduleDragPaint();
        return;
      }

      const point = getPointOnCanvas(event.clientX, event.clientY, dragging.surface, dragging.scale);
      const x = Math.max(0, Math.round(point.x - dragging.offsetX));
      const y = Math.max(0, Math.round(point.y - dragging.offsetY));
      dragging.moved = true;
      dragging.currentX = x;
      dragging.currentY = y;
      scheduleDragPaint();
    };

    const handleMouseUp = () => {
      clearHoldTimer();
      const dragging = draggingRef.current;
      if (!dragging) {
        return;
      }
      draggingRef.current = null;

      if (dragging.mode === "split") {
        setPaneWidths(normalizePaneWidths(dragging.currentWidths, dragging.currentWidths.length));
        return;
      }

      if (dragging.mode === "pan") {
        setPaneViewState(dragging.tabId, dragging.pane, (current) => ({
          ...current,
          panX: dragging.currentPanX,
          panY: dragging.currentPanY,
        }));
        return;
      }

      if (dragging.moved) {
        flushSync(() => {
          if (getTabPanes(dragging.tabId).length > 1) {
            setPaneViewState(dragging.tabId, dragging.pane, (current) => ({
              ...current,
              itemOverrides: {
                ...current.itemOverrides,
                [dragging.itemId]: {
                  ...current.itemOverrides[dragging.itemId],
                  x: dragging.currentX,
                  y: dragging.currentY,
                },
              },
            }));
          } else {
            updateCanvasTab(dragging.tabId, (tab) => {
              const nextItems = tab.items.map((item) => (item.id === dragging.itemId ? { ...item, x: dragging.currentX, y: dragging.currentY } : item));
              return {
                ...tab,
                items: nextItems,
                dirty: true,
                ...pushHistory(tab, nextItems),
              };
            });
            setPaneViewState(dragging.tabId, dragging.pane, (current) => {
              const override = current.itemOverrides[dragging.itemId];
              if (!override || (override.x === undefined && override.y === undefined)) {
                return current;
              }
              const { x: _x, y: _y, ...remainingOverride } = override;
              const nextOverrides = { ...current.itemOverrides };
              if (Object.keys(remainingOverride).length > 0) {
                nextOverrides[dragging.itemId] = remainingOverride;
              } else {
                delete nextOverrides[dragging.itemId];
              }
              return { ...current, itemOverrides: nextOverrides };
            });
          }
        });
        dragging.elements.forEach((element) => {
          element.style.transform = "";
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      clearHoldTimer();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [clearHoldTimer, getTabPanes, scheduleDragPaint, setPaneViewState, updateCanvasTab]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const needle = searchValue.trim();
    if (!needle) {
      return [];
    }

    const results: SearchResult[] = [];
    tabs.forEach((tab) => {
      if (tab.kind === "canvas") {
        tab.items.forEach((item) => {
          if (item.type === "text" && item.text.toLowerCase().includes(needle.toLowerCase())) {
            results.push({
              id: `${tab.id}:${item.id}`,
              tabId: tab.id,
              itemId: item.id,
              kind: "canvas-text",
              title: tab.title,
              preview: makePreview(item.text, needle),
            });
          }
        });
        return;
      }

      const lines = tab.content.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(needle.toLowerCase())) {
          results.push({
            id: `${tab.id}:line:${index}`,
            tabId: tab.id,
            kind: "file",
            title: tab.title,
            line: index + 1,
            preview: makePreview(line, needle),
          });
        }
      });
    });
    return results;
  }, [searchValue, tabs]);

  const openSearchResult = useCallback(
    (result: SearchResult) => {
      const tab = tabs.find((item) => item.id === result.tabId);
      if (!tab) {
        return;
      }

      const availablePanes = getTabPanes(result.tabId);
      const pane = availablePanes.includes(activePane) ? activePane : availablePanes[0];
      focusTabInPane(result.tabId, pane);
      setActiveSearchResultId(result.id);

      if (tab.kind === "canvas" && result.itemId) {
        const item = tab.items.find((canvasItem) => canvasItem.id === result.itemId);
        if (!item) {
          return;
        }
        setSelectedItem({ tabId: tab.id, itemId: item.id, pane });
        setPaneViewState(tab.id, pane, (current) => {
          const layout = getItemLayout(item, current);
          const viewport = document.querySelector<HTMLElement>(`.canvas-viewport[data-tab-id="${tab.id}"][data-pane="${pane}"]`);
          const rect = viewport?.getBoundingClientRect();
          const centerX = rect ? rect.width / 2 : 360;
          const centerY = rect ? rect.height / 2 : 260;
          return {
            ...current,
            panX: Math.round(centerX - (layout.x + layout.width / 2) * current.scale),
            panY: Math.round(centerY - (layout.y + layout.height / 2) * current.scale),
          };
        });
      }
    },
    [activePane, focusTabInPane, getTabPanes, setPaneViewState, tabs],
  );

  const fileMenu: MenuProps["items"] = [
    {
      key: "new",
      label: "打开新的文件",
      icon: <FileAddOutlined />,
      onClick: addCanvasTab,
    },
    {
      key: "open",
      label: "打开已有文件",
      icon: <FolderOpenOutlined />,
      onClick: openExistingFile,
    },
    { type: "divider" },
    {
      key: "save",
      label: "保存文件",
      icon: <SaveOutlined />,
      onClick: saveCurrentTab,
    },
  ];

  const operationMenu: MenuProps["items"] = [
    {
      key: "search",
      label: `搜索 (${settings.shortcuts.search})`,
      icon: <SearchOutlined />,
      onClick: () => {
        setSearchOpen(true);
        window.setTimeout(() => document.getElementById("global-search-input")?.focus(), 0);
      },
    },
    {
      key: "undo",
      label: `撤销 (${settings.shortcuts.undo})`,
      icon: <UndoOutlined />,
      onClick: undo,
    },
    {
      key: "redo",
      label: `重做 (${settings.shortcuts.redo})`,
      icon: <RedoOutlined />,
      onClick: redo,
    },
    {
      key: "paste",
      label: `粘贴 (${settings.shortcuts.paste})`,
      icon: <CopyOutlined />,
      onClick: pasteFromClipboard,
    },
    {
      key: "delete",
      label: `删除选中元素 (${settings.shortcuts.deleteSelected})`,
      icon: <DeleteOutlined />,
      disabled: !selectedItem,
      danger: true,
      onClick: () => {
        if (selectedItem) {
          deleteCanvasItem(selectedItem.tabId, selectedItem.itemId);
        }
      },
    },
    { type: "divider" },
    {
      key: "split-left",
      label: `向左分割视图 (${settings.shortcuts.splitLeft})`,
      icon: <SplitCellsOutlined />,
      onClick: () => autoSplitTab("left"),
    },
    {
      key: "split-right",
      label: `向右分割视图 (${settings.shortcuts.splitRight})`,
      icon: <SplitCellsOutlined />,
      onClick: () => autoSplitTab("right"),
    },
  ];

  const helpMenu: MenuProps["items"] = [
    {
      key: "docs",
      label: "文档",
      icon: <QuestionCircleOutlined />,
      onClick: () =>
        modal.info({
          title: "文档",
          content: "双击画板创建文字区，双击文字再次编辑。点击元素后 Ctrl+滚轮缩放元素；长按画板拖拽平移；Ctrl+滚轮缩放画板。",
        }),
    },
    {
      key: "version",
      label: "版本",
      icon: <InfoCircleOutlined />,
      onClick: () => modal.info({ title: "版本", content: appInfo.version }),
    },
    {
      key: "author",
      label: "作者",
      icon: <InfoCircleOutlined />,
      onClick: () => modal.info({ title: "作者", content: `${appInfo.author}\n${appInfo.desc}` }),
    },
  ];

  const makeTabItems = useCallback(
    (paneTabs: NoteTab[], pane: PaneKey): TabsProps["items"] =>
      paneTabs.map((tab) => {
        const activeTheme = canvasThemes[tab.themeIndex % canvasThemes.length];
        const isActive = paneActiveTabIds[pane] === tab.id;
        const tabPanes = getTabPanes(tab.id);
        const tabContextMenu: MenuProps["items"] = [
          {
            key: "split-left",
            label: "向左分割视图",
            icon: <SplitCellsOutlined />,
            onClick: () => splitTab(tab.id, pane, "left"),
          },
          {
            key: "split-right",
            label: "向右分割视图",
            icon: <SplitCellsOutlined />,
            onClick: () => splitTab(tab.id, pane, "right"),
          },
          ...(tabPanes.length > 1
            ? [
                {
                  key: "cancel-split",
                  label: "从当前分栏移除",
                  icon: <CloseOutlined />,
                  onClick: () => closeTab(tab.id, pane),
                },
              ]
            : []),
          ...(splitView
            ? [
                {
                  key: "close-split",
                  label: "关闭当前分栏",
                  icon: <CloseOutlined />,
                  onClick: () => closePane(pane),
                },
              ]
            : []),
        ];

        return {
          key: tab.id,
          label: (
            <Dropdown menu={{ items: tabContextMenu }} trigger={["contextMenu"]}>
              <span
                draggable={splitView}
                className="tab-label"
                style={{ ["--tab-accent" as string]: activeTheme.accent }}
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/super-note-tab", JSON.stringify({ tabId: tab.id, sourcePane: pane }));
                  event.dataTransfer.effectAllowed = "move";
                }}
              >
                {tab.kind === "file" ? <FileTextOutlined /> : null}
                <span className="tab-title">{tab.title}</span>
                <button
                  type="button"
                  className={`tab-close ${isActive ? "active" : "inactive"}${tab.dirty ? " dirty" : ""}`}
                  title={tab.dirty ? "未保存，点击关闭" : "关闭"}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id, pane);
                  }}
                >
                  <span className="dirty-dot" />
                  <CloseOutlined className="dirty-close" />
                </button>
              </span>
            </Dropdown>
          ),
        };
      }),
    [closePane, closeTab, getTabPanes, paneActiveTabIds, splitTab, splitView],
  );

  const renderTabZone = (pane: PaneKey, paneTabs: NoteTab[], activeKey?: string | null) => (
    <div
      key={pane}
      className="tab-pane-zone"
      onDragOver={(event) => {
        if (splitView && event.dataTransfer.types.includes("text/super-note-tab")) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const payload = event.dataTransfer.getData("text/super-note-tab");
        if (splitView && payload) {
          event.preventDefault();
          try {
            const parsed = JSON.parse(payload) as { tabId?: string; sourcePane?: PaneKey };
            if (parsed.tabId && parsed.sourcePane) {
              moveTabToPane(parsed.tabId, parsed.sourcePane, pane);
            }
          } catch {
            const sourcePane = getTabPanes(payload)[0];
            if (sourcePane) {
              moveTabToPane(payload, sourcePane, pane);
            }
          }
        }
      }}
    >
      <Tabs
        type="card"
        activeKey={activeKey ?? undefined}
        items={makeTabItems(paneTabs, pane)}
        onChange={(key) => focusTabInPane(key, pane)}
      />
    </div>
  );

  const renderPaneContent = (tab: NoteTab, pane: PaneKey) => {
    if (tab.kind === "canvas") {
      const viewState = getPaneViewState(tab, pane);
      return (
        <CanvasView
          tab={tab}
          pane={pane}
          viewState={viewState}
          editingTextId={editingText?.pane === pane ? editingText.itemId : null}
          selectedItem={selectedItem}
          searchValue={searchValue}
          activeSearchItemId={activeSearchResultId?.startsWith(`${tab.id}:`) ? activeSearchResultId.split(":")[1] : null}
          handwritten={settings.handwritten}
          programmerMode={settings.programmerMode}
          onDoubleClick={handleCanvasDoubleClick}
          onWheel={handleCanvasWheel}
          onDrop={handleCanvasDrop}
          onSurfaceMouseDown={startCanvasPan}
          onPointChange={(point) => {
            lastCanvasPoint.current[`${pane}:${tab.id}`] = point;
          }}
          onTextChange={(itemId, text) =>
            updateCanvasItems(tab.id, (items) => items.map((item) => (item.id === itemId && item.type === "text" ? { ...item, text } : item)))
          }
          onTextCommit={(item) => {
            setEditingText(null);
            if (!item.text.trim()) {
              deleteCanvasItem(tab.id, item.id);
              return;
            }
            updateCanvasTab(tab.id, (current) => ({
              ...current,
              title: deriveCanvasTitle(current, current.items),
              dirty: true,
              ...pushHistory(current, current.items),
            }));
          }}
          onTextDoubleClick={(item, event) => {
            event.stopPropagation();
            setSelectedItem({ tabId: tab.id, itemId: item.id, pane });
            focusTabInPane(tab.id, pane);
            bringCanvasItemToFront(tab.id, item.id);
            setEditingText({ itemId: item.id, pane });
            focusTextEditor(item.id, pane, true);
          }}
          onItemMouseDown={(item, event) => startItemDrag(tab, pane, viewState, item, event)}
          onItemContextMenu={(item) => {
            focusTabInPane(tab.id, pane);
            setSelectedItem({ tabId: tab.id, itemId: item.id, pane });
          }}
          onDeleteItem={(item) => deleteCanvasItem(tab.id, item.id)}
          onEditItem={(item) => editCanvasItem(tab.id, item.id, pane)}
          onPreviewImage={(item) => setImagePreview({ src: item.src, name: item.name })}
          onProgrammerAction={(item, action) => applyProgrammerAction(tab.id, item.id, action)}
        />
      );
    }

    return <FileView tab={tab} searchValue={searchValue} onContentChange={(content) => updateFileContent(tab.id, content)} />;
  };

  const renderSurface = (tab: NoteTab | null, pane: PaneKey) => (
    <section key={pane} className={`work-pane ${activePane === pane ? "focused" : ""}`} onMouseDown={() => tab && focusTabInPane(tab.id, pane)}>
      <div className="pane-content">{tab ? renderPaneContent(tab, pane) : <Empty description="没有标签页" />}</div>
    </section>
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: effectiveDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorPrimary: "#1677ff",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
        },
      }}
    >
    <div
      className={`app-shell${settings.handwritten ? " handwritten-mode" : ""}${effectiveDarkMode ? " dark-mode" : ""}`}
      style={{ ["--pane-grid" as string]: makePaneGridTemplate(paneWidths) } as React.CSSProperties}
    >
      <header className="app-titlebar">
        <div className="titlebar-left">
          <span className="app-title">Super Note</span>
        <div className="menu-left">
          <Dropdown menu={{ items: fileMenu }} trigger={["click"]}>
            <Button type="text">文件</Button>
          </Dropdown>
          <Dropdown menu={{ items: operationMenu }} trigger={["click"]}>
            <Button type="text">操作</Button>
          </Dropdown>
          <Button type="text" onClick={() => setSettingsOpen(true)}>
            设置
          </Button>
          <Dropdown menu={{ items: helpMenu }} trigger={["click"]}>
            <Button type="text">帮助</Button>
          </Dropdown>
        </div>

        </div>

        <div className="window-controls">
          <Tooltip title={alwaysOnTop ? "取消置顶" : "窗口置顶"}>
            <Button
              type="text"
              className="window-control"
              icon={alwaysOnTop ? <PushpinFilled /> : <PushpinOutlined />}
              onClick={async () => {
                const next = !alwaysOnTop;
                setAlwaysOnTop(next);
                await window.superNote?.setAlwaysOnTop(next);
              }}
            />
          </Tooltip>
          <Tooltip title={effectiveDarkMode ? "切换为日间模式" : "切换为夜间模式"}>
            <Button
              type="text"
              className="window-control"
              icon={effectiveDarkMode ? <SunOutlined /> : <MoonOutlined />}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  followSystemTheme: false,
                  darkMode: !effectiveDarkMode,
                }))
              }
            />
          </Tooltip>
          <Button type="text" className="window-control" icon={<MinusOutlined />} onClick={() => window.superNote?.minimizeWindow()} />
          <Button type="text" className="window-control" icon={<BorderOutlined />} onClick={() => window.superNote?.toggleMaximizeWindow()} />
          <Button type="text" className="window-control close" icon={<CloseOutlined />} onClick={() => window.superNote?.closeWindow()} />
        </div>
      </header>

      <div className={splitView ? "tabs-bar multi-pane" : "tabs-bar"}>
        {paneIds.flatMap((paneId, index) => [
          renderTabZone(paneId, paneTabs[paneId] ?? [], activeTabsByPane[paneId]?.id),
          ...(index < paneIds.length - 1
            ? [
                <div
                  key={`tab-divider-${paneId}`}
                  className="tabs-split-gap"
                  title="长按后左右拖拽调整分栏宽度"
                  onMouseDown={(event) => startSplitResize(index, event)}
                />,
              ]
            : []),
        ])}
        <Tooltip title="新建">
          <Button className="tabs-add-button" type="text" aria-label="新建" icon={<PlusOutlined />} onClick={addCanvasTab} />
        </Tooltip>
      </div>

      <main className={splitView ? "workspace multi-pane" : "workspace"}>
        {paneIds.flatMap((paneId, index) => [
          renderSurface(activeTabsByPane[paneId] ?? null, paneId),
          ...(index < paneIds.length - 1
            ? [
                <div
                  key={`workspace-divider-${paneId}`}
                  className="split-resizer"
                  title="长按后左右拖拽调整分栏宽度"
                  onMouseDown={(event) => startSplitResize(index, event)}
                />,
              ]
            : []),
        ])}
      </main>

      {searchOpen ? (
        <div className="global-search-layer">
          <div className="global-search-box">
            <Input
              id="global-search-input"
              autoFocus
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索所有标签内容"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              suffix={searchValue ? `${searchResults.length} 个匹配` : null}
            />
            <div className="search-results">
              {searchValue.trim() && searchResults.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配内容" /> : null}
              {searchResults.slice(0, 80).map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="search-result"
                  onClick={() => {
                    openSearchResult(result);
                    closeSearch();
                  }}
                >
                  <span className="search-result-title">
                    {result.kind === "file" ? <FileTextOutlined /> : null}
                    {result.title}
                    {result.line ? ` · 第 ${result.line} 行` : ""}
                  </span>
                  <span className="search-result-preview">{renderHighlightedText(result.preview, searchValue)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
      />
      {imagePreview ? (
        <div className="image-preview-layer" role="dialog" aria-modal="true" onClick={() => setImagePreview(null)}>
          <button type="button" className="image-preview-close" aria-label="关闭预览" onClick={() => setImagePreview(null)}>
            <CloseOutlined />
          </button>
          <img src={imagePreview.src} alt={imagePreview.name} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
    </ConfigProvider>
  );
}

function CanvasView({
  tab,
  pane,
  viewState,
  editingTextId,
  selectedItem,
  searchValue,
  activeSearchItemId,
  handwritten,
  programmerMode,
  onDoubleClick,
  onWheel,
  onDrop,
  onSurfaceMouseDown,
  onPointChange,
  onTextChange,
  onTextCommit,
  onTextDoubleClick,
  onItemMouseDown,
  onItemContextMenu,
  onDeleteItem,
  onEditItem,
  onPreviewImage,
  onProgrammerAction,
}: {
  tab: CanvasTab;
  pane: PaneKey;
  viewState: CanvasViewState;
  editingTextId: string | null;
  selectedItem: SelectedItem;
  searchValue: string;
  activeSearchItemId: string | null;
  handwritten: boolean;
  programmerMode: boolean;
  onDoubleClick: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.MouseEvent<HTMLDivElement>) => void;
  onWheel: (tab: CanvasTab, pane: PaneKey, event: React.WheelEvent<HTMLDivElement>) => void;
  onDrop: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.DragEvent<HTMLDivElement>) => void;
  onSurfaceMouseDown: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.MouseEvent<HTMLDivElement>) => void;
  onPointChange: (point: { x: number; y: number }) => void;
  onTextChange: (itemId: string, text: string) => void;
  onTextCommit: (item: TextCanvasItem) => void;
  onTextDoubleClick: (item: TextCanvasItem, event: React.MouseEvent<HTMLDivElement>) => void;
  onItemMouseDown: (item: CanvasItem, event: React.MouseEvent<HTMLElement>) => void;
  onItemContextMenu: (item: CanvasItem) => void;
  onDeleteItem: (item: CanvasItem) => void;
  onEditItem: (item: CanvasItem) => void;
  onPreviewImage: (item: ImageCanvasItem) => void;
  onProgrammerAction: (item: CanvasItem, action: ProgrammerAction) => void;
}) {
  const activeTheme = canvasThemes[tab.themeIndex % canvasThemes.length];
  const needle = searchValue.trim().toLowerCase();

  const makeItemMenu = (item: CanvasItem): MenuProps["items"] => [
    {
      key: "edit",
      label: "编辑",
      icon: <EditOutlined />,
      onClick: () => onEditItem(item),
    },
    {
      key: "delete",
      label: "删除",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDeleteItem(item),
    },
    ...(item.type === "image"
      ? [
          {
            key: "preview",
            label: "预览",
            icon: <SearchOutlined />,
            onClick: () => onPreviewImage(item),
          },
        ]
      : []),
    ...(programmerMode && item.type === "text"
      ? [
          { type: "divider" as const },
          {
            key: "format-json",
            label: "转为 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "format-json"),
          },
          {
            key: "minify-json",
            label: "压缩 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "minify-json"),
          },
          {
            key: "string-to-json",
            label: "字符串转 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "string-to-json"),
          },
        ]
      : []),
  ];

  return (
    <div className="canvas-frame" style={{ ["--accent" as string]: activeTheme.accent }}>
      <div
        data-tab-id={tab.id}
        data-pane={pane}
        className="canvas-viewport"
        style={{
          ["--canvas-pan-x" as string]: `${viewState.panX}px`,
          ["--canvas-pan-y" as string]: `${viewState.panY}px`,
        }}
        onWheel={(event) => onWheel(tab, pane, event)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(tab, pane, viewState, event)}
        onMouseMove={(event) => {
          const surface = event.currentTarget.querySelector<HTMLDivElement>(".canvas-surface");
          if (!surface) {
            return;
          }
          onPointChange(getPointOnCanvas(event.clientX, event.clientY, surface, viewState.scale));
        }}
      >
        <div
          data-tab-id={tab.id}
          data-pane={pane}
          className="canvas-surface"
          style={{
            transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.scale})`,
          }}
          onDoubleClick={(event) => onDoubleClick(tab, pane, viewState, event)}
          onMouseDown={(event) => onSurfaceMouseDown(tab, pane, viewState, event)}
        >
          {tab.items.map((item, index) => {
            const zIndex = index + 1;
            const layout = getItemLayout(item, viewState);
            const isSelected = selectedItem?.tabId === tab.id && selectedItem.itemId === item.id && selectedItem.pane === pane;
            const isSearchTarget = activeSearchItemId === item.id;
            if (item.type === "text") {
              const matched = Boolean(needle && item.text.toLowerCase().includes(needle));
              const fontSize = (layout as TextCanvasItem).fontSize;
              const editorStyle = {
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                fontSize,
                zIndex,
              };
              const viewStyle = {
                left: layout.x,
                top: layout.y,
                fontSize,
                zIndex,
              };

              if (editingTextId === item.id) {
                return (
                  <textarea
                    id={`text-${pane}-${item.id}`}
                    data-item-id={item.id}
                    key={item.id}
                    className={`${matched ? "text-note-editor matched" : "text-note-editor"}${handwritten ? " handwritten" : ""}`}
                    style={editorStyle}
                    value={item.text}
                    placeholder="输入文字"
                    onMouseDown={(event) => event.stopPropagation()}
                    onChange={(event) => onTextChange(item.id, event.target.value)}
                    onBlur={() => onTextCommit(item)}
                  />
                );
              }

              return (
                <Dropdown key={item.id} menu={{ items: makeItemMenu(item) }} trigger={["contextMenu"]}>
                  <div
                    data-item-id={item.id}
                    className={`${matched ? "text-note-view matched" : "text-note-view"}${isSelected ? " selected" : ""}${isSearchTarget ? " search-target" : ""}`}
                    style={viewStyle}
                    onContextMenu={() => onItemContextMenu(item)}
                    onMouseDown={(event) => onItemMouseDown(item, event)}
                    onDoubleClick={(event) => onTextDoubleClick(item, event)}
                  >
                    {item.text.trim() ? renderHighlightedText(item.text, searchValue) : <span className="text-placeholder">双击编辑</span>}
                  </div>
                </Dropdown>
              );
            }

            return (
              <Dropdown key={item.id} menu={{ items: makeItemMenu(item) }} trigger={["contextMenu"]}>
                <div
                  data-item-id={item.id}
                  className={`image-note${isSelected ? " selected" : ""}${isSearchTarget ? " search-target" : ""}`}
                  style={{
                    left: layout.x,
                    top: layout.y,
                    width: layout.width,
                    height: layout.height,
                    zIndex,
                  }}
                  onContextMenu={() => onItemContextMenu(item)}
                  onMouseDown={(event) => onItemMouseDown(item, event)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onPreviewImage(item);
                  }}
                >
                  <img src={item.src} alt={item.name} draggable={false} />
                  <span>{item.name}</span>
                </div>
              </Dropdown>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FileView({
  tab,
  searchValue,
  onContentChange,
}: {
  tab: FileTab;
  searchValue: string;
  onContentChange: (content: string) => void;
}) {
  const needle = searchValue.trim();
  const highlightRef = useRef<HTMLPreElement>(null);
  const matchCount = needle ? (tab.content.match(new RegExp(escapeRegExp(needle), "gi")) ?? []).length : 0;

  return (
    <div className="file-view">
      <div className="file-header">
        <div>
          <Typography.Title level={4}>{tab.fileName}</Typography.Title>
          {tab.filePath ? <Typography.Text type="secondary">{tab.filePath}</Typography.Text> : null}
        </div>
        {needle ? <Typography.Text type="secondary">{matchCount} 个匹配</Typography.Text> : null}
      </div>
      <div className="file-editor-wrap">
        <pre ref={highlightRef} className="file-highlight" aria-hidden>
          {renderHighlightedText(tab.content || " ", searchValue)}
        </pre>
        <textarea
          className="file-editor"
          value={tab.content}
          spellCheck={false}
          placeholder="文件为空，可以直接编辑"
          onScroll={(event) => {
            if (highlightRef.current) {
              highlightRef.current.scrollTop = event.currentTarget.scrollTop;
              highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          onChange={(event) => onContentChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  settings,
  onClose,
  onChange,
}: {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}) {
  const updateShortcut = (action: ShortcutAction, shortcut: string) => {
    onChange({
      ...settings,
      shortcuts: {
        ...settings.shortcuts,
        [action]: normalizeShortcut(shortcut),
      },
    });
  };

  return (
    <Modal
      title="设置"
      open={open}
      footer={null}
      onCancel={onClose}
      width="min(720px, calc(100vw - 32px))"
      style={{ top: 24 }}
      styles={{ body: { maxHeight: "min(72vh, calc(100vh - 140px))", overflowY: "auto", paddingRight: 8 } }}
    >
      <div className="settings-panel">
        <label className="settings-row">
          <span>
            <strong>手绘风格</strong>
            <small>打开后，画板文字切换为偏 Q 版的手绘字体栈。</small>
          </span>
          <Switch
            checked={settings.handwritten}
            onChange={(checked) =>
              onChange({
                ...settings,
                handwritten: checked,
              })
            }
          />
        </label>

        <label className="settings-row">
          <span>
            <strong>程序员使用</strong>
            <small>打开后，文字元素右键菜单增加 JSON 工具。</small>
          </span>
          <Switch
            checked={settings.programmerMode}
            onChange={(checked) =>
              onChange({
                ...settings,
                programmerMode: checked,
              })
            }
          />
        </label>

        <label className="settings-row">
          <span>
            <strong>夜间模式跟随系统设置</strong>
            <small>打开后，夜间模式会跟随系统外观自动切换。</small>
          </span>
          <Switch
            checked={settings.followSystemTheme}
            onChange={(checked) =>
              onChange({
                ...settings,
                followSystemTheme: checked,
              })
            }
          />
        </label>

        <div className="shortcut-settings">
          <div className="settings-section-title">快捷键设置</div>
          {SHORTCUT_ROWS.map((row) => (
            <label className="shortcut-row" key={row.action}>
              <span>
                <strong>{row.label}</strong>
                <small>{row.desc}</small>
              </span>
              <Input
                value={settings.shortcuts[row.action]}
                onChange={(event) => updateShortcut(row.action, event.target.value)}
                onKeyDown={(event) => {
                  const shortcut = shortcutFromEvent(event);
                  if (shortcut) {
                    event.preventDefault();
                    updateShortcut(row.action, shortcut);
                  }
                }}
              />
            </label>
          ))}
          <Button
            onClick={() =>
              onChange({
                ...settings,
                shortcuts: DEFAULT_SHORTCUTS,
              })
            }
          >
            恢复默认快捷键
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorPrimary: "#1677ff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
        },
      }}
    >
      <AntApp>
        <AppShell />
      </AntApp>
    </ConfigProvider>
  );
}
