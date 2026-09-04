import { uiText } from "../../../electron/uiLanguage";
import { BorderOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FolderOpenOutlined, PlusOutlined, SplitCellsOutlined, VerticalAlignTopOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tabs, Tooltip } from "antd";
import type { MenuProps, TabsProps } from "antd";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { PaneKey, TabLayout } from "../../appTypes";
import type { TabDropPosition } from "./tabOrder";

const TAB_ACCENTS = ["#1677ff", "#13c2c2", "#722ed1", "#fa8c16", "#eb2f96", "#52c41a"];

export type TabNavigationItem = {
  id: string;
  title: string;
  themeIndex: number;
  dirty: boolean;
  pinned?: boolean;
  filePath?: string;
};

type PointerDrag = {
  pointerId: number;
  tabId: string;
  sourcePane: PaneKey;
  startX: number;
  startY: number;
  dragging: boolean;
};

type DropIndicator = {
  pane: PaneKey;
  tabId: string;
  position: TabDropPosition;
} | null;

type TabNavigationProps = {
  layout: TabLayout;
  tabs: TabNavigationItem[];
  paneIds: PaneKey[];
  paneTabIds: Record<PaneKey, string[]>;
  paneActiveTabIds: Record<PaneKey, string>;
  activePane: PaneKey;
  splitView: boolean;
  canvasPluginEnabled: boolean;
  newCanvasShortcut: string;
  newTextShortcut: string;
  getTabPanes: (tabId: string) => PaneKey[];
  onFocusTab: (tabId: string, pane: PaneKey) => void;
  onCloseTab: (tabId: string, pane?: PaneKey) => void;
  onClosePane: (pane: PaneKey) => void;
  onSplitTab: (tabId: string, pane: PaneKey, direction: "left" | "right") => void;
  onMoveTabToPane: (tabId: string, sourcePane: PaneKey, targetPane: PaneKey) => void;
  onReorderTab: (movingId: string, targetId: string, position: TabDropPosition, pane?: PaneKey) => void;
  onPinTab: (tabId: string) => void;
  onRenameTab: (tabId: string) => void;
  onOpenTabInExplorer: (tabId: string) => void;
  onAddCanvas: () => void;
  onAddText: (pane?: PaneKey) => void;
  onStartSplitResize: (dividerIndex: number, event: MouseEvent<HTMLDivElement>) => void;
  onStartSidebarResize: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function getDropPosition(element: HTMLElement, clientX: number, clientY: number, layout: TabLayout): TabDropPosition {
  const rect = element.getBoundingClientRect();
  const pointer = layout === "left" ? clientY - rect.top : clientX - rect.left;
  const size = layout === "left" ? rect.height : rect.width;
  return pointer >= size / 2 ? "after" : "before";
}

function TabNavigationComponent({
  layout,
  tabs,
  paneIds,
  paneTabIds,
  paneActiveTabIds,
  activePane,
  splitView,
  canvasPluginEnabled,
  newCanvasShortcut,
  newTextShortcut,
  getTabPanes,
  onFocusTab,
  onCloseTab,
  onClosePane,
  onSplitTab,
  onMoveTabToPane,
  onReorderTab,
  onPinTab,
  onRenameTab,
  onOpenTabInExplorer,
  onAddCanvas,
  onAddText,
  onStartSplitResize,
  onStartSidebarResize,
}: TabNavigationProps) {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
  const pointerDragRef = useRef<PointerDrag | null>(null);
  const dropIndicatorRef = useRef<DropIndicator>(null);
  const suppressClickRef = useRef(false);

  const paneTabs = useMemo(() => {
    const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
    return Object.fromEntries(
      paneIds.map((pane) => [pane, (paneTabIds[pane] ?? []).flatMap((tabId) => tabById.get(tabId) ?? [])]),
    ) as Record<PaneKey, TabNavigationItem[]>;
  }, [paneIds, paneTabIds, tabs]);

  const finishDrag = useCallback(() => {
    pointerDragRef.current = null;
    dropIndicatorRef.current = null;
    setDraggedTabId(null);
    setDropIndicator(null);
  }, []);

  const beginPointerDrag = useCallback((event: ReactPointerEvent<HTMLElement>, tabId: string, sourcePane: PaneKey) => {
    if (event.button !== 0 || event.target instanceof Element && event.target.closest(".tab-close")) {
      return;
    }
    pointerDragRef.current = {
      pointerId: event.pointerId,
      tabId,
      sourcePane,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      if (!drag.dragging) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) {
          return;
        }
        drag.dragging = true;
        suppressClickRef.current = true;
        setDraggedTabId(drag.tabId);
      }

      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-tab-id]");
      const targetId = target?.dataset.tabId;
      if (!target || !targetId || targetId === drag.tabId) {
        dropIndicatorRef.current = null;
        setDropIndicator(null);
        return;
      }
      const pane = target.dataset.paneId ?? drag.sourcePane;
      const position = getDropPosition(target, event.clientX, event.clientY, layout);
      dropIndicatorRef.current = { pane, tabId: targetId, position };
      setDropIndicator((current) =>
        current?.pane === pane && current.tabId === targetId && current.position === position ? current : { pane, tabId: targetId, position },
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const target = dropIndicatorRef.current;
      finishDrag();
      if (drag.dragging && target && drag.tabId !== target.tabId) {
        if (layout === "top" && drag.sourcePane !== target.pane) {
          onMoveTabToPane(drag.tabId, drag.sourcePane, target.pane);
        } else {
          onReorderTab(drag.tabId, target.tabId, target.position, layout === "top" ? target.pane : undefined);
        }
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (pointerDragRef.current?.pointerId === event.pointerId) {
        suppressClickRef.current = false;
        finishDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [finishDrag, layout, onMoveTabToPane, onReorderTab]);

  const suppressDragClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  const makeContextMenu = useCallback((tabId: string, pane: PaneKey): MenuProps["items"] => {
    const tab = tabs.find((item) => item.id === tabId);
    const tabPanes = getTabPanes(tabId);
    return [
      { key: "pin", label: tab?.pinned ? uiText("取消置顶") : uiText("置顶"), icon: <VerticalAlignTopOutlined />, onClick: () => onPinTab(tabId) },
      { key: "delete", label: uiText("删除"), danger: true, icon: <DeleteOutlined />, onClick: () => onCloseTab(tabId) },
      { key: "rename", label: uiText("编辑"), icon: <EditOutlined />, onClick: () => onRenameTab(tabId) },
      {
        key: "explorer",
        label: uiText("在资源管理器打开"),
        icon: <FolderOpenOutlined />,
        disabled: !tab?.filePath,
        onClick: () => onOpenTabInExplorer(tabId),
      },
      ...(layout === "top" ? [{ type: "divider" as const }] : []),
      ...(layout === "top" ? [
      {
        key: "split-left",
        label: uiText("向左分割视图"),
        icon: <SplitCellsOutlined />,
        onClick: () => onSplitTab(tabId, pane, "left"),
      },
      {
        key: "split-right",
        label: uiText("向右分割视图"),
        icon: <SplitCellsOutlined />,
        onClick: () => onSplitTab(tabId, pane, "right"),
      },
      ...(tabPanes.length > 1
        ? [{ key: "cancel-split", label: uiText("从当前分栏移除"), icon: <CloseOutlined />, onClick: () => onCloseTab(tabId, pane) }]
        : []),
      ...(splitView
        ? [{ key: "close-split", label: uiText("关闭当前分栏"), icon: <CloseOutlined />, onClick: () => onClosePane(pane) }]
        : []),
      ] : []),
    ];
  }, [getTabPanes, layout, onClosePane, onCloseTab, onOpenTabInExplorer, onPinTab, onRenameTab, onSplitTab, splitView, tabs]);

  const renderCloseButton = (tab: TabNavigationItem, pane: PaneKey, isActive: boolean, closeGlobally = false) => (
    <button
      type="button"
      draggable={false}
      className={`tab-close${isActive ? " active" : ""}${tab.dirty ? " dirty" : ""}`}
      title={tab.dirty ? uiText("未保存，点击关闭") : uiText("关闭")}
      aria-label={uiText("关闭 {0}", [tab.title])}
      onClick={(event) => {
        event.stopPropagation();
        onCloseTab(tab.id, closeGlobally ? undefined : pane);
      }}
    >
      {isActive || tab.dirty ? (
        <>
          <span className="tab-status-dot" />
          <CloseOutlined className="tab-status-close" />
        </>
      ) : (
        <CloseOutlined />
      )}
    </button>
  );

  const renderTabLabel = (tab: TabNavigationItem, pane: PaneKey, isActive: boolean) => {
    const indicator = dropIndicator?.pane === pane && dropIndicator.tabId === tab.id ? ` tab-drop-${dropIndicator.position}` : "";
    return (
      <Dropdown overlayClassName="tab-context-menu" menu={{ items: makeContextMenu(tab.id, pane) }} trigger={["contextMenu"]}>
        <span
          data-tab-id={tab.id}
          data-pane-id={pane}
          className={`tab-label${draggedTabId === tab.id ? " dragging" : ""}${indicator}`}
          style={{ ["--tab-accent" as string]: TAB_ACCENTS[tab.themeIndex % TAB_ACCENTS.length] } as CSSProperties}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => beginPointerDrag(event, tab.id, pane)}
          onClick={suppressDragClick}
        >
          <span className="tab-title" title={tab.title}>{tab.title}</span>
          {renderCloseButton(tab, pane, isActive)}
        </span>
      </Dropdown>
    );
  };

  const renderTopZone = (pane: PaneKey, showAddButtons: boolean) => {
    const currentTabs = paneTabs[pane] ?? [];
    const items: TabsProps["items"] = currentTabs.map((tab) => ({
      key: tab.id,
      label: renderTabLabel(tab, pane, paneActiveTabIds[pane] === tab.id),
    }));

    return (
      <div
        key={pane}
        className="tab-pane-zone"
        data-pane-id={pane}
        onDoubleClick={(event) => {
          const target = event.target;
          if (target instanceof Element && !target.closest(".ant-tabs-tab, .ant-tabs-nav-more, .ant-tabs-nav-operations, .tab-close, button")) {
            onAddText(pane);
          }
        }}
      >
        <Tabs
          type="card"
          activeKey={paneActiveTabIds[pane]}
          items={items}
          onChange={(key) => onFocusTab(key, pane)}
          tabBarExtraContent={showAddButtons ? (
            <div className="tabs-extra-actions">
              {canvasPluginEnabled ? (
                <Tooltip title={uiText("新建画板 ({0})", [newCanvasShortcut])}>
                  <Button className="tabs-canvas-add-button" type="text" aria-label={uiText("新建画板")} icon={<BorderOutlined />} onClick={onAddCanvas} />
                </Tooltip>
              ) : null}
              <Tooltip title={uiText("新建文本模块 ({0})", [newTextShortcut])}>
                <Button className="tabs-add-button" type="text" aria-label={uiText("新建文本模块")} icon={<PlusOutlined />} onClick={() => onAddText()} />
              </Tooltip>
            </div>
          ) : null}
        />
      </div>
    );
  };

  if (layout === "left") {
    const activeId = paneActiveTabIds[activePane];
    return (
      <>
      <aside className="tabs-sidebar" data-tab-layout="left" aria-label={uiText("标签菜单")}>
        <div className="tabs-sidebar-header">
          <div className="tabs-sidebar-actions">
            {canvasPluginEnabled ? (
              <Tooltip title={uiText("新建画板 ({0})", [newCanvasShortcut])}>
                <Button type="text" size="small" aria-label={uiText("新建画板")} icon={<BorderOutlined />} onClick={onAddCanvas} />
              </Tooltip>
            ) : null}
            <Tooltip title={uiText("新建文本模块 ({0})", [newTextShortcut])}>
              <Button type="text" size="small" aria-label={uiText("新建文本模块")} icon={<PlusOutlined />} onClick={() => onAddText(activePane)} />
            </Tooltip>
          </div>
        </div>
        <div className="tabs-sidebar-list" role="tablist" aria-orientation="vertical" onDoubleClick={(event) => {
          if (event.target === event.currentTarget) {
            onAddText(activePane);
          }
        }}>
          {tabs.map((tab, index) => {
            const panes = getTabPanes(tab.id);
            const pane = panes.includes(activePane) ? activePane : panes[0] ?? activePane;
            const isActive = tab.id === activeId;
            const indicator = dropIndicator?.tabId === tab.id ? ` tab-drop-${dropIndicator.position}` : "";
            return (
              <Fragment key={tab.id}>
                {index === 0 && tab.pinned ? <div className="tabs-sidebar-group-label" role="presentation">{uiText("置顶")}</div> : null}
                {index > 0 && tabs[index - 1].pinned && !tab.pinned ? <div className="tabs-sidebar-group-label unpinned" role="presentation">{uiText("标签")}</div> : null}
                <Dropdown key={tab.id} overlayClassName="tab-context-menu" menu={{ items: makeContextMenu(tab.id, pane) }} trigger={["contextMenu"]}>
                <div
                  role="tab"
                  tabIndex={isActive ? 0 : -1}
                  aria-selected={isActive}
                  data-tab-id={tab.id}
                  data-pane-id={pane}
                  className={`tabs-sidebar-item${isActive ? " active" : ""}${draggedTabId === tab.id ? " dragging" : ""}${indicator}`}
                  style={{ ["--tab-accent" as string]: TAB_ACCENTS[tab.themeIndex % TAB_ACCENTS.length] } as CSSProperties}
                  onClick={(event) => {
                    if (suppressClickRef.current) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                    onFocusTab(tab.id, pane);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onFocusTab(tab.id, pane);
                    }
                  }}
                  onPointerDown={(event) => beginPointerDrag(event, tab.id, pane)}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span className="tab-title" title={tab.title}>{tab.title}</span>
                  {renderCloseButton(tab, pane, isActive, true)}
                </div>
                </Dropdown>
              </Fragment>
            );
          })}
        </div>
      </aside>
      <div
        className="tabs-sidebar-resizer"
        role="separator"
        aria-label={uiText("调整侧边栏宽度")}
        aria-orientation="vertical"
        onPointerDown={onStartSidebarResize}
      />
      </>
    );
  }

  return (
    <div className={`${splitView ? "tabs-bar multi-pane" : "tabs-bar"}${canvasPluginEnabled ? " canvas-plugin-enabled" : ""}`}>
      {paneIds.flatMap((pane, index) => [
        renderTopZone(pane, index === paneIds.length - 1),
        ...(index < paneIds.length - 1
          ? [<div key={`tab-divider-${pane}`} className="tabs-split-gap" title={uiText("长按后左右拖拽调整分栏宽度")} onMouseDown={(event) => onStartSplitResize(index, event)} />]
          : []),
      ])}
    </div>
  );
}

export const TabNavigation = memo(TabNavigationComponent);
