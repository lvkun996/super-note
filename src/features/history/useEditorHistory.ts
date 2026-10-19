import { useCallback, useRef } from "react";
import type { CanvasTab, NoteTab } from "../../appTypes";
import type { StateSetter } from "../workspace/controllerTypes";
import { cloneMindMap } from "../mindmap/mindMapModel";
import { deriveCanvasTitle } from "../tabs/tabDocument";
import { updateTextAnchors } from "../text/textAnchors";
import { normalizeTextLineEndings } from "../text/textLineEndings";
import { cloneItems, HISTORY_LIMIT } from "./historyModel";

type EditorHistoryOptions = {
  activeTab: NoteTab | null | undefined;
  setTabs: StateSetter<NoteTab[]>;
  updateCanvasTab: (tabId: string, updater: (tab: CanvasTab) => CanvasTab) => void;
};

export function useEditorHistory({
  activeTab,
  setTabs,
  updateCanvasTab,
}: EditorHistoryOptions) {
  const fileUndoRef = useRef<Record<string, string[]>>({});
  const fileRedoRef = useRef<Record<string, string[]>>({});
  const updateFileContent = useCallback((tabId: string, content: string) => {
    content = normalizeTextLineEndings(content);
    setTabs((current) => current.map((tab) => {
      if (tab.id !== tabId || tab.kind !== "file" || tab.content === content) {
        return tab;
      }
      const history = fileUndoRef.current[tabId] ?? [];
      if (history.at(-1) !== tab.content) {
        fileUndoRef.current[tabId] = [...history, tab.content].slice(-HISTORY_LIMIT);
      }
      fileRedoRef.current[tabId] = [];
      return { ...tab, content, textAnchors: updateTextAnchors(tab.content, content, tab.textAnchors), dirty: true };
    }));
  }, []);

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
        current.map((tab) => (tab.id === activeTab.id && tab.kind === "file" ? {
          ...tab,
          content: previousContent,
          textAnchors: updateTextAnchors(tab.content, previousContent, tab.textAnchors),
          dirty: true,
        } : tab)),
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
        current.map((tab) => (tab.id === activeTab.id && tab.kind === "file" ? {
          ...tab,
          content: nextContent,
          textAnchors: updateTextAnchors(tab.content, nextContent, tab.textAnchors),
          dirty: true,
        } : tab)),
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

  const clearFileHistory = useCallback((tabId: string) => {
    delete fileUndoRef.current[tabId];
    delete fileRedoRef.current[tabId];
  }, []);
  const recordFileHistory = useCallback((tabId: string, content: string) => {
    fileUndoRef.current[tabId] = [...(fileUndoRef.current[tabId] ?? []), content].slice(-HISTORY_LIMIT);
    fileRedoRef.current[tabId] = [];
  }, []);
  const canUndoFile = useCallback(() => activeTab?.kind === "file" && (fileUndoRef.current[activeTab.id]?.length ?? 0) > 0, [activeTab]);
  const canRedoFile = useCallback(() => activeTab?.kind === "file" && (fileRedoRef.current[activeTab.id]?.length ?? 0) > 0, [activeTab]);
  return { updateFileContent, undo, redo, canUndoFile, canRedoFile, clearFileHistory, recordFileHistory };
}
