import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent, KeyboardEvent, MouseEvent } from "react";
import { getMindMapChildren } from "./mindMapModel";
import { getMindMapBranchPath, layoutMindMap } from "./mindMapLayout";
import type { MindMapDocument } from "./mindMapTypes";

type MindMapLayerProps = {
  document: MindMapDocument;
  selectedNodeId: string | null;
  editRequestId?: string | null;
  onSelectNode: (nodeId: string) => void;
  onAddChild: (nodeId: string) => string | null;
  onAddSibling: (nodeId: string) => string | null;
  onDeleteBranch: (nodeId: string) => void;
  onToggleNode: (nodeId: string) => void;
  onChangeText: (nodeId: string, text: string) => void;
  onMoveNode: (nodeId: string, targetNodeId: string, placement: "before" | "after" | "child") => void;
  linkMode: boolean;
  linkSourceNodeId: string | null;
  onLinkNodeSelect: (nodeId: string) => void;
};

export function MindMapLayer({
  document,
  selectedNodeId,
  editRequestId,
  onSelectNode,
  onAddChild,
  onAddSibling,
  onDeleteBranch,
  onToggleNode,
  onChangeText,
  onMoveNode,
  linkMode,
  linkSourceNodeId,
  onLinkNodeSelect,
}: MindMapLayerProps) {
  const layout = useMemo(() => layoutMindMap(document), [document]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ nodeId: string; placement: "before" | "after" | "child" } | null>(null);
  const handledEditRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!editRequestId || handledEditRequest.current === editRequestId) {
      return;
    }
    const node = document.nodes.find((candidate) => candidate.id === editRequestId);
    if (!node) {
      return;
    }
    handledEditRequest.current = editRequestId;
    setEditingId(editRequestId);
    setDraft(node.text);
  }, [document.nodes, editRequestId]);

  const beginEditing = (nodeId: string, initialText?: string) => {
    const node = document.nodes.find((candidate) => candidate.id === nodeId);
    setEditingId(nodeId);
    setDraft(initialText ?? node?.text ?? "主题");
  };

  const commitEditing = () => {
    if (!editingId) {
      return;
    }
    onChangeText(editingId, draft);
    setEditingId(null);
  };

  const addAndEdit = (mode: "child" | "sibling", nodeId: string) => {
    const nextId = mode === "child" ? onAddChild(nodeId) : onAddSibling(nodeId);
    if (nextId) {
      beginEditing(nextId, mode === "child" ? "子主题" : "同级主题");
    }
  };

  const handleNodeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, nodeId: string) => {
    if (event.key === "Tab") {
      event.preventDefault();
      addAndEdit("child", nodeId);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      addAndEdit("sibling", nodeId);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onDeleteBranch(nodeId);
      return;
    }
    if (event.key === "F2" || event.key === " ") {
      event.preventDefault();
      beginEditing(nodeId);
    }
  };

  const stopSurfaceEvent = (event: MouseEvent<HTMLElement>) => event.stopPropagation();

  const handleDragOver = (event: ReactDragEvent<HTMLElement>, targetNodeId: string) => {
    const dragged = document.nodes.find((node) => node.id === draggingNodeId);
    const target = document.nodes.find((node) => node.id === targetNodeId);
    if (!dragged || !target || dragged.id === target.id) {
      return;
    }
    let ancestorId = target.parentId;
    while (ancestorId) {
      if (ancestorId === dragged.id) {
        return;
      }
      ancestorId = document.nodes.find((node) => node.id === ancestorId)?.parentId ?? null;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / Math.max(1, rect.height);
    const placement = target.parentId === null
      ? "child"
      : relativeY < 0.25
        ? "before"
        : relativeY > 0.75
          ? "after"
          : "child";
    setDropTarget({ nodeId: targetNodeId, placement });
  };

  const fontFamilies = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Songti SC", "SimSun", serif',
    mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  } as const;

  return (
    <div className="mind-map-layer" aria-label="思维导图">
      <svg className="mind-map-connections" aria-hidden="true">
        {layout.edges.map((edge) => (
          <path
            key={edge.id}
            d={getMindMapBranchPath(edge, document.style.branchShape)}
            fill="none"
            stroke={edge.color}
            strokeWidth={document.style.branchWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      {layout.nodes.map((layoutNode) => {
        const { node } = layoutNode;
        const children = getMindMapChildren(document, node.id);
        const selected = selectedNodeId === node.id;
        const nodeStyle = {
          left: layoutNode.x,
          top: layoutNode.y,
          width: layoutNode.width,
          height: layoutNode.height,
          ["--mind-map-color" as string]: layoutNode.color,
          ["--mind-map-font-family" as string]: fontFamilies[document.style.fontFamily],
          ["--mind-map-font-scale" as string]: document.style.fontScale,
          ["--mind-map-font-weight" as string]: document.style.fontWeight,
          ["--mind-map-text-color" as string]: document.style.textColor,
        } satisfies CSSProperties;
        const dropPlacement = dropTarget?.nodeId === node.id ? dropTarget.placement : null;
        const linkSource = linkSourceNodeId === node.id;

        return (
          <div
            key={node.id}
            className={`mind-map-node-wrap side-${layoutNode.side}${dropPlacement ? ` drop-${dropPlacement}` : ""}`}
            style={nodeStyle}
            data-mind-map-node-id={node.id}
            onMouseDown={stopSurfaceEvent}
            onDragOver={(event) => handleDragOver(event, node.id)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropTarget((current) => current?.nodeId === node.id ? null : current);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (draggingNodeId && dropPlacement) {
                onMoveNode(draggingNodeId, node.id, dropPlacement);
              }
              setDraggingNodeId(null);
              setDropTarget(null);
            }}
          >
            {editingId === node.id ? (
              <input
                className={`mind-map-node mind-map-node-input level-${layoutNode.level} shape-${document.style.topicShape} fill-${document.style.topicFill} selected`}
                autoFocus
                value={draft}
                aria-label="编辑主题"
                onChange={(event) => setDraft(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={commitEditing}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitEditing();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setEditingId(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                draggable={!linkMode && node.id !== document.rootId}
                className={`mind-map-node level-${layoutNode.level} shape-${document.style.topicShape} fill-${document.style.topicFill}${selected ? " selected" : ""}${draggingNodeId === node.id ? " dragging" : ""}${linkMode ? " link-mode" : ""}${linkSource ? " link-source" : ""}`}
                title={linkMode ? (node.id === document.rootId ? "请选择子主题" : "设为内容关联起点") : `${node.text}\n拖到主题中部成为其子主题，拖到上下边缘调整顺序　Tab：子主题　Enter：同级主题　Delete：删除`}
                onMouseDown={(event) => {
                  stopSurfaceEvent(event);
                  if (!linkMode) {
                    onSelectNode(node.id);
                  }
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (linkMode) {
                    if (node.id !== document.rootId) {
                      onLinkNodeSelect(node.id);
                    }
                    return;
                  }
                  onSelectNode(node.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!linkMode) {
                    beginEditing(node.id);
                  }
                }}
                onKeyDown={(event) => handleNodeKeyDown(event, node.id)}
                onDragStart={(event) => {
                  event.stopPropagation();
                  setDraggingNodeId(node.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("application/x-super-note-mind-node", node.id);
                }}
                onDragEnd={() => {
                  setDraggingNodeId(null);
                  setDropTarget(null);
                }}
              >
                <span>{node.text}</span>
              </button>
            )}

            {children.length > 0 ? (
              <button
                type="button"
                className="mind-map-collapse-button"
                aria-label={node.collapsed ? "展开分支" : "折叠分支"}
                title={node.collapsed ? `展开 ${children.length} 个主题` : "折叠分支"}
                onMouseDown={stopSurfaceEvent}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleNode(node.id);
                }}
              >
                {node.collapsed ? <PlusOutlined /> : <MinusOutlined />}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
