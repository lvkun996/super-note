import type { CanvasItem, CanvasViewState, PaneKey, TextCanvasItem } from "../../appTypes";

export const DEFAULT_TEXT_FONT_SIZE = 18;

export function getTextFontSize(item: TextCanvasItem) {
  return item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
}

export function estimateTextHeight(text: string, fontSize: number, width: number) {
  const usableWidth = Math.max(40, width - 12);
  const charactersPerLine = Math.max(1, Math.floor(usableWidth / (fontSize * 0.62)));
  const visualLines = (text || " ")
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(Math.max(1, line.length) / charactersPerLine)), 0);
  return Math.max(48, Math.ceil(visualLines * fontSize * 1.45 + 12));
}

export function estimateTextWidth(text: string, fontSize: number) {
  const longestLineWidth = (text || " ")
    .split("\n")
    .reduce((longest, line) => {
      const width = Array.from(line).reduce(
        (sum, character) => sum + (character.charCodeAt(0) > 255 ? fontSize : fontSize * 0.62),
        0,
      );
      return Math.max(longest, width);
    }, 0);
  return Math.min(960, Math.max(260, Math.ceil(longestLineWidth + 16)));
}

export function getItemLayout(item: CanvasItem, viewState: CanvasViewState) {
  const override = viewState.itemOverrides[item.id];
  if (item.type === "text") {
    return {
      ...item,
      x: override?.x ?? item.x,
      y: override?.y ?? item.y,
      width: override?.width ?? item.width,
      height: override?.height ?? item.height,
      fontSize: override?.fontSize ?? getTextFontSize(item),
    };
  }
  return {
    ...item,
    x: override?.x ?? item.x,
    y: override?.y ?? item.y,
    width: override?.width ?? item.width,
    height: override?.height ?? item.height,
  };
}

export function getPointOnCanvas(clientX: number, clientY: number, surface: HTMLDivElement | null, scale: number) {
  if (!surface) {
    return { x: 120, y: 120 };
  }
  const rect = surface.getBoundingClientRect();
  return {
    x: Math.round((clientX - rect.left) / scale),
    y: Math.round((clientY - rect.top) / scale),
  };
}

export function focusTextEditor(itemId: string, pane: PaneKey, placeAtEnd = false) {
  window.setTimeout(() => {
    const editor = document.querySelector<HTMLTextAreaElement>(
      `.canvas-viewport[data-pane="${pane}"] textarea[data-item-id="${itemId}"]`,
    );
    if (!editor) {
      return;
    }
    window.requestAnimationFrame(() => {
      editor.focus({ preventScroll: true });
      if (placeAtEnd) {
        const end = editor.value.replace(/[\r\n]+$/g, "").length;
        editor.setSelectionRange(end, end);
        editor.scrollLeft = editor.scrollWidth;
      }
    });
  }, 0);
}
