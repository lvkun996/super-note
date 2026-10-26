import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import { uiText } from "../../../electron/uiLanguage";
import { createNoteReference, filterNoteTargets, getNoteReferenceQuery, type NoteReferenceTarget } from "./noteReferences";
import { getTextCaretPositions } from "./textCaretLayout";

export function useNoteReferencePicker({ tabId, targets, editorRef, mirrorRef, revealMirror, insert }: {
  tabId: string;
  targets: readonly NoteReferenceTarget[];
  editorRef: RefObject<HTMLTextAreaElement | null>;
  mirrorRef: RefObject<HTMLElement | null>;
  revealMirror: () => void;
  insert: (content: string, caret: number) => void;
}) {
  const [query, setQuery] = useState<ReturnType<typeof getNoteReferenceQuery>>(null);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, maxHeight: 240 });
  const dismissed = useRef("");
  const popupRef = useRef<HTMLDivElement>(null);
  const candidates = useMemo(() => filterNoteTargets(targets, tabId, query?.query ?? ""), [targets, tabId, query?.query]);
  const close = () => { dismissed.current = JSON.stringify(query); setQuery(null); };
  const refresh = (editor: HTMLTextAreaElement) => {
    if (document.activeElement !== editor) return;
    const next = getNoteReferenceQuery(editor.value, editor.selectionStart, editor.selectionEnd);
    if (!next) { dismissed.current = ""; setQuery(null); return; }
    if (dismissed.current === JSON.stringify(next)) { setQuery(null); return; }
    if (next.start !== query?.start || next.query !== query?.query) setActive(0);
    setQuery(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    revealMirror();
    const caret = getTextCaretPositions(mirrorRef.current, [editor.selectionStart], editor.value)[0];
    const rect = editor.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left + (caret?.left ?? 12), window.innerWidth - width - 12));
    const y = Math.max(12, Math.min(rect.top + (caret?.top ?? 12), window.innerHeight - 36));
    const below = window.innerHeight - y - 36;
    const above = below < 160 && y > 180;
    const maxHeight = Math.min(260, above ? y - 20 : Math.max(64, below));
    setPosition({ left, top: above ? Math.max(12, y - maxHeight - 4) : y + (caret?.height ?? 20) + 4, width, maxHeight });
  };
  useEffect(() => { setQuery(null); dismissed.current = ""; }, [tabId]);
  useEffect(() => {
    if (!query) return;
    const outside = (event: globalThis.MouseEvent) => {
      if (event.target !== editorRef.current && !popupRef.current?.contains(event.target as Node)) setQuery(null);
    };
    const hide = () => setQuery(null);
    document.addEventListener("mousedown", outside, true);
    window.addEventListener("resize", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("mousedown", outside, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("blur", hide);
    };
  }, [Boolean(query), editorRef]);
  useEffect(() => { popupRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [active]);
  const choose = (index: number) => {
    const editor = editorRef.current, target = candidates[index];
    if (!editor || !query || !target) return;
    const current = getNoteReferenceQuery(editor.value, editor.selectionStart, editor.selectionEnd);
    if (JSON.stringify(current) !== JSON.stringify(query)) { setQuery(null); return; }
    const link = createNoteReference(target);
    editor.focus({ preventScroll: true });
    insert(editor.value.slice(0, query.start) + link + editor.value.slice(query.end), query.start + link.length);
    setQuery(null); dismissed.current = "";
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!query || event.nativeEvent.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return false;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Escape") close();
    else if (event.key === "Enter") { if (candidates.length) choose(Math.min(active, candidates.length - 1)); else close(); }
    else if (candidates.length) setActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + candidates.length) % candidates.length);
    return true;
  };
  const selected = Math.min(active, Math.max(0, candidates.length - 1));
  const popup = query ? createPortal(<div ref={popupRef} className="note-reference-picker" style={position}
    role="listbox" aria-label={uiText("关联笔记")} onMouseDown={event => event.preventDefault()}>
    <div className="note-reference-picker-heading">{uiText("关联笔记")}<small>↑ ↓ · Enter · Esc</small></div>
    {candidates.length ? candidates.map((target, index) => <button key={target.id} type="button" role="option"
      aria-selected={index === selected} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>
      <span className="note-reference-symbol">{target.kind === "canvas" ? "◇" : "▤"}</span>
      <span className="note-reference-title">{target.title}</span>
      <small>{target.kind === "canvas" ? uiText("画板") : uiText("文本")}</small>
    </button>) : <p className="note-reference-empty">{uiText("没有匹配的其他笔记")}</p>}
  </div>, document.body) : null;
  return { refresh, onKeyDown, popup, close };
}
