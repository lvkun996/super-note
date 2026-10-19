import { uiText } from "../../../electron/uiLanguage";
import type { CanvasItem, CanvasTab, FileTab, NoteFilePayload, NoteTab, PersistedCanvasTab, PersistedTab, TextCanvasItem } from "../../appTypes";
import { cloneCanvasSnapshot, cloneItems } from "../history/historyModel";
import { normalizeMindMap } from "../mindmap/mindMapModel";
import { getCanvasMode } from "../../pluginSettings";
import { formatOpenedFileContent, getFileDocumentMode, isMarkdownFileName } from "../text/fileDocument";
import { normalizeTextAnchorsForEditor } from "../text/textAnchors";
import { normalizeTextLineEndings } from "../text/textLineEndings";

export const DEFAULT_FILE_FONT_SIZE = 13;
const makeId = () => crypto.randomUUID();

export function truncateTitle(value: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) {
    return uiText("未知");
  }
  return clean.length > 14 ? `${clean.slice(0, 14)}...` : clean;
}

export function getFileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || filePath;
}

export function getFileSaveFilters(tab: FileTab) {
  const textFilters = [
    { name: uiText("文本文件"), extensions: ["txt", "md", "markdown", "json", "csv", "log", "ts", "tsx", "js", "jsx", "css", "html"] },
    { name: uiText("所有文件"), extensions: ["*"] },
  ];
  if (getFileDocumentMode(tab) !== "markdown") {
    return textFilters;
  }
  return [
    { name: "Markdown", extensions: ["md", "markdown"] },
    ...textFilters,
  ];
}

export function deriveCanvasTitle(tab: CanvasTab, items: CanvasItem[], mindMap = tab.mindMap) {
  if (!tab.autoTitle) {
    return tab.title;
  }
  const textItem = items.find((item): item is TextCanvasItem => item.type === "text" && item.text.trim().length > 0);
  const rootText = mindMap?.nodes.find((node) => node.id === mindMap.rootId)?.text;
  return textItem ? truncateTitle(textItem.text) : rootText ? truncateTitle(rootText) : uiText("未知");
}

export function createCanvasTab(themeIndex: number, dirty = true): CanvasTab {
  const items: CanvasItem[] = [];
  return {
    id: makeId(),
    kind: "canvas",
    title: uiText("未知"),
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

export function createFileTab(file: OpenedFile, themeIndex: number): FileTab {
  return {
    id: makeId(),
    kind: "file",
    title: file.name,
    fileName: file.name,
    filePath: file.path,
    content: formatOpenedFileContent(file.content, file.name, file.path),
    textAnchors: [],
    documentMode: isMarkdownFileName(file.name) || isMarkdownFileName(file.path) ? "markdown" : "text",
    fontSize: DEFAULT_FILE_FONT_SIZE,
    themeIndex,
    lastKnownMtimeMs: file.mtimeMs,
    lastKnownSize: file.size,
    isPreviewOnly: file.truncated,
    previewBytes: file.previewBytes,
    dirty: false,
  };
}

export function createTextTab(themeIndex: number): FileTab {
  return {
    id: makeId(),
    kind: "file",
    title: uiText("未命名文本"),
    fileName: uiText("未命名文本.txt"),
    content: "",
    textAnchors: [],
    documentMode: "text",
    fontSize: DEFAULT_FILE_FONT_SIZE,
    themeIndex,
    dirty: true,
  };
}

export function createMarkdownTab(themeIndex: number): FileTab {
  return {
    id: makeId(),
    kind: "file",
    title: uiText("未命名 Markdown"),
    fileName: "untitled.md",
    content: uiText("# 未命名\n\n"),
    textAnchors: [],
    documentMode: "markdown",
    fontSize: DEFAULT_FILE_FONT_SIZE,
    themeIndex,
    dirty: true,
  };
}

export function restoreTab(tab: PersistedTab): NoteTab {
  if (tab.kind === "canvas") {
    const items = cloneItems(tab.items ?? []);
    const mindMap = normalizeMindMap(tab.mindMap);
    return {
      ...tab,
      title: tab.title || uiText("未知"),
      autoTitle: tab.autoTitle ?? true,
      scale: tab.scale || 1,
      panX: tab.panX ?? 0,
      panY: tab.panY ?? 0,
      items,
      mindMap,
      canvasMode: getCanvasMode({ ...tab, mindMap }),
      history: [cloneCanvasSnapshot(items, mindMap)],
      historyIndex: 0,
      dirty: tab.dirty ?? false,
    };
  }
  return {
    ...tab,
    content: normalizeTextLineEndings(tab.content),
    textAnchors: normalizeTextAnchorsForEditor(tab.textAnchors, tab.content),
    documentMode: tab.documentMode ?? (isMarkdownFileName(tab.fileName) || isMarkdownFileName(tab.filePath) ? "markdown" : "text"),
    fontSize: tab.fontSize ?? DEFAULT_FILE_FONT_SIZE,
    dirty: tab.dirty ?? false,
  };
}

export function stripTab(tab: NoteTab): PersistedTab {
  if (tab.kind === "canvas") {
    const { history: _history, historyIndex: _historyIndex, ...rest } = tab;
    return rest;
  }
  return tab;
}

export function createCanvasPayload(tab: CanvasTab): NoteFilePayload {
  const persisted = stripTab({ ...tab, dirty: false }) as PersistedCanvasTab;
  return {
    type: "super-note-canvas",
    version: 1,
    tab: persisted,
  };
}

export function parseNoteFile(file: OpenedFile, themeIndex: number): NoteTab | null {
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

export function createTabFromOpenedFile(file: OpenedFile, themeIndex: number): NoteTab {
  const noteTab = file.name.toLowerCase().endsWith(".snote") ? parseNoteFile(file, themeIndex) : null;
  return noteTab ?? createFileTab(file, themeIndex);
}

export function isTabEmpty(tab: NoteTab) {
  if (tab.kind === "file") {
    return tab.content.trim().length === 0;
  }
  return !tab.mindMap && tab.items.every((item) => item.type === "text" && item.text.trim().length === 0);
}

