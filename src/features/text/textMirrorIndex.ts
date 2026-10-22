type IndexedText = { node: Text; start: number; end: number };
type MirrorIndex = { content: string; nodes: IndexedText[] };
const indexes = new WeakMap<HTMLElement, MirrorIndex>();

export function invalidateTextMirrorIndex(mirror: HTMLElement | null) {
  if (mirror) indexes.delete(mirror);
}

export function getTextMirrorIndex(mirror: HTMLElement, content: string) {
  const cached = indexes.get(mirror);
  if (cached?.content === content && (!cached.nodes.length || mirror.contains(cached.nodes[0].node) && mirror.contains(cached.nodes[cached.nodes.length - 1].node))) return cached.nodes;
  const nodes: IndexedText[] = [];
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest(".file-highlight-end-marker, .file-search-position-marker")) continue;
    nodes.push({ node, start: offset, end: offset + node.length });
    offset += node.length;
  }
  indexes.set(mirror, { content, nodes });
  return nodes;
}

export function textNodeAtOffset(nodes: IndexedText[], offset: number) {
  let low = 0, high = nodes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (nodes[middle].end <= offset) low = middle + 1;
    else high = middle;
  }
  return low;
}
