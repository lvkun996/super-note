import { useMemo } from "react";
import { uiText } from "../../../electron/uiLanguage";
import { getNoteReferences, type NoteReferenceTarget } from "./noteReferences";

export function NoteReferenceCards({ content, targets, onOpen }: {
  content: string; targets: readonly NoteReferenceTarget[]; onOpen?: (id: string) => void;
}) {
  const references = useMemo(() => [...new Map(getNoteReferences(content).map(link => [link.id, link])).values()], [content]);
  const byId = useMemo(() => new Map(targets.map(target => [target.id, target])), [targets]);
  if (!references.length) return null;
  return <nav className="note-reference-cards" aria-label={uiText("关联笔记")}>
    {references.map(reference => {
      const target = byId.get(reference.id);
      return <button key={reference.id} type="button" disabled={!target} onClick={event => { event.stopPropagation(); onOpen?.(reference.id); }}
        title={target ? uiText("打开关联笔记 {0}", [target.title]) : uiText("关联笔记已关闭或移除")}>
        <span className="note-reference-symbol">{target?.kind === "canvas" ? "◇" : "▤"}</span>
        <span className="note-reference-title">{target?.title ?? reference.title}</span><span aria-hidden>↗</span>
      </button>;
    })}
  </nav>;
}
