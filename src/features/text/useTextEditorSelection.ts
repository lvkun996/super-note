import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";
import type { TextSelection } from "../../appTypes";
import { getTextOffsetAtPoint } from "../editor/editorUtils";
import { deleteAtCarets, insertAtCarets } from "./multiCaret";

const LONG_PRESS_DELAY_MS = 360;
const LONG_PRESS_MOVE_TOLERANCE_PX = 4;

type Point = { x: number; y: number };
type VerticalSelection = { anchor: Point };

type UseTextEditorSelectionOptions = {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  mirrorRef: RefObject<HTMLElement | null>;
  content: string;
  onContentChange: (content: string) => void;
  onSelectionChange: (selection: TextSelection) => void;
};

function getLineHeight(editor: HTMLTextAreaElement) {
  const styles = window.getComputedStyle(editor);
  return Number.parseFloat(styles.lineHeight) || (Number.parseFloat(styles.fontSize) || 13) * 1.65;
}

function getVerticalCarets(editor: HTMLTextAreaElement, mirror: HTMLElement, anchor: Point, pointerY: number) {
  const lineHeight = getLineHeight(editor);
  const rowDelta = Math.round((pointerY - anchor.y) / lineHeight);
  const direction = rowDelta < 0 ? -1 : 1;
  const orderedCarets = Array.from({ length: Math.abs(rowDelta) + 1 }, (_, index) =>
    getTextOffsetAtPoint(editor, mirror, anchor.x, anchor.y + index * lineHeight * direction),
  );
  return {
    orderedCarets,
    uniqueCarets: Array.from(new Set(orderedCarets)).sort((a, b) => a - b),
  };
}

export function useTextEditorSelection({
  editorRef,
  mirrorRef,
  content,
  onContentChange,
  onSelectionChange,
}: UseTextEditorSelectionOptions) {
  const [multiCarets, setMultiCarets] = useState<number[]>([]);
  const longPressTimerRef = useRef<number | null>(null);
  const pendingLongPressRef = useRef<Point | null>(null);
  const verticalSelectionRef = useRef<VerticalSelection | null>(null);

  const cancelPendingLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingLongPressRef.current = null;
  }, []);

  const clearMultiCarets = useCallback(() => setMultiCarets([]), []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const pendingLongPress = pendingLongPressRef.current;
      if (
        pendingLongPress &&
        Math.hypot(event.clientX - pendingLongPress.x, event.clientY - pendingLongPress.y) > LONG_PRESS_MOVE_TOLERANCE_PX
      ) {
        cancelPendingLongPress();
      }

      const editor = editorRef.current;
      const verticalSelection = verticalSelectionRef.current;
      if (!editor || !verticalSelection) return;

      event.preventDefault();
      editor.focus({ preventScroll: true });

      const mirror = mirrorRef.current;
      if (!mirror) return;
      const { orderedCarets, uniqueCarets } = getVerticalCarets(editor, mirror, verticalSelection.anchor, event.clientY);
      const primaryCaret = orderedCarets.at(-1) ?? 0;
      setMultiCarets(uniqueCarets);
      editor.setSelectionRange(primaryCaret, primaryCaret);
      onSelectionChange({ start: primaryCaret, end: primaryCaret });
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 0 && event.button !== 1) return;
      cancelPendingLongPress();
      verticalSelectionRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      cancelPendingLongPress();
      verticalSelectionRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [cancelPendingLongPress, editorRef, mirrorRef, onSelectionChange]);

  const handleSelectionMouseDown = (event: ReactMouseEvent<HTMLTextAreaElement>) => {
    const editor = event.currentTarget;
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      clearMultiCarets();
      const anchor = { x: event.clientX, y: event.clientY };
      const offset = getTextOffsetAtPoint(editor, mirrorRef.current, event.clientX, event.clientY);
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(offset, offset);
      verticalSelectionRef.current = { anchor };
      setMultiCarets([offset]);
      onSelectionChange({ start: offset, end: offset });
      return true;
    }

    if (event.button !== 0) return false;
    clearMultiCarets();
    const mirror = mirrorRef.current;
    if (!mirror) return false;

    const anchor = { x: event.clientX, y: event.clientY };
    const anchorOffset = getTextOffsetAtPoint(editor, mirror, anchor.x, anchor.y);
    cancelPendingLongPress();
    pendingLongPressRef.current = anchor;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      pendingLongPressRef.current = null;
      verticalSelectionRef.current = { anchor };
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(anchorOffset, anchorOffset);
      setMultiCarets([anchorOffset]);
      onSelectionChange({ start: anchorOffset, end: anchorOffset });
    }, LONG_PRESS_DELAY_MS);
    return false;
  };

  const commitMultiCaretEdit = (nextContent: string, nextCarets: number[]) => {
    onContentChange(nextContent);
    setMultiCarets(nextCarets);
    const primaryCaret = nextCarets.at(-1) ?? 0;
    onSelectionChange({ start: primaryCaret, end: primaryCaret });
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      editor?.focus({ preventScroll: true });
      editor?.setSelectionRange(primaryCaret, primaryCaret);
    });
  };

  const handleMultiCaretKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (multiCarets.length < 2) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      clearMultiCarets();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return false;

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const result = deleteAtCarets(content, multiCarets, event.key === "Backspace" ? "backward" : "forward");
      commitMultiCaretEdit(result.content, result.carets);
      return true;
    }

    const insertion = event.key === "Enter" ? "\n" : event.key === "Tab" ? "\t" : event.key.length === 1 ? event.key : null;
    if (insertion === null) return false;
    event.preventDefault();
    const result = insertAtCarets(content, multiCarets, insertion);
    commitMultiCaretEdit(result.content, result.carets);
    return true;
  };

  const handleMultiCaretPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    if (multiCarets.length < 2) return false;
    event.preventDefault();
    const result = insertAtCarets(content, multiCarets, event.clipboardData.getData("text"));
    commitMultiCaretEdit(result.content, result.carets);
    return true;
  };

  return {
    multiCarets,
    clearMultiCarets,
    handleSelectionMouseDown,
    handleMultiCaretKeyDown,
    handleMultiCaretPaste,
  };
}
