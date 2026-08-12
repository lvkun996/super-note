import type { CanvasItem, CanvasViewState } from "../../appTypes";
import { getItemLayout } from "../canvas/canvasUtils";
import { layoutMindMap } from "./mindMapLayout";
import type { MindMapCanvasLink, MindMapDocument, MindMapRelationAnchor } from "./mindMapTypes";

type Box = { x: number; y: number; width: number; height: number };
export type MindMapRelationEndpoint = "node" | "item";
export type ResolvedMindMapRelationAnchors = {
  nodeAnchor: Exclude<MindMapRelationAnchor, "auto">;
  itemAnchor: Exclude<MindMapRelationAnchor, "auto">;
};

export type MindMapCanvasRelationLayout = {
  link: MindMapCanvasLink;
  path: string;
  color: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

function getBoxCenter(box: Box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function resolveAutoAnchor(box: Box, other: Box): Exclude<MindMapRelationAnchor, "auto"> {
  const center = getBoxCenter(box);
  const otherCenter = getBoxCenter(other);
  const dx = otherCenter.x - center.x;
  const dy = otherCenter.y - center.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function resolveAnchor(anchor: MindMapRelationAnchor, box: Box, other: Box) {
  return anchor === "auto" ? resolveAutoAnchor(box, other) : anchor;
}

export function resolveNearestRelationAnchor(
  box: Box,
  point: { x: number; y: number },
): Exclude<MindMapRelationAnchor, "auto"> {
  const center = getBoxCenter(box);
  const horizontal = (point.x - center.x) / Math.max(1, box.width / 2);
  const vertical = (point.y - center.y) / Math.max(1, box.height / 2);
  if (Math.abs(horizontal) > Math.abs(vertical)) {
    return horizontal >= 0 ? "right" : "left";
  }
  return vertical >= 0 ? "bottom" : "top";
}

function getAnchorPoint(box: Box, anchor: MindMapRelationAnchor, other: Box) {
  const resolved = resolveAnchor(anchor, box, other);
  switch (resolved) {
    case "top":
      return { x: box.x + box.width / 2, y: box.y };
    case "right":
      return { x: box.x + box.width, y: box.y + box.height / 2 };
    case "bottom":
      return { x: box.x + box.width / 2, y: box.y + box.height };
    case "left":
      return { x: box.x, y: box.y + box.height / 2 };
  }
}

function getRelationBoxes(
  document: MindMapDocument,
  items: CanvasItem[],
  viewState: CanvasViewState,
  link: MindMapCanvasLink,
) {
  const node = layoutMindMap(document).nodes.find((layout) => layout.node.id === link.nodeId);
  const item = items.find((candidate) => candidate.id === link.itemId);
  if (!node || !item) {
    return null;
  }
  return { node, item: getItemLayout(item, viewState) };
}

export function resolveMindMapCanvasLinkAnchors(
  document: MindMapDocument,
  items: CanvasItem[],
  viewState: CanvasViewState,
  link: MindMapCanvasLink,
): ResolvedMindMapRelationAnchors | null {
  const boxes = getRelationBoxes(document, items, viewState, link);
  if (!boxes) {
    return null;
  }
  return {
    nodeAnchor: resolveAnchor(link.nodeAnchor, boxes.node, boxes.item),
    itemAnchor: resolveAnchor(link.itemAnchor, boxes.item, boxes.node),
  };
}

export function getMindMapCanvasLinkAnchorAtPoint(
  document: MindMapDocument,
  items: CanvasItem[],
  viewState: CanvasViewState,
  link: MindMapCanvasLink,
  endpoint: MindMapRelationEndpoint,
  point: { x: number; y: number },
) {
  const boxes = getRelationBoxes(document, items, viewState, link);
  return boxes ? resolveNearestRelationAnchor(endpoint === "node" ? boxes.node : boxes.item, point) : null;
}

function getConnectionPoints(source: Box, target: Box, link: MindMapCanvasLink) {
  const start = getAnchorPoint(source, link.nodeAnchor, target);
  const end = getAnchorPoint(target, link.itemAnchor, source);
  return { startX: start.x, startY: start.y, endX: end.x, endY: end.y };
}

export function getMindMapCanvasRelationPath(
  relation: Pick<MindMapCanvasRelationLayout, "startX" | "startY" | "endX" | "endY">,
) {
  const { startX, startY, endX, endY } = relation;
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return `M ${startX} ${startY} C ${startX + dx * 0.48} ${startY}, ${endX - dx * 0.48} ${endY}, ${endX} ${endY}`;
  }
  return `M ${startX} ${startY} C ${startX} ${startY + dy * 0.48}, ${endX} ${endY - dy * 0.48}, ${endX} ${endY}`;
}

export function layoutMindMapCanvasRelations(
  document: MindMapDocument,
  items: CanvasItem[],
  viewState: CanvasViewState,
): MindMapCanvasRelationLayout[] {
  const nodeLayouts = new Map(layoutMindMap(document).nodes.map((layout) => [layout.node.id, layout]));
  const itemLayouts = new Map(items.map((item) => [item.id, getItemLayout(item, viewState)]));
  return document.canvasLinks.flatMap((link) => {
    const node = nodeLayouts.get(link.nodeId);
    const item = itemLayouts.get(link.itemId);
    if (!node || !item) {
      return [];
    }
    const points = getConnectionPoints(node, item, link);
    const relation = { link, color: node.color, ...points };
    return [{ ...relation, path: getMindMapCanvasRelationPath(relation) }];
  });
}
