import { memo, useMemo } from "react";
import { renderTextWithLinks, renderHighlightedText } from "../editor/editorUtils";
import { getNoteReferences, type NoteReferenceTarget } from "./noteReferences";

// Plain text stays plain: only note references collapse to their visible names.
export const NoteReferenceText = memo(function NoteReferenceText({ content, query, targets }: {
  content: string; query: string; targets: readonly NoteReferenceTarget[];
}) {
  const references = useMemo(() => getNoteReferences(content), [content]);
  const titles = useMemo(() => new Map(targets.map(target => [target.id, target.title])), [targets]);
  let cursor = 0;
  const nodes = references.map(reference => {
    const before = content.slice(cursor, reference.start);
    cursor = reference.end;
    return <span key={reference.start}>
      {renderTextWithLinks(before, query)}
      <a className="text-http-link" href={`super-note://note/${encodeURIComponent(reference.id)}`}>
        {renderHighlightedText(titles.get(reference.id) ?? reference.title, query)}
      </a>
    </span>;
  });
  return <>{nodes}{renderTextWithLinks(content.slice(cursor), query)}</>;
});
