import type { CanvasItem, CanvasTab } from "../../appTypes";
import type { MindMapDocument } from "../mindmap/mindMapTypes";
import { cloneMindMap } from "../mindmap/mindMapModel";

export const HISTORY_LIMIT = 80;

export function cloneItems(items: CanvasItem[]) {
  return items.map((item) => ({ ...item }));
}

export function cloneCanvasSnapshot(items: CanvasItem[], mindMap?: MindMapDocument) {
  return { items: cloneItems(items), mindMap: cloneMindMap(mindMap) };
}

export function pushHistory(tab: CanvasTab, nextItems: CanvasItem[], nextMindMap = tab.mindMap) {
  const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
  nextHistory.push(cloneCanvasSnapshot(nextItems, nextMindMap));
  const limited = nextHistory.slice(-HISTORY_LIMIT);
  return {
    history: limited,
    historyIndex: limited.length - 1,
  };
}

