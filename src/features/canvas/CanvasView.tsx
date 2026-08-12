import {
  ApartmentOutlined,
  BgColorsOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  HighlightOutlined,
  PlusOutlined,
  ScissorOutlined,
  SearchOutlined,
  SnippetsOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type {
  CanvasItem,
  CanvasTab,
  CanvasViewState,
  ImageCanvasItem,
  PaneKey,
  ProgrammerAction,
  SelectedItem,
  TextCanvasItem,
  TextSelection,
} from "../../appTypes";
import { MindMapLayer } from "../mindmap/MindMapLayer";
import { MindMapRelationsLayer } from "../mindmap/MindMapRelationsLayer";
import {
  resolveMindMapCanvasLinkAnchors,
  type ResolvedMindMapRelationAnchors,
} from "../mindmap/mindMapRelations";
import type { MindMapCanvasLink, SelectedMindMapNode } from "../mindmap/mindMapTypes";
import {
  continueOrderedList,
  findHttpUrlAtOffset,
  getTextSelection,
  openExternalUrl,
  readClipboardText,
  renderTextWithLinks,
  writeClipboardText,
} from "../editor/editorUtils";
import { getItemLayout, getPointOnCanvas } from "./canvasUtils";
import { CANVAS_ITEM_DRAG_END_EVENT, CANVAS_ITEM_DRAG_EVENT, type LiveCanvasItemDrag } from "./canvasLiveDrag";

type CanvasTextEditorProps = {
  item: TextCanvasItem;
  pane: PaneKey;
  matched: boolean;
  handwritten: boolean;
  style: CSSProperties;
  onTextChange: (text: string) => void;
  onTextCommit: (size: { width: number; height: number }, text: string) => void;
};

function CanvasTextEditor({
  item,
  pane,
  matched,
  handwritten,
  style,
  onTextChange,
  onTextCommit,
}: CanvasTextEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const hasSelection = selection.end > selection.start;

  const syncSelection = (editor: HTMLTextAreaElement) => setSelection(getTextSelection(editor));

  const resizeEditor = (editor: HTMLTextAreaElement) => {
    editor.style.height = "0px";
    editor.style.height = `${Math.max(48, editor.scrollHeight + 2)}px`;
  };

  const commitEditor = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    onTextCommit(
      { width: editor.offsetWidth, height: Math.max(48, editor.scrollHeight + 2) },
      editor.value,
    );
  };

  const replaceSelection = (insertion: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = getTextSelection(editor);
    const nextText = `${editor.value.slice(0, current.start)}${insertion}${editor.value.slice(current.end)}`;
    const nextCaret = current.start + insertion.length;
    onTextChange(nextText);
    setSelection({ start: nextCaret, end: nextCaret });
    window.requestAnimationFrame(() => {
      const currentEditor = editorRef.current;
      if (!currentEditor) {
        return;
      }
      resizeEditor(currentEditor);
      currentEditor.focus({ preventScroll: true });
      currentEditor.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const copySelection = async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = getTextSelection(editor);
    if (current.end > current.start) {
      await writeClipboardText(editor.value.slice(current.start, current.end));
    }
  };

  const contextMenuItems: MenuProps["items"] = [
    {
      key: "cut",
      label: "剪切",
      icon: <ScissorOutlined />,
      disabled: !hasSelection,
      onClick: () => {
        void copySelection().then(() => replaceSelection(""));
      },
    },
    {
      key: "paste",
      label: "粘贴",
      icon: <SnippetsOutlined />,
      onClick: () => void readClipboardText().then((text) => text && replaceSelection(text)),
    },
    {
      key: "copy",
      label: "复制",
      icon: <CopyOutlined />,
      disabled: !hasSelection,
      onClick: () => void copySelection(),
    },
  ];

  return (
    <Dropdown
      menu={{ items: contextMenuItems }}
      trigger={["contextMenu"]}
      onOpenChange={(open) => {
        setContextMenuOpen(open);
        if (!open && document.activeElement !== editorRef.current) {
          window.setTimeout(commitEditor, 0);
        }
      }}
    >
      <textarea
        ref={(editor) => {
          editorRef.current = editor;
          if (editor) {
            resizeEditor(editor);
          }
        }}
        id={`text-${pane}-${item.id}`}
        data-item-id={item.id}
        className={`${matched ? "text-note-editor matched" : "text-note-editor"}${handwritten ? " handwritten" : ""}`}
        style={style}
        value={item.text}
        placeholder="输入文字"
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => {
          syncSelection(event.currentTarget);
          if (event.ctrlKey) {
            const url = findHttpUrlAtOffset(event.currentTarget.value, event.currentTarget.selectionStart);
            if (url) {
              event.preventDefault();
              void openExternalUrl(url);
            }
          }
        }}
        onSelect={(event) => syncSelection(event.currentTarget)}
        onKeyUp={(event) => syncSelection(event.currentTarget)}
        onContextMenu={(event) => syncSelection(event.currentTarget)}
        onKeyDown={(event) => continueOrderedList(event, onTextChange)}
        onChange={(event) => {
          resizeEditor(event.currentTarget);
          onTextChange(event.target.value);
        }}
        onBlur={() => {
          if (!contextMenuOpen) {
            window.setTimeout(commitEditor, 0);
          }
        }}
      />
    </Dropdown>
  );
}

type CanvasViewProps = {
  tab: CanvasTab;
  pane: PaneKey;
  viewState: CanvasViewState;
  editingTextId: string | null;
  selectedItem: SelectedItem;
  selectedMindMapNode: SelectedMindMapNode;
  searchValue: string;
  activeSearchItemId: string | null;
  handwritten: boolean;
  programmerMode: boolean;
  accent: string;
  onDoubleClick: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: ReactMouseEvent<HTMLDivElement>) => void;
  onWheel: (tab: CanvasTab, pane: PaneKey, event: React.WheelEvent<HTMLDivElement>) => void;
  onDrop: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.DragEvent<HTMLDivElement>) => void;
  onSurfaceMouseDown: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: ReactMouseEvent<HTMLDivElement>) => void;
  onPointChange: (point: { x: number; y: number }) => void;
  onTextChange: (itemId: string, text: string) => void;
  onTextCommit: (item: TextCanvasItem, size: { width: number; height: number }, text: string) => void;
  onTextDoubleClick: (item: TextCanvasItem, event: ReactMouseEvent<HTMLDivElement>) => void;
  onItemMouseDown: (item: CanvasItem, event: React.MouseEvent<HTMLElement>) => void;
  onItemContextMenu: (item: CanvasItem) => void;
  onDeleteItem: (item: CanvasItem) => void;
  onEditItem: (item: CanvasItem) => void;
  onPreviewImage: (item: ImageCanvasItem) => void;
  onProgrammerAction: (item: CanvasItem, action: ProgrammerAction) => void;
  onCreateMindMap: (point: { x: number; y: number }) => void;
  onRemoveMindMap: () => void;
  onSelectMindMapNode: (nodeId: string) => void;
  onAddMindMapChild: (nodeId: string) => string | null;
  onAddMindMapSibling: (nodeId: string) => string | null;
  onDeleteMindMapBranch: (nodeId: string) => void;
  onToggleMindMapNode: (nodeId: string) => void;
  onChangeMindMapText: (nodeId: string, text: string) => void;
  onMoveMindMapNode: (nodeId: string, targetNodeId: string, placement: "before" | "after" | "child") => void;
  onCreateMindMapCanvasLink: (nodeId: string, itemId: string, anchors: ResolvedMindMapRelationAnchors) => void;
  onUpdateMindMapCanvasLink: (linkId: string, patch: Partial<Pick<MindMapCanvasLink, "nodeAnchor" | "itemAnchor">>) => void;
  onDeleteMindMapCanvasLink: (linkId: string) => void;
  onOpenMindMapStyle: () => void;
  onExportImage: () => void;
};

export function CanvasView({
  tab,
  pane,
  viewState,
  editingTextId,
  selectedItem,
  selectedMindMapNode,
  searchValue,
  activeSearchItemId,
  handwritten,
  programmerMode,
  accent,
  onDoubleClick,
  onWheel,
  onDrop,
  onSurfaceMouseDown,
  onPointChange,
  onTextChange,
  onTextCommit,
  onTextDoubleClick,
  onItemMouseDown,
  onItemContextMenu,
  onDeleteItem,
  onEditItem,
  onPreviewImage,
  onProgrammerAction,
  onCreateMindMap,
  onRemoveMindMap,
  onSelectMindMapNode,
  onAddMindMapChild,
  onAddMindMapSibling,
  onDeleteMindMapBranch,
  onToggleMindMapNode,
  onChangeMindMapText,
  onMoveMindMapNode,
  onCreateMindMapCanvasLink,
  onUpdateMindMapCanvasLink,
  onDeleteMindMapCanvasLink,
  onOpenMindMapStyle,
  onExportImage,
}: CanvasViewProps) {
  const needle = searchValue.trim().toLowerCase();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [mindMapEditRequestId, setMindMapEditRequestId] = useState<string | null>(null);
  const [relationToolActive, setRelationToolActive] = useState(false);
  const [relationSourceNodeId, setRelationSourceNodeId] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [liveItemDrag, setLiveItemDrag] = useState<LiveCanvasItemDrag | null>(null);
  const [frozenRelationAnchors, setFrozenRelationAnchors] = useState<Record<string, ResolvedMindMapRelationAnchors>>({});
  const selectedNodeId = selectedMindMapNode?.tabId === tab.id && selectedMindMapNode.pane === pane
    ? selectedMindMapNode.nodeId
    : null;
  const rootNodeId = tab.mindMap?.rootId;
  const selectedRelation = tab.mindMap?.canvasLinks.find((link) => link.id === selectedRelationId) ?? null;
  const relationViewState = useMemo<CanvasViewState>(() => {
    if (!liveItemDrag || liveItemDrag.tabId !== tab.id || liveItemDrag.pane !== pane) {
      return viewState;
    }
    return {
      ...viewState,
      itemOverrides: {
        ...viewState.itemOverrides,
        [liveItemDrag.itemId]: {
          ...viewState.itemOverrides[liveItemDrag.itemId],
          x: liveItemDrag.x,
          y: liveItemDrag.y,
        },
      },
    };
  }, [liveItemDrag, pane, tab.id, viewState]);
  const relationDocument = useMemo(() => {
    if (!tab.mindMap || !liveItemDrag || Object.keys(frozenRelationAnchors).length === 0) {
      return tab.mindMap;
    }
    return {
      ...tab.mindMap,
      canvasLinks: tab.mindMap.canvasLinks.map((link) => {
        const frozen = frozenRelationAnchors[link.id];
        if (!frozen) {
          return link;
        }
        return {
          ...link,
          nodeAnchor: link.nodeAnchor === "auto" ? frozen.nodeAnchor : link.nodeAnchor,
          itemAnchor: link.itemAnchor === "auto" ? frozen.itemAnchor : link.itemAnchor,
        };
      }),
    };
  }, [frozenRelationAnchors, liveItemDrag, tab.mindMap]);

  useEffect(() => {
    const handleDrag = (event: Event) => {
      const detail = (event as CustomEvent<LiveCanvasItemDrag>).detail;
      if (detail.tabId !== tab.id || detail.pane !== pane) {
        return;
      }
      if (detail.phase === "start" && tab.mindMap) {
        const frozen = Object.fromEntries(tab.mindMap.canvasLinks
          .filter((link) => link.itemId === detail.itemId)
          .flatMap((link) => {
            const anchors = resolveMindMapCanvasLinkAnchors(tab.mindMap!, tab.items, viewState, link);
            return anchors ? [[link.id, anchors] as const] : [];
          }));
        setFrozenRelationAnchors(frozen);
      }
      setLiveItemDrag(detail);
    };
    const handleDragEnd = (event: Event) => {
      const detail = (event as CustomEvent<Pick<LiveCanvasItemDrag, "tabId" | "pane" | "itemId">>).detail;
      if (detail.tabId !== tab.id || detail.pane !== pane) {
        return;
      }
      setLiveItemDrag(null);
      setFrozenRelationAnchors({});
    };
    window.addEventListener(CANVAS_ITEM_DRAG_EVENT, handleDrag);
    window.addEventListener(CANVAS_ITEM_DRAG_END_EVENT, handleDragEnd);
    return () => {
      window.removeEventListener(CANVAS_ITEM_DRAG_EVENT, handleDrag);
      window.removeEventListener(CANVAS_ITEM_DRAG_END_EVENT, handleDragEnd);
    };
  }, [pane, tab.id, tab.items, tab.mindMap, viewState]);

  useEffect(() => {
    if (!selectedRelation) {
      return;
    }
    const handleDelete = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Delete" || target?.closest("input, textarea, [contenteditable='true']")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onDeleteMindMapCanvasLink(selectedRelation.id);
      setSelectedRelationId(null);
    };
    window.addEventListener("keydown", handleDelete, true);
    return () => window.removeEventListener("keydown", handleDelete, true);
  }, [onDeleteMindMapCanvasLink, selectedRelation]);

  const linkCanvasItem = (itemId: string) => {
    if (!relationToolActive) {
      return false;
    }
    if (relationSourceNodeId) {
      const mindMap = tab.mindMap;
      if (!mindMap) {
        return true;
      }
      const anchors = resolveMindMapCanvasLinkAnchors(mindMap, tab.items, viewState, {
        id: "preview-link",
        nodeId: relationSourceNodeId,
        itemId,
        nodeAnchor: "auto",
        itemAnchor: "auto",
      });
      if (anchors) {
        onCreateMindMapCanvasLink(relationSourceNodeId, itemId, anchors);
      }
      setRelationToolActive(false);
      setRelationSourceNodeId(null);
    }
    return true;
  };

  const getViewportCenter = () => {
    const viewport = viewportRef.current;
    const surface = viewport?.querySelector<HTMLDivElement>(".canvas-surface") ?? null;
    const rect = viewport?.getBoundingClientRect();
    return rect
      ? getPointOnCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2, surface, viewState.scale)
      : { x: 640, y: 420 };
  };

  const makeItemMenu = (item: CanvasItem): MenuProps["items"] => [
    {
      key: "edit",
      label: "编辑",
      icon: <EditOutlined />,
      onClick: () => onEditItem(item),
    },
    {
      key: "delete",
      label: "删除",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDeleteItem(item),
    },
    ...(item.type === "image"
      ? [
          {
            key: "preview",
            label: "预览",
            icon: <SearchOutlined />,
            onClick: () => onPreviewImage(item),
          },
        ]
      : []),
    ...(programmerMode && item.type === "text"
      ? [
          { type: "divider" as const },
          {
            key: "format-json",
            label: "转为 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "format-json"),
          },
          {
            key: "minify-json",
            label: "压缩 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "minify-json"),
          },
          {
            key: "string-to-json",
            label: "字符串转 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "string-to-json"),
          },
        ]
      : []),
  ];

  return (
    <div className="canvas-frame" style={{ ["--accent" as string]: accent }}>
      <div className="canvas-command-bar" onMouseDown={(event) => event.stopPropagation()}>
        {tab.mindMap ? (
          <>
            <Tooltip title="添加子主题（Tab）">
              <Button size="small" type="text" icon={<PlusOutlined />} disabled={!selectedNodeId} onClick={() => {
                if (selectedNodeId) {
                  setMindMapEditRequestId(onAddMindMapChild(selectedNodeId));
                }
              }}>子主题</Button>
            </Tooltip>
            <Tooltip title="添加同级主题（Enter）">
              <Button size="small" type="text" icon={<ApartmentOutlined />} disabled={!selectedNodeId} onClick={() => {
                if (selectedNodeId) {
                  setMindMapEditRequestId(onAddMindMapSibling(selectedNodeId));
                }
              }}>同级</Button>
            </Tooltip>
            <Tooltip title="删除所选主题及其分支（中心主题不可删除）">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={!selectedNodeId || selectedNodeId === rootNodeId} onClick={() => selectedNodeId && onDeleteMindMapBranch(selectedNodeId)} />
            </Tooltip>
            <span className="canvas-command-divider" />
            <Tooltip title="在独立窗口中配置结构、线条和配色">
              <Button size="small" type="text" icon={<BgColorsOutlined />} onClick={onOpenMindMapStyle}>样式</Button>
            </Tooltip>
            <Tooltip title={relationSourceNodeId ? "请选择需要关联的文字或图片" : "先选择子主题，再选择文字或图片"}>
              <Button
                size="small"
                type={relationToolActive ? "primary" : "text"}
                icon={<HighlightOutlined />}
                onClick={() => {
                  setRelationToolActive((active) => {
                    if (active) {
                      setRelationSourceNodeId(null);
                    }
                    return !active;
                  });
                  setSelectedRelationId(null);
                }}
              >关联</Button>
            </Tooltip>
            <Tooltip title="删除整张思维导图">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemoveMindMap}>导图</Button>
            </Tooltip>
          </>
        ) : (
          <Button size="small" type="text" icon={<ApartmentOutlined />} onClick={() => onCreateMindMap(getViewportCenter())}>新建思维导图</Button>
        )}
        <span className="canvas-command-divider" />
        <Tooltip title="按全部内容边界导出 2× PNG">
          <Button size="small" type="text" icon={<ExportOutlined />} onClick={onExportImage}>导出图片</Button>
        </Tooltip>
      </div>
      <div
        ref={viewportRef}
        data-tab-id={tab.id}
        data-pane={pane}
        className="canvas-viewport"
        style={{
          ["--canvas-pan-x" as string]: `${viewState.panX}px`,
          ["--canvas-pan-y" as string]: `${viewState.panY}px`,
        }}
        onWheel={(event) => onWheel(tab, pane, event)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(tab, pane, viewState, event)}
        onMouseMove={(event) => {
          const surface = event.currentTarget.querySelector<HTMLDivElement>(".canvas-surface");
          if (surface) {
            onPointChange(getPointOnCanvas(event.clientX, event.clientY, surface, viewState.scale));
          }
        }}
      >
        <div
          data-tab-id={tab.id}
          data-pane={pane}
          className="canvas-surface"
          style={{ transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.scale})` }}
          onDoubleClick={(event) => onDoubleClick(tab, pane, viewState, event)}
          onMouseDown={(event) => onSurfaceMouseDown(tab, pane, viewState, event)}
        >
          {tab.mindMap ? (
            <>
              <MindMapRelationsLayer
                document={relationDocument ?? tab.mindMap}
                items={tab.items}
                viewState={relationViewState}
                selectedLinkId={selectedRelationId}
                onSelectLink={(linkId) => {
                  setSelectedRelationId(linkId);
                  setRelationToolActive(false);
                  setRelationSourceNodeId(null);
                }}
                onUpdateLink={onUpdateMindMapCanvasLink}
                onDeleteLink={(linkId) => {
                  onDeleteMindMapCanvasLink(linkId);
                  setSelectedRelationId((current) => current === linkId ? null : current);
                }}
              />
              <MindMapLayer
                document={tab.mindMap}
                selectedNodeId={selectedNodeId}
                editRequestId={mindMapEditRequestId}
                onSelectNode={onSelectMindMapNode}
                onAddChild={onAddMindMapChild}
                onAddSibling={onAddMindMapSibling}
                onDeleteBranch={onDeleteMindMapBranch}
                onToggleNode={onToggleMindMapNode}
                onChangeText={onChangeMindMapText}
                onMoveNode={onMoveMindMapNode}
                linkMode={relationToolActive}
                linkSourceNodeId={relationSourceNodeId}
                onLinkNodeSelect={(nodeId) => {
                  setRelationSourceNodeId(nodeId);
                  setSelectedRelationId(null);
                }}
              />
            </>
          ) : null}
          {tab.items.map((item, index) => {
            const zIndex = index + 10;
            const layout = getItemLayout(item, viewState);
            const isSelected = selectedItem?.tabId === tab.id && selectedItem.itemId === item.id && selectedItem.pane === pane;
            const isSearchTarget = activeSearchItemId === item.id;
            if (item.type === "text") {
              const matched = Boolean(needle && item.text.toLowerCase().includes(needle));
              const fontSize = (layout as TextCanvasItem).fontSize;
              const editorStyle: CSSProperties = {
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                fontSize,
                zIndex,
              };
              const viewStyle: CSSProperties = {
                left: layout.x,
                top: layout.y,
                width: layout.width,
                minHeight: layout.height,
                fontSize,
                zIndex,
              };

              if (editingTextId === item.id) {
                return (
                  <CanvasTextEditor
                    key={item.id}
                    item={item}
                    pane={pane}
                    matched={matched}
                    handwritten={handwritten}
                    style={editorStyle}
                    onTextChange={(text) => onTextChange(item.id, text)}
                    onTextCommit={(size, text) => onTextCommit(item, size, text)}
                  />
                );
              }

              return (
                <Dropdown key={item.id} menu={{ items: makeItemMenu(item) }} trigger={["contextMenu"]}>
                  <div
                    data-item-id={item.id}
                    className={`${matched ? "text-note-view matched" : "text-note-view"}${isSelected ? " selected" : ""}${isSearchTarget ? " search-target" : ""}${relationToolActive && relationSourceNodeId ? " relation-target" : ""}`}
                    style={viewStyle}
                    onContextMenu={() => onItemContextMenu(item)}
                    onMouseDown={(event) => {
                      if (linkCanvasItem(item.id)) {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      const target = event.target as HTMLElement;
                      if (event.ctrlKey && target.closest("[data-http-url]")) {
                        event.stopPropagation();
                        return;
                      }
                      onItemMouseDown(item, event);
                    }}
                    onClick={(event) => {
                      if (!event.ctrlKey) {
                        return;
                      }
                      const link = (event.target as HTMLElement).closest<HTMLElement>("[data-http-url]");
                      const url = link?.dataset.httpUrl;
                      if (url) {
                        event.preventDefault();
                        event.stopPropagation();
                        void openExternalUrl(url);
                      }
                    }}
                    onDoubleClick={(event) => onTextDoubleClick(item, event)}
                  >
                    {item.text.trim() ? renderTextWithLinks(item.text, searchValue) : <span className="text-placeholder">双击编辑</span>}
                  </div>
                </Dropdown>
              );
            }

            return (
              <Dropdown key={item.id} menu={{ items: makeItemMenu(item) }} trigger={["contextMenu"]}>
                <div
                  data-item-id={item.id}
                  className={`image-note${isSelected ? " selected" : ""}${isSearchTarget ? " search-target" : ""}${relationToolActive && relationSourceNodeId ? " relation-target" : ""}`}
                  style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height, zIndex }}
                  onContextMenu={() => onItemContextMenu(item)}
                  onMouseDown={(event) => {
                    if (relationToolActive) {
                      event.preventDefault();
                      event.stopPropagation();
                      linkCanvasItem(item.id);
                      return;
                    }
                    onItemMouseDown(item, event);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onPreviewImage(item);
                  }}
                >
                  <img src={item.src} alt={item.name} draggable={false} />
                </div>
              </Dropdown>
            );
          })}
        </div>
      </div>
    </div>
  );
}
