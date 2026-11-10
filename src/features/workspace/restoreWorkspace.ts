import type { CanvasViewState, NoteTab, PaneKey, PersistedWorkspace } from "../../appTypes";
import { restoreTab } from "../tabs/tabDocument";
import { sortPinnedTabs } from "../tabs/tabOrder";
import { normalizePaneWidths } from "./paneWidths";
import { normalizeRecentFiles } from "./workspaceUtils";

type PaneLayout = {
  activePane: PaneKey;
  paneIds: PaneKey[];
  paneWidths: number[];
  paneActiveTabIds: Record<PaneKey, string>;
  tabPaneIds: Record<string, PaneKey[]>;
  canvasViewStates: Record<string, Partial<Record<PaneKey, CanvasViewState>>>;
};

function restoreModernLayout(workspace: PersistedWorkspace, tabs: NoteTab[], savedPanes: PaneKey[]): PaneLayout {
  const validPanes = new Set(savedPanes);
  const firstTabByPane = new Map<PaneKey, string>();
  const tabPaneIds = Object.fromEntries(tabs.map((tab) => {
    const saved = workspace.tabPaneIds?.[tab.id];
    const panes = Array.isArray(saved) ? [...new Set(saved.filter((pane) => validPanes.has(pane)))] : [];
    if (panes.length === 0) panes.push(savedPanes[0]);
    for (const pane of panes) {
      if (!firstTabByPane.has(pane)) firstTabByPane.set(pane, tab.id);
    }
    return [tab.id, panes];
  }));
  const paneIds = savedPanes.filter((pane) => firstTabByPane.has(pane));
  const paneActiveTabIds = Object.fromEntries(paneIds.map((pane) => {
    const preferred = workspace.paneActiveTabIds?.[pane];
    const preferredPanes = preferred ? tabPaneIds[preferred] : undefined;
    return [pane, preferred && Array.isArray(preferredPanes) && preferredPanes.includes(pane) ? preferred : firstTabByPane.get(pane)!];
  }));
  return {
    paneIds,
    activePane: workspace.activePane && paneIds.includes(workspace.activePane) ? workspace.activePane : paneIds[0],
    paneWidths: normalizePaneWidths(workspace.paneWidths ?? [], paneIds.length),
    paneActiveTabIds,
    tabPaneIds,
    canvasViewStates: workspace.canvasViewStates ?? {},
  };
}

function restoreLegacyLayout(workspace: PersistedWorkspace, tabs: NoteTab[]): PaneLayout {
  const left = "pane-left";
  const right = "pane-right";
  const hasRightPane = Boolean(workspace.splitView || workspace.splitTabId ||
    Object.values(workspace.tabPlacements ?? {}).some((placement) => placement === "right" || placement === "both"));
  const tabPaneIds = Object.fromEntries(tabs.map((tab) => {
    const placement = workspace.tabPlacements?.[tab.id] ?? (workspace.splitTabId === tab.id ? "both" : "left");
    const panes = hasRightPane && placement === "both" ? [left, right] : [hasRightPane && placement === "right" ? right : left];
    return [tab.id, panes];
  }));
  const activeIn = (pane: PaneKey, preferred?: string | null) => {
    const preferredPanes = preferred ? tabPaneIds[preferred] : undefined;
    return preferred && Array.isArray(preferredPanes) && preferredPanes.includes(pane)
      ? preferred
      : tabs.find((tab) => tabPaneIds[tab.id].includes(pane))?.id;
  };
  const paneActiveTabIds: Record<PaneKey, string> = { [left]: activeIn(left, workspace.leftActiveTabId) ?? tabs[0].id };
  if (hasRightPane) paneActiveTabIds[right] = activeIn(right, workspace.rightActiveTabId) ?? paneActiveTabIds[left];
  const leftWidth = Math.min(88, Math.max(12, workspace.splitRatio ?? 50));

  return {
    activePane: hasRightPane && workspace.activePane === "right" ? right : left,
    paneIds: hasRightPane ? [left, right] : [left],
    paneWidths: hasRightPane ? [leftWidth, 100 - leftWidth] : [100],
    paneActiveTabIds,
    tabPaneIds,
    canvasViewStates: Object.fromEntries(Object.entries(workspace.canvasViewStates ?? {}).map(([tabId, states]) => [tabId, {
      ...(states.left ? { [left]: states.left } : {}),
      ...(hasRightPane && states.right ? { [right]: states.right } : {}),
    }])),
  };
}

export function restoreWorkspace(workspace: PersistedWorkspace, initialPane: PaneKey) {
  const tabs = sortPinnedTabs(workspace.tabs.map(restoreTab));
  const recentFiles = normalizeRecentFiles(workspace.recentFiles);
  const savedPanes = workspace.version >= 4 && Array.isArray(workspace.paneIds)
    ? [...new Set(workspace.paneIds.filter((pane) => typeof pane === "string" && pane.length > 0))]
    : [];

  if (tabs.length === 0) {
    const activePane = workspace.activePane && savedPanes.includes(workspace.activePane) ? workspace.activePane : savedPanes[0] ?? initialPane;
    const emptyLayout: PaneLayout = { activePane, paneIds: [activePane], paneWidths: [100], paneActiveTabIds: {}, tabPaneIds: {}, canvasViewStates: {} };
    return { tabs, recentFiles, ...emptyLayout };
  }

  const layout = savedPanes.length > 0 ? restoreModernLayout(workspace, tabs, savedPanes) : restoreLegacyLayout(workspace, tabs);
  return { tabs, recentFiles, ...layout };
}
