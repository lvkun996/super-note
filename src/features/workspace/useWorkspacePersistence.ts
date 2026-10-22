import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { uiText, getUiLanguage, setUiLanguage } from "../../../electron/uiLanguage";
import type { AppSettings, NoteTab, PersistedWorkspace } from "../../appTypes";
import type { AppFeedback, StateSetter } from "./controllerTypes";
import { stripTab } from "../tabs/tabDocument";
import { CURRENT_WORKSPACE_VERSION } from "./workspaceUtils";
import { createCoalescingQueue } from "./coalescingQueue";

export const STORAGE_KEY = "super-note-workspace";
const WORKSPACE_SAVE_DEBOUNCE_MS = 600;
type WorkspaceState = Omit<PersistedWorkspace, "version" | "savedAt" | "tabs" | "settings"> & { tabs: NoteTab[]; settings: AppSettings };
type WorkspacePersistenceOptions = WorkspaceState & {
  message: AppFeedback["message"];
  workspaceLoaded: boolean;
  workspaceLoadedRef: RefObject<boolean>;
  setSettings: StateSetter<AppSettings>;
};

export function useWorkspacePersistence({
  activePane,
  activeTabId,
  canvasViewStates,
  paneActiveTabIds,
  paneIds,
  paneWidths,
  recentFiles,
  settings,
  splitView,
  tabPaneIds,
  tabs,
  message,
  workspaceLoaded,
  workspaceLoadedRef,
  setSettings,
}: WorkspacePersistenceOptions) {
  const saveTimerRef = useRef<number | null>(null);
  const workspaceSaveErrorRef = useRef("");
  const savedTabsRef = useRef(new Map<string, NoteTab>());
  const saveQueueRef = useRef<ReturnType<typeof createCoalescingQueue<boolean>> | null>(null);
  if (!saveQueueRef.current) saveQueueRef.current = createCoalescingQueue<boolean>();
  const persistWorkspace = useCallback(async () => {
    const save = async () => {
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
        tabs: window.superNote?.saveWorkspaceDelta ? [] : tabs.map(stripTab),
      };

      if (window.superNote) {
        try {
          const { tabs: _tabs, ...metadata } = workspace;
          const result = window.superNote.saveWorkspaceDelta
            ? await window.superNote.saveWorkspaceDelta({
              metadata, tabIds: tabs.map(tab => tab.id),
              changedTabs: tabs.filter(tab => savedTabsRef.current.get(tab.id) !== tab).map(stripTab),
            })
            : await window.superNote.saveWorkspace(workspace);
          if (!result.ok) {
            throw new Error(result.error ?? uiText("工作区保存失败"));
          }
          workspaceSaveErrorRef.current = "";
          savedTabsRef.current = new Map(tabs.map(tab => [tab.id, tab]));
        } catch (error) {
          const detail = String(error);
          if (workspaceSaveErrorRef.current !== detail) {
            workspaceSaveErrorRef.current = detail;
            message.error(uiText("自动保存失败：{0}", [detail]));
          }
          return false;
        }
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      }
      return true;
    };
    return saveQueueRef.current!(save);
  }, [activePane, activeTabId, canvasViewStates, message, paneActiveTabIds, paneIds, paneWidths, recentFiles, settings, splitView, tabPaneIds, tabs]);
  const persistWorkspaceRef = useRef(persistWorkspace);
  persistWorkspaceRef.current = persistWorkspace;

  const languageReloadRef = useRef(false);
  useEffect(() => {
    if (!workspaceLoaded || languageReloadRef.current) return;
    if (settings.language === getUiLanguage()) {
      void window.superNote?.setLanguage(settings.language);
      return;
    }
    languageReloadRef.current = true;
    void persistWorkspaceRef.current().then(async (saved) => {
      if (!saved) {
        languageReloadRef.current = false;
        setSettings((current) => ({ ...current, language: getUiLanguage() }));
        return;
      }
      await window.superNote?.setLanguage(settings.language);
      setUiLanguage(settings.language);
      window.location.reload();
    }).catch(() => {
      languageReloadRef.current = false;
      setSettings((current) => ({ ...current, language: getUiLanguage() }));
      message.error(uiText("语言切换失败，请重试"));
    });
  }, [settings.language, workspaceLoaded, message]);

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

  useEffect(() => {
    if (!workspaceLoaded) {
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => void persistWorkspace(), WORKSPACE_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [persistWorkspace, workspaceLoaded]);
  return { persistWorkspace, persistWorkspaceRef };
}
