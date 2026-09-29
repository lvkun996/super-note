export type TextCaretPosition = { offset: number; left: number; top: number; height: number };

// Measure the unmodified highlight text. Carets live in a separate overlay so
// adding them cannot change glyph shaping, line wrapping, or hit-test offsets.
export function getTextCaretPositions(mirror: HTMLElement | null, carets: number[], contentLength: number): TextCaretPosition[] {
  if (!mirror || carets.length === 0) return [];
  const bounds = mirror.getBoundingClientRect();
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest(".file-highlight-end-marker, .file-search-position-marker")) nodes.push(node);
  }
  const endMarker = mirror.querySelector<HTMLElement>(".file-highlight-end-marker");
  const orderedOffsets = carets
    .map((offset, index) => ({ offset, index }))
    .sort((a, b) => a.offset - b.offset || a.index - b.index);
  const positions = new Array<TextCaretPosition | undefined>(carets.length);
  const positionsByOffset = new Map<number, TextCaretPosition | null>();
  let nodeIndex = 0;
  let nodeStart = 0;

  for (const { offset, index } of orderedOffsets) {
    if (positionsByOffset.has(offset)) {
      positions[index] = positionsByOffset.get(offset) ?? undefined;
      continue;
    }

    let rect: DOMRect | undefined;
    if (offset === contentLength && endMarker) {
      rect = endMarker.getBoundingClientRect();
    } else {
      while (nodeIndex < nodes.length && offset - nodeStart > nodes[nodeIndex].length) {
        nodeStart += nodes[nodeIndex].length;
        nodeIndex += 1;
      }
      const node = nodes[nodeIndex];
      const nodeOffset = offset - nodeStart;
      if (node && nodeOffset >= 0 && nodeOffset <= node.length) {
        const range = document.createRange();
        range.setStart(node, nodeOffset);
        range.collapse(true);
        rect = range.getBoundingClientRect();
      }
    }

    const position = rect
      ? { offset, left: rect.left - bounds.left, top: rect.top - bounds.top, height: rect.height }
      : null;
    positionsByOffset.set(offset, position);
    positions[index] = position ?? undefined;
  }

  return positions.filter((position): position is TextCaretPosition => position !== undefined);
}
