import type { PaneKey } from "../../appTypes";

export const CANVAS_ITEM_DRAG_EVENT = "super-note:canvas-item-drag";
export const CANVAS_ITEM_DRAG_END_EVENT = "super-note:canvas-item-drag-end";

export type LiveCanvasItemDrag = {
  tabId: string;
  pane: PaneKey;
  itemId: string;
  x: number;
  y: number;
  phase: "start" | "move";
};

export function dispatchCanvasItemDrag(detail: LiveCanvasItemDrag) {
  window.dispatchEvent(new CustomEvent<LiveCanvasItemDrag>(CANVAS_ITEM_DRAG_EVENT, { detail }));
}

export function dispatchCanvasItemDragEnd(detail: Pick<LiveCanvasItemDrag, "tabId" | "pane" | "itemId">) {
  window.dispatchEvent(new CustomEvent(CANVAS_ITEM_DRAG_END_EVENT, { detail }));
}
