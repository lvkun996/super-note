import { memo, useLayoutEffect, useRef } from "react";
import type { MouseEventHandler } from "react";
type Block = { html: string; nodes: Node[] };

export const MarkdownContent = memo(function MarkdownContent({ blocks, className, onClick }: {
  blocks: string[]; className: string; onClick: MouseEventHandler<HTMLElement>;
}) {
  const element = useRef<HTMLElement>(null);
  const previous = useRef<Block[]>([]);
  useLayoutEffect(() => {
    const root = element.current;
    if (!root) return;
    const old = previous.current;
    let prefix = 0, suffix = 0;
    while (prefix < old.length && prefix < blocks.length && old[prefix].html === blocks[prefix]) prefix++;
    while (suffix < old.length - prefix && suffix < blocks.length - prefix && old[old.length - suffix - 1].html === blocks[blocks.length - suffix - 1]) suffix++;
    let anchor: Node | null = null;
    for (let index = old.length - suffix; index < old.length && !anchor; index++) anchor = old[index].nodes[0] ?? null;
    for (let index = prefix; index < old.length - suffix; index++) for (const node of old[index].nodes) node.parentNode?.removeChild(node);
    const added: Block[] = blocks.slice(prefix, blocks.length - suffix).map(html => ({ html, nodes: [] }));
    if (added.length) {
      const template = document.createElement("template");
      // Parse a large initial preview in one pass. Temporary boundaries never
      // enter the live DOM; each block may contain any number of root nodes.
      template.innerHTML = added.map(block => `<!--super-note-block-->${block.html}`).join("");
      let index = -1;
      for (const node of Array.from(template.content.childNodes)) {
        if (node.nodeType === Node.COMMENT_NODE && node.nodeValue === "super-note-block") { index++; node.parentNode?.removeChild(node); }
        else added[index].nodes.push(node);
      }
      root.insertBefore(template.content, anchor);
    }
    previous.current = [...old.slice(0, prefix), ...added, ...(suffix ? old.slice(old.length - suffix) : [])];
  }, [blocks]);
  return <article ref={element} className={className} onClick={onClick} />;
});
