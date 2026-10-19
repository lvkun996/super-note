import { lazy, Suspense, useCallback } from "react";
import type { RefObject } from "react";
import type { InputRef } from "antd";
import { uiText } from "../../../electron/uiLanguage";
import type { AppSettings, CanvasViewState, NoteTab, PaneKey, SelectedItem } from "../../appTypes";
import type { AppFeedback, StateSetter } from "../workspace/controllerTypes";
import { neutralConfirmDialog } from "../overlays/dialogPresets";
import { writeClipboardText } from "../editor/editorUtils";
import { getTabDisplayTitle } from "./tabTitle";
import { isTabEmpty } from "./tabDocument";
import { rememberTabVisit, removeTabVisit, resolveTabAfterClose } from "./tabHistory";
import { reorderTabsById, toggleTabPinned } from "./tabOrder";
import type { TabDropPosition } from "./tabOrder";

const LazyRenameTabInput = lazy(() => import("../../components/RenameTabInput").then(({ RenameTabInput }) => ({ default: RenameTabInput })));
type TabActionsOptions = {
  tabs: NoteTab[];
  tabsRef: RefObject<NoteTab[]>;
  setTabs: StateSetter<NoteTab[]>;
  paneIds: PaneKey[];
  setPaneIds: StateSetter<PaneKey[]>;
  activePane: PaneKey;
  setActivePane: StateSetter<PaneKey>;
  activeTab: NoteTab | null | undefined;
  tabPaneIds: Record<string, PaneKey[]>;
  setTabPaneIds: StateSetter<Record<string, PaneKey[]>>;
  paneTabs: Record<PaneKey, NoteTab[]>;
  setPaneActiveTabIds: StateSetter<Record<PaneKey, string>>;
  setPaneWidths: StateSetter<number[]>;
  setCanvasViewStates: StateSetter<Record<string, Partial<Record<PaneKey, CanvasViewState>>>>;
  selectedItem: SelectedItem;
  setSelectedItem: StateSetter<SelectedItem>;
  paneTabHistoryRef: RefObject<Record<PaneKey, string[]>>;
  getTabPanes: (tabId: string) => PaneKey[];
  clearFileHistory: (tabId: string) => void;
  settings: AppSettings;
  modal: AppFeedback["modal"];
  message: AppFeedback["message"];
};

export function useTabActions({
  tabs,
  tabsRef,
  setTabs,
  paneIds,
  setPaneIds,
  activePane,
  setActivePane,
  activeTab,
  tabPaneIds,
  setTabPaneIds,
  paneTabs,
  setPaneActiveTabIds,
  setPaneWidths,
  setCanvasViewStates,
  selectedItem,
  setSelectedItem,
  paneTabHistoryRef,
  getTabPanes,
  clearFileHistory,
  settings,
  modal,
  message,
}: TabActionsOptions) {
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
    let inputRef: InputRef | null = null;
    modal.confirm({
      ...neutralConfirmDialog,
      title: uiText("重命名标签"),
      content: <div className="rename-dialog"><p>{uiText("保持简短且易于识别")}</p><Suspense fallback={<span />}><LazyRenameTabInput inputRef={(node) => { inputRef = node; }} defaultValue={nextTitle} onChange={(value) => { nextTitle = value; }} /></Suspense></div>,
      afterOpenChange: (open) => {
        if (open) window.requestAnimationFrame(() => inputRef?.focus({ cursor: "all" }));
      },
      okText: uiText("保存"),
      cancelText: uiText("取消"),
      onOk: () => {
        const title = nextTitle.trim();
        if (!title) return Promise.reject(new Error(uiText("栏目名称不能为空")));
        setTabs((current) => current.map((item) => item.id === tabId ? { ...item, title, ...(item.kind === "canvas" ? { autoTitle: false } : {}) } : item));
      },
    });
  }, [modal]);

  const openTabInExplorer = useCallback((tabId: string) => {
    const filePath = tabsRef.current.find((tab) => tab.id === tabId)?.filePath;
    if (filePath) void window.superNote?.showItemInFolder(filePath);
  }, []);

  const copyTabAbsolutePath = useCallback(async (tabId: string) => {
    const filePath = tabsRef.current.find((tab) => tab.id === tabId)?.filePath;
    if (!filePath) return;
    await writeClipboardText(filePath);
    message.success(uiText("已复制文件绝对地址"));
  }, [message]);

  const copyTabRelativePath = useCallback(async (tabId: string) => {
    const filePath = tabsRef.current.find((tab) => tab.id === tabId)?.filePath;
    if (!filePath) return;
    const result = await window.superNote?.getRelativeFilePath(filePath, settings.defaultSaveDirectory || undefined);
    if (!result?.ok || !result.path) return;
    await writeClipboardText(result.path);
    message.success(uiText("已复制文件相对地址"));
  }, [message, settings.defaultSaveDirectory]);

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
        clearFileHistory(targetId);
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
        ...neutralConfirmDialog,
        title: uiText("当前标签还没有保存"),
        content: uiText("是否关闭？未保存的修改会丢失。"),
        okText: uiText("关闭"),
        cancelText: uiText("取消"),
        okButtonProps: { danger: true },
        onOk: doClose,
      });
    },
    [activePane, clearFileHistory, getTabPanes, modal, paneIds, paneTabs, selectedItem, tabs],
  );

  const closeCurrentTab = useCallback(() => {
    if (activeTab) {
      closeTab(activeTab.id, activePane);
    }
  }, [activePane, activeTab, closeTab]);

  return { reorderTab, pinTab, renameTab, openTabInExplorer, copyTabAbsolutePath, copyTabRelativePath, closeTab, closeCurrentTab };
}
