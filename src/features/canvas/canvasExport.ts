import type { CanvasTab, CanvasViewState, TextCanvasItem } from "../../appTypes";
import { layoutMindMap, getMindMapBranchPath, type MindMapLayoutNode } from "../mindmap/mindMapLayout";
import { layoutMindMapCanvasRelations } from "../mindmap/mindMapRelations";
import type { MindMapStyle } from "../mindmap/mindMapTypes";
import { getItemLayout, getTextFontSize } from "./canvasUtils";

const EXPORT_PADDING = 64;
const MAX_BITMAP_SIZE = 8192;

type ExportBounds = { left: number; top: number; right: number; bottom: number };

function includeBounds(current: ExportBounds | null, next: ExportBounds): ExportBounds {
  if (!current) {
    return next;
  }
  return {
    left: Math.min(current.left, next.left),
    top: Math.min(current.top, next.top),
    right: Math.max(current.right, next.right),
    bottom: Math.max(current.bottom, next.bottom),
  };
}

function makeRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = src;
  });
}

function splitTextLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const result: string[] = [];
  (text || " ").split("\n").forEach((paragraph) => {
    let line = "";
    Array.from(paragraph || " ").forEach((character) => {
      const candidate = `${line}${character}`;
      if (line && context.measureText(candidate).width > maxWidth) {
        result.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    result.push(line || " ");
  });
  return result;
}

function drawMindMapNode(context: CanvasRenderingContext2D, layoutNode: MindMapLayoutNode, style: MindMapStyle) {
  const { x, y, width, height, color, level, node } = layoutNode;
  const fontFamilies = {
    system: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    serif: 'Georgia, "Songti SC", "SimSun", serif',
    mono: 'Consolas, "Liberation Mono", monospace',
  } as const;
  context.save();
  if (style.topicShape === "underline" && level > 0) {
    context.fillStyle = "#ffffff";
    context.fillRect(x, y, width, height - 3);
    context.fillStyle = color;
    context.fillRect(x, y + height - 3, width, 3);
  } else {
    makeRoundedRect(context, x, y, width, height, style.topicShape === "pill" ? height / 2 : level === 0 ? 16 : 10);
    context.fillStyle = level === 0 || style.topicFill === "solid"
      ? color
      : style.topicFill === "soft"
        ? `${color}20`
        : "#ffffff";
    context.fill();
    context.lineWidth = level === 0 ? 0 : 1.5;
    context.strokeStyle = color;
    if (level > 0) {
      context.stroke();
    }
  }
  context.fillStyle = level === 0 || style.topicFill === "solid" ? "#ffffff" : style.textColor;
  context.font = `${level === 0 ? 700 : style.fontWeight} ${(level === 0 ? 18 : level === 1 ? 16 : 14) * style.fontScale}px ${fontFamilies[style.fontFamily]}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const label = node.text.length > 30 ? `${Array.from(node.text).slice(0, 29).join("")}…` : node.text;
  context.fillText(label, x + width / 2, y + height / 2, width - 22);
  context.restore();
}

async function drawImageItem(
  context: CanvasRenderingContext2D,
  item: { src: string; x: number; y: number; width: number; height: number },
) {
  try {
    const image = await loadImage(item.src);
    const ratio = Math.min(item.width / image.naturalWidth, item.height / image.naturalHeight);
    const width = image.naturalWidth * ratio;
    const height = image.naturalHeight * ratio;
    context.drawImage(image, item.x + (item.width - width) / 2, item.y + (item.height - height) / 2, width, height);
  } catch {
    context.save();
    context.strokeStyle = "#cbd5e1";
    context.strokeRect(item.x, item.y, item.width, item.height);
    context.fillStyle = "#64748b";
    context.font = "14px sans-serif";
    context.textAlign = "center";
    context.fillText("图片无法读取", item.x + item.width / 2, item.y + item.height / 2);
    context.restore();
  }
}

function drawTextItem(context: CanvasRenderingContext2D, item: TextCanvasItem) {
  const fontSize = getTextFontSize(item);
  context.save();
  context.fillStyle = "#161a20";
  context.font = `${fontSize}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "top";
  const lineHeight = fontSize * 1.45;
  const lines = splitTextLines(context, item.text, Math.max(20, item.width - 12));
  lines.forEach((line, index) => context.fillText(line, item.x + 6, item.y + 4 + index * lineHeight));
  context.restore();
}

export async function renderCanvasToPng(tab: CanvasTab, viewState: CanvasViewState) {
  const itemLayouts = tab.items.map((item) => getItemLayout(item, viewState));
  const mindMapLayout = tab.mindMap ? layoutMindMap(tab.mindMap) : null;
  let bounds: ExportBounds | null = mindMapLayout?.nodes.length ? { ...mindMapLayout.bounds } : null;
  itemLayouts.forEach((item) => {
    bounds = includeBounds(bounds, {
      left: item.x,
      top: item.y,
      right: item.x + item.width,
      bottom: item.y + item.height,
    });
  });
  bounds ??= { left: 0, top: 0, right: 960, bottom: 540 };

  const logicalWidth = Math.max(320, Math.ceil(bounds.right - bounds.left + EXPORT_PADDING * 2));
  const logicalHeight = Math.max(240, Math.ceil(bounds.bottom - bounds.top + EXPORT_PADDING * 2));
  const exportScale = Math.min(2, MAX_BITMAP_SIZE / logicalWidth, MAX_BITMAP_SIZE / logicalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(logicalWidth * exportScale));
  canvas.height = Math.max(1, Math.round(logicalHeight * exportScale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前环境无法创建图片画布");
  }

  context.scale(exportScale, exportScale);
  context.fillStyle = tab.mindMap?.style.background ?? "#ffffff";
  context.fillRect(0, 0, logicalWidth, logicalHeight);
  context.translate(-bounds.left + EXPORT_PADDING, -bounds.top + EXPORT_PADDING);

  if (tab.mindMap && mindMapLayout) {
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    layoutMindMapCanvasRelations(tab.mindMap, tab.items, viewState).forEach((relation) => {
      context.strokeStyle = relation.color;
      context.lineWidth = 2.5;
      context.setLineDash([9, 6]);
      context.stroke(new Path2D(relation.path));
      context.setLineDash([]);
      context.fillStyle = relation.color;
      context.beginPath();
      context.arc(relation.startX, relation.startY, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ffffff";
      context.strokeStyle = relation.color;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(relation.endX, relation.endY, 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
    mindMapLayout.edges.forEach((edge) => {
      context.strokeStyle = edge.color;
      context.lineWidth = tab.mindMap!.style.branchWidth;
      context.stroke(new Path2D(getMindMapBranchPath(edge, tab.mindMap!.style.branchShape)));
    });
    context.restore();
    mindMapLayout.nodes.forEach((node) => drawMindMapNode(context, node, tab.mindMap!.style));
  }

  for (const item of itemLayouts) {
    if (item.type === "image") {
      await drawImageItem(context, item);
    } else {
      drawTextItem(context, item);
    }
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}
