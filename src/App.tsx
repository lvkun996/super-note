import {
  App as AntApp,
  Button,
  ConfigProvider,
  Dropdown,
  Empty,
  Input,
  Tooltip,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import {
  BookOutlined,
  CheckOutlined,
  CloudDownloadOutlined,
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  BorderOutlined,
  MinusOutlined,
  MoonOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  RedoOutlined,
  SaveOutlined,
  SearchOutlined,
  SplitCellsOutlined,
  SunOutlined,
  UndoOutlined,
  UserOutlined,
  HeartOutlined,
} from "@ant-design/icons";
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import donationImageUrl from "../assets/wechat-donation.jpg";
import { flushSync } from "react-dom";
import type {
  AppSettings,
  CanvasItem,
  CanvasItemOverride,
  CanvasTab,
  CanvasTheme,
  CanvasViewState,
  DragState,
  FileDocumentMode,
  FileTab,
  FileViewState,
  ImageCanvasItem,
  LegacyTabPlacement,
  NoteFilePayload,
  NoteTab,
  PaneKey,
  PersistedCanvasTab,
  PersistedTab,
  PersistedWorkspace,
  ProgrammerAction,
  RecentFile,
  SearchResult,
  SelectedItem,
  TextCanvasItem,
  TextSearchTarget,
  TabLayout,
} from "./appTypes";
import { EmptyWorld } from "./components/EmptyWorld";
import { dispatchCanvasItemDrag, dispatchCanvasItemDragEnd } from "./features/canvas/canvasLiveDrag";
import {
  DEFAULT_TEXT_FONT_SIZE,
  estimateTextHeight,
  estimateTextWidth,
  focusTextEditor,
  getItemLayout,
  getPointOnCanvas,
  getTextFontSize,
} from "./features/canvas/canvasUtils";
import {
  openExternalUrl,
  renderHighlightedText,
  transformJsonText,
} from "./features/editor/editorUtils";
import { DEFAULT_SETTINGS, normalizeSettings, shortcutMatches } from "./features/settings/settingsModel";
import { rememberTabVisit, removeTabVisit, resolveTabAfterClose } from "./features/tabs/tabHistory";
import { TabNavigation } from "./features/tabs/TabNavigation";
import { reorderTabsById, sortPinnedTabs, toggleTabPinned } from "./features/tabs/tabOrder";
import type { TabDropPosition } from "./features/tabs/tabOrder";
import { getFileDocumentMode, isMarkdownFileName } from "./features/text/fileDocument";
import { hasExternalFileChange } from "./features/files/fileState";
import { buildSaveFileName } from "./features/files/saveFileName";
import {
  addMindMapChild,
  addMindMapSibling,
  cloneMindMap,
  createMindMap,
  deleteMindMapBranch,
  deleteMindMapCanvasLink,
  linkMindMapNodeToCanvasItem,
  moveMindMapNode,
  normalizeMindMap,
  removeMindMapCanvasLinksForItem,
  toggleMindMapNode,
  updateMindMapCanvasLink,
  updateMindMapNodeText,
  updateMindMapStyle,
} from "./features/mindmap/mindMapModel";
import type { MindMapCanvasLink, MindMapDocument, MindMapStyle, SelectedMindMapNode } from "./features/mindmap/mindMapTypes";
import type { ResolvedMindMapRelationAnchors } from "./features/mindmap/mindMapRelations";
import {
  CURRENT_WORKSPACE_VERSION,
  normalizeRecentFiles,
  rememberRecentFiles,
  selectWorkspaceCandidate,
} from "./features/workspace/workspaceUtils";

const HISTORY_LIMIT = 80;
const LONG_PRESS_MS = 160;
const STORAGE_KEY = "super-note-workspace";
const DEFAULT_FILE_FONT_SIZE = 13;
const SEARCH_RESULT_LIMIT = 80;
const INITIAL_PANE_ID = "pane-main";
const SITE_URL = "https://lvkun996.github.io/super-note/";

const LazyCanvasView = lazy(() => import("./features/canvas/CanvasView").then(({ CanvasView }) => ({ default: CanvasView })));
const LazyFileView = lazy(() => import("./features/text/FileView").then(({ FileView }) => ({ default: FileView })));
const LazyHelpDocumentation = lazy(() =>
  import("./components/HelpDocumentation").then(({ HelpDocumentation }) => ({ default: HelpDocumentation })),
);
const LazySettingsModal = lazy(() =>
  import("./features/settings/SettingsModal").then(({ SettingsModal }) => ({ default: SettingsModal })),
);

function FeatureLoading({ label = "正在加载..." }: { label?: string }) {
  return <div className="feature-loading" role="status">{label}</div>;
}

const canvasThemes: CanvasTheme[] = [
  { accent: "#1677ff" },
  { accent: "#13c2c2" },
  { accent: "#722ed1" },
  { accent: "#fa8c16" },
  { accent: "#eb2f96" },
  { accent: "#52c41a" },
];

const releaseTimeline: Array<{ version: string; date: string; title: string; description: string; upcoming?: boolean }> = [
  {
    version: "v0.1.20",
    date: "2026.09.03",
    title: "文本标题栏与光标修复",
    description: "文本模块采用顶部圆角与独立文档标题栏，支持标题菜单操作；修复输入时光标回退，多光标改为不闪烁、不挤占文字空间的独立覆盖层。",
  },
  {
    version: "v0.1.19",
    date: "2026.09.02",
    title: "修复在线更新下载",
    description: "安装包补齐自动更新配置与缓存目录，解决检测到新版本后下载时报 app-update.yml 缺失的问题，并加入打包配置校验。",
  },
  {
    version: "v0.1.18",
    date: "2026.09.02",
    title: "统一导航配色与置顶分组",
    description: "顶栏与顶部标签沿用侧栏配色，操作栏更紧凑；左侧新增可持久化的 Pinned 分组与取消置顶。同步改进文本保存、标签位置恢复、搜索范围和缩放提示。",
  },
  {
    version: "v0.1.17",
    date: "2026.08.28",
    title: "保存命名与标签菜单优化",
    description: "首次保存文本时使用当前标签标题并统一为 .snote 文件，标签右键菜单同步收紧尺寸、间距与视觉层级。",
  },
  {
    version: "v0.1.16",
    date: "2026.08.27",
    title: "标签操作、保存位置与搜索入口",
    description: "两种布局的标签右键菜单新增置顶、删除、编辑和资源管理器定位；设置可选择默认保存位置，并加入顶部搜索入口、长按竖向多光标同步输入与打赏作者页面。",
  },
  {
    version: "v0.1.15",
    date: "2026.08.25",
    title: "可调侧栏、全屏与缩放反馈",
    description: "左侧标签栏支持实时拖拽调宽并精简视觉元素，侧栏模式聚焦单栏编辑；新增 Ctrl + H 全屏、缩放倍率提示和 Ctrl + 0 恢复 100%。",
  },
  {
    version: "v0.1.14",
    date: "2026.08.20",
    title: "标签导航与 Windows 文件集成",
    description: "新增标签拖拽排序和 Ctrl + B 左侧标签菜单，优化标签渲染与代码层级，并扩展 Windows 默认打开和资源管理器预览支持。",
  },
  {
    version: "v0.1.13",
    date: "2026.08.12",
    title: "画板思维导图与内容关联",
    description: "增加思维导图、主题跨层级拖动、文字与图片关联、连线吸附点拖拽和画板图片导出，并优化样式面板启动与夜间模式。",
  },
  {
    version: "v0.1.12",
    date: "2026.08.11",
    title: "更新与文本操作优化",
    description: "修复低版本更新提示，增加中键竖向选中文本与 Ctrl + 滚轮调整字号，并让 Markdown 默认进入预览模式。",
  },
  {
    version: "v0.1.11",
    date: "2026.08.07",
    title: "工作区安全与文件操作优化",
    description: "增加工作区备份恢复、外部文件变化检测、最近文件和快速打开，并优化 Markdown 预览体验。",
  },
  {
    version: "v0.1.10",
    date: "2026.08.04",
    title: "标签关闭状态与全屏弹窗优化",
    description: "优化当前标签关闭状态提示、全屏版本与作者弹窗布局，并新增 .snote 文件的 Windows 资源管理器预览注册。",
  },
  {
    version: "v0.1.9",
    date: "2026.07.20",
    title: "标签、托盘与弹窗体验",
    description: "更新分栏与标签切换快捷键，新增内容标签名和最近标签托盘菜单，并优化全屏版本页、弹窗滚动与标签栏溢出。",
  },
  {
    version: "v0.1.8",
    date: "2026.07.17",
    title: "链接、搜索与编辑体验",
    description: "修复文本底部点击和搜索定位，新增 Ctrl + 单击外部链接、固定编辑菜单，并按功能拆分核心代码。",
  },
  {
    version: "v0.1.7",
    date: "2026.07.09",
    title: "透明图标与作者全屏",
    description: "更新透明背景的新 logo，作者寄语改为全屏展示，优化标签栏边框，并暂时移除文本对比插件。",
  },
  {
    version: "v0.1.6",
    date: "2026.07.08",
    title: "自动更新与全局快捷键",
    description: "根据凯哥的提议，新增自动更新按钮、Windows 版本通道识别、一键发布脚本，以及 Ctrl + Alt + 空格全局打开/隐藏。",
  },
  {
    version: "v0.1.5",
    date: "2026.07.08",
    title: "为凯哥更新的版本",
    description: "新增凯哥生日快乐独立页面，用纯 CSS 做蛋糕、礼物、烟花与生日签互动；同时保留空工作区、插件开关、安装目录选择和本地打包缓存优化。",
  },
  {
    version: "v0.1.4",
    date: "2026.06.30",
    title: "文本模块字号与滚动空间",
    description: "新增文本模块字号放大、缩小快捷键设置，并把文本编辑区底部空白扩展到约 22 行。",
  },
  {
    version: "v0.1.3",
    date: "2026.06.24",
    title: "更多 Windows 版本支持",
    description: "新增 Windows 7 / 8 安装包，同时保留 Windows 10 / 11 独立下载入口。",
  },
  {
    version: "v0.1.2",
    date: "2026.06.23",
    title: "项目网站与直接下载",
    description: "重构项目页面视觉与响应式布局，安装包可从网站直接下载。",
  },
  {
    version: "v0.1.1",
    date: "2026.06.22",
    title: "多栏工作区",
    description: "加入自由画板、动态分栏、全局搜索与本地工作区保存。",
  },
];

const makeId = () => crypto.randomUUID();

function cloneItems(items: CanvasItem[]) {
  return items.map((item) => ({ ...item }));
}

function cloneCanvasSnapshot(items: CanvasItem[], mindMap?: MindMapDocument) {
  return { items: cloneItems(items), mindMap: cloneMindMap(mindMap) };
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

function getFileSaveFilters(tab: FileTab) {
  const textFilters = [
    { name: "Text", extensions: ["txt", "md", "markdown", "json", "csv", "log", "ts", "tsx", "js", "jsx", "css", "html"] },
    { name: "All Files", extensions: ["*"] },
  ];
  if (getFileDocumentMode(tab) !== "markdown") {
    return textFilters;
  }
  return [
    { name: "Markdown", extensions: ["md", "markdown"] },
    ...textFilters,
  ];
}

function deriveCanvasTitle(tab: CanvasTab, items: CanvasItem[], mindMap = tab.mindMap) {
  if (!tab.autoTitle) {
    return tab.title;
  }
  const textItem = items.find((item): item is TextCanvasItem => item.type === "text" && item.text.trim().length > 0);
  const rootText = mindMap?.nodes.find((node) => node.id === mindMap.rootId)?.text;
  return textItem ? truncateTitle(textItem.text) : rootText ? truncateTitle(rootText) : "未知";
}

function pushHistory(tab: CanvasTab, nextItems: CanvasItem[], nextMindMap = tab.mindMap) {
  const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
  nextHistory.push(cloneCanvasSnapshot(nextItems, nextMindMap));
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
    history: [cloneCanvasSnapshot(items)],
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
    documentMode: isMarkdownFileName(file.name) || isMarkdownFileName(file.path) ? "markdown" : "text",
    fontSize: DEFAULT_FILE_FONT_SIZE,
    themeIndex,
    lastKnownMtimeMs: file.mtimeMs,
    lastKnownSize: file.size,
    dirty: false,
  };
}

function createTextTab(themeIndex: number): FileTab {
  return {
    id: makeId(),
    kind: "file",
    title: "未命名文本",
    fileName: "未命名文本.txt",
    content: "",
    documentMode: "text",
    fontSize: DEFAULT_FILE_FONT_SIZE,
    themeIndex,
    dirty: true,
  };
}

function createMarkdownTab(themeIndex: number): FileTab {
  return {
    id: makeId(),
    kind: "file",
    title: "未命名 Markdown",
    fileName: "untitled.md",
    content: "# 未命名\n\n",
    documentMode: "markdown",
    fontSize: DEFAULT_FILE_FONT_SIZE,
    themeIndex,
    dirty: true,
  };
}

function restoreTab(tab: PersistedTab): NoteTab {
  if (tab.kind === "canvas") {
    const items = cloneItems(tab.items ?? []);
    const mindMap = normalizeMindMap(tab.mindMap);
    return {
      ...tab,
      title: tab.title || "未知",
      autoTitle: tab.autoTitle ?? true,
      scale: tab.scale || 1,
      panX: tab.panX ?? 0,
      panY: tab.panY ?? 0,
      items,
      mindMap,
      history: [cloneCanvasSnapshot(items, mindMap)],
      historyIndex: 0,
      dirty: tab.dirty ?? false,
    };
  }
  return {
    ...tab,
    documentMode: tab.documentMode ?? (isMarkdownFileName(tab.fileName) || isMarkdownFileName(tab.filePath) ? "markdown" : "text"),
    fontSize: tab.fontSize ?? DEFAULT_FILE_FONT_SIZE,
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
      lastKnownMtimeMs: file.mtimeMs,
      lastKnownSize: file.size,
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

function getFileFontSize(tab: FileTab) {
  return tab.fontSize ?? DEFAULT_FILE_FONT_SIZE;
}

function isTabEmpty(tab: NoteTab) {
  if (tab.kind === "file") {
    return tab.content.trim().length === 0;
  }
  return !tab.mindMap && tab.items.every((item) => item.type === "text" && item.text.trim().length === 0);
}

function getTabDisplayTitle(tab: NoteTab) {
  if (tab.kind !== "file" || tab.filePath || !tab.title.startsWith("未命名")) {
    return tab.title;
  }
  const preview = tab.content.replace(/\s+/g, " ").trim();
  if (!preview) {
    return tab.title;
  }
  return `${Array.from(preview).slice(0, 14).join("")}...`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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

function makePreview(text: string, query: string, matchIndex?: number) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = matchIndex ?? lowerText.indexOf(lowerQuery);
  if (index < 0) {
    return text.slice(0, 80);
  }
  const start = Math.max(0, index - 28);
  const end = Math.min(text.length, index + query.length + 36);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

function AppShell() {
  const { message, modal } = AntApp.useApp();
  const [tabs, setTabs] = useState<NoteTab[]>(() => [createTextTab(0)]);
  const [paneIds, setPaneIds] = useState<PaneKey[]>([INITIAL_PANE_ID]);
  const [paneActiveTabIds, setPaneActiveTabIds] = useState<Record<PaneKey, string>>(() => ({ [INITIAL_PANE_ID]: tabs[0].id }));
  const [activePane, setActivePane] = useState<PaneKey>(INITIAL_PANE_ID);
  const [tabPaneIds, setTabPaneIds] = useState<Record<string, PaneKey[]>>(() => ({ [tabs[0].id]: [INITIAL_PANE_ID] }));
  const [paneWidths, setPaneWidths] = useState<number[]>([100]);
  const [canvasViewStates, setCanvasViewStates] = useState<Record<string, Partial<Record<PaneKey, CanvasViewState>>>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchScope, setSearchScope] = useState<"current" | "all">("current");
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenValue, setQuickOpenValue] = useState("");
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [fileZoomPercent, setFileZoomPercent] = useState<number | null>(null);
  const [donationOpen, setDonationOpen] = useState(false);
  const [editingText, setEditingText] = useState<{ itemId: string; pane: PaneKey } | null>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [selectedMindMapNode, setSelectedMindMapNode] = useState<SelectedMindMapNode>(null);
  const [activeSearchResultId, setActiveSearchResultId] = useState<string | null>(null);
  const [fileSearchTarget, setFileSearchTarget] = useState<TextSearchTarget | null>(null);
  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo>({
    version: "0.1.20",
    author: "kunkun",
    desc: "认识自身平凡后，依旧拥有改变世界的勇气",
  });
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "idle",
    channel: "latest",
    currentVersion: "0.1.20",
  });
  const lastCanvasPoint = useRef<Record<string, { x: number; y: number }>>({});
  const draggingRef = useRef<DragState | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileUndoRef = useRef<Record<string, string[]>>({});
  const fileRedoRef = useRef<Record<string, string[]>>({});
  const fileViewStatesRef = useRef<Record<string, FileViewState>>({});
  const workspaceSaveErrorRef = useRef("");
  const workspaceLoadedRef = useRef(false);
  const pendingOpenedFilesRef = useRef<OpenedFile[]>([]);
  const tabsRef = useRef(tabs);
  const externalPromptedRef = useRef(new Set<string>());
  const sidebarResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number; currentWidth: number } | null>(null);
  const zoomFeedbackPendingRef = useRef(false);
  const zoomFeedbackTimerRef = useRef<number | null>(null);
  tabsRef.current = tabs;
  const paneTabHistoryRef = useRef<Record<PaneKey, string[]>>({ [INITIAL_PANE_ID]: [tabs[0].id] });
  const effectiveDarkMode = settings.followSystemTheme ? systemDarkMode : settings.darkMode;
  const canvasPluginEnabled = settings.plugins.canvas;

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchValue("");
    setSearchScope("current");
  }, []);

  const closeQuickOpen = useCallback(() => {
    setQuickOpenOpen(false);
    setQuickOpenValue("");
  }, []);

  const openSearch = useCallback(
    (scope: "current" | "all") => {
      closeQuickOpen();
      setSearchScope(scope);
      setSearchOpen(true);
      window.setTimeout(() => document.getElementById("global-search-input")?.focus(), 0);
    },
    [closeQuickOpen],
  );

  const getTabPanes = useCallback(
    (tabId: string) => tabPaneIds[tabId]?.filter((paneId) => paneIds.includes(paneId)) ?? [paneIds[0]],
    [paneIds, tabPaneIds],
  );

  const { paneTabs, paneTabIds } = useMemo(() => {
    const nextTabs: Record<PaneKey, NoteTab[]> = Object.fromEntries(paneIds.map((paneId) => [paneId, []]));
    const nextIds: Record<PaneKey, string[]> = Object.fromEntries(paneIds.map((paneId) => [paneId, []]));
    const validPaneIds = new Set(paneIds);
    tabs.forEach((tab) => {
      const placements = tabPaneIds[tab.id]?.filter((paneId) => validPaneIds.has(paneId)) ?? [paneIds[0]];
      placements.forEach((paneId) => {
        nextTabs[paneId]?.push(tab);
        nextIds[paneId]?.push(tab.id);
      });
    });
    return { paneTabs: nextTabs, paneTabIds: nextIds };
  }, [paneIds, tabPaneIds, tabs]);

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
  const activeFileFontSize = activeTab?.kind === "file" ? getFileFontSize(activeTab) : null;

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
    paneTabHistoryRef.current[pane] = rememberTabVisit(paneTabHistoryRef.current[pane] ?? [], tabId);
    setPaneActiveTabIds((current) => ({ ...current, [pane]: tabId }));
    setActivePane(pane);
  }, []);

  const toggleCanvasPlugin = useCallback(() => {
    setSettings((current) => ({
      ...current,
      plugins: {
        ...current.plugins,
        canvas: !current.plugins.canvas,
      },
    }));
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
      dispatchCanvasItemDrag({
        tabId: dragging.tabId,
        pane: dragging.pane,
        itemId: dragging.itemId,
        x: dragging.currentX,
        y: dragging.currentY,
        phase: "move",
      });
    });
  }, []);

  const persistWorkspace = useCallback(async () => {
    const workspace: PersistedWorkspace = {
      version: CURRENT_WORKSPACE_VERSION,
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
      recentFiles,
      tabs: tabs.map(stripTab),
    };

    if (window.superNote) {
      try {
        const result = await window.superNote.saveWorkspace(workspace);
        if (!result.ok) {
          throw new Error(result.error ?? "工作区保存失败");
        }
        workspaceSaveErrorRef.current = "";
      } catch (error) {
        const detail = String(error);
        if (workspaceSaveErrorRef.current !== detail) {
          workspaceSaveErrorRef.current = detail;
          message.error(`自动保存失败：${detail}`);
        }
      }
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    }
  }, [activePane, activeTabId, canvasViewStates, message, paneActiveTabIds, paneIds, paneWidths, recentFiles, settings, splitView, tabPaneIds, tabs]);
  const persistWorkspaceRef = useRef(persistWorkspace);
  persistWorkspaceRef.current = persistWorkspace;

  useEffect(() => {
    const unsubscribe = window.superNote?.onPrepareQuit(() => {
      if (!workspaceLoadedRef.current) {
        void window.superNote?.notifyWorkspaceFlushed();
        return;
      }
      void persistWorkspaceRef.current().finally(() => window.superNote?.notifyWorkspaceFlushed());
    });
    return unsubscribe;
  }, []);

  const toggleTabLayout = useCallback(() => {
    setSettings((current) => ({
      ...current,
      tabLayout: current.tabLayout === "left" ? "top" : "left",
    }));
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) {
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => void persistWorkspace(), 250);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [persistWorkspace, workspaceLoaded]);

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

  useEffect(() => {
    const paneSet = new Set(paneIds);
    Object.keys(paneTabHistoryRef.current).forEach((paneId) => {
      if (!paneSet.has(paneId)) {
        delete paneTabHistoryRef.current[paneId];
      }
    });
    Object.entries(paneActiveTabIds).forEach(([paneId, tabId]) => {
      paneTabHistoryRef.current[paneId] = rememberTabVisit(paneTabHistoryRef.current[paneId] ?? [], tabId);
    });
  }, [paneActiveTabIds, paneIds]);

  const updateCanvasTab = useCallback((tabId: string, updater: (tab: CanvasTab) => CanvasTab) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId && tab.kind === "canvas" ? updater(tab) : tab)));
  }, []);

  const updateFileContent = useCallback((tabId: string, content: string) => {
    fileUndoRef.current[tabId] = [];
    fileRedoRef.current[tabId] = [];
    setTabs((current) => current.map((tab) => (tab.id === tabId && tab.kind === "file" ? { ...tab, content, dirty: true } : tab)));
  }, []);

  const updateFileFontSize = useCallback((tabId: string, updater: (fontSize: number) => number) => {
    zoomFeedbackPendingRef.current = true;
    setTabs((current) =>
      current.map((tab) =>
        tab.id === tabId && tab.kind === "file"
          ? {
              ...tab,
              fontSize: clamp(Math.round(updater(getFileFontSize(tab))), 10, 36),
            }
          : tab,
      ),
    );
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

  const addTextTab = useCallback((targetPane?: PaneKey) => {
    const nextTab = createTextTab(tabs.length);
    const destination = targetPane && paneIds.includes(targetPane) ? targetPane : paneIds.includes(activePane) ? activePane : paneIds[0];
    setTabs((current) => [...current, nextTab]);
    setTabPaneIds((current) => ({ ...current, [nextTab.id]: [destination] }));
    focusTabInPane(nextTab.id, destination);
    setSelectedItem(null);
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(`.file-view[data-tab-id="${nextTab.id}"] .file-editor`)?.focus(), 0);
  }, [activePane, focusTabInPane, paneIds, tabs.length]);

  const addMarkdownTab = useCallback((targetPane?: PaneKey) => {
    const nextTab = createMarkdownTab(tabs.length);
    const destination = targetPane && paneIds.includes(targetPane) ? targetPane : paneIds.includes(activePane) ? activePane : paneIds[0];
    setTabs((current) => [...current, nextTab]);
    setTabPaneIds((current) => ({ ...current, [nextTab.id]: [destination] }));
    focusTabInPane(nextTab.id, destination);
    setSelectedItem(null);
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(`.file-view[data-tab-id="${nextTab.id}"] .file-editor`)?.focus(), 0);
  }, [activePane, focusTabInPane, paneIds, tabs.length]);

  const focusSiblingTab = useCallback(
    (offset: -1 | 1) => {
      const available = paneTabs[activePane] ?? [];
      const currentIndex = available.findIndex((tab) => tab.id === activeTabId);
      const sibling = available[currentIndex + offset];
      if (sibling) {
        focusTabInPane(sibling.id, activePane);
      }
    },
    [activePane, activeTabId, focusTabInPane, paneTabs],
  );

  const commitMindMap = useCallback(
    (tabId: string, updater: (mindMap?: MindMapDocument) => MindMapDocument | undefined) => {
      updateCanvasTab(tabId, (tab) => {
        const nextMindMap = updater(cloneMindMap(tab.mindMap));
        return {
          ...tab,
          title: deriveCanvasTitle(tab, tab.items, nextMindMap),
          mindMap: nextMindMap,
          dirty: true,
          ...pushHistory(tab, tab.items, nextMindMap),
        };
      });
    },
    [updateCanvasTab],
  );

  useEffect(() => {
    return window.superNote?.onMindMapStyleUpdate?.((payload) => {
      if (!payload || typeof payload.tabId !== "string" || !payload.style || typeof payload.style !== "object") {
        return;
      }
      commitMindMap(payload.tabId, (mindMap) => mindMap ? updateMindMapStyle(mindMap, payload.style as Partial<MindMapStyle>) : mindMap);
    });
  }, [commitMindMap]);

  useEffect(() => {
    if (activeTab?.kind === "canvas" && activeTab.mindMap) {
      void window.superNote?.syncMindMapStyle?.({
        tabId: activeTab.id,
        title: getTabDisplayTitle(activeTab),
        style: activeTab.mindMap.style,
        darkMode: effectiveDarkMode,
      });
    }
  }, [activeTab, effectiveDarkMode]);

  const openFilesAsTabs = useCallback(
    (files: OpenedFile[], targetPane?: PaneKey) => {
      if (files.length === 0) {
        return;
      }
      setRecentFiles((current) =>
        rememberRecentFiles(
          current,
          files.flatMap((file) => (file.path ? [{ path: file.path, name: file.name }] : [])),
        ),
      );
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
  const openFilesAsTabsRef = useRef(openFilesAsTabs);
  openFilesAsTabsRef.current = openFilesAsTabs;

  const reloadTabFromDisk = useCallback(
    async (tab: NoteTab) => {
      if (!tab.filePath || !window.superNote) {
        return false;
      }
      const result = await window.superNote.readFile(tab.filePath);
      if (!result.ok || !result.file) {
        message.error(`重新加载失败：${result.error ?? tab.filePath}`);
        return false;
      }
      const restored = createTabFromOpenedFile(result.file, tab.themeIndex);
      setTabs((current) => current.map((item) => (item.id === tab.id ? { ...restored, id: tab.id } : item)));
      fileUndoRef.current[tab.id] = [];
      fileRedoRef.current[tab.id] = [];
      setRecentFiles((current) => rememberRecentFiles(current, [{ path: tab.filePath!, name: result.file!.name }]));
      return true;
    },
    [message],
  );

  useEffect(() => {
    const unsubscribe = window.superNote?.onOpenFiles((files) => {
      if (workspaceLoadedRef.current) {
        openFilesAsTabsRef.current(files);
      } else {
        pendingOpenedFilesRef.current.push(...files);
      }
    });
    void window.superNote?.notifyRendererReady();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!zoomFeedbackPendingRef.current || activeFileFontSize === null) {
      return;
    }
    zoomFeedbackPendingRef.current = false;
    setFileZoomPercent(Math.round((activeFileFontSize / DEFAULT_FILE_FONT_SIZE) * 100));
    if (zoomFeedbackTimerRef.current !== null) {
      window.clearTimeout(zoomFeedbackTimerRef.current);
    }
    zoomFeedbackTimerRef.current = window.setTimeout(() => setFileZoomPercent(null), 3000);
    return () => {
      if (zoomFeedbackTimerRef.current !== null) {
        window.clearTimeout(zoomFeedbackTimerRef.current);
      }
    };
  }, [activeFileFontSize]);

  const openDroppedFilesAsTabs = useCallback(
    async (files: File[], targetPane?: PaneKey) => {
      const fileTabs: OpenedFile[] = [];
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          continue;
        }
        const filePath = window.superNote?.getPathForFile?.(file) || (file as File & { path?: string }).path;
        try {
          fileTabs.push({
            path: filePath,
            name: file.name,
            content: await file.text(),
          });
        } catch (error) {
          message.error(`读取文件失败：${file.name}，${String(error)}`);
        }
      }

      if (fileTabs.length === 0) {
        return false;
      }

      openFilesAsTabs(fileTabs, targetPane);
      return true;
    },
    [message, openFilesAsTabs],
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

  const openFilePath = useCallback(
    async (filePath: string, targetPane?: PaneKey) => {
      const existing = tabs.find((tab) => tab.filePath?.toLowerCase() === filePath.toLowerCase());
      if (existing) {
        const availablePanes = getTabPanes(existing.id);
        const pane = targetPane && availablePanes.includes(targetPane) ? targetPane : availablePanes[0] ?? activePane;
        focusTabInPane(existing.id, pane);
        setRecentFiles((current) => rememberRecentFiles(current, [{ path: filePath, name: getFileName(filePath) }]));
        return true;
      }
      if (!window.superNote) {
        return false;
      }
      const result = await window.superNote.readFile(filePath);
      if (!result.ok || !result.file) {
        message.error(`打开文件失败：${result.error ?? filePath}`);
        setRecentFiles((current) => current.filter((file) => file.path.toLowerCase() !== filePath.toLowerCase()));
        return false;
      }
      openFilesAsTabs([result.file], targetPane ?? (paneIds.includes(activePane) ? activePane : paneIds[0]));
      return true;
    },
    [activePane, focusTabInPane, getTabPanes, message, openFilesAsTabs, paneIds, tabs],
  );

  const handleAppDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleAppDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      const files = Array.from(event.dataTransfer.files);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const targetPane = paneIds.includes(activePane) ? activePane : paneIds[0];
      await openDroppedFilesAsTabs(files, targetPane);
    },
    [activePane, openDroppedFilesAsTabs, paneIds],
  );

  const splitTab = useCallback(
    (tabId: string, sourcePane: PaneKey, direction: "left" | "right") => {
      if (settings.tabLayout === "left") {
        return;
      }
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
    [paneIds, settings.tabLayout],
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
      delete paneTabHistoryRef.current[paneId];
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

  useEffect(() => {
    if (settings.tabLayout !== "left" || paneIds.length <= 1) {
      return;
    }
    const retainedPane = paneIds.includes(activePane) ? activePane : paneIds[0];
    setTabPaneIds(Object.fromEntries(tabs.map((tab) => [tab.id, [retainedPane]])));
    setPaneIds([retainedPane]);
    setPaneWidths([100]);
    setPaneActiveTabIds({ [retainedPane]: activeTabId });
    setActivePane(retainedPane);
    setCanvasViewStates((current) => Object.fromEntries(
      Object.entries(current).map(([tabId, states]) => [tabId, states[retainedPane] ? { [retainedPane]: states[retainedPane] } : {}]),
    ));
    paneTabHistoryRef.current = { [retainedPane]: paneTabHistoryRef.current[retainedPane] ?? [activeTabId] };
  }, [activePane, activeTabId, paneIds, settings.tabLayout, tabs]);

  const reorderTab = useCallback(
    (movingId: string, targetId: string, position: TabDropPosition, pane?: PaneKey) => {
      setTabs((current) => {
        const scopeIds = pane
          ? new Set(
              current
                .filter((tab) => (tabPaneIds[tab.id] ?? [paneIds[0]]).filter((paneId) => paneIds.includes(paneId)).includes(pane))
                .map((tab) => tab.id),
            )
          : undefined;
        return reorderTabsById(current, movingId, targetId, position, scopeIds);
      });
    },
    [paneIds, tabPaneIds],
  );

  const pinTab = useCallback((tabId: string) => {
    setTabs((current) => toggleTabPinned(current, tabId));
  }, []);

  const renameTab = useCallback((tabId: string) => {
    const tab = tabsRef.current.find((item) => item.id === tabId);
    if (!tab) return;
    let nextTitle = getTabDisplayTitle(tab);
    modal.confirm({
      title: "编辑栏目名称",
      content: <Input autoFocus defaultValue={nextTitle} maxLength={80} onChange={(event) => { nextTitle = event.target.value; }} />,
      okText: "保存",
      cancelText: "取消",
      onOk: () => {
        const title = nextTitle.trim();
        if (!title) return Promise.reject(new Error("栏目名称不能为空"));
        setTabs((current) => current.map((item) => item.id === tabId ? { ...item, title, ...(item.kind === "canvas" ? { autoTitle: false } : {}) } : item));
      },
    });
  }, [modal]);

  const openTabInExplorer = useCallback((tabId: string) => {
    const filePath = tabsRef.current.find((tab) => tab.id === tabId)?.filePath;
    if (filePath) void window.superNote?.showItemInFolder(filePath);
  }, []);

  const closeTab = useCallback(
    (targetId: string, pane?: PaneKey) => {
      const target = tabs.find((tab) => tab.id === targetId);
      if (!target) {
        return;
      }

      const targetPanes = getTabPanes(targetId);
      if (pane && targetPanes.length > 1) {
        const orderedTabIds = (paneTabs[pane] ?? []).map((tab) => tab.id);
        const fallback = resolveTabAfterClose(paneTabHistoryRef.current[pane] ?? [], targetId, orderedTabIds);
        setTabPaneIds((current) => ({
          ...current,
          [targetId]: (current[targetId] ?? targetPanes).filter((paneId) => paneId !== pane),
        }));
        paneTabHistoryRef.current[pane] = removeTabVisit(paneTabHistoryRef.current[pane] ?? [], targetId);
        setPaneActiveTabIds((current) => {
          if (current[pane] !== targetId) {
            return current;
          }
          const next = { ...current };
          if (fallback) {
            next[pane] = fallback;
            paneTabHistoryRef.current[pane] = rememberTabVisit(paneTabHistoryRef.current[pane] ?? [], fallback);
          } else {
            delete next[pane];
          }
          return next;
        });
        if (selectedItem?.tabId === targetId && selectedItem.pane === pane) {
          setSelectedItem(null);
        }
        return;
      }

      const doClose = () => {
        delete fileUndoRef.current[targetId];
        delete fileRedoRef.current[targetId];
        setTabs((current) => {
          if (current.length === 1) {
            const emptyPane = pane && paneIds.includes(pane) ? pane : paneIds.includes(activePane) ? activePane : paneIds[0];
            setPaneIds([emptyPane]);
            setPaneWidths([100]);
            setPaneActiveTabIds({});
            setActivePane(emptyPane);
            setTabPaneIds({});
            setCanvasViewStates({});
            setSelectedItem(null);
            paneTabHistoryRef.current = {};
            return [];
          }

          const next = current.filter((tab) => tab.id !== targetId);
          setPaneActiveTabIds((activeIds) => {
            const updated = { ...activeIds };
            Object.entries(updated).forEach(([paneId, activeId]) => {
              const paneHistory = paneTabHistoryRef.current[paneId] ?? [];
              if (activeId === targetId) {
                const orderedTabIds = current
                  .filter((tab) => getTabPanes(tab.id).includes(paneId))
                  .map((tab) => tab.id);
                const fallback = resolveTabAfterClose(paneHistory, targetId, orderedTabIds);
                if (fallback) {
                  updated[paneId] = fallback;
                  paneTabHistoryRef.current[paneId] = rememberTabVisit(removeTabVisit(paneHistory, targetId), fallback);
                } else {
                  delete updated[paneId];
                  delete paneTabHistoryRef.current[paneId];
                }
              } else {
                paneTabHistoryRef.current[paneId] = removeTabVisit(paneHistory, targetId);
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

      if (!target.dirty || isTabEmpty(target)) {
        doClose();
        return;
      }

      modal.confirm({
        title: "当前标签还没有保存",
        content: "是否关闭？未保存的修改会丢失。",
        okText: "关闭",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: doClose,
      });
    },
    [activePane, getTabPanes, modal, paneIds, paneTabs, selectedItem, tabs],
  );

  const closeCurrentTab = useCallback(() => {
    if (activeTab) {
      closeTab(activeTab.id, activePane);
    }
  }, [activePane, activeTab, closeTab]);

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
        const isNewFile = !activeTab.filePath;
        const documentMode = getFileDocumentMode(activeTab);
        const requiredExtension = documentMode === "markdown" ? "md" : "txt";
        const result = await window.superNote?.saveFile({
          path: activeTab.filePath,
          content: activeTab.content,
          defaultName: isNewFile
            ? buildSaveFileName(
                getTabDisplayTitle(activeTab),
                requiredExtension,
                documentMode === "markdown" ? "未命名 Markdown" : "未命名文本",
              )
            : activeTab.fileName,
          defaultDirectory: settings.defaultSaveDirectory,
          filters: getFileSaveFilters(activeTab),
          requiredExtension: isNewFile ? requiredExtension : undefined,
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
                  documentMode: tab.documentMode === "markdown" || isMarkdownFileName(result.name) || isMarkdownFileName(result.path) ? "markdown" : "text",
                  lastKnownMtimeMs: result.mtimeMs,
                  lastKnownSize: result.size,
                  dirty: false,
                }
              : tab,
          ),
        );
        if (result.path) {
          setRecentFiles((current) =>
            rememberRecentFiles(current, [{ path: result.path!, name: result.name ?? getFileName(result.path!) }]),
          );
        }
        message.success("已保存到本地文件");
        return;
      }

      const payload = JSON.stringify(createCanvasPayload(activeTab), null, 2);
      const result = await window.superNote?.saveFile({
        path: activeTab.filePath,
        content: payload,
        defaultName: `${activeTab.title === "未知" ? "untitled" : activeTab.title}.snote`,
        defaultDirectory: settings.defaultSaveDirectory,
        filters: [
          { name: "Super Note", extensions: ["snote"] },
          { name: "All Files", extensions: ["*"] },
        ],
        requiredExtension: "snote",
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
                lastKnownMtimeMs: result.mtimeMs,
                lastKnownSize: result.size,
                dirty: false,
              }
            : tab,
          ),
      );
      if (result.path) {
        setRecentFiles((current) =>
          rememberRecentFiles(current, [{ path: result.path!, name: result.name ?? getFileName(result.path!) }]),
        );
      }
      message.success("已保存为 Super Note 文件");
    } catch (error) {
      message.error(`保存失败：${String(error)}`);
    }
  }, [activeTab, message, settings.defaultSaveDirectory]);

  const undo = useCallback(() => {
    if (activeTab?.kind === "file") {
      const history = fileUndoRef.current[activeTab.id] ?? [];
      if (history.length === 0) {
        return;
      }
      const previousContent = history[history.length - 1];
      fileUndoRef.current[activeTab.id] = history.slice(0, -1);
      fileRedoRef.current[activeTab.id] = [...(fileRedoRef.current[activeTab.id] ?? []), activeTab.content].slice(-HISTORY_LIMIT);
      setTabs((current) =>
        current.map((tab) => (tab.id === activeTab.id && tab.kind === "file" ? { ...tab, content: previousContent, dirty: true } : tab)),
      );
      window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(`.file-view[data-tab-id="${activeTab.id}"] .file-editor`)?.focus(), 0);
      return;
    }
    if (activeTab?.kind !== "canvas") {
      return;
    }
    updateCanvasTab(activeTab.id, (tab) => {
      if (tab.historyIndex <= 0) {
        return tab;
      }
      const nextIndex = tab.historyIndex - 1;
      const snapshot = tab.history[nextIndex];
      const nextItems = cloneItems(snapshot.items);
      const nextMindMap = cloneMindMap(snapshot.mindMap);
      return {
        ...tab,
        title: deriveCanvasTitle(tab, nextItems, nextMindMap),
        items: nextItems,
        mindMap: nextMindMap,
        dirty: true,
        historyIndex: nextIndex,
      };
    });
  }, [activeTab, updateCanvasTab]);

  const redo = useCallback(() => {
    if (activeTab?.kind === "file") {
      const history = fileRedoRef.current[activeTab.id] ?? [];
      if (history.length === 0) {
        return;
      }
      const nextContent = history[history.length - 1];
      fileRedoRef.current[activeTab.id] = history.slice(0, -1);
      fileUndoRef.current[activeTab.id] = [...(fileUndoRef.current[activeTab.id] ?? []), activeTab.content].slice(-HISTORY_LIMIT);
      setTabs((current) =>
        current.map((tab) => (tab.id === activeTab.id && tab.kind === "file" ? { ...tab, content: nextContent, dirty: true } : tab)),
      );
      window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(`.file-view[data-tab-id="${activeTab.id}"] .file-editor`)?.focus(), 0);
      return;
    }
    if (activeTab?.kind !== "canvas") {
      return;
    }
    updateCanvasTab(activeTab.id, (tab) => {
      if (tab.historyIndex >= tab.history.length - 1) {
        return tab;
      }
      const nextIndex = tab.historyIndex + 1;
      const snapshot = tab.history[nextIndex];
      const nextItems = cloneItems(snapshot.items);
      const nextMindMap = cloneMindMap(snapshot.mindMap);
      return {
        ...tab,
        title: deriveCanvasTitle(tab, nextItems, nextMindMap),
        items: nextItems,
        mindMap: nextMindMap,
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
      setSelectedMindMapNode(null);
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
      setSelectedMindMapNode(null);
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

  const createCanvasMindMap = useCallback(
    (tabId: string, pane: PaneKey, point: { x: number; y: number }) => {
      const nextMindMap = createMindMap(point);
      commitMindMap(tabId, (current) => current ?? nextMindMap);
      setSelectedItem(null);
      setEditingText(null);
      setSelectedMindMapNode({ tabId, pane, nodeId: nextMindMap.rootId });
    },
    [commitMindMap],
  );

  const addCanvasMindMapChild = useCallback(
    (tabId: string, pane: PaneKey, parentId: string) => {
      const nodeId = makeId();
      commitMindMap(tabId, (mindMap) => mindMap ? addMindMapChild(mindMap, parentId, () => nodeId).document : mindMap);
      setSelectedItem(null);
      setSelectedMindMapNode({ tabId, pane, nodeId });
      return nodeId;
    },
    [commitMindMap],
  );

  const addCanvasMindMapSibling = useCallback(
    (tabId: string, pane: PaneKey, siblingId: string) => {
      const nodeId = makeId();
      commitMindMap(tabId, (mindMap) => mindMap ? addMindMapSibling(mindMap, siblingId, () => nodeId).document : mindMap);
      setSelectedItem(null);
      setSelectedMindMapNode({ tabId, pane, nodeId });
      return nodeId;
    },
    [commitMindMap],
  );

  const moveCanvasMindMapNode = useCallback(
    (tabId: string, nodeId: string, targetNodeId: string, placement: "before" | "after" | "child") => {
      commitMindMap(tabId, (mindMap) => mindMap ? moveMindMapNode(mindMap, nodeId, targetNodeId, placement) : mindMap);
    },
    [commitMindMap],
  );

  const createCanvasMindMapCanvasLink = useCallback(
    (tabId: string, nodeId: string, itemId: string, anchors: ResolvedMindMapRelationAnchors) => {
      const linkId = makeId();
      commitMindMap(tabId, (mindMap) => mindMap
        ? linkMindMapNodeToCanvasItem(mindMap, nodeId, itemId, () => linkId, anchors)
        : mindMap);
    },
    [commitMindMap],
  );

  const updateCanvasMindMapCanvasLink = useCallback(
    (tabId: string, linkId: string, patch: Partial<Pick<MindMapCanvasLink, "nodeAnchor" | "itemAnchor">>) => {
      commitMindMap(tabId, (mindMap) => mindMap ? updateMindMapCanvasLink(mindMap, linkId, patch) : mindMap);
    },
    [commitMindMap],
  );

  const deleteCanvasMindMapCanvasLink = useCallback(
    (tabId: string, linkId: string) => {
      commitMindMap(tabId, (mindMap) => mindMap ? deleteMindMapCanvasLink(mindMap, linkId) : mindMap);
    },
    [commitMindMap],
  );

  const deleteCanvasMindMapBranch = useCallback(
    (tabId: string, pane: PaneKey, nodeId: string) => {
      const tab = tabs.find((candidate): candidate is CanvasTab => candidate.id === tabId && candidate.kind === "canvas");
      const parentId = tab?.mindMap?.nodes.find((node) => node.id === nodeId)?.parentId;
      if (!tab?.mindMap || nodeId === tab.mindMap.rootId) {
        return;
      }
      commitMindMap(tabId, (mindMap) => mindMap ? deleteMindMapBranch(mindMap, nodeId) : mindMap);
      setSelectedMindMapNode(parentId ? { tabId, pane, nodeId: parentId } : null);
    },
    [commitMindMap, tabs],
  );

  const removeCanvasMindMap = useCallback(
    (tabId: string) => {
      modal.confirm({
        title: "删除整张思维导图？",
        content: "中心主题和所有分支都会从当前画板移除，可使用撤销恢复。",
        okText: "删除导图",
        cancelText: "取消",
        okButtonProps: { danger: true },
        onOk: () => {
          commitMindMap(tabId, () => undefined);
          setSelectedMindMapNode(null);
        },
      });
    },
    [commitMindMap, modal],
  );

  const openMindMapStyleWindow = useCallback(async (tab: CanvasTab) => {
    if (!tab.mindMap) {
      return;
    }
    const result = await window.superNote?.openMindMapStyle?.({
      tabId: tab.id,
      title: getTabDisplayTitle(tab),
      style: tab.mindMap.style,
      darkMode: effectiveDarkMode,
    });
    if (result && !result.ok) {
      message.error(result.error ?? "无法打开思维导图样式窗口");
    }
  }, [effectiveDarkMode, message]);

  const exportCanvasImage = useCallback(async (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState) => {
    try {
      const { renderCanvasToPng } = await import("./features/canvas/canvasExport");
      const rendered = await renderCanvasToPng(tab, viewState);
      const defaultName = `${getTabDisplayTitle(tab).replace(/[\\/:*?"<>|]/g, "-") || "super-note-canvas"}.png`;
      if (window.superNote?.saveCanvasImage) {
        const result = await window.superNote.saveCanvasImage({ dataUrl: rendered.dataUrl, defaultName });
        if (result.canceled) {
          return;
        }
        if (!result.ok) {
          throw new Error(result.error ?? "图片保存失败");
        }
        message.success(`已导出 ${rendered.width} × ${rendered.height} PNG`);
        return;
      }
      const link = document.createElement("a");
      link.href = rendered.dataUrl;
      link.download = defaultName;
      link.click();
      message.success("画板图片已导出");
    } catch (error) {
      message.error(`导出图片失败：${String(error)}`);
    }
  }, [message]);

  const deleteCanvasItem = useCallback(
    (tabId: string, itemId: string) => {
      updateCanvasTab(tabId, (tab) => {
        const nextItems = tab.items.filter((item) => item.id !== itemId);
        const nextMindMap = tab.mindMap ? removeMindMapCanvasLinksForItem(tab.mindMap, itemId) : tab.mindMap;
        return {
          ...tab,
          title: deriveCanvasTitle(tab, nextItems, nextMindMap),
          items: nextItems,
          mindMap: nextMindMap,
          dirty: true,
          ...pushHistory(tab, nextItems, nextMindMap),
        };
      });
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
    [editingText, selectedItem, updateCanvasTab],
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
        const nextWidth = estimateTextWidth(nextText, getTextFontSize(item));
        commitCanvasItems(tabId, (items) =>
          items.map((canvasItem) =>
            canvasItem.id === itemId && canvasItem.type === "text"
              ? {
                  ...canvasItem,
                  text: nextText,
                  width: nextWidth,
                  height: estimateTextHeight(nextText, getTextFontSize(canvasItem), nextWidth),
                }
              : canvasItem,
          ),
        );
      } catch (error) {
        message.error(`JSON 处理失败：${String(error)}`);
      }
    },
    [commitCanvasItems, message, tabs],
  );

  const applyFileProgrammerAction = useCallback(
    (tabId: string, action: ProgrammerAction, selectionStart: number, selectionEnd: number) => {
      try {
        const tab = tabs.find((item): item is FileTab => item.id === tabId && item.kind === "file");
        if (!tab) {
          message.warning("程序员工具仅支持文本模块和画布文字元素");
          return;
        }

        const start = clamp(Math.min(selectionStart, selectionEnd), 0, tab.content.length);
        const end = clamp(Math.max(selectionStart, selectionEnd), 0, tab.content.length);
        if (end <= start) {
          message.warning("请先选中需要处理的文本");
          return;
        }

        const sourceText = tab.content.slice(start, end);
        const transformedText = transformJsonText(sourceText, action);
        const nextContent = `${tab.content.slice(0, start)}${transformedText}${tab.content.slice(end)}`;
        fileUndoRef.current[tabId] = [...(fileUndoRef.current[tabId] ?? []), tab.content].slice(-HISTORY_LIMIT);
        fileRedoRef.current[tabId] = [];
        setTabs((current) =>
          current.map((item) => (item.id === tabId && item.kind === "file" ? { ...item, content: nextContent, dirty: true } : item)),
        );
      } catch (error) {
        message.error(`JSON 处理失败：${String(error)}`);
      }
    },
    [message, tabs],
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
      event.stopPropagation();
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
      if (event.key === "Escape" && quickOpenOpen) {
        event.preventDefault();
        closeQuickOpen();
        return;
      }
      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        closeSearch();
        return;
      }

      const activeElement = document.activeElement;
      const isTyping = activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement;
      const canUndoFile = activeTab?.kind === "file" && (fileUndoRef.current[activeTab.id]?.length ?? 0) > 0;
      const canRedoFile = activeTab?.kind === "file" && (fileRedoRef.current[activeTab.id]?.length ?? 0) > 0;

      if (shortcutMatches(event, settings.shortcuts.quickOpen)) {
        event.preventDefault();
        closeSearch();
        setQuickOpenOpen(true);
        window.setTimeout(() => document.getElementById("quick-open-input")?.focus(), 0);
      } else if (quickOpenOpen) {
        return;
      } else if (!searchOpen && !settingsOpen && shortcutMatches(event, settings.shortcuts.toggleTabLayout)) {
        event.preventDefault();
        toggleTabLayout();
      } else if (!searchOpen && !settingsOpen && shortcutMatches(event, settings.shortcuts.toggleFullscreen)) {
        event.preventDefault();
        void window.superNote?.toggleFullscreenWindow();
      } else if (!searchOpen && !settingsOpen && activeTab?.kind === "file" && shortcutMatches(event, settings.shortcuts.fileFontIncrease)) {
        event.preventDefault();
        updateFileFontSize(activeTab.id, (fontSize) => fontSize + 1);
      } else if (!searchOpen && !settingsOpen && activeTab?.kind === "file" && shortcutMatches(event, settings.shortcuts.fileFontDecrease)) {
        event.preventDefault();
        updateFileFontSize(activeTab.id, (fontSize) => fontSize - 1);
      } else if (!searchOpen && !settingsOpen && activeTab?.kind === "file" && shortcutMatches(event, settings.shortcuts.fileFontReset)) {
        event.preventDefault();
        updateFileFontSize(activeTab.id, () => DEFAULT_FILE_FONT_SIZE);
      } else if (!searchOpen && canvasPluginEnabled && shortcutMatches(event, settings.shortcuts.newCanvas)) {
        event.preventDefault();
        addCanvasTab();
      } else if (!searchOpen && shortcutMatches(event, settings.shortcuts.newText)) {
        event.preventDefault();
        addTextTab();
      } else if (!searchOpen && shortcutMatches(event, settings.shortcuts.closeTab)) {
        event.preventDefault();
        closeCurrentTab();
      } else if (shortcutMatches(event, settings.shortcuts.save)) {
        event.preventDefault();
        saveCurrentTab();
      } else if (shortcutMatches(event, settings.shortcuts.search)) {
        event.preventDefault();
        openSearch(searchOpen && searchScope === "current" ? "all" : "current");
      } else if (
        !searchOpen &&
        !settingsOpen &&
        shortcutMatches(event, settings.tabLayout === "left" ? "Ctrl+Up" : settings.shortcuts.previousTab)
      ) {
        event.preventDefault();
        focusSiblingTab(-1);
      } else if (
        !searchOpen &&
        !settingsOpen &&
        shortcutMatches(event, settings.tabLayout === "left" ? "Ctrl+Down" : settings.shortcuts.nextTab)
      ) {
        event.preventDefault();
        focusSiblingTab(1);
      } else if (!searchOpen && settings.tabLayout === "top" && shortcutMatches(event, settings.shortcuts.splitLeft)) {
        event.preventDefault();
        autoSplitTab("left");
      } else if (!searchOpen && settings.tabLayout === "top" && shortcutMatches(event, settings.shortcuts.splitRight)) {
        event.preventDefault();
        autoSplitTab("right");
      } else if (!isTyping && shortcutMatches(event, settings.shortcuts.paste)) {
        event.preventDefault();
        pasteFromClipboard();
      } else if (!isTyping && shortcutMatches(event, settings.shortcuts.deleteSelected)) {
        event.preventDefault();
        if (selectedItem) {
          deleteCanvasItem(selectedItem.tabId, selectedItem.itemId);
        } else if (selectedMindMapNode) {
          deleteCanvasMindMapBranch(selectedMindMapNode.tabId, selectedMindMapNode.pane, selectedMindMapNode.nodeId);
        }
      } else if ((!isTyping || canUndoFile) && shortcutMatches(event, settings.shortcuts.undo)) {
        event.preventDefault();
        undo();
      } else if ((!isTyping || canRedoFile) && (shortcutMatches(event, settings.shortcuts.redo) || shortcutMatches(event, settings.shortcuts.redoAlt))) {
        event.preventDefault();
        redo();
      }
    },
    [
      activeTab,
      addCanvasTab,
      addTextTab,
      autoSplitTab,
      canvasPluginEnabled,
      closeCurrentTab,
      closeQuickOpen,
      closeSearch,
      deleteCanvasItem,
      deleteCanvasMindMapBranch,
      focusSiblingTab,
      pasteFromClipboard,
      openSearch,
      quickOpenOpen,
      redo,
      saveCurrentTab,
      searchOpen,
      searchScope,
      selectedItem,
      selectedMindMapNode,
      settings.shortcuts,
      settings.tabLayout,
      settingsOpen,
      toggleTabLayout,
      undo,
      updateFileFontSize,
    ],
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
      setSelectedMindMapNode(null);
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
      dispatchCanvasItemDrag({
        tabId: tab.id,
        pane,
        itemId: item.id,
        x: layout.x,
        y: layout.y,
        phase: "start",
      });
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
      setSelectedMindMapNode(null);
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
          const selected = selectWorkspaceCandidate(result.workspace, result.backupWorkspace);
          workspace = selected.workspace;
          if (selected.source === "backup") {
            message.warning("主工作区无法读取，已从自动备份恢复");
          } else if (!result.ok && selected.source === "none") {
            throw new Error(result.error ?? "工作区与备份均无法读取");
          } else if (selected.source === "none" && (result.workspace != null || result.backupWorkspace != null)) {
            message.warning("工作区数据格式无效，已创建新的空工作区");
          }
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          workspace = raw ? JSON.parse(raw) : null;
        }

        const selectedWorkspace = selectWorkspaceCandidate(workspace, null).workspace;
        if (selectedWorkspace) {
          const workspace = selectedWorkspace;
          if (workspace.tabs.length === 0) {
            const savedPaneIds =
              workspace.version >= 4 && Array.isArray(workspace.paneIds)
                ? Array.from(new Set(workspace.paneIds.filter((paneId): paneId is string => typeof paneId === "string" && paneId.length > 0)))
                : [];
            const emptyPane = savedPaneIds.includes(workspace.activePane ?? "") ? workspace.activePane! : savedPaneIds[0] ?? INITIAL_PANE_ID;

            setTabs([]);
            setPaneIds([emptyPane]);
            setTabPaneIds({});
            setPaneActiveTabIds({});
            setActivePane(emptyPane);
            setPaneWidths([100]);
            setCanvasViewStates({});
            setSettings(normalizeSettings(workspace.settings));
            setRecentFiles(normalizeRecentFiles(workspace.recentFiles));
            paneTabHistoryRef.current = {};
            return;
          }

          const restored = sortPinnedTabs(workspace.tabs.map(restoreTab));
          let restoredPaneIds: PaneKey[];
          let restoredTabPaneIds: Record<string, PaneKey[]> = {};
          let restoredActiveTabIds: Record<PaneKey, string> = {};
          let restoredActivePane: PaneKey;
          let restoredPaneWidths: number[];
          let restoredViewStates: Record<string, Partial<Record<PaneKey, CanvasViewState>>> = {};

          if (workspace.version >= 4 && Array.isArray(workspace.paneIds) && workspace.paneIds.length > 0) {
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
          setRecentFiles(normalizeRecentFiles(workspace.recentFiles));
          paneTabHistoryRef.current = Object.fromEntries(
            Object.entries(restoredActiveTabIds).map(([paneId, tabId]) => [paneId, [tabId]]),
          );
        }
      } catch (error) {
        message.warning(`加载上次内容失败：${String(error)}`);
      } finally {
        setWorkspaceLoaded(true);
      }
    }

    loadWorkspace();
    window.superNote?.getAppInfo().then(setAppInfo).catch(() => undefined);
  }, [message]);

  useEffect(() => {
    if (!workspaceLoaded) {
      return;
    }
    workspaceLoadedRef.current = true;
    const pendingFiles = pendingOpenedFilesRef.current.splice(0);
    if (pendingFiles.length > 0) {
      openFilesAsTabs(pendingFiles);
    }
  }, [openFilesAsTabs, workspaceLoaded]);

  useEffect(() => {
    if (!workspaceLoaded || !window.superNote) {
      return;
    }
    let disposed = false;

    const checkExternalChanges = async () => {
      const monitoredTabs = tabsRef.current.filter((tab) => Boolean(tab.filePath));
      const paths = monitoredTabs.flatMap((tab) => (tab.filePath ? [tab.filePath] : []));
      if (paths.length === 0) {
        return;
      }

      let snapshots;
      try {
        snapshots = await window.superNote!.getFileSnapshots(paths);
      } catch {
        return;
      }
      if (disposed) {
        return;
      }
      const byPath = new Map(snapshots.map((snapshot) => [snapshot.path.toLowerCase(), snapshot]));

      for (const tab of monitoredTabs) {
        const filePath = tab.filePath!;
        const pathKey = filePath.toLowerCase();
        const snapshot = byPath.get(pathKey);
        if (!snapshot) {
          continue;
        }

        if (!snapshot.exists) {
          const deletedKey = `deleted:${pathKey}`;
          if (!externalPromptedRef.current.has(deletedKey)) {
            externalPromptedRef.current.add(deletedKey);
            setTabs((current) => current.map((item) => (item.id === tab.id ? { ...item, dirty: true } : item)));
            message.warning(`文件已被外部删除，当前内容仍保留：${tab.title}`);
          }
          continue;
        }
        externalPromptedRef.current.delete(`deleted:${pathKey}`);

        if (tab.lastKnownMtimeMs == null && tab.lastKnownSize == null) {
          setTabs((current) =>
            current.map((item) =>
              item.id === tab.id
                ? { ...item, lastKnownMtimeMs: snapshot.mtimeMs, lastKnownSize: snapshot.size }
                : item,
            ),
          );
          continue;
        }

        if (!hasExternalFileChange(tab, snapshot)) {
          continue;
        }
        const changeKey = `${pathKey}:${snapshot.mtimeMs ?? "unknown"}:${snapshot.size ?? "unknown"}`;
        if (externalPromptedRef.current.has(changeKey)) {
          continue;
        }
        externalPromptedRef.current.add(changeKey);

        if (!tab.dirty) {
          if (await reloadTabFromDisk(tab)) {
            message.info(`已重新加载外部修改：${tab.title}`);
          }
          continue;
        }

        modal.confirm({
          title: "文件已在外部修改",
          content: `${tab.title} 在磁盘上发生变化，当前标签也有未保存内容。`,
          okText: "重新加载磁盘版本",
          cancelText: "保留当前内容",
          onOk: () => reloadTabFromDisk(tab),
          onCancel: () => {
            setTabs((current) =>
              current.map((item) =>
                item.id === tab.id
                  ? { ...item, lastKnownMtimeMs: snapshot.mtimeMs, lastKnownSize: snapshot.size, dirty: true }
                  : item,
              ),
            );
          },
        });
      }
    };

    void checkExternalChanges();
    const timer = window.setInterval(() => void checkExternalChanges(), 2500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [message, modal, reloadTabFromDisk, workspaceLoaded]);

  useEffect(() => {
    window.superNote?.getUpdateStatus?.().then(setUpdateStatus).catch(() => undefined);
    const unsubscribe = window.superNote?.onUpdateStatus?.((status) => setUpdateStatus(status));
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    window.superNote?.syncTrayTabs?.({
      activeTabId,
      tabs: tabs.map((tab) => ({ id: tab.id, title: getTabDisplayTitle(tab), kind: tab.kind })),
    });
  }, [activeTabId, tabs]);

  useEffect(() => {
    const unsubscribe = window.superNote?.onTrayAction?.((action) => {
      if (action.type === "new-text") {
        addTextTab();
        return;
      }
      const tab = tabs.find((item) => item.id === action.tabId);
      if (!tab) {
        return;
      }
      const availablePanes = getTabPanes(tab.id);
      const targetPane = availablePanes.includes(activePane) ? activePane : availablePanes[0];
      if (targetPane) {
        focusTabInPane(tab.id, targetPane);
      }
    });
    return () => unsubscribe?.();
  }, [activePane, addTextTab, focusTabInPane, getTabPanes, tabs]);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("paste", handlePaste);
    };
  }, [handleGlobalKeyDown, handlePaste]);

  const startSidebarResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sidebarResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: settings.sidebarWidth,
      currentWidth: settings.sidebarWidth,
    };
    setSidebarResizing(true);
  }, [settings.sidebarWidth]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resize = sidebarResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      const maxWidth = Math.max(160, Math.min(480, window.innerWidth - 320));
      resize.currentWidth = clamp(resize.startWidth + event.clientX - resize.startX, 160, maxWidth);
      document.querySelector<HTMLElement>(".app-shell")?.style.setProperty("--sidebar-width", `${resize.currentWidth}px`);
    };
    const finishSidebarResize = (event: PointerEvent) => {
      const resize = sidebarResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) {
        return;
      }
      sidebarResizeRef.current = null;
      setSidebarResizing(false);
      setSettings((current) => ({ ...current, sidebarWidth: Math.round(resize.currentWidth) }));
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishSidebarResize);
    window.addEventListener("pointercancel", finishSidebarResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishSidebarResize);
      window.removeEventListener("pointercancel", finishSidebarResize);
    };
  }, []);

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
      const x = Math.round(point.x - dragging.offsetX);
      const y = Math.round(point.y - dragging.offsetY);
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
      dispatchCanvasItemDragEnd({ tabId: dragging.tabId, pane: dragging.pane, itemId: dragging.itemId });
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

  const quickOpenResults = useMemo(() => {
    const needle = quickOpenValue.trim().toLowerCase();
    const openTabs = tabs
      .filter((tab) => !needle || getTabDisplayTitle(tab).toLowerCase().includes(needle) || tab.filePath?.toLowerCase().includes(needle))
      .map((tab) => ({
        id: `tab:${tab.id}`,
        kind: "tab" as const,
        title: getTabDisplayTitle(tab),
        detail: tab.filePath ?? (tab.kind === "canvas" ? "当前画板" : "未保存文本"),
        tabId: tab.id,
      }));
    const openPaths = new Set(tabs.flatMap((tab) => (tab.filePath ? [tab.filePath.toLowerCase()] : [])));
    const recent = recentFiles
      .filter((file) => !openPaths.has(file.path.toLowerCase()))
      .filter((file) => !needle || file.name.toLowerCase().includes(needle) || file.path.toLowerCase().includes(needle))
      .map((file) => ({
        id: `recent:${file.path.toLowerCase()}`,
        kind: "recent" as const,
        title: file.name,
        detail: file.path,
        filePath: file.path,
      }));
    return [...openTabs, ...recent].slice(0, 40);
  }, [quickOpenValue, recentFiles, tabs]);

  const deferredSearchValue = useDeferredValue(searchValue);
  const searchResults = useMemo<SearchResult[]>(() => {
    const needle = deferredSearchValue.trim();
    if (!needle) {
      return [];
    }

    const results: SearchResult[] = [];
    const lowerNeedle = needle.toLowerCase();
    const searchableTabs = searchScope === "current" ? tabs.filter((tab) => tab.id === activeTabId) : tabs;
    searchableTabs.forEach((tab) => {
      if (results.length >= SEARCH_RESULT_LIMIT) return;
      if (getTabDisplayTitle(tab).toLowerCase().includes(lowerNeedle)) {
        results.push({
          id: `${tab.id}:title`,
          tabId: tab.id,
          kind: "tab-title",
          title: getTabDisplayTitle(tab),
          preview: tab.filePath ?? (tab.kind === "canvas" ? "画板标题匹配" : "标签标题匹配"),
        });
      }
      if (tab.kind === "canvas") {
        tab.items.forEach((item) => {
          if (results.length < SEARCH_RESULT_LIMIT && item.type === "text" && item.text.toLowerCase().includes(lowerNeedle)) {
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

      const lines = tab.content.split(/\r\n|\r|\n/);
      let lineStart = 0;
      lines.forEach((line, index) => {
        if (results.length >= SEARCH_RESULT_LIMIT) return;
        const lowerLine = line.toLowerCase();
        let searchFrom = 0;
        let localIndex = lowerLine.indexOf(lowerNeedle, searchFrom);
        while (localIndex >= 0) {
          const selectionStart = lineStart + localIndex;
          results.push({
            id: `${tab.id}:match:${selectionStart}`,
            tabId: tab.id,
            kind: "file",
            title: tab.title,
            line: index + 1,
            preview: makePreview(line, needle, localIndex),
            selectionStart,
            selectionEnd: selectionStart + needle.length,
          });
          if (results.length >= SEARCH_RESULT_LIMIT) break;
          searchFrom = localIndex + Math.max(1, lowerNeedle.length);
          localIndex = lowerLine.indexOf(lowerNeedle, searchFrom);
        }
        const separator = tab.content.slice(lineStart + line.length).match(/^(?:\r\n|\r|\n)/)?.[0] ?? "";
        lineStart += line.length + separator.length;
      });
    });
    if (searchScope === "all") {
      const openPaths = new Set(tabs.flatMap((tab) => (tab.filePath ? [tab.filePath.toLowerCase()] : [])));
      recentFiles.forEach((file) => {
        if (
          results.length < SEARCH_RESULT_LIMIT &&
          !openPaths.has(file.path.toLowerCase()) &&
          (file.name.toLowerCase().includes(lowerNeedle) || file.path.toLowerCase().includes(lowerNeedle))
        ) {
          results.push({
            id: `recent:${file.path.toLowerCase()}`,
            filePath: file.path,
            kind: "recent-file",
            title: file.name,
            preview: file.path,
          });
        }
      });
    }
    return results;
  }, [activeTabId, deferredSearchValue, recentFiles, searchScope, tabs]);

  const openSearchResult = useCallback(
    async (result: SearchResult) => {
      if (result.kind === "recent-file" && result.filePath) {
        await openFilePath(result.filePath);
        setActiveSearchResultId(result.id);
        return;
      }
      if (!result.tabId) {
        return;
      }
      const tab = tabs.find((item) => item.id === result.tabId);
      if (!tab) {
        return;
      }

      const availablePanes = getTabPanes(result.tabId);
      const pane = availablePanes.includes(activePane) ? activePane : availablePanes[0];
      focusTabInPane(result.tabId, pane);
      setActiveSearchResultId(result.id);

      if (tab.kind === "file" && result.selectionStart != null && result.selectionEnd != null) {
        setFileSearchTarget((current) => ({
          tabId: tab.id,
          selectionStart: result.selectionStart!,
          selectionEnd: result.selectionEnd!,
          requestId: (current?.requestId ?? 0) + 1,
        }));
      }

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
    [activePane, focusTabInPane, getTabPanes, openFilePath, setPaneViewState, tabs],
  );

  const openQuickOpenResult = useCallback(
    async (result: (typeof quickOpenResults)[number]) => {
      if (result.kind === "recent") {
        await openFilePath(result.filePath);
        closeQuickOpen();
        return;
      }
      const availablePanes = getTabPanes(result.tabId);
      focusTabInPane(result.tabId, availablePanes.includes(activePane) ? activePane : availablePanes[0]);
      closeQuickOpen();
    },
    [activePane, closeQuickOpen, focusTabInPane, getTabPanes, openFilePath, quickOpenResults],
  );

  const pluginMenu: MenuProps["items"] = [
    {
      key: "canvas-plugin",
      label: (
        <span className="new-module-menu-label">
          <strong>画板插件</strong>
          <small>{canvasPluginEnabled ? `已启用 · 新建画板 ${settings.shortcuts.newCanvas}` : "未启用 · 点击启用画板能力"}</small>
        </span>
      ),
      icon: canvasPluginEnabled ? <CheckOutlined /> : <BorderOutlined />,
      onClick: toggleCanvasPlugin,
    },
  ];

  const fileMenu: MenuProps["items"] = [
    {
      key: "new-text",
      label: `新建文本模块 (${settings.shortcuts.newText})`,
      icon: <FileTextOutlined />,
      onClick: () => addTextTab(),
    },
    {
      key: "new-markdown",
      label: "新建 Markdown 文档",
      icon: <CodeOutlined />,
      onClick: () => addMarkdownTab(),
    },
    {
      key: "open",
      label: "打开已有文件",
      icon: <FolderOpenOutlined />,
      onClick: openExistingFile,
    },
    {
      key: "quick-open",
      label: `快速打开 (${settings.shortcuts.quickOpen})`,
      icon: <SearchOutlined />,
      onClick: () => {
        closeSearch();
        setQuickOpenOpen(true);
        window.setTimeout(() => document.getElementById("quick-open-input")?.focus(), 0);
      },
    },
    ...(recentFiles.length > 0
      ? [
          {
            key: "recent-files",
            label: "最近文件",
            icon: <HistoryOutlined />,
            children: recentFiles.slice(0, 8).map((file) => ({
              key: `recent:${file.path}`,
              label: file.name,
              title: file.path,
              onClick: () => void openFilePath(file.path),
            })),
          },
        ]
      : []),
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
      key: "new-text",
      label: `新建文本模块 (${settings.shortcuts.newText})`,
      icon: <FileTextOutlined />,
      onClick: () => addTextTab(),
    },
    {
      key: "new-markdown",
      label: "新建 Markdown 文档",
      icon: <CodeOutlined />,
      onClick: () => addMarkdownTab(),
    },
    {
      key: "close-tab",
      label: `关闭当前标签 (${settings.shortcuts.closeTab})`,
      icon: <CloseOutlined />,
      onClick: closeCurrentTab,
    },
    {
      key: "toggle-tab-layout",
      label: `${settings.tabLayout === "left" ? "切换到顶部标签栏" : "切换到左侧标签菜单"} (${settings.shortcuts.toggleTabLayout})`,
      icon: settings.tabLayout === "left" ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />,
      onClick: toggleTabLayout,
    },
    { type: "divider" },
    {
      key: "search",
      label: `搜索当前页 (${settings.shortcuts.search})`,
      icon: <SearchOutlined />,
      onClick: () => openSearch("current"),
    },
    {
      key: "quick-open",
      label: `快速打开 (${settings.shortcuts.quickOpen})`,
      icon: <FolderOpenOutlined />,
      onClick: () => {
        closeSearch();
        setQuickOpenOpen(true);
        window.setTimeout(() => document.getElementById("quick-open-input")?.focus(), 0);
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
    ...(settings.tabLayout === "top" ? [
      { type: "divider" as const },
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
    ] : []),
  ];

  const topRightCloseModal = {
    footer: null,
    closable: true,
    closeIcon: <CloseOutlined />,
    maskClosable: true,
    icon: null as ReactNode,
  };

  const helpMenu: MenuProps["items"] = [
    {
      key: "donate",
      label: "打赏作者",
      icon: <HeartOutlined />,
      onClick: () => setDonationOpen(true),
    },
    {
      key: "website",
      label: "官网",
      icon: <LinkOutlined />,
      onClick: () => void openExternalUrl(SITE_URL),
    },
    {
      key: "docs",
      label: "文档",
      icon: <BookOutlined />,
      onClick: () =>
        modal.info({
          ...topRightCloseModal,
          title: "文档",
          width: 760,
          content: (
            <div className="scrollable-modal-content">
              <Suspense fallback={<FeatureLoading label="正在加载文档..." />}>
                <LazyHelpDocumentation canvasPluginEnabled={canvasPluginEnabled} shortcuts={settings.shortcuts} />
              </Suspense>
            </div>
          ),
        }),
    },
    {
      key: "version",
      label: "版本",
      icon: <InfoCircleOutlined />,
      onClick: () =>
        modal.info({
          ...topRightCloseModal,
          title: null,
          width: "100vw",
          wrapClassName: "author-inspiration-modal-wrap",
          style: { top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", maxWidth: "none", margin: 0, paddingBottom: 0 },
          className: "author-inspiration-modal",
          content: (
            <div className="author-inspiration-panel" aria-label="版本">
              <div className="author-inspiration-text version-fullscreen-text">v{appInfo.version}</div>
            </div>
          ),
        }),
    },
    {
      key: "updates",
      label: "版本更新",
      icon: <HistoryOutlined />,
      onClick: () =>
        modal.info({
          ...topRightCloseModal,
          title: "版本更新",
          width: 680,
          content: (
            <div className="scrollable-modal-content">
              <ol className="help-update-timeline">
              {releaseTimeline.map((release) => (
                <li key={release.version} className={release.upcoming ? "upcoming" : ""}>
                  <span className="help-update-marker" aria-hidden />
                  <article>
                    <div className="help-update-meta">
                      <strong>{release.version}</strong>
                      <span>{release.date}</span>
                    </div>
                    <h4>{release.title}</h4>
                    <p>{release.description}</p>
                  </article>
                </li>
              ))}
              </ol>
            </div>
          ),
        }),
    },
    {
      key: "author",
      label: "作者",
      icon: <UserOutlined />,
      onClick: () =>
        modal.info({
          ...topRightCloseModal,
          title: null,
          width: "100vw",
          wrapClassName: "author-inspiration-modal-wrap",
          style: { top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", maxWidth: "none", margin: 0, paddingBottom: 0 },
          className: "author-inspiration-modal",
          content: (
            <div className="author-inspiration-panel" aria-label="作者寄语">
              <div className="author-inspiration-text">
                希望你认识自身平凡之后，
                <br />
                依旧拥有改变世界的勇气
              </div>
            </div>
          ),
        }),
    },
  ];

  const updateButtonVisible =
    updateStatus.state === "available" ||
    updateStatus.state === "downloading" ||
    updateStatus.state === "downloaded" ||
    updateStatus.state === "installing" ||
    updateStatus.state === "error";
  const updateButtonLoading = updateStatus.state === "downloading" || updateStatus.state === "installing";
  const updateButtonText =
    updateStatus.state === "downloading"
      ? updateStatus.error && (updateStatus.downloadAttempt ?? 1) > 1
        ? `重试 ${updateStatus.downloadAttempt}/${updateStatus.maxDownloadAttempts ?? 3}`
        : `${Math.max(0, Math.min(100, updateStatus.progress ?? 0))}%`
      : updateStatus.state === "downloaded"
        ? "安装"
        : updateStatus.state === "installing"
          ? "安装中"
          : updateStatus.state === "error"
            ? "重试更新"
            : updateStatus.latestVersion
            ? `更新 ${updateStatus.latestVersion}`
            : "更新";
  const updateButtonTitle =
    updateStatus.state === "error"
      ? `更新失败，点击重试${updateStatus.error ? `：${updateStatus.error}` : ""}`
      : updateStatus.state === "downloading" && updateStatus.error
        ? updateStatus.error
        : updateStatus.channel === "win7-8"
      ? "发现新版本，点击自动更新 Windows 7 / 8 版本"
      : "发现新版本，点击自动更新 Windows 10 / 11 版本";

  const handleUpdateClick = useCallback(async () => {
    try {
      if (updateStatus.state === "downloaded") {
        await window.superNote?.installUpdate?.();
        return;
      }
      if (updateStatus.state === "error" && !updateStatus.latestVersion) {
        await window.superNote?.checkForUpdates?.();
        return;
      }
      if (updateStatus.state === "available" || updateStatus.state === "error") {
        await window.superNote?.downloadUpdate?.();
      }
    } catch (error) {
      message.error(`自动更新启动失败：${String(error)}`);
    }
  }, [message, updateStatus.latestVersion, updateStatus.state]);

  const tabNavigationItems = useMemo(
    () => tabs.map((tab) => ({ id: tab.id, title: getTabDisplayTitle(tab), themeIndex: tab.themeIndex, dirty: tab.dirty, filePath: tab.filePath, pinned: tab.pinned })),
    [tabs],
  );

  const renderPaneContent = (tab: NoteTab, pane: PaneKey) => {
    if (tab.kind === "canvas") {
      const viewState = getPaneViewState(tab, pane);
      return (
        <Suspense fallback={<FeatureLoading label="正在加载画板..." />}>
        <LazyCanvasView
          tab={tab}
          pane={pane}
          viewState={viewState}
          editingTextId={editingText?.pane === pane ? editingText.itemId : null}
          selectedItem={selectedItem}
          selectedMindMapNode={selectedMindMapNode}
          searchValue={deferredSearchValue}
          activeSearchItemId={activeSearchResultId?.startsWith(`${tab.id}:`) ? activeSearchResultId.split(":")[1] : null}
          handwritten={settings.handwritten}
          programmerMode={settings.programmerMode}
          accent={canvasThemes[tab.themeIndex % canvasThemes.length].accent}
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
          onTextCommit={(item, size, text) => {
            setEditingText(null);
            if (!text.trim()) {
              deleteCanvasItem(tab.id, item.id);
              return;
            }
            updateCanvasTab(tab.id, (current) => {
              const nextItems = current.items.map((currentItem) =>
                currentItem.id === item.id && currentItem.type === "text"
                  ? { ...currentItem, text, width: size.width, height: size.height }
                  : currentItem,
              );
              return {
                ...current,
                items: nextItems,
                title: deriveCanvasTitle(current, nextItems),
                dirty: true,
                ...pushHistory(current, nextItems),
              };
            });
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
          onCreateMindMap={(point) => createCanvasMindMap(tab.id, pane, point)}
          onRemoveMindMap={() => removeCanvasMindMap(tab.id)}
          onSelectMindMapNode={(nodeId) => {
            focusTabInPane(tab.id, pane);
            setSelectedItem(null);
            setEditingText(null);
            setSelectedMindMapNode({ tabId: tab.id, pane, nodeId });
          }}
          onAddMindMapChild={(nodeId) => addCanvasMindMapChild(tab.id, pane, nodeId)}
          onAddMindMapSibling={(nodeId) => addCanvasMindMapSibling(tab.id, pane, nodeId)}
          onDeleteMindMapBranch={(nodeId) => deleteCanvasMindMapBranch(tab.id, pane, nodeId)}
          onToggleMindMapNode={(nodeId) => commitMindMap(tab.id, (mindMap) => mindMap ? toggleMindMapNode(mindMap, nodeId) : mindMap)}
          onChangeMindMapText={(nodeId, text) => commitMindMap(tab.id, (mindMap) => mindMap ? updateMindMapNodeText(mindMap, nodeId, text) : mindMap)}
          onMoveMindMapNode={(nodeId, targetNodeId, placement) => moveCanvasMindMapNode(tab.id, nodeId, targetNodeId, placement)}
          onCreateMindMapCanvasLink={(nodeId, itemId, anchors) => createCanvasMindMapCanvasLink(tab.id, nodeId, itemId, anchors)}
          onUpdateMindMapCanvasLink={(linkId, patch) => updateCanvasMindMapCanvasLink(tab.id, linkId, patch)}
          onDeleteMindMapCanvasLink={(linkId) => deleteCanvasMindMapCanvasLink(tab.id, linkId)}
          onOpenMindMapStyle={() => void openMindMapStyleWindow(tab)}
          onExportImage={() => void exportCanvasImage(tab, pane, viewState)}
        />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<FeatureLoading label="正在加载文本模块..." />}>
      <LazyFileView
        tab={tab}
        title={getTabDisplayTitle(tab)}
        titleMenuItems={[
          { key: "rename", label: "编辑名称", onClick: () => renameTab(tab.id) },
          { key: "pin", label: tab.pinned ? "取消置顶" : "置顶", onClick: () => pinTab(tab.id) },
          { key: "explorer", label: "打开所在文件夹", disabled: !tab.filePath, onClick: () => openTabInExplorer(tab.id) },
        ]}
        searchValue={deferredSearchValue}
        searchTarget={fileSearchTarget}
        programmerMode={settings.programmerMode}
        viewState={fileViewStatesRef.current[`${pane}:${tab.id}`]}
        onViewStateChange={(patch) => {
          const key = `${pane}:${tab.id}`;
          const currentViewState = fileViewStatesRef.current[key] ?? {
            editorScrollTop: 0,
            editorScrollLeft: 0,
            selectionStart: 0,
            selectionEnd: 0,
            selectionDirection: "none",
            markdownMode: "preview",
            previewScrollTop: 0,
            livePreviewScrollTop: 0,
          };
          fileViewStatesRef.current[key] = { ...currentViewState, ...patch };
        }}
        onContentChange={(content) => updateFileContent(tab.id, content)}
        onFontSizeChange={(delta) => updateFileFontSize(tab.id, (fontSize) => fontSize + delta)}
        onProgrammerAction={(action, selectionStart, selectionEnd) =>
          applyFileProgrammerAction(tab.id, action, selectionStart, selectionEnd)
        }
        onSearchTargetHandled={(requestId) =>
          setFileSearchTarget((current) => (current?.requestId === requestId ? null : current))
        }
      />
      </Suspense>
    );
  };

  const renderSurface = (tab: NoteTab | null, pane: PaneKey) => (
    <section key={pane} className={`work-pane ${activePane === pane ? "focused" : ""}`} onMouseDown={() => tab && focusTabInPane(tab.id, pane)}>
      <div className="pane-content">
        {tab ? renderPaneContent(tab, pane) : <EmptyWorld />}
      </div>
    </section>
  );

  const renderedPaneIds = settings.tabLayout === "left" ? [activePane] : paneIds;
  const renderedSplitView = settings.tabLayout === "top" && splitView;

  return (
    <ConfigProvider
      theme={{
        algorithm: effectiveDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 10,
          colorPrimary: "#5b5bd6",
          colorInfo: "#5b5bd6",
          colorLink: "#5b5bd6",
          controlHeight: 34,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
        },
      }}
    >
    <div
      className={`app-shell${settings.handwritten ? " handwritten-mode" : ""}${effectiveDarkMode ? " dark-mode" : ""}${sidebarResizing ? " sidebar-resizing" : ""}`}
      data-tab-layout={settings.tabLayout}
      style={{
        ["--pane-grid" as string]: makePaneGridTemplate(paneWidths),
        ["--sidebar-width" as string]: `${settings.sidebarWidth}px`,
      } as React.CSSProperties}
      onDragOver={handleAppDragOver}
      onDrop={handleAppDrop}
    >
      <header className="app-titlebar">
        <div className="titlebar-left">
          <span className="app-brand" aria-label="Super Note">
            <span className="app-title-stack">
              <span className="app-title">Super Note</span>
            </span>
          </span>
        <div className="menu-left">
          <Dropdown menu={{ items: fileMenu }} trigger={["click"]}>
            <Button type="text">文件</Button>
          </Dropdown>
          <Dropdown menu={{ items: pluginMenu }} trigger={["click"]}>
            <Button type="text">插件</Button>
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
          {updateButtonVisible ? (
            <Tooltip title={updateButtonTitle}>
              <Button
                type="primary"
                size="small"
                className="update-button"
                icon={<CloudDownloadOutlined />}
                loading={updateButtonLoading}
                onClick={handleUpdateClick}
              >
                {updateButtonText}
              </Button>
            </Tooltip>
          ) : null}
        </div>

        </div>

        <div className="window-controls">
          <Tooltip title="搜索全部标签">
            <Button
              type="text"
              className="window-control"
              aria-label="搜索"
              icon={<SearchOutlined />}
              onClick={() => openSearch("all")}
            />
          </Tooltip>
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

      <div className={`app-content-shell tab-layout-${settings.tabLayout}`}>
        <TabNavigation
          layout={settings.tabLayout}
          tabs={tabNavigationItems}
          paneIds={renderedPaneIds}
          paneTabIds={paneTabIds}
          paneActiveTabIds={paneActiveTabIds}
          activePane={activePane}
          splitView={renderedSplitView}
          canvasPluginEnabled={canvasPluginEnabled}
          newCanvasShortcut={settings.shortcuts.newCanvas}
          newTextShortcut={settings.shortcuts.newText}
          getTabPanes={getTabPanes}
          onFocusTab={focusTabInPane}
          onCloseTab={closeTab}
          onClosePane={closePane}
          onSplitTab={splitTab}
          onMoveTabToPane={moveTabToPane}
          onReorderTab={reorderTab}
          onPinTab={pinTab}
          onRenameTab={renameTab}
          onOpenTabInExplorer={openTabInExplorer}
          onAddCanvas={addCanvasTab}
          onAddText={addTextTab}
          onStartSplitResize={startSplitResize}
          onStartSidebarResize={startSidebarResize}
        />

        <main className={renderedSplitView ? "workspace multi-pane" : "workspace"}>
          {renderedPaneIds.flatMap((paneId, index) => [
            renderSurface(activeTabsByPane[paneId] ?? null, paneId),
            ...(index < renderedPaneIds.length - 1
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
      </div>

      {fileZoomPercent !== null ? (
        <div className="file-zoom-indicator" role="status">
          <span className="file-zoom-value">{fileZoomPercent}%</span>
          <button
            type="button"
            className="file-zoom-reset"
            onClick={() => activeTab?.kind === "file" && updateFileFontSize(activeTab.id, () => DEFAULT_FILE_FONT_SIZE)}
          >
            <UndoOutlined />
            恢复
          </button>
        </div>
      ) : null}

      {donationOpen ? (
        <div className="donation-overlay" role="dialog" aria-modal="true" aria-label="打赏作者" onClick={() => setDonationOpen(false)}>
          <button type="button" className="donation-close" aria-label="关闭" onClick={() => setDonationOpen(false)}><CloseOutlined /></button>
          <div className="donation-panel" onClick={(event) => event.stopPropagation()}>
            <img src={donationImageUrl} alt="微信支付收款码" />
          </div>
        </div>
      ) : null}

      {quickOpenOpen ? (
        <div className="global-search-layer">
          <div className="global-search-box">
            <Input
              id="quick-open-input"
              autoFocus
              allowClear
              prefix={<FolderOpenOutlined />}
              placeholder="输入标签名、文件名或路径"
              value={quickOpenValue}
              onChange={(event) => setQuickOpenValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && quickOpenResults[0]) {
                  event.preventDefault();
                  void openQuickOpenResult(quickOpenResults[0]);
                }
              }}
              suffix={`${quickOpenResults.length} 个结果`}
            />
            <div className="search-results">
              {quickOpenResults.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的标签或最近文件" /> : null}
              {quickOpenResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="search-result"
                  onClick={() => void openQuickOpenResult(result)}
                >
                  <span className="search-result-title">
                    {result.kind === "recent" ? <HistoryOutlined /> : <FileTextOutlined />}
                    {result.title}
                  </span>
                  <span className="search-result-preview">{result.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {searchOpen ? (
        <div className="global-search-layer">
          <div className="global-search-box">
            <Input
              id="global-search-input"
              autoFocus
              allowClear
              prefix={<SearchOutlined />}
              placeholder={searchScope === "current" ? "搜索当前页内容，再按一次 Ctrl+F 搜索全部标签" : "搜索所有标签内容"}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) {
                  event.preventDefault();
                  void openSearchResult(searchResults[0]);
                  closeSearch();
                }
              }}
              suffix={searchValue ? `${searchScope === "current" ? "当前页" : "全部标签"} · ${searchResults.length} 个匹配` : null}
            />
            {searchValue.trim() ? (
              <div className="search-results">
                {searchResults.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配内容" /> : null}
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="search-result"
                    onClick={() => {
                      void openSearchResult(result);
                      closeSearch();
                    }}
                  >
                    <span className="search-result-title">
                      {result.kind !== "canvas-text" ? <FileTextOutlined /> : null}
                      {result.title}
                      {result.line ? ` · 第 ${result.line} 行` : ""}
                    </span>
                    <span className="search-result-preview">{renderHighlightedText(result.preview, deferredSearchValue)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <Suspense fallback={<FeatureLoading label="正在加载设置..." />}>
          <LazySettingsModal
            open
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onChange={setSettings}
          />
        </Suspense>
      ) : null}
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

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 10,
          colorPrimary: "#5b5bd6",
          colorInfo: "#5b5bd6",
          colorLink: "#5b5bd6",
          controlHeight: 34,
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
