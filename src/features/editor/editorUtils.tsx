import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { ProgrammerAction, TextSelection } from "../../appTypes";

const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_URL_PUNCTUATION = /[),.;!?\]}，。！？；：、》】」』）]$/u;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimUrlPunctuation(value: string) {
  let url = value;
  while (url && TRAILING_URL_PUNCTUATION.test(url)) {
    url = url.slice(0, -1);
  }
  return url;
}

function renderHighlightedSegment(text: string, query: string, keyPrefix: string): ReactNode {
  const needle = query.trim();
  if (!needle) {
    return text;
  }

  const regex = new RegExp(`(${escapeRegExp(needle)})`, "gi");
  return text.split(regex).map((part, index) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={`${keyPrefix}-match-${index}`} className="search-mark">
        {part}
      </mark>
    ) : (
      <span key={`${keyPrefix}-text-${index}`}>{part}</span>
    ),
  );
}

export function renderHighlightedText(text: string, query: string): ReactNode {
  return renderHighlightedSegment(text, query, "highlight");
}

export function renderTextWithLinks(text: string, query: string): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  HTTP_URL_PATTERN.lastIndex = 0;

  while ((match = HTTP_URL_PATTERN.exec(text))) {
    const rawUrl = match[0];
    const url = trimUrlPunctuation(rawUrl);
    const start = match.index;
    if (start > cursor) {
      nodes.push(renderHighlightedSegment(text.slice(cursor, start), query, `plain-${cursor}`));
    }
    if (url) {
      nodes.push(
        <span
          key={`link-${start}`}
          className="text-http-link"
          data-http-url={url}
          title="按住 Ctrl 并单击，在外部浏览器中打开"
        >
          {renderHighlightedSegment(url, query, `link-${start}`)}
        </span>,
      );
    }
    const punctuation = rawUrl.slice(url.length);
    if (punctuation) {
      nodes.push(renderHighlightedSegment(punctuation, query, `punctuation-${start}`));
    }
    cursor = start + rawUrl.length;
  }

  if (cursor < text.length) {
    nodes.push(renderHighlightedSegment(text.slice(cursor), query, `plain-${cursor}`));
  }
  return nodes.length > 0 ? nodes : text;
}

export function findHttpUrlAtOffset(text: string, offset: number) {
  HTTP_URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTTP_URL_PATTERN.exec(text))) {
    const url = trimUrlPunctuation(match[0]);
    const start = match.index;
    const end = start + url.length;
    if (offset >= start && offset <= end) {
      return url;
    }
  }
  return null;
}

export function getMirrorTextOffsetAtPoint(
  editor: HTMLTextAreaElement,
  mirror: HTMLElement | null | undefined,
  clientX: number,
  clientY: number,
) {
  if (!mirror) {
    return null;
  }

  const editorPointerEvents = editor.style.pointerEvents;
  const mirrorPointerEvents = mirror.style.pointerEvents;
  try {
    editor.style.pointerEvents = "none";
    mirror.style.pointerEvents = "auto";
    const caretPosition = document.caretPositionFromPoint?.(clientX, clientY);
    const caretRange = caretPosition ? null : document.caretRangeFromPoint?.(clientX, clientY);
    const node = caretPosition?.offsetNode ?? caretRange?.startContainer;
    const offset = caretPosition?.offset ?? caretRange?.startOffset;
    if (!node || offset == null || !mirror.contains(node)) {
      return null;
    }

    const range = document.createRange();
    range.selectNodeContents(mirror);
    range.setEnd(node, offset);
    return Math.min(editor.value.length, range.toString().replace(/\u200b/g, "").length);
  } finally {
    editor.style.pointerEvents = editorPointerEvents;
    mirror.style.pointerEvents = mirrorPointerEvents;
  }
}

export async function openExternalUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }
  if (window.superNote?.openExternal) {
    const result = await window.superNote.openExternal(url);
    return result?.ok !== false;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

export async function readClipboardText() {
  if (window.superNote?.readClipboardText) {
    return window.superNote.readClipboardText();
  }
  return navigator.clipboard?.readText?.() ?? "";
}

export async function writeClipboardText(text: string) {
  if (window.superNote?.writeClipboardText) {
    await window.superNote.writeClipboardText(text);
    return;
  }
  await navigator.clipboard?.writeText?.(text);
}

export function getTextSelection(editor: HTMLTextAreaElement): TextSelection {
  return {
    start: Math.min(editor.selectionStart, editor.selectionEnd),
    end: Math.max(editor.selectionStart, editor.selectionEnd),
  };
}

export function placeCaretAtEndForBlankArea(
  event: ReactMouseEvent<HTMLTextAreaElement>,
  endMarker: HTMLElement | null | undefined,
) {
  if (event.button !== 0 || event.shiftKey || event.ctrlKey || !endMarker) {
    return false;
  }

  const editor = event.currentTarget;
  const editorRect = editor.getBoundingClientRect();
  const scrollbarWidth = editor.offsetWidth - editor.clientWidth;
  const scrollbarHeight = editor.offsetHeight - editor.clientHeight;
  const onVerticalScrollbar = scrollbarWidth > 0 && event.clientX >= editorRect.right - scrollbarWidth;
  const onHorizontalScrollbar = scrollbarHeight > 0 && event.clientY >= editorRect.bottom - scrollbarHeight;
  if (onVerticalScrollbar || onHorizontalScrollbar) {
    return false;
  }

  const markerRect = endMarker.getBoundingClientRect();
  const belowLastLine = event.clientY > markerRect.bottom;
  const toRightOfTextEnd =
    event.clientY >= markerRect.top &&
    event.clientY <= markerRect.bottom &&
    event.clientX >= markerRect.left;
  if (!belowLastLine && !toRightOfTextEnd) {
    return false;
  }

  event.preventDefault();
  editor.focus({ preventScroll: true });
  const end = editor.value.length;
  editor.setSelectionRange(end, end);
  return true;
}

export function transformJsonText(text: string, action: ProgrammerAction) {
  if (action === "format-json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return JSON.stringify(text, null, 2);
    }
  }
  if (action === "minify-json") {
    return JSON.stringify(JSON.parse(text));
  }

  const first = JSON.parse(text);
  const parsed = typeof first === "string" ? JSON.parse(first) : first;
  return JSON.stringify(parsed, null, 2);
}

export function continueOrderedList(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  onChange: (content: string) => void,
) {
  if (
    event.key !== "Enter" ||
    !event.shiftKey ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.nativeEvent.isComposing
  ) {
    return;
  }

  const editor = event.currentTarget;
  const selectionStart = editor.selectionStart;
  const selectionEnd = editor.selectionEnd;
  const lineStart = selectionStart === 0 ? 0 : editor.value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextLineBreak = editor.value.indexOf("\n", selectionStart);
  const lineEnd = nextLineBreak < 0 ? editor.value.length : nextLineBreak;
  const currentLine = editor.value.slice(lineStart, lineEnd).replace(/\r$/, "");
  const match = /^(\s*)(\d+)([.)])(\s+)(.*)$/.exec(currentLine);
  if (!match) {
    return;
  }

  const currentNumber = Number(match[2]);
  if (!Number.isSafeInteger(currentNumber)) {
    return;
  }

  event.preventDefault();
  const nextNumber = String(currentNumber + 1).padStart(match[2].length, "0");
  const insertion = `\n${match[1]}${nextNumber}${match[3]}${match[4]}`;
  const nextContent = `${editor.value.slice(0, selectionStart)}${insertion}${editor.value.slice(selectionEnd)}`;
  const nextCaret = selectionStart + insertion.length;
  onChange(nextContent);
  window.requestAnimationFrame(() => {
    editor.focus();
    editor.setSelectionRange(nextCaret, nextCaret);
  });
}
