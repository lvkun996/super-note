import { useCallback, useRef, useState } from "react";
import type { CanvasTab, NoteTab } from "../../appTypes";
import type { RefObject } from "react";
import { createTextHistoryEntry, type TextEditMetadata, type TextHistoryEntry, type TextHistoryRestore } from "./textHistory";
import type { StateSetter } from "../workspace/controllerTypes";
import { cloneMindMap } from "../mindmap/mindMapModel";
import { deriveCanvasTitle } from "../tabs/tabDocument";
import { updateTextAnchors } from "../text/textAnchors";
import { normalizeTextLineEndings } from "../text/textLineEndings";
import { cloneItems, HISTORY_LIMIT } from "./historyModel";

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
  const fileUndoRef = useRef<Record<string, TextHistoryEntry[]>>({});
  const fileRedoRef = useRef<Record<string, TextHistoryEntry[]>>({});
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
        const entry = createTextHistoryEntry(previous.content, content, metadata);
        fileUndoRef.current[tabId] = [...history.slice(0, -1), { ...last, after: entry.after }];
      }
      return;
    }
    const entry = createTextHistoryEntry(previous.content, content, metadata);
    const history = fileUndoRef.current[tabId] ?? [];
    const last = history.at(-1);
    // Composition updates form one transaction, including their final input.
    fileUndoRef.current[tabId] = metadata?.group && last?.group === metadata.group
      ? [...history.slice(0, -1), { ...entry, before: last.before }]
      : [...history, entry].slice(-HISTORY_LIMIT);
    fileRedoRef.current[tabId] = [];
    const next = tabsRef.current.map(tab => tab.id === tabId && tab.kind === "file"
      ? { ...tab, content, textAnchors: updateTextAnchors(tab.content, content, tab.textAnchors), dirty: true } : tab);
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
    source.current[activeTab.id] = history.slice(0, -1);
    destination.current[activeTab.id] = [...(destination.current[activeTab.id] ?? []), entry].slice(-HISTORY_LIMIT);
    const snapshot = direction === "undo" ? entry.before : entry.after;
    setTabs(current => current.map(tab => tab.id === activeTab.id && tab.kind === "file"
      ? { ...tab, content: snapshot.content, textAnchors: updateTextAnchors(tab.content, snapshot.content, tab.textAnchors), dirty: true } : tab));
    setHistoryRestore({ tabId: activeTab.id, requestId: ++requestIdRef.current, ...snapshot });
  }, [activeTab, setTabs]);

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
