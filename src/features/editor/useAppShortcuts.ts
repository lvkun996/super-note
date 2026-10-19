import { useCallback, useEffect } from "react";
import type { AppSettings, NoteTab, PaneKey, SelectedItem } from "../../appTypes";
import type { SelectedMindMapNode } from "../mindmap/mindMapTypes";
import { shortcutMatches } from "../settings/settingsModel";
import { DEFAULT_FILE_FONT_SIZE } from "../tabs/tabDocument";

type AppShortcutsOptions = {
  activeTab: NoteTab | null | undefined;
  settings: AppSettings;
  quickOpenOpen: boolean;
  searchOpen: boolean;
  settingsOpen: boolean;
  searchScope: "current" | "all";
  canvasPluginEnabled: boolean;
  selectedItem: SelectedItem;
  selectedMindMapNode: SelectedMindMapNode;
  canUndoFile: () => boolean;
  canRedoFile: () => boolean;
  closeQuickOpen: () => void;
  closeSearch: () => void;
  setQuickOpenOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleTabLayout: () => void;
  updateFileFontSize: (tabId: string, updater: (size: number) => number) => void;
  addCanvasTab: () => void;
  addTextTab: () => void;
  closeCurrentTab: () => void;
  saveCurrentTab: () => unknown;
  openSearch: (scope: "current" | "all") => void;
  focusSiblingTab: (direction: -1 | 1) => void;
  autoSplitTab: (direction: "left" | "right") => void;
  pasteFromClipboard: () => unknown;
  deleteCanvasItem: (tabId: string, itemId: string) => void;
  deleteCanvasMindMapBranch: (tabId: string, pane: PaneKey, nodeId: string) => void;
  undo: () => void;
  redo: () => void;
};

export function useAppShortcuts({
  activeTab,
  settings,
  quickOpenOpen,
  searchOpen,
  settingsOpen,
  searchScope,
  canvasPluginEnabled,
  selectedItem,
  selectedMindMapNode,
  canUndoFile,
  canRedoFile,
  closeQuickOpen,
  closeSearch,
  setQuickOpenOpen,
  toggleSidebar,
  toggleTabLayout,
  updateFileFontSize,
  addCanvasTab,
  addTextTab,
  closeCurrentTab,
  saveCurrentTab,
  openSearch,
  focusSiblingTab,
  autoSplitTab,
  pasteFromClipboard,
  deleteCanvasItem,
  deleteCanvasMindMapBranch,
  undo,
  redo,
}: AppShortcutsOptions) {
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
      const undoFileAvailable = canUndoFile();
      const redoFileAvailable = canRedoFile();

      if (shortcutMatches(event, settings.shortcuts.quickOpen)) {
        event.preventDefault();
        closeSearch();
        setQuickOpenOpen(true);
        window.setTimeout(() => document.getElementById("quick-open-input")?.focus(), 0);
      } else if (quickOpenOpen) {
        return;
      } else if (!searchOpen && !settingsOpen && settings.tabLayout === "left" && shortcutMatches(event, settings.shortcuts.toggleSidebar)) {
        event.preventDefault();
        toggleSidebar();
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
      } else if ((!isTyping || undoFileAvailable) && shortcutMatches(event, settings.shortcuts.undo)) {
        event.preventDefault();
        undo();
      } else if ((!isTyping || redoFileAvailable) && (shortcutMatches(event, settings.shortcuts.redo) || shortcutMatches(event, settings.shortcuts.redoAlt))) {
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
      canUndoFile,
      canRedoFile,
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
      toggleSidebar,
      toggleTabLayout,
      undo,
      updateFileFontSize,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);
}
