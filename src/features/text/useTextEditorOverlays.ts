import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FileDocumentMode, TextAnchor } from "../../appTypes";
import { getTextCaretPositions, type TextCaretPosition } from "./textCaretLayout";

type AnchorPosition = TextCaretPosition & { id: string; index: number };
type OverlayOptions = {
  mirrorRef: RefObject<HTMLElement | null>;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  carets: number[];
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

export function useTextEditorOverlays({ mirrorRef, editorRef, carets, anchors, content, fontSize, searchValue, documentMode, editorOpen }: OverlayOptions) {
  const [caretPositions, setCaretPositions] = useState<TextCaretPosition[]>([]);
  const [anchorPositions, setAnchorPositions] = useState<AnchorPosition[]>([]);
  const frameRef = useRef<number | null>(null);

  const measure = useCallback(() => {
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
  }, [anchors, carets, content.length, editorRef, mirrorRef]);

  const scheduleOverlayMeasurement = useCallback(() => {
    if (frameRef.current !== null || (carets.length === 0 && anchors.length === 0)) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [anchors.length, carets.length, measure]);

  useLayoutEffect(() => {
    measure();
    const mirror = mirrorRef.current;
    const observer = mirror && (carets.length > 0 || anchors.length > 0)
      ? new ResizeObserver(scheduleOverlayMeasurement)
      : null;
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
