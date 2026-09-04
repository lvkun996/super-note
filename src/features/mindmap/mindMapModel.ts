import { uiText } from "../../../electron/uiLanguage";
import {
  DEFAULT_MIND_MAP_STYLE,
  type MindMapCanvasLink,
  type MindMapDocument,
  type MindMapNode,
  type MindMapRelationAnchor,
  type MindMapStyle,
} from "./mindMapTypes";

type IdFactory = () => string;

const defaultIdFactory: IdFactory = () => crypto.randomUUID();

export function cloneMindMap(document?: MindMapDocument): MindMapDocument | undefined {
  if (!document) {
    return undefined;
  }
  return {
    ...document,
    nodes: document.nodes.map((node) => ({ ...node })),
    canvasLinks: document.canvasLinks.map((link) => ({ ...link })),
    style: { ...document.style },
  };
}

export function normalizeMindMap(value: unknown): MindMapDocument | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as Partial<MindMapDocument> & {
    imageLinks?: Array<{ id?: unknown; nodeId?: unknown; imageItemId?: unknown }>;
  };
  if (!Array.isArray(candidate.nodes) || typeof candidate.rootId !== "string") {
    return undefined;
  }
  const nodes = candidate.nodes.filter(
    (node): node is MindMapNode =>
      Boolean(node) &&
      typeof node.id === "string" &&
      (node.parentId === null || typeof node.parentId === "string") &&
      typeof node.text === "string",
  );
  if (!nodes.some((node) => node.id === candidate.rootId)) {
    return undefined;
  }
  const rawStyle = candidate.style && typeof candidate.style === "object" ? candidate.style : {};
  const nodeIds = new Set(nodes.map((node) => node.id));
  const canvasLinks = normalizeCanvasLinks(candidate.canvasLinks ?? candidate.imageLinks, nodeIds);
  return {
    rootId: candidate.rootId,
    originX: Number.isFinite(candidate.originX) ? Number(candidate.originX) : 640,
    originY: Number.isFinite(candidate.originY) ? Number(candidate.originY) : 420,
    nodes: nodes.map((node) => ({ ...node })),
    canvasLinks,
    style: {
      ...DEFAULT_MIND_MAP_STYLE,
      ...rawStyle,
      horizontalGap: clampNumber((rawStyle as Partial<MindMapStyle>).horizontalGap, 56, 180, DEFAULT_MIND_MAP_STYLE.horizontalGap),
      verticalGap: clampNumber((rawStyle as Partial<MindMapStyle>).verticalGap, 10, 64, DEFAULT_MIND_MAP_STYLE.verticalGap),
      branchWidth: normalizeBranchWidth((rawStyle as Partial<MindMapStyle>).branchWidth),
      fontScale: clampDecimal((rawStyle as Partial<MindMapStyle>).fontScale, 0.8, 1.35, DEFAULT_MIND_MAP_STYLE.fontScale),
      fontWeight: normalizeFontWeight((rawStyle as Partial<MindMapStyle>).fontWeight),
    },
  };
}

function normalizeCanvasLinks(value: unknown, nodeIds: Set<string>): MindMapCanvasLink[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  return value.flatMap((link) => {
    if (!link || typeof link !== "object") {
      return [];
    }
    const candidate = link as Partial<MindMapCanvasLink> & { imageItemId?: unknown };
    const itemId = typeof candidate.itemId === "string"
      ? candidate.itemId
      : typeof candidate.imageItemId === "string"
        ? candidate.imageItemId
        : null;
    const key = `${candidate.nodeId}:${itemId}`;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.nodeId !== "string" ||
      !itemId ||
      !nodeIds.has(candidate.nodeId) ||
      seen.has(key)
    ) {
      return [];
    }
    seen.add(key);
    return [{
      id: candidate.id,
      nodeId: candidate.nodeId,
      itemId,
      nodeAnchor: normalizeRelationAnchor(candidate.nodeAnchor),
      itemAnchor: normalizeRelationAnchor(candidate.itemAnchor),
    }];
  });
}

function normalizeRelationAnchor(value: unknown): MindMapRelationAnchor {
  return value === "top" || value === "right" || value === "bottom" || value === "left" ? value : "auto";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function clampDecimal(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value * 100) / 100))
    : fallback;
}

function normalizeBranchWidth(value: unknown): MindMapStyle["branchWidth"] {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : DEFAULT_MIND_MAP_STYLE.branchWidth;
}

function normalizeFontWeight(value: unknown): MindMapStyle["fontWeight"] {
  return value === 500 || value === 600 || value === 700 ? value : DEFAULT_MIND_MAP_STYLE.fontWeight;
}

export function createMindMap(
  origin: { x: number; y: number },
  makeId: IdFactory = defaultIdFactory,
): MindMapDocument {
  const rootId = makeId();
  const firstId = makeId();
  const secondId = makeId();
  return {
    rootId,
    originX: Math.round(origin.x),
    originY: Math.round(origin.y),
    style: { ...DEFAULT_MIND_MAP_STYLE },
    canvasLinks: [],
    nodes: [
      { id: rootId, parentId: null, text: uiText("中心主题") },
      { id: firstId, parentId: rootId, text: uiText("主要主题 1") },
      { id: secondId, parentId: rootId, text: uiText("主要主题 2") },
    ],
  };
}

export function getMindMapNode(document: MindMapDocument, nodeId: string) {
  return document.nodes.find((node) => node.id === nodeId);
}

export function getMindMapChildren(document: MindMapDocument, parentId: string) {
  return document.nodes.filter((node) => node.parentId === parentId);
}

export function addMindMapChild(
  document: MindMapDocument,
  parentId: string,
  makeId: IdFactory = defaultIdFactory,
) {
  if (!getMindMapNode(document, parentId)) {
    return { document, nodeId: null };
  }
  const nodeId = makeId();
  const next: MindMapDocument = {
    ...document,
    nodes: [
      ...document.nodes.map((node) => (node.id === parentId && node.collapsed ? { ...node, collapsed: false } : node)),
      { id: nodeId, parentId, text: uiText("子主题") },
    ],
  };
  return { document: next, nodeId };
}

export function addMindMapSibling(
  document: MindMapDocument,
  nodeId: string,
  makeId: IdFactory = defaultIdFactory,
) {
  const node = getMindMapNode(document, nodeId);
  if (!node) {
    return { document, nodeId: null };
  }
  if (node.parentId === null) {
    return addMindMapChild(document, node.id, makeId);
  }
  const siblingId = makeId();
  const nodeIndex = document.nodes.findIndex((candidate) => candidate.id === nodeId);
  const nodes = [...document.nodes];
  nodes.splice(nodeIndex + 1, 0, { id: siblingId, parentId: node.parentId, text: uiText("同级主题") });
  return { document: { ...document, nodes }, nodeId: siblingId };
}

export function updateMindMapNodeText(document: MindMapDocument, nodeId: string, text: string) {
  const normalized = text.trim() || uiText("主题");
  return {
    ...document,
    nodes: document.nodes.map((node) => (node.id === nodeId ? { ...node, text: normalized } : node)),
  };
}

export function toggleMindMapNode(document: MindMapDocument, nodeId: string) {
  if (getMindMapChildren(document, nodeId).length === 0) {
    return document;
  }
  return {
    ...document,
    nodes: document.nodes.map((node) => (node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node)),
  };
}

export function deleteMindMapBranch(document: MindMapDocument, nodeId: string) {
  if (nodeId === document.rootId || !getMindMapNode(document, nodeId)) {
    return document;
  }
  const removeIds = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    document.nodes.forEach((node) => {
      if (node.parentId && removeIds.has(node.parentId) && !removeIds.has(node.id)) {
        removeIds.add(node.id);
        changed = true;
      }
    });
  }
  return {
    ...document,
    nodes: document.nodes.filter((node) => !removeIds.has(node.id)),
    canvasLinks: document.canvasLinks.filter((link) => !removeIds.has(link.nodeId)),
  };
}

function isMindMapDescendant(document: MindMapDocument, nodeId: string, possibleAncestorId: string) {
  let current = getMindMapNode(document, nodeId);
  const visited = new Set<string>();
  while (current?.parentId && !visited.has(current.id)) {
    if (current.parentId === possibleAncestorId) {
      return true;
    }
    visited.add(current.id);
    current = getMindMapNode(document, current.parentId);
  }
  return false;
}

export function moveMindMapNode(
  document: MindMapDocument,
  nodeId: string,
  targetNodeId: string,
  placement: "before" | "after" | "child",
) {
  if (nodeId === targetNodeId || nodeId === document.rootId) {
    return document;
  }
  const node = getMindMapNode(document, nodeId);
  const target = getMindMapNode(document, targetNodeId);
  if (!node || !target || isMindMapDescendant(document, targetNodeId, nodeId)) {
    return document;
  }
  const nextParentId = placement === "child" ? target.id : target.parentId;
  if (!nextParentId) {
    return document;
  }
  const withoutNode = document.nodes.filter((candidate) => candidate.id !== nodeId);
  const targetIndex = withoutNode.findIndex((candidate) => candidate.id === targetNodeId);
  if (targetIndex < 0) {
    return document;
  }
  const insertIndex = targetIndex + (placement === "before" ? 0 : 1);
  const nodes = [...withoutNode];
  nodes.splice(insertIndex, 0, { ...node, parentId: nextParentId });
  return {
    ...document,
    nodes: nodes.map((candidate) => (
      placement === "child" && candidate.id === target.id && candidate.collapsed
        ? { ...candidate, collapsed: false }
        : candidate
    )),
  };
}

export function linkMindMapNodeToCanvasItem(
  document: MindMapDocument,
  nodeId: string,
  itemId: string,
  makeId: IdFactory = defaultIdFactory,
  anchors: Partial<Pick<MindMapCanvasLink, "nodeAnchor" | "itemAnchor">> = {},
): MindMapDocument {
  if (nodeId === document.rootId || !getMindMapNode(document, nodeId)) {
    return document;
  }
  if (document.canvasLinks.some((link) => link.nodeId === nodeId && link.itemId === itemId)) {
    return document;
  }
  return {
    ...document,
    canvasLinks: [...document.canvasLinks, {
      id: makeId(),
      nodeId,
      itemId,
      nodeAnchor: normalizeRelationAnchor(anchors.nodeAnchor),
      itemAnchor: normalizeRelationAnchor(anchors.itemAnchor),
    }],
  };
}

export function updateMindMapCanvasLink(
  document: MindMapDocument,
  linkId: string,
  patch: Partial<Pick<MindMapCanvasLink, "nodeAnchor" | "itemAnchor">>,
) {
  return {
    ...document,
    canvasLinks: document.canvasLinks.map((link) => link.id === linkId ? {
      ...link,
      ...(patch.nodeAnchor ? { nodeAnchor: normalizeRelationAnchor(patch.nodeAnchor) } : {}),
      ...(patch.itemAnchor ? { itemAnchor: normalizeRelationAnchor(patch.itemAnchor) } : {}),
    } : link),
  };
}

export function deleteMindMapCanvasLink(document: MindMapDocument, linkId: string) {
  return { ...document, canvasLinks: document.canvasLinks.filter((link) => link.id !== linkId) };
}

export function removeMindMapCanvasLinksForItem(document: MindMapDocument, itemId: string) {
  return { ...document, canvasLinks: document.canvasLinks.filter((link) => link.itemId !== itemId) };
}

export function updateMindMapStyle(document: MindMapDocument, style: Partial<MindMapStyle>) {
  return normalizeMindMap({ ...document, style: { ...document.style, ...style } }) ?? document;
}
