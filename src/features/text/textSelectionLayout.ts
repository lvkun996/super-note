import type { TextSelection } from "../../appTypes";

export type SelectionRectangle = { left: number; top: number; width: number; height: number };

// Newlines remain in the real textarea selection and on the clipboard; only
// visible text runs get painted. No spans are inserted into the text mirror.
export function selectedTextRuns(content: string, selection: TextSelection) {
  const start = Math.max(0, Math.min(selection.start, content.length));
  const end = Math.max(start, Math.min(selection.end, content.length));
  const runs: Array<{ start: number; end: number }> = [];
  const pattern = /[^\r\n]+/g;
  const selected = content.slice(start, end);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(selected))) {
    if (match[0].trim()) runs.push({ start: start + match.index, end: start + match.index + match[0].length });
  }
  return runs;
}

export function getTextSelectionRectangles(mirror: HTMLElement | null, editor: HTMLTextAreaElement | null, content: string, selection: TextSelection): SelectionRectangle[] {
  if (!mirror || !editor || selection.start >= selection.end) return [];
  const nodes: Array<{ node: Text; start: number; end: number }> = [];
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest(".file-highlight-end-marker, .file-search-position-marker")) continue;
    nodes.push({ node, start: offset, end: offset + node.length });
    offset += node.length;
  }
  const bounds = mirror.getBoundingClientRect();
  const rectangles: SelectionRectangle[] = [];
  let nodeIndex = 0;
  for (const run of selectedTextRuns(content, selection)) {
    while (nodeIndex < nodes.length && nodes[nodeIndex].end <= run.start) nodeIndex++;
    const first = nodes[nodeIndex];
    if (!first) break;
    let lastIndex = nodeIndex;
    while (lastIndex + 1 < nodes.length && nodes[lastIndex].end < run.end) lastIndex++;
    // Measure each text node separately: a range spanning links/marks would
    // also return their element boxes and paint the same pixels twice.
    for (let index = nodeIndex; index <= lastIndex; index++) {
      const part = nodes[index];
      const range = document.createRange();
      range.setStart(part.node, Math.max(0, run.start - part.start));
      range.setEnd(part.node, Math.min(part.node.length, run.end - part.start));
      for (const rect of Array.from(range.getClientRects())) {
        const left = Math.max(0, rect.left - bounds.left), top = Math.max(0, rect.top - bounds.top);
        const right = Math.min(editor.clientWidth, rect.right - bounds.left), bottom = Math.min(editor.clientHeight, rect.bottom - bounds.top);
        if (right > left && bottom > top) rectangles.push({ left, top, width: right - left, height: bottom - top });
      }
    }
  }
  return rectangles;
}
