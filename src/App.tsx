import { useWorkspacePersistence, STORAGE_KEY } from "./features/workspace/useWorkspacePersistence";
import { useFileSave } from "./features/files/useFileSave";
import { useEditorHistory } from "./features/history/useEditorHistory";
import { useTabActions } from "./features/tabs/useTabActions";
import { useAppShortcuts } from "./features/editor/useAppShortcuts";
import { cloneItems, cloneCanvasSnapshot, pushHistory } from "./features/history/historyModel";
import { DEFAULT_FILE_FONT_SIZE, createCanvasTab, createTextTab, createMarkdownTab, createTabFromOpenedFile, deriveCanvasTitle, getFileName } from "./features/tabs/tabDocument";
import { uiText, getUiLanguage } from "../electron/uiLanguage";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import {
  App as AntApp,
  ConfigProvider,
  Button,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import {
  BookOutlined,
  ApartmentOutlined,
  CheckOutlined,
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
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RedoOutlined,
  SaveOutlined,
  SearchOutlined,
  SplitCellsOutlined,
  UndoOutlined,
  UserOutlined,
  HeartOutlined,
} from "@ant-design/icons";
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import donationImageUrl from "../assets/wechat-donation.jpg";
import { flushSync } from "react-dom";
import { neutralConfirmDialog, neutralInfoDialog } from "./features/overlays/dialogPresets";
import { ZoomIndicator } from "./features/overlays/ZoomIndicator";
import type {
  AppSettings,
  CanvasItem,
  CanvasItemOverride,
  CanvasTab,
  CanvasTheme,
  CanvasViewState,
  DragState,
  FileTab,
  FileViewState,
  NoteTab,
  PaneKey,
  ProgrammerAction,
  QuickOpenItem,
  RecentFile,
  SearchResult,
  SelectedItem,
  TextCanvasItem,
  TextSearchTarget,
} from "./appTypes";
import { EmptyWorld } from "./components/EmptyWorld";
import { FeatureLoading } from "./components/FeatureLoading";
import { WelcomeWorld } from "./components/WelcomeWorld";
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
  transformJsonText,
} from "./features/editor/editorUtils";
import { DEFAULT_SETTINGS, normalizeSettings } from "./features/settings/settingsModel";
import { textScaleTokens, updateTextScale } from "./features/settings/textScale";
import { getCanvasMode } from "./pluginSettings";
import { rememberTabVisit } from "./features/tabs/tabHistory";
import { getTabDisplayTitle } from "./features/tabs/tabTitle";
import { createTabPresentationCache } from "./features/tabs/tabPresentation";
import { getQuickOpenResults, searchWorkspace } from "./features/search/searchModel";
import { createTextAnchor, MAX_TEXT_ANCHORS, normalizeTextAnchors, updateTextAnchors } from "./features/text/textAnchors";
import { hasExternalFileChange } from "./features/files/fileState";
import {
  addMindMapChild,
  addMindMapSibling,
  cloneMindMap,
  createMindMap,
  deleteMindMapBranch,
  deleteMindMapCanvasLink,
  linkMindMapNodeToCanvasItem,
  moveMindMapNode,
  removeMindMapCanvasLinksForItem,
  toggleMindMapNode,
  updateMindMapCanvasLink,
  updateMindMapNodeText,
  updateMindMapStyle,
} from "./features/mindmap/mindMapModel";
import type { MindMapCanvasLink, MindMapDocument, MindMapStyle, SelectedMindMapNode } from "./features/mindmap/mindMapTypes";
import type { ResolvedMindMapRelationAnchors } from "./features/mindmap/mindMapRelations";
import {
  rememberRecentFiles,
  selectWorkspaceCandidate,
} from "./features/workspace/workspaceUtils";

import { insertPaneWidth, makePaneGridTemplate, normalizePaneWidths, removePaneWidth } from "./features/workspace/paneWidths";
import { restoreWorkspace } from "./features/workspace/restoreWorkspace";

const LONG_PRESS_MS = 160;
const INITIAL_PANE_ID = "pane-main";
const SITE_URL = "https://lvkun996.github.io/super-note/";

const LazyCanvasView = lazy(() => import("./features/canvas/CanvasView").then(({ CanvasView }) => ({ default: CanvasView })));
const LazyMindMapCanvasView = lazy(() => import("./features/mindmap/MindMapCanvasView").then(({ MindMapCanvasView }) => ({ default: MindMapCanvasView })));
const LazyAppTitleBar = lazy(() => import("./components/AppTitleBar").then(({ AppTitleBar }) => ({ default: AppTitleBar })));
const LazyFileView = lazy(() => import("./features/text/FileView").then(({ FileView }) => ({ default: FileView })));
const LazyReleaseTimeline = lazy(() => import("./components/ReleaseTimeline").then(({ ReleaseTimeline }) => ({ default: ReleaseTimeline })));
const LazyHelpDocumentation = lazy(() => import("./components/HelpDocumentation").then(({ HelpDocumentation }) => ({ default: HelpDocumentation })));
const LazySettingsModal = lazy(() => import("./features/settings/SettingsModal").then(({ SettingsModal }) => ({ default: SettingsModal })));
const LazyTabNavigation = lazy(() => import("./features/tabs/TabNavigation").then(({ TabNavigation }) => ({ default: TabNavigation })));
const LazyGlobalSearchOverlays = lazy(() => import("./components/GlobalSearchOverlays").then(({ GlobalSearchOverlays }) => ({ default: GlobalSearchOverlays })));
const canvasThemes: CanvasTheme[] = [
  { accent: "#1677ff" },
  { accent: "#13c2c2" },
  { accent: "#722ed1" },
  { accent: "#fa8c16" },
  { accent: "#eb2f96" },
  { accent: "#52c41a" },
];

const makeId = () => crypto.randomUUID();

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

function AppShell({ onTextScaleChange }: { onTextScaleChange: (scale: number) => void }) {
  const { message, modal } = AntApp.useApp();
  const [tabs, setTabs] = useState<NoteTab[]>(() => [createTextTab(0)]);
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [paneIds, setPaneIds] = useState<PaneKey[]>([INITIAL_PANE_ID]);
  const [paneActiveTabIds, setPaneActiveTabIds] = useState<Record<PaneKey, string>>(() => ({ [INITIAL_PANE_ID]: tabs[0].id }));
  const [activePane, setActivePane] = useState<PaneKey>(INITIAL_PANE_ID);
  const [tabPaneIds, setTabPaneIds] = useState<Record<string, PaneKey[]>>(() => ({ [tabs[0].id]: [INITIAL_PANE_ID] }));
  const [paneWidths, setPaneWidths] = useState<number[]>([100]);
  const [canvasViewStates, setCanvasViewStates] = useState<Record<string, Partial<Record<PaneKey, CanvasViewState>>>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  useLayoutEffect(() => {
    updateTextScale(settings.textScale);
    onTextScaleChange(settings.textScale);
  }, [settings.textScale, onTextScaleChange]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [windowFocused, setWindowFocused] = useState(() => document.hasFocus());
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
    version: "0.1.34",
    author: "kunkun",
    desc: uiText("认识自身平凡后，依旧拥有改变世界的勇气"),
  });
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "idle",
    channel: "latest",
    currentVersion: "0.1.34",
  });
  const lastCanvasPoint = useRef<Record<string, { x: number; y: number }>>({});
  const draggingRef = useRef<DragState | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileViewStatesRef = useRef<Record<string, FileViewState>>({});
  const workspaceLoadedRef = useRef(false);
  const pendingOpenedFilesRef = useRef<OpenedFile[]>([]);
  const tabsRef = useRef(tabs);
  const externalPromptedRef = useRef(new Set<string>());
  const sidebarResizeRef = useRef<{ pointerId: number; startX: number; startWidth: number; currentWidth: number } | null>(null);
  const zoomFeedbackPendingRef = useRef(false);
  const zoomFeedbackTimerRef = useRef<number | null>(null);
  tabsRef.current = tabs;
  const paneTabHistoryRef = useRef<Record<PaneKey, string[]>>({ [INITIAL_PANE_ID]: tabs[0] ? [tabs[0].id] : [] });
  const effectiveDarkMode = settings.followSystemTheme ? systemDarkMode : settings.darkMode;
  const canvasPluginEnabled = settings.plugins.canvas;
  const mindMapPluginEnabled = settings.plugins.mindMap;

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

  const paneTabIdsRef = useRef<Record<PaneKey, string[]>>({});
  const { paneTabs, paneTabIds } = useMemo(() => {
    const nextTabs: Record<PaneKey, NoteTab[]> = Object.fromEntries(paneIds.map((paneId) => [paneId, []]));
    const nextIds: Record<PaneKey, string[]> = Object.fromEntries(paneIds.map((paneId) => [paneId, []]));
    const validPaneIds = new Set(paneIds);
    const defaultPlacement = [paneIds[0]];
    for (const tab of tabs) {
      for (const paneId of tabPaneIds[tab.id] ?? defaultPlacement) {
        if (!validPaneIds.has(paneId)) continue;
        nextTabs[paneId].push(tab);
        nextIds[paneId].push(tab.id);
      }
    }
    const previous = paneTabIdsRef.current;
    let changed = Object.keys(previous).length !== paneIds.length;
    for (const pane of paneIds) {
      const ids = previous[pane];
      if (ids?.length === nextIds[pane].length && ids.every((id, i) => id === nextIds[pane][i])) nextIds[pane] = ids;
      else changed = true;
    }
    paneTabIdsRef.current = changed ? nextIds : previous;
    return { paneTabs: nextTabs, paneTabIds: paneTabIdsRef.current };
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
  const [getTabPresentation] = useState(createTabPresentationCache);
  const tabPresentation = useMemo(() => getTabPresentation(tabs), [getTabPresentation, tabs]);
  const activeTab = welcomeVisible ? undefined : activeTabsByPane[activePane] ?? activeTabsByPane[paneIds[0]] ?? tabs[0];
  const activeTabId = welcomeVisible ? "" : activeTab?.id ?? tabs[0]?.id ?? "";
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
    setPaneActiveTabIds((current) => current[pane] === tabId ? current : { ...current, [pane]: tabId });
    setActivePane(pane);
    setWelcomeVisible(false);
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

  const toggleMindMapPlugin = useCallback(() => {
    setSettings(current => ({ ...current, plugins: { ...current.plugins, mindMap: !current.plugins.mindMap } }));
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

  useWorkspacePersistence({
    activePane, activeTabId, canvasViewStates, paneActiveTabIds, paneIds, paneWidths,
    recentFiles, settings, splitView, tabPaneIds, tabs, message, workspaceLoaded, workspaceLoadedRef, setSettings,
  });

  const toggleTabLayout = useCallback(() => {
    setSettings((current) => ({
      ...current,
      tabLayout: current.tabLayout === "left" ? "top" : "left",
      ...(current.tabLayout === "top" ? { sidebarVisible: true } : {}),
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSettings((current) => current.tabLayout === "left"
      ? { ...current, sidebarVisible: !current.sidebarVisible }
      : current);
  }, []);


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
    const populatedPaneIds = paneIds.filter((paneId) => (paneTabIds[paneId]?.length ?? 0) > 0);
    const retainedPaneIds = populatedPaneIds.length > 0 ? populatedPaneIds : [paneIds[0]];

    if (retainedPaneIds.length !== paneIds.length) {
      const retained = new Set(retainedPaneIds);
      setPaneIds(retainedPaneIds);
      setPaneWidths((current) => normalizePaneWidths(current.filter((_, index) => retained.has(paneIds[index])), retainedPaneIds.length));
      setTabPaneIds((current) => {
        const next: Record<string, PaneKey[]> = {};
        tabsRef.current.forEach((tab) => {
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
        const available = paneTabIds[paneId] ?? [];
        const currentId = current[paneId];
        const nextId = available.includes(currentId) ? currentId : available[0];
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
  }, [activePane, paneIds, paneTabIds]);

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
    setTabs((current) => current.map((tab) => (tab.id === tabId && tab.kind === "canvas" && (getCanvasMode(tab) !== "mindmap" || mindMapPluginEnabled) ? updater(tab) : tab)));
  }, [mindMapPluginEnabled]);

  const { updateFileContent, undo, redo, clearFileHistory, historyRestore, onHistoryRestoreHandled } = useEditorHistory({ activeTab, tabsRef, setTabs, updateCanvasTab });

  useEffect(() => {
    const handleFocus = () => setWindowFocused(true);
    const handleBlur = () => setWindowFocused(false);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const addFileTextAnchor = useCallback((tabId: string, selectionStart: number, selectionEnd: number) => {
    setTabs((current) => current.map((tab) => {
      if (tab.id !== tabId || tab.kind !== "file") return tab;
      const currentAnchors = normalizeTextAnchors(tab.textAnchors, tab.content);
      if (currentAnchors.length >= MAX_TEXT_ANCHORS) return tab;
      const anchor = createTextAnchor(tab.content, selectionStart, selectionEnd, makeId());
      if (!anchor || currentAnchors.some((item) => item.start === anchor.start && item.end === anchor.end)) return tab;
      return { ...tab, textAnchors: [...currentAnchors, anchor].sort((left, right) => left.start - right.start) };
    }));
  }, []);

  const removeFileTextAnchor = useCallback((tabId: string, anchorId: string) => {
    setTabs((current) => current.map((tab) =>
      tab.id === tabId && tab.kind === "file"
        ? { ...tab, textAnchors: (tab.textAnchors ?? []).filter((anchor) => anchor.id !== anchorId) }
        : tab,
    ));
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

  const addMindMapTab = useCallback(() => {
    if (!mindMapPluginEnabled) return;
    const mindMap = createMindMap({ x: 320, y: 240 });
    const nextTab: CanvasTab = { ...createCanvasTab(tabs.length), canvasMode: "mindmap", title: uiText("思维导图"), mindMap, history: [cloneCanvasSnapshot([], mindMap)] };
    const targetPane = paneIds.includes(activePane) ? activePane : paneIds[0];
    setTabs(current => [...current, nextTab]);
    setTabPaneIds(current => ({ ...current, [nextTab.id]: [targetPane] }));
    focusTabInPane(nextTab.id, targetPane);
    setSelectedItem(null);
  }, [activePane, focusTabInPane, mindMapPluginEnabled, paneIds, tabs.length]);

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
        message.error(uiText("重新加载失败：{0}", [result.error ?? tab.filePath]));
        return false;
      }
      const restored = createTabFromOpenedFile(result.file, tab.themeIndex);
      setTabs((current) => current.map((item) => (item.id === tab.id ? {
        ...restored,
        id: tab.id,
        ...(item.kind === "file" && restored.kind === "file"
          ? { textAnchors: updateTextAnchors(item.content, restored.content, item.textAnchors) }
          : {}),
      } : item)));
      clearFileHistory(tab.id);
      setRecentFiles((current) => rememberRecentFiles(current, [{ path: tab.filePath!, name: result.file!.name }]));
      return true;
    },
    [clearFileHistory, message],
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
          if (filePath && window.superNote) {
            const result = await window.superNote.readFile(filePath);
            if (!result.ok || !result.file) {
              throw new Error(result.error ?? file.name);
            }
            fileTabs.push(result.file);
          } else {
            fileTabs.push({
              path: filePath,
              name: file.name,
              content: await file.text(),
              size: file.size,
            });
          }
        } catch (error) {
          message.error(uiText("读取文件失败：{0}，{1}", [file.name, String(error)]));
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
      message.warning(uiText("当前环境不支持系统文件选择器"));
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
        message.error(uiText("打开文件失败：{0}", [result.error ?? filePath]));
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

  const { reorderTab, pinTab, renameTab, openTabInExplorer, copyTabAbsolutePath, copyTabRelativePath, closeTab, closeCurrentTab } = useTabActions({
    tabs, tabsRef, setTabs, paneIds, setPaneIds, activePane, setActivePane, activeTab,
    tabPaneIds, setTabPaneIds, paneTabs, setPaneActiveTabIds, setPaneWidths, setCanvasViewStates,
    selectedItem, setSelectedItem, paneTabHistoryRef, getTabPanes, clearFileHistory, settings, modal, message,
  });

  const saveCurrentTab = useFileSave({ activeTab, message, settings, setTabs, setRecentFiles, setEditingText });

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
        ...neutralConfirmDialog,
        title: uiText("删除整张思维导图？"),
        content: uiText("中心主题和所有分支都会从当前画板移除，可使用撤销恢复。"),
        okText: uiText("删除导图"),
        cancelText: uiText("取消"),
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
      message.error(result.error ?? uiText("无法打开思维导图样式窗口"));
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
          throw new Error(result.error ?? uiText("图片保存失败"));
        }
        message.success(uiText("已导出 {0} × {1} PNG", [rendered.width, rendered.height]));
        return;
      }
      const link = document.createElement("a");
      link.href = rendered.dataUrl;
      link.download = defaultName;
      link.click();
      message.success(uiText("画板图片已导出"));
    } catch (error) {
      message.error(uiText("导出图片失败：{0}", [String(error)]));
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
        message.info(uiText("图片元素目前支持移动、缩放和删除"));
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
          message.warning(uiText("程序员工具仅支持文字元素"));
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
        message.error(uiText("JSON 处理失败：{0}", [String(error)]));
      }
    },
    [commitCanvasItems, message, tabs],
  );

  const applyFileProgrammerAction = useCallback(
    (tabId: string, action: ProgrammerAction, selectionStart: number, selectionEnd: number) => {
      try {
        const tab = tabs.find((item): item is FileTab => item.id === tabId && item.kind === "file");
        if (!tab) {
          message.warning(uiText("程序员工具仅支持文本模块和画布文字元素"));
          return;
        }
        if (tab.isPreviewOnly) {
          message.warning(uiText("大文本以只读预览打开，不能直接保存；原文件未被修改"));
          return;
        }

        const start = clamp(Math.min(selectionStart, selectionEnd), 0, tab.content.length);
        const end = clamp(Math.max(selectionStart, selectionEnd), 0, tab.content.length);
        if (end <= start) {
          message.warning(uiText("请先选中需要处理的文本"));
          return;
        }

        const sourceText = tab.content.slice(start, end);
        const transformedText = transformJsonText(sourceText, action);
        const nextContent = `${tab.content.slice(0, start)}${transformedText}${tab.content.slice(end)}`;
        updateFileContent(tabId, nextContent);
      } catch (error) {
        message.error(uiText("JSON 处理失败：{0}", [String(error)]));
      }
    },
    [message, updateFileContent, tabs],
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
        message.warning(uiText("剪贴板没有可粘贴的文字"));
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
      message.error(uiText("粘贴失败：{0}", [String(error)]));
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

  useAppShortcuts({
    activeTab, settings, quickOpenOpen, searchOpen, settingsOpen, searchScope, canvasPluginEnabled,
    selectedItem, selectedMindMapNode, closeQuickOpen, closeSearch,
    setQuickOpenOpen, toggleSidebar, toggleTabLayout, updateFileFontSize, addCanvasTab, addTextTab,
    closeCurrentTab, saveCurrentTab, openSearch, focusSiblingTab, autoSplitTab, pasteFromClipboard,
    deleteCanvasItem, deleteCanvasMindMapBranch, undo, redo,
  });

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
            message.warning(uiText("主工作区无法读取，已从自动备份恢复"));
          } else if (!result.ok && selected.source === "none") {
            throw new Error(result.error ?? uiText("工作区与备份均无法读取"));
          } else if (selected.source === "none" && (result.workspace != null || result.backupWorkspace != null)) {
            message.warning(uiText("工作区数据格式无效，已创建新的空工作区"));
          }
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          workspace = raw ? JSON.parse(raw) : null;
        }

        const selectedWorkspace = selectWorkspaceCandidate(workspace, null).workspace;
        if (selectedWorkspace) {
          const restored = restoreWorkspace(selectedWorkspace, INITIAL_PANE_ID);
          setTabs(restored.tabs);
          setPaneIds(restored.paneIds);
          setTabPaneIds(restored.tabPaneIds);
          setPaneActiveTabIds(restored.paneActiveTabIds);
          setActivePane(restored.activePane);
          setPaneWidths(restored.paneWidths);
          setCanvasViewStates(restored.canvasViewStates);
          setSettings(normalizeSettings(selectedWorkspace.settings));
          setRecentFiles(restored.recentFiles);
          paneTabHistoryRef.current = Object.fromEntries(
            Object.entries(restored.paneActiveTabIds).map(([paneId, tabId]) => [paneId, [tabId]]),
          );
        }
      } catch (error) {
        message.warning(uiText("加载上次内容失败：{0}", [String(error)]));
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
            message.warning(uiText("文件已被外部删除，当前内容仍保留：{0}", [tab.title]));
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
            message.info(uiText("已重新加载外部修改：{0}", [tab.title]));
          }
          continue;
        }

        modal.confirm({
          ...neutralConfirmDialog,
          title: uiText("文件已在外部修改"),
          content: uiText("{0} 在磁盘上发生变化，当前标签也有未保存内容。", [tab.title]),
          okText: uiText("重新加载磁盘版本"),
          cancelText: uiText("保留当前内容"),
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

    let checking = false;
    const refresh = () => {
      if (disposed || checking || document.hidden) return;
      checking = true;
      void checkExternalChanges().finally(() => { checking = false; });
    };
    refresh();
    const timer = window.setInterval(refresh, 2500);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
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
      tabs: tabPresentation.map((tab) => ({ id: tab.id, title: tab.title, kind: tab.kind })),
    });
  }, [activeTabId, tabPresentation]);

  useEffect(() => {
    const unsubscribe = window.superNote?.onTrayAction?.((action) => {
      if (action.type === "new-text") {
        addTextTab();
        return;
      }
      const tab = tabsRef.current.find((item) => item.id === action.tabId);
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
  }, [activePane, addTextTab, focusTabInPane, getTabPanes]);

  useEffect(() => {
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [handlePaste]);

  useEffect(() => {
    const setControlKeyState = (pressed: boolean) => document.body.classList.toggle("ctrl-key-down", pressed);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control") setControlKeyState(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Control") setControlKeyState(false);
    };
    const handleWindowBlur = () => setControlKeyState(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      setControlKeyState(false);
    };
  }, []);

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

  const quickOpenResults = useMemo(
    () => quickOpenOpen ? getQuickOpenResults(tabs, recentFiles, quickOpenValue) : [],
    [quickOpenOpen, quickOpenValue, recentFiles, tabs],
  );

  const deferredSearchValue = useDeferredValue(searchValue);
  const searchResults = useMemo(
    () => searchOpen ? searchWorkspace({ tabs, recentFiles, query: deferredSearchValue, scope: searchScope, activeTabId }) : [],
    [activeTabId, deferredSearchValue, recentFiles, searchOpen, searchScope, tabs],
  );

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
    async (result: QuickOpenItem) => {
      if (result.kind === "recent") {
        await openFilePath(result.filePath);
        closeQuickOpen();
        return;
      }
      const availablePanes = getTabPanes(result.tabId);
      focusTabInPane(result.tabId, availablePanes.includes(activePane) ? activePane : availablePanes[0]);
      closeQuickOpen();
    },
    [activePane, closeQuickOpen, focusTabInPane, getTabPanes, openFilePath],
  );

  const pluginMenu: MenuProps["items"] = [
    {
      key: "canvas-plugin",
      label: (
        <span className="new-module-menu-label">
          <strong>{uiText("画板插件")}</strong>
          <small>{canvasPluginEnabled ? uiText("已启用 · 新建画板 {0}", [settings.shortcuts.newCanvas]) : uiText("未启用 · 点击启用画板能力")}</small>
        </span>
      ),
      icon: canvasPluginEnabled ? <CheckOutlined /> : <BorderOutlined />,
      onClick: toggleCanvasPlugin,
    },
    {
      key: "mindmap-plugin",
      label: <span className="new-module-menu-label"><strong>{uiText("思维导图插件")}</strong><small>{mindMapPluginEnabled ? uiText("已启用 · 可独立新建思维导图") : uiText("未启用 · 点击启用思维导图能力")}</small></span>,
      icon: mindMapPluginEnabled ? <CheckOutlined /> : <BorderOutlined />,
      onClick: toggleMindMapPlugin,
    },
  ];

  const fileMenu: MenuProps["items"] = [
    ...(mindMapPluginEnabled ? [{ key: "new-mindmap", label: uiText("新建思维导图"), icon: <ApartmentOutlined />, onClick: addMindMapTab }] : []),
    {
      key: "new-text",
      label: uiText("新建文本模块 ({0})", [settings.shortcuts.newText]),
      icon: <FileTextOutlined />,
      onClick: () => addTextTab(),
    },
    {
      key: "new-markdown",
      label: uiText("新建 Markdown 文档"),
      icon: <CodeOutlined />,
      onClick: () => addMarkdownTab(),
    },
    {
      key: "open",
      label: uiText("打开已有文件"),
      icon: <FolderOpenOutlined />,
      onClick: openExistingFile,
    },
    {
      key: "quick-open",
      label: uiText("快速打开 ({0})", [settings.shortcuts.quickOpen]),
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
            label: uiText("最近文件"),
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
      label: uiText("保存文件"),
      icon: <SaveOutlined />,
      onClick: saveCurrentTab,
    },
  ];

  const operationMenu: MenuProps["items"] = [
    {
      key: "new-text",
      label: uiText("新建文本模块 ({0})", [settings.shortcuts.newText]),
      icon: <FileTextOutlined />,
      onClick: () => addTextTab(),
    },
    {
      key: "new-markdown",
      label: uiText("新建 Markdown 文档"),
      icon: <CodeOutlined />,
      onClick: () => addMarkdownTab(),
    },
    {
      key: "close-tab",
      label: uiText("关闭当前标签 ({0})", [settings.shortcuts.closeTab]),
      icon: <CloseOutlined />,
      onClick: closeCurrentTab,
    },
    {
      key: "toggle-tab-layout",
      label: `${settings.tabLayout === "left" ? uiText("切换到顶部标签栏") : uiText("切换到左侧标签菜单")} (${settings.shortcuts.toggleTabLayout})`,
      icon: settings.tabLayout === "left" ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />,
      onClick: toggleTabLayout,
    },
    ...(settings.tabLayout === "left" ? [{
      key: "toggle-sidebar",
      label: `${settings.sidebarVisible ? uiText("隐藏左侧栏") : uiText("显示左侧栏")} (${settings.shortcuts.toggleSidebar})`,
      icon: settings.sidebarVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />,
      onClick: toggleSidebar,
    }] : []),
    { type: "divider" },
    {
      key: "search",
      label: uiText("搜索当前页 ({0})", [settings.shortcuts.search]),
      icon: <SearchOutlined />,
      onClick: () => openSearch("current"),
    },
    {
      key: "quick-open",
      label: uiText("快速打开 ({0})", [settings.shortcuts.quickOpen]),
      icon: <FolderOpenOutlined />,
      onClick: () => {
        closeSearch();
        setQuickOpenOpen(true);
        window.setTimeout(() => document.getElementById("quick-open-input")?.focus(), 0);
      },
    },
    {
      key: "undo",
      label: uiText("撤销 ({0})", [settings.shortcuts.undo]),
      icon: <UndoOutlined />,
      onClick: undo,
    },
    {
      key: "redo",
      label: uiText("重做 ({0})", [settings.shortcuts.redo]),
      icon: <RedoOutlined />,
      onClick: redo,
    },
    {
      key: "paste",
      label: uiText("粘贴 ({0})", [settings.shortcuts.paste]),
      icon: <CopyOutlined />,
      onClick: pasteFromClipboard,
    },
    {
      key: "delete",
      label: uiText("删除选中元素 ({0})", [settings.shortcuts.deleteSelected]),
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
        label: uiText("向左分割视图 ({0})", [settings.shortcuts.splitLeft]),
        icon: <SplitCellsOutlined />,
        onClick: () => autoSplitTab("left"),
      },
      {
        key: "split-right",
        label: uiText("向右分割视图 ({0})", [settings.shortcuts.splitRight]),
        icon: <SplitCellsOutlined />,
        onClick: () => autoSplitTab("right"),
      },
    ] : []),
  ];

  const helpMenu: MenuProps["items"] = [
    {
      key: "donate",
      label: uiText("打赏作者"),
      icon: <HeartOutlined />,
      onClick: () => setDonationOpen(true),
    },
    {
      key: "website",
      label: uiText("官网"),
      icon: <LinkOutlined />,
      onClick: () => void openExternalUrl(SITE_URL),
    },
    {
      key: "docs",
      label: uiText("文档"),
      icon: <BookOutlined />,
      onClick: () =>
        modal.info({
          ...neutralInfoDialog,
          title: uiText("文档"),
          width: 760,
          content: (
            <div className="scrollable-modal-content">
              <Suspense fallback={<FeatureLoading label={uiText("正在加载文档...")} />}>
                <LazyHelpDocumentation canvasPluginEnabled={canvasPluginEnabled} shortcuts={settings.shortcuts} />
              </Suspense>
            </div>
          ),
        }),
    },
    {
      key: "version",
      label: uiText("版本"),
      icon: <InfoCircleOutlined />,
      onClick: () =>
        modal.info({
          ...neutralInfoDialog,
          title: null,
          width: "100vw",
          wrapClassName: "author-inspiration-modal-wrap",
          style: { top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", maxWidth: "none", margin: 0, paddingBottom: 0 },
          className: "author-inspiration-modal",
          content: (
            <div className="author-inspiration-panel" aria-label={uiText("版本")}>
              <div className="author-inspiration-text version-fullscreen-text">v{appInfo.version}</div>
            </div>
          ),
        }),
    },
    {
      key: "updates",
      label: uiText("版本更新"),
      icon: <HistoryOutlined />,
      onClick: () =>
        modal.info({
          ...neutralInfoDialog,
          title: uiText("版本更新"),
          width: 680,
          content: (
            <div className="scrollable-modal-content">
              <Suspense fallback={<FeatureLoading label={uiText("正在加载文档...")} />}>
                <LazyReleaseTimeline />
              </Suspense>
            </div>
          ),
        }),
    },
    {
      key: "author",
      label: uiText("作者"),
      icon: <UserOutlined />,
      onClick: () =>
        modal.info({
          ...neutralInfoDialog,
          title: null,
          width: "100vw",
          wrapClassName: "author-inspiration-modal-wrap",
          style: { top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", maxWidth: "none", margin: 0, paddingBottom: 0 },
          className: "author-inspiration-modal",
          content: (
            <div className="author-inspiration-panel" aria-label={uiText("作者寄语")}>
              <div className="author-inspiration-text">{uiText("希望你认识自身平凡之后，")}<br />{uiText("依旧拥有改变世界的勇气")}</div>
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
        ? uiText("重试 {0}/{1}", [updateStatus.downloadAttempt, updateStatus.maxDownloadAttempts ?? 3])
        : `${Math.max(0, Math.min(100, updateStatus.progress ?? 0))}%`
      : updateStatus.state === "downloaded"
        ? uiText("安装")
        : updateStatus.state === "installing"
          ? uiText("安装中")
          : updateStatus.state === "error"
            ? uiText("重试更新")
            : updateStatus.latestVersion
            ? uiText("更新 {0}", [updateStatus.latestVersion])
            : uiText("更新");
  const updateButtonTitle =
    updateStatus.state === "error"
      ? uiText("更新失败，点击重试{0}", [updateStatus.error ? `：${updateStatus.error}` : ""])
      : updateStatus.state === "downloading" && updateStatus.error
        ? updateStatus.error
        : updateStatus.channel === "win7-8"
      ? uiText("发现新版本，点击自动更新 Windows 7 / 8 版本")
      : uiText("发现新版本，点击自动更新 Windows 10 / 11 版本");

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
      message.error(uiText("自动更新启动失败：{0}", [String(error)]));
    }
  }, [message, updateStatus.latestVersion, updateStatus.state]);

  const tabNavigationItems = tabPresentation;

  const renderPaneContent = (tab: NoteTab, pane: PaneKey) => {
    if (tab.kind === "canvas") {
      if (getCanvasMode(tab) === "mindmap" && !mindMapPluginEnabled) {
        return <div className="plugin-disabled" data-plugin="mindmap"><span>{uiText("启用思维导图插件后查看和编辑，已有内容已保留。")}</span><Button onClick={toggleMindMapPlugin}>{uiText("启用思维导图插件")}</Button></div>;
      }
      const viewState = getPaneViewState(tab, pane);
      const CanvasDocumentView = getCanvasMode(tab) === "mindmap" ? LazyMindMapCanvasView : LazyCanvasView;
      return (
        <Suspense fallback={<FeatureLoading label={uiText("正在加载画板...")} />}>
        <CanvasDocumentView
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
      <Suspense fallback={<FeatureLoading label={uiText("正在加载文本模块...")} />}>
      <LazyFileView
        tab={tab}
        noteTargets={tabPresentation}
        onOpenNote={(id) => {
          if (!tabs.some(note => note.id === id)) { message.warning(uiText("关联笔记已关闭或移除")); return; }
          const panes = getTabPanes(id);
          focusTabInPane(id, panes.includes(pane) ? pane : panes[0] ?? pane);
        }}
        showTitleBar={settings.tabLayout === "left"}
        title={getTabDisplayTitle(tab)}
        titleMenuItems={[
          { key: "rename", label: uiText("编辑名称"), onClick: () => renameTab(tab.id) },
          { key: "pin", label: tab.pinned ? uiText("取消置顶") : uiText("置顶"), onClick: () => pinTab(tab.id) },
          { key: "explorer", label: uiText("打开所在文件夹"), disabled: !tab.filePath, onClick: () => openTabInExplorer(tab.id) },
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
        historyRestore={activePane === pane ? historyRestore : null}
        onHistoryRestoreHandled={onHistoryRestoreHandled}
        onContentChange={(content, metadata) => updateFileContent(tab.id, content, metadata)}
        onAddTextAnchor={(selectionStart, selectionEnd) => addFileTextAnchor(tab.id, selectionStart, selectionEnd)}
        onRemoveTextAnchor={(anchorId) => removeFileTextAnchor(tab.id, anchorId)}
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
    <section key={pane} className={`work-pane ${activePane === pane ? "focused" : ""}`} onMouseDown={() => !welcomeVisible && tab && focusTabInPane(tab.id, pane)}>
      <div className="pane-content">
        {welcomeVisible ? <WelcomeWorld /> : tab ? renderPaneContent(tab, pane) : <EmptyWorld />}
      </div>
    </section>
  );

  const renderedPaneIds = useMemo(() => settings.tabLayout === "left" ? [activePane] : paneIds, [settings.tabLayout, activePane, paneIds]);
  const renderedSplitView = settings.tabLayout === "top" && splitView;

  return (
    <ConfigProvider
      locale={getUiLanguage() === "en-US" ? enUS : zhCN}
      theme={{
        algorithm: effectiveDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 10,
          colorPrimary: "#262626",
          colorInfo: "#262626",
          colorLink: "#262626",
          controlHeight: 34,
          ...textScaleTokens(settings.textScale),
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
        },
      }}
    >
    <div
      className={`app-shell${window.superNote?.windowBackdropEnabled ? " native-window-backdrop" : ""}${settings.handwritten ? " handwritten-mode" : ""}${effectiveDarkMode ? " dark-mode" : ""}${sidebarResizing ? " sidebar-resizing" : ""}${windowFocused ? " window-focused" : ""}`}
      data-tab-layout={settings.tabLayout}
      style={{
        ["--pane-grid" as string]: makePaneGridTemplate(paneWidths),
        ["--sidebar-width" as string]: `${settings.sidebarWidth}px`,
      } as React.CSSProperties}
      onDragOver={handleAppDragOver}
      onDrop={handleAppDrop}
    >
      <Suspense fallback={<div className="app-titlebar" aria-hidden="true" />}>
        <LazyAppTitleBar
          fileMenu={fileMenu}
          pluginMenu={pluginMenu}
          operationMenu={operationMenu}
          helpMenu={helpMenu}
          updateButtonVisible={updateButtonVisible}
          updateButtonTitle={updateButtonTitle}
          updateButtonLoading={updateButtonLoading}
          updateButtonText={updateButtonText}
          alwaysOnTop={alwaysOnTop}
          darkMode={effectiveDarkMode}
          onOpenWelcome={() => setWelcomeVisible(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenSearch={() => openSearch("all")}
          onToggleAlwaysOnTop={async () => {
            const next = !alwaysOnTop;
            setAlwaysOnTop(next);
            await window.superNote?.setAlwaysOnTop(next);
          }}
          onToggleTheme={() => setSettings((current) => ({
            ...current,
            followSystemTheme: false,
            darkMode: !effectiveDarkMode,
          }))}
          onUpdateClick={handleUpdateClick}
        />
      </Suspense>

      <div className={`app-content-shell tab-layout-${settings.tabLayout}${settings.tabLayout === "left" && !settings.sidebarVisible ? " sidebar-collapsed" : ""}`}>
        {settings.tabLayout !== "left" || settings.sidebarVisible ? <Suspense fallback={<div className="tab-navigation-loading" aria-hidden="true" />}><LazyTabNavigation
          layout={settings.tabLayout}
          tabs={tabNavigationItems}
          paneIds={renderedPaneIds}
          paneTabIds={paneTabIds}
          paneActiveTabIds={welcomeVisible
            ? Object.fromEntries(paneIds.map((pane) => [pane, "__welcome__"])) as Record<PaneKey, string>
            : paneActiveTabIds}
          activePane={activePane}
          splitView={renderedSplitView}
          canvasPluginEnabled={canvasPluginEnabled}
          mindMapPluginEnabled={mindMapPluginEnabled}
          onAddMindMap={addMindMapTab}
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
          onCopyTabAbsolutePath={(tabId) => void copyTabAbsolutePath(tabId)}
          onCopyTabRelativePath={(tabId) => void copyTabRelativePath(tabId)}
          onAddCanvas={addCanvasTab}
          onAddText={addTextTab}
          onStartSplitResize={startSplitResize}
          onStartSidebarResize={startSidebarResize}
        /></Suspense> : null}

        <main className={renderedSplitView ? "workspace multi-pane" : "workspace"}>
          {renderedPaneIds.flatMap((paneId, index) => [
            renderSurface(activeTabsByPane[paneId] ?? null, paneId),
            ...(index < renderedPaneIds.length - 1
              ? [
                  <div
                    key={`workspace-divider-${paneId}`}
                    className="split-resizer"
                    title={uiText("长按后左右拖拽调整分栏宽度")}
                    onMouseDown={(event) => startSplitResize(index, event)}
                  />,
                ]
              : []),
          ])}
        </main>
      </div>

      {fileZoomPercent !== null ? (
        <ZoomIndicator
          percent={fileZoomPercent}
          onRestore={() => activeTab?.kind === "file" && updateFileFontSize(activeTab.id, () => DEFAULT_FILE_FONT_SIZE)}
        />
      ) : null}

      {donationOpen ? (
        <div className="donation-overlay" role="dialog" aria-modal="true" aria-label={uiText("打赏作者")} onClick={() => setDonationOpen(false)}>
          <button type="button" className="donation-close" aria-label={uiText("关闭")} onClick={() => setDonationOpen(false)}><CloseOutlined /></button>
          <div className="donation-panel" onClick={(event) => event.stopPropagation()}>
            <img src={donationImageUrl} alt={uiText("微信支付收款码")} />
          </div>
        </div>
      ) : null}

      {quickOpenOpen || searchOpen ? (
        <Suspense fallback={null}>
          <LazyGlobalSearchOverlays
            quickOpenOpen={quickOpenOpen}
            quickOpenValue={quickOpenValue}
            quickOpenResults={quickOpenResults}
            onQuickOpenValueChange={setQuickOpenValue}
            onOpenQuickOpenResult={openQuickOpenResult}
            searchOpen={searchOpen}
            searchScope={searchScope}
            searchValue={searchValue}
            deferredSearchValue={deferredSearchValue}
            searchResults={searchResults}
            onSearchValueChange={setSearchValue}
            onOpenSearchResult={openSearchResult}
            onCloseSearch={closeSearch}
          />
        </Suspense>
      ) : null}

      {settingsOpen ? (
        <Suspense fallback={null}>
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
          <button type="button" className="image-preview-close" aria-label={uiText("关闭预览")} onClick={() => setImagePreview(null)}>
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
  const [textScale, setTextScale] = useState(100);
  return (
    <ConfigProvider
      locale={getUiLanguage() === "en-US" ? enUS : zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 10,
          colorPrimary: "#262626",
          colorInfo: "#262626",
          colorLink: "#262626",
          controlHeight: 34,
          ...textScaleTokens(textScale),
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', Arial, sans-serif",
        },
      }}
    >
      <AntApp>
        <AppShell onTextScaleChange={setTextScale} />
      </AntApp>
    </ConfigProvider>
  );
}
