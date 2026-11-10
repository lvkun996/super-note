import { memo, type Ref } from "react";
import { renderHighlightedText, renderTextWithLinks } from "../editor/editorUtils";

export const PlainTextMirror = memo(function PlainTextMirror({ mirrorRef, content, query, hasLinks, searchOffset, searchEnd }: {
  mirrorRef: Ref<HTMLPreElement>;
  content: string;
  query: string;
  hasLinks: boolean;
  searchOffset?: number;
  searchEnd?: number;
}) {
  const render = (text: string) => hasLinks ? renderTextWithLinks(text, query) : renderHighlightedText(text, query);
  const hasTarget = searchOffset != null && searchEnd != null && searchOffset >= 0 && searchEnd >= searchOffset && searchOffset <= content.length;
  return (
    <pre ref={mirrorRef} className="file-highlight" aria-hidden>
      {hasTarget ? (
        <>
          {render(content.slice(0, searchOffset))}
          <span className="file-search-position-marker">{"\u200b"}</span>
          {render(content.slice(searchOffset, searchEnd))}
          {render(content.slice(searchEnd))}
        </>
      ) : render(content || " ")}
      <span className="file-highlight-end-marker">{"\u200b"}</span>
    </pre>
  );
});
