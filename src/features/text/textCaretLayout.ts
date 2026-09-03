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
  return carets.flatMap(offset => {
    let rect: DOMRect | undefined;
    if (offset === contentLength && endMarker) {
      rect = endMarker.getBoundingClientRect();
    } else {
      let remaining = offset;
      for (const node of nodes) {
        if (remaining <= node.length) {
          const range = document.createRange();
          range.setStart(node, remaining);
          range.collapse(true);
          rect = range.getBoundingClientRect();
          break;
        }
        remaining -= node.length;
      }
    }
    return rect ? [{ offset, left: rect.left - bounds.left, top: rect.top - bounds.top, height: rect.height }] : [];
  });
}
