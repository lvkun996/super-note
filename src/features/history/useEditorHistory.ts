import { useCallback, useRef, useState } from "react";
import type { CanvasTab, NoteTab } from "../../appTypes";
import type { RefObject } from "react";
import { clampEditorSelection, type TextEditMetadata, type TextHistoryRestore } from "./textHistory";
import { appendTextHistory, applyBufferedTextEdit, bufferTextEdit, limitTextHistory, type BufferedTextEdit } from "./textHistoryBuffer";
import type { StateSetter } from "../workspace/controllerTypes";
import { cloneMindMap } from "../mindmap/mindMapModel";
import { deriveCanvasTitle } from "../tabs/tabDocument";
import { updateTextAnchors } from "../text/textAnchors";
import { normalizeTextLineEndings } from "../text/textLineEndings";
import { cloneItems } from "./historyModel";

type EditorHistoryOptions = {
  activeTab: NoteTab | null | undefined;
  tabsRef: RefObject<NoteTab[]>;
  setTabs: StateSetter<NoteTab[]>;
  updateCanvasTab: (tabId: string, updater: (tab: CanvasTab) => CanvasTab) => void;
};

export function useEditorHistory({
  activeTab,
  tabsRef,
  setTabs,
  updateCanvasTab,
}: EditorHistoryOptions) {
  const fileUndoRef = useRef<Record<string, BufferedTextEdit[]>>({});
  const fileRedoRef = useRef<Record<string, BufferedTextEdit[]>>({});
  const [historyRestore, setHistoryRestore] = useState<TextHistoryRestore | null>(null);
  const requestIdRef = useRef(0);
  const updateFileContent = useCallback((tabId: string, content: string, metadata?: TextEditMetadata) => {
    content = normalizeTextLineEndings(content);
    const previous = tabsRef.current.find(tab => tab.id === tabId);
    if (!previous || previous.kind !== "file" || previous.isPreviewOnly) return;
    if (previous.content === content) {
      const history = fileUndoRef.current[tabId];
      const last = history?.at(-1);
      if (metadata?.group && last?.group === metadata.group) {
        fileUndoRef.current[tabId] = [...history.slice(0, -1), { ...last, after: clampEditorSelection(metadata.after, content.length) }];
      }
      return;
    }
    const entry = bufferTextEdit(previous.content, content, metadata);
    const history = fileUndoRef.current[tabId] ?? [];
    fileUndoRef.current[tabId] = appendTextHistory(history, entry, previous.content);
    fileRedoRef.current[tabId] = [];
    const next = tabsRef.current.map(tab => tab.id === tabId && tab.kind === "file"
      ? { ...tab, content, textAnchors: updateTextAnchors(tab.content, content, tab.textAnchors, { start: entry.start, previousEnd: entry.start + entry.removed.length, nextEnd: entry.start + entry.inserted.length }), dirty: true } : tab);
    tabsRef.current = next;
    setTabs(next);
  }, [setTabs, tabsRef]);

  const restoreTextHistory = useCallback((direction: "undo" | "redo") => {
    if (activeTab?.kind !== "file") return;
    const source = direction === "undo" ? fileUndoRef : fileRedoRef;
    const destination = direction === "undo" ? fileRedoRef : fileUndoRef;
    const history = source.current[activeTab.id] ?? [];
    const entry = history.at(-1);
    if (!entry) return;
    const tab = tabsRef.current.find(tab => tab.id === activeTab.id);
    if (!tab || tab.kind !== "file") return;
    const content = applyBufferedTextEdit(tab.content, entry, direction === "undo");
    source.current[activeTab.id] = history.slice(0, -1);
    destination.current[activeTab.id] = limitTextHistory([...(destination.current[activeTab.id] ?? []), entry]);
    const selection = direction === "undo" ? entry.before : entry.after;
    const next = tabsRef.current.map(tab => tab.id === activeTab.id && tab.kind === "file"
      ? { ...tab, content, textAnchors: updateTextAnchors(tab.content, content, tab.textAnchors), dirty: true } : tab);
    tabsRef.current = next;
    setTabs(next);
    setHistoryRestore({ tabId: activeTab.id, requestId: ++requestIdRef.current, content, selection });
  }, [activeTab, setTabs, tabsRef]);

  const undo = useCallback(() => {
    if (activeTab?.kind === "file") {
      restoreTextHistory("undo");
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
  }, [activeTab, restoreTextHistory, updateCanvasTab]);

  const redo = useCallback(() => {
    if (activeTab?.kind === "file") {
      restoreTextHistory("redo");
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
  }, [activeTab, restoreTextHistory, updateCanvasTab]);

  const clearFileHistory = useCallback((tabId: string) => {
    delete fileUndoRef.current[tabId];
    delete fileRedoRef.current[tabId];
    setHistoryRestore(current => current?.tabId === tabId ? null : current);
  }, []);
  const onHistoryRestoreHandled = useCallback((requestId: number) => {
    setHistoryRestore(current => current?.requestId === requestId ? null : current);
  }, []);
  return { updateFileContent, undo, redo, clearFileHistory, historyRestore, onHistoryRestoreHandled };
}
