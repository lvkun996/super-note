import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { CanvasItem, CanvasViewState } from "../../appTypes";
import type { MindMapCanvasLink, MindMapDocument, MindMapRelationAnchor } from "./mindMapTypes";
import {
  getMindMapCanvasLinkAnchorAtPoint,
  layoutMindMapCanvasRelations,
  type MindMapCanvasRelationLayout,
  type MindMapRelationEndpoint,
} from "./mindMapRelations";

type AnchorDrag = {
  linkId: string;
  endpoint: MindMapRelationEndpoint;
  anchor: Exclude<MindMapRelationAnchor, "auto"> | null;
  startClientX: number;
  startClientY: number;
  moved: boolean;
};

type MindMapRelationsLayerProps = {
  document: MindMapDocument;
  items: CanvasItem[];
  viewState: CanvasViewState;
  selectedLinkId: string | null;
  onSelectLink: (linkId: string) => void;
  onUpdateLink: (linkId: string, patch: Partial<Pick<MindMapCanvasLink, "nodeAnchor" | "itemAnchor">>) => void;
  onDeleteLink: (linkId: string) => void;
};

function distanceSquared(point: { x: number; y: number }, target: { x: number; y: number }) {
  return (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
}

export function MindMapRelationsLayer({
  document,
  items,
  viewState,
  selectedLinkId,
  onSelectLink,
  onUpdateLink,
  onDeleteLink,
}: MindMapRelationsLayerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<AnchorDrag | null>(null);
  const [anchorDrag, setAnchorDrag] = useState<AnchorDrag | null>(null);
  const [contextMenu, setContextMenu] = useState<{ linkId: string; x: number; y: number } | null>(null);
  const renderedDocument = useMemo(() => {
    const anchor = anchorDrag?.anchor;
    if (!anchorDrag || !anchor) {
      return document;
    }
    return {
      ...document,
      canvasLinks: document.canvasLinks.map((link) => link.id === anchorDrag.linkId ? {
        ...link,
        ...(anchorDrag.endpoint === "node" ? { nodeAnchor: anchor } : { itemAnchor: anchor }),
      } : link),
    };
  }, [anchorDrag, document]);
  const relations = useMemo(
    () => layoutMindMapCanvasRelations(renderedDocument, items, viewState),
    [items, renderedDocument, viewState],
  );

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) {
      return null;
    }
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const current = dragRef.current;
      if (!current) {
        return;
      }
      const moved = current.moved || Math.hypot(event.clientX - current.startClientX, event.clientY - current.startClientY) >= 6;
      if (!moved) {
        return;
      }
      const link = document.canvasLinks.find((candidate) => candidate.id === current.linkId);
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (!link || !point) {
        return;
      }
      const anchor = getMindMapCanvasLinkAnchorAtPoint(document, items, viewState, link, current.endpoint, point);
      if (!anchor) {
        return;
      }
      const next = { ...current, anchor, moved: true };
      dragRef.current = next;
      setAnchorDrag(next);
    };

    const handleMouseUp = () => {
      const current = dragRef.current;
      if (current?.moved && current.anchor) {
        onUpdateLink(current.linkId, current.endpoint === "node"
          ? { nodeAnchor: current.anchor }
          : { itemAnchor: current.anchor });
      }
      dragRef.current = null;
      setAnchorDrag(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [document, items, onUpdateLink, viewState]);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("mousedown", closeContextMenu);
    window.addEventListener("blur", closeContextMenu);
    return () => {
      window.removeEventListener("mousedown", closeContextMenu);
      window.removeEventListener("blur", closeContextMenu);
    };
  }, []);

  const beginAnchorDrag = (event: ReactMouseEvent<SVGPathElement>, relation: MindMapCanvasRelationLayout) => {
    if (event.button !== 0) {
      return;
    }
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSelectLink(relation.link.id);
    setContextMenu(null);
    const endpoint: MindMapRelationEndpoint = distanceSquared(point, { x: relation.startX, y: relation.startY })
      <= distanceSquared(point, { x: relation.endX, y: relation.endY })
      ? "node"
      : "item";
    dragRef.current = {
      linkId: relation.link.id,
      endpoint,
      anchor: null,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };
  };

  if (relations.length === 0) {
    return null;
  }

  return (
    <>
      <svg ref={svgRef} className={`mind-map-relation-layer${anchorDrag ? " dragging-anchor" : ""}`} aria-label="主题内容关联线">
        {relations.map((relation) => (
          <g key={relation.link.id}>
            <path
              className="mind-map-relation-hit"
              d={relation.path}
              onMouseDown={(event) => beginAnchorDrag(event, relation)}
              onClick={(event) => {
                event.stopPropagation();
                onSelectLink(relation.link.id);
              }}
              onContextMenu={(event) => {
                const point = getCanvasPoint(event.clientX, event.clientY);
                if (!point) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                onSelectLink(relation.link.id);
                setContextMenu({ linkId: relation.link.id, x: point.x, y: point.y });
              }}
            />
            <path
              className={`mind-map-relation${selectedLinkId === relation.link.id ? " selected" : ""}`}
              d={relation.path}
              stroke={relation.color}
            />
            <circle className="mind-map-relation-anchor" cx={relation.startX} cy={relation.startY} r={selectedLinkId === relation.link.id ? 5 : 4} fill={relation.color} />
            <circle className="mind-map-relation-anchor" cx={relation.endX} cy={relation.endY} r={selectedLinkId === relation.link.id ? 5 : 4} fill="#fff" stroke={relation.color} strokeWidth="2" />
          </g>
        ))}
      </svg>
      {contextMenu ? (
        <div
          className="mind-map-relation-context-menu"
          style={{ left: contextMenu.x + 8, top: contextMenu.y + 8 }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => {
            onDeleteLink(contextMenu.linkId);
            setContextMenu(null);
          }}>删除关联</button>
        </div>
      ) : null}
    </>
  );
}
