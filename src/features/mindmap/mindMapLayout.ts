import { uiText } from "../../../electron/uiLanguage";
import { MIND_MAP_PALETTES, type MindMapDocument, type MindMapNode } from "./mindMapTypes";

export type MindMapSide = "left" | "right";

export type MindMapLayoutNode = {
  node: MindMapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  side: MindMapSide | "root";
  color: string;
};

export type MindMapLayoutEdge = {
  id: string;
  parentId: string;
  childId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
};

export type MindMapLayout = {
  nodes: MindMapLayoutNode[];
  edges: MindMapLayoutEdge[];
  bounds: { left: number; top: number; right: number; bottom: number };
};

function getVisualTextWidth(text: string) {
  return Array.from(text || uiText("主题")).reduce(
    (width, character) => width + (character.charCodeAt(0) > 255 ? 16 : 8.6),
    0,
  );
}

export function getMindMapNodeSize(node: MindMapNode, level: number, fontScale = 1) {
  const horizontalPadding = level === 0 ? 42 : level === 1 ? 34 : 28;
  return {
    width: Math.min(level === 0 ? 300 : 250, Math.max(level === 0 ? 150 : 108, Math.ceil(getVisualTextWidth(node.text) * fontScale + horizontalPadding))),
    height: Math.round((level === 0 ? 54 : level === 1 ? 44 : 38) * Math.max(0.9, fontScale)),
  };
}

function buildChildren(document: MindMapDocument) {
  const children = new Map<string, MindMapNode[]>();
  document.nodes.forEach((node) => {
    if (!node.parentId) {
      return;
    }
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node);
    children.set(node.parentId, siblings);
  });
  return children;
}

export function getMindMapBranchPath(
  edge: Pick<MindMapLayoutEdge, "startX" | "startY" | "endX" | "endY">,
  shape: MindMapDocument["style"]["branchShape"],
) {
  const { startX, startY, endX, endY } = edge;
  if (shape === "straight") {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }
  const middleX = startX + (endX - startX) * 0.52;
  if (shape === "elbow") {
    return `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`;
  }
  const control = Math.max(34, Math.abs(endX - startX) * 0.5);
  const direction = endX >= startX ? 1 : -1;
  return `M ${startX} ${startY} C ${startX + control * direction} ${startY}, ${endX - control * direction} ${endY}, ${endX} ${endY}`;
}

export function layoutMindMap(document: MindMapDocument): MindMapLayout {
  const root = document.nodes.find((node) => node.id === document.rootId);
  if (!root) {
    return {
      nodes: [],
      edges: [],
      bounds: { left: document.originX, top: document.originY, right: document.originX, bottom: document.originY },
    };
  }

  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const children = buildChildren(document);
  const palette = MIND_MAP_PALETTES[document.style.palette];
  const nodes: MindMapLayoutNode[] = [];
  const edges: MindMapLayoutEdge[] = [];
  const rootSize = getMindMapNodeSize(root, 0, document.style.fontScale);
  const rootLayout: MindMapLayoutNode = {
    node: root,
    x: document.originX - rootSize.width / 2,
    y: document.originY - rootSize.height / 2,
    ...rootSize,
    level: 0,
    side: "root",
    color: palette[0],
  };
  nodes.push(rootLayout);

  const heightCache = new Map<string, number>();
  const getSubtreeHeight = (nodeId: string, level: number, visiting = new Set<string>()): number => {
    const cacheKey = `${nodeId}:${level}`;
    const cached = heightCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const node = nodeById.get(nodeId);
    if (!node || visiting.has(nodeId)) {
      return 0;
    }
    const nextVisiting = new Set(visiting).add(nodeId);
    const ownHeight = getMindMapNodeSize(node, level, document.style.fontScale).height;
    const visibleChildren = node.collapsed ? [] : (children.get(nodeId) ?? []);
    const childHeights = visibleChildren.map((child) => getSubtreeHeight(child.id, level + 1, nextVisiting));
    const childrenHeight = childHeights.reduce((total, height) => total + height, 0)
      + Math.max(0, childHeights.length - 1) * document.style.verticalGap;
    const height = Math.max(ownHeight, childrenHeight);
    heightCache.set(cacheKey, height);
    return height;
  };

  const placeBranch = (
    node: MindMapNode,
    parentLayout: MindMapLayoutNode,
    side: MindMapSide,
    centerY: number,
    level: number,
    branchIndex: number,
    ancestors: Set<string>,
  ) => {
    if (ancestors.has(node.id)) {
      return;
    }
    const size = getMindMapNodeSize(node, level, document.style.fontScale);
    const x = side === "right"
      ? parentLayout.x + parentLayout.width + document.style.horizontalGap
      : parentLayout.x - document.style.horizontalGap - size.width;
    const color = document.style.coloredBranches ? palette[branchIndex % palette.length] : palette[0];
    const layout: MindMapLayoutNode = {
      node,
      x,
      y: centerY - size.height / 2,
      ...size,
      level,
      side,
      color,
    };
    nodes.push(layout);
    edges.push({
      id: `${parentLayout.node.id}:${node.id}`,
      parentId: parentLayout.node.id,
      childId: node.id,
      startX: side === "right" ? parentLayout.x + parentLayout.width : parentLayout.x,
      startY: parentLayout.y + parentLayout.height / 2,
      endX: side === "right" ? layout.x : layout.x + layout.width,
      endY: layout.y + layout.height / 2,
      color,
    });

    if (node.collapsed) {
      return;
    }
    const visibleChildren = children.get(node.id) ?? [];
    const childHeights = visibleChildren.map((child) => getSubtreeHeight(child.id, level + 1));
    const totalHeight = childHeights.reduce((total, height) => total + height, 0)
      + Math.max(0, childHeights.length - 1) * document.style.verticalGap;
    let cursorY = centerY - totalHeight / 2;
    const nextAncestors = new Set(ancestors).add(node.id);
    visibleChildren.forEach((child, childIndex) => {
      const childCenterY = cursorY + childHeights[childIndex] / 2;
      placeBranch(child, layout, side, childCenterY, level + 1, branchIndex, nextAncestors);
      cursorY += childHeights[childIndex] + document.style.verticalGap;
    });
  };

  const rootChildren = children.get(root.id) ?? [];
  const rightBranches: Array<{ node: MindMapNode; index: number }> = [];
  const leftBranches: Array<{ node: MindMapNode; index: number }> = [];
  rootChildren.forEach((node, index) => {
    if (document.style.structure === "right" || index % 2 === 0) {
      rightBranches.push({ node, index });
    } else {
      leftBranches.push({ node, index });
    }
  });

  const placeSide = (branches: Array<{ node: MindMapNode; index: number }>, side: MindMapSide) => {
    const heights = branches.map(({ node }) => getSubtreeHeight(node.id, 1));
    const totalHeight = heights.reduce((total, height) => total + height, 0)
      + Math.max(0, heights.length - 1) * document.style.verticalGap;
    let cursorY = document.originY - totalHeight / 2;
    branches.forEach(({ node, index }, branchPosition) => {
      const centerY = cursorY + heights[branchPosition] / 2;
      placeBranch(node, rootLayout, side, centerY, 1, index, new Set([root.id]));
      cursorY += heights[branchPosition] + document.style.verticalGap;
    });
  };

  placeSide(rightBranches, "right");
  placeSide(leftBranches, "left");

  const bounds = nodes.reduce(
    (current, node) => ({
      left: Math.min(current.left, node.x),
      top: Math.min(current.top, node.y),
      right: Math.max(current.right, node.x + node.width),
      bottom: Math.max(current.bottom, node.y + node.height),
    }),
    {
      left: rootLayout.x,
      top: rootLayout.y,
      right: rootLayout.x + rootLayout.width,
      bottom: rootLayout.y + rootLayout.height,
    },
  );

  return { nodes, edges, bounds };
}
