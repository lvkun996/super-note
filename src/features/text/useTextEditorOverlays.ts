import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FileDocumentMode, TextAnchor } from "../../appTypes";
import { getTextSelectionRectangles, type SelectionRectangle } from "./textSelectionLayout";
import { getTextCaretPositions, type TextCaretPosition } from "./textCaretLayout";

type AnchorPosition = TextCaretPosition & { id: string; index: number };
type OverlayOptions = {
  mirrorRef: RefObject<HTMLElement | null>;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  carets: number[];
  selectionLayerRef: RefObject<HTMLDivElement | null>;
  anchors: TextAnchor[];
  content: string;
  fontSize: number;
  searchValue: string;
  documentMode: FileDocumentMode;
  editorOpen: boolean;
};

function samePosition(left: TextCaretPosition, right: TextCaretPosition) {
  return left.offset === right.offset && left.left === right.left && left.top === right.top && left.height === right.height;
}

export function useTextEditorOverlays({ mirrorRef, editorRef, carets, selectionLayerRef, anchors, content, fontSize, searchValue, documentMode, editorOpen }: OverlayOptions) {
  const [caretPositions, setCaretPositions] = useState<TextCaretPosition[]>([]);
  const [anchorPositions, setAnchorPositions] = useState<AnchorPosition[]>([]);
  const selectionRectanglesRef = useRef<SelectionRectangle[]>([]);
  const paintedLayerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const editor = editorRef.current;
    const layer = selectionLayerRef.current;
    const nativeSelection = { start: editor?.selectionStart ?? 0, end: editor?.selectionEnd ?? 0 };
    const nextSelection = getTextSelectionRectangles(mirrorRef.current, editor, content, nativeSelection);
    const current = selectionRectanglesRef.current;
    const unchanged = paintedLayerRef.current === layer && current.length === nextSelection.length && current.every((r, i) =>
      r.left === nextSelection[i].left && r.top === nextSelection[i].top && r.width === nextSelection[i].width && r.height === nextSelection[i].height);
    if (layer && !unchanged) {
      const fragment = document.createDocumentFragment();
      for (const rect of nextSelection) {
        const span = document.createElement("span");
        span.className = "file-text-selection";
        Object.assign(span.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        fragment.append(span);
      }
      layer.replaceChildren(fragment);
      selectionRectanglesRef.current = nextSelection;
      paintedLayerRef.current = layer;
    }
    if (carets.length === 0 && anchors.length === 0) {
      setCaretPositions((current) => current.length === 0 ? current : []);
      setAnchorPositions((current) => current.length === 0 ? current : []);
      return;
    }
    const measured = new Map(getTextCaretPositions(
      mirrorRef.current,
      [...carets, ...anchors.map((anchor) => anchor.end)],
      content.length,
    ).map((position) => [position.offset, position]));
    const nextCarets = carets.flatMap((offset) => {
      const position = measured.get(offset);
      return position ? [position] : [];
    });
    const maxLeft = Math.max(0, (editorRef.current?.clientWidth ?? 0) - 24);
    const nextAnchors = anchors.flatMap((anchor, index) => {
      const position = measured.get(anchor.end);
      return position ? [{ ...position, id: anchor.id, index: index + 1, left: Math.min(position.left, maxLeft) }] : [];
    });
    setCaretPositions((current) => {
      const unchanged = current.length === nextCarets.length && current.every((position, index) => samePosition(position, nextCarets[index]));
      return unchanged ? current : nextCarets;
    });
    setAnchorPositions((current) => {
      const unchanged = current.length === nextAnchors.length && current.every((position, index) => (
        position.id === nextAnchors[index].id && position.index === nextAnchors[index].index && samePosition(position, nextAnchors[index])
      ));
      return unchanged ? current : nextAnchors;
    });
  }, [anchors, carets, content, selectionLayerRef, editorRef, mirrorRef]);

  const scheduleOverlayMeasurement = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    const syncNativeSelection = () => {
      if (editorRef.current && document.activeElement === editorRef.current) scheduleOverlayMeasurement();
    };
    const syncDrag = (event: MouseEvent) => {
      if (event.buttons & 1) syncNativeSelection();
    };
    // React's onSelect intentionally waits for mouseup during a drag. Native
    // selectionchange also covers keyboard selection and textarea auto-scroll.
    // Paint only; never rerender or write selectionRange in this drag path.
    document.addEventListener("selectionchange", syncNativeSelection, true);
    document.addEventListener("select", syncNativeSelection, true);
    window.addEventListener("mousemove", syncDrag);
    return () => {
      document.removeEventListener("selectionchange", syncNativeSelection, true);
      document.removeEventListener("select", syncNativeSelection, true);
      window.removeEventListener("mousemove", syncDrag);
    };
  }, [editorRef, scheduleOverlayMeasurement]);

  useLayoutEffect(() => {
    measure();
    const mirror = mirrorRef.current;
    const observer = mirror ? new ResizeObserver(scheduleOverlayMeasurement) : null;
    if (observer && mirror) observer.observe(mirror);
    return () => {
      observer?.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [measure, scheduleOverlayMeasurement, mirrorRef, anchors.length, carets.length, content, fontSize, searchValue, documentMode, editorOpen]);

  return { caretPositions, anchorPositions, scheduleOverlayMeasurement };
}
