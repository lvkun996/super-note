import { captureEditorSelection, clampEditorSelection, createTextHistoryEntry, type EditorSelectionState, type TextEditMetadata, type TextHistoryRestore } from "../history/textHistory";
import { uiText } from "../../../electron/uiLanguage";
import { AimOutlined, CloseOutlined, CodeOutlined, CopyOutlined, EditOutlined, EllipsisOutlined, ScissorOutlined, SnippetsOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tooltip, message } from "antd";
import type { MenuProps } from "antd";
import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";
import type { FileTab, FileViewState, ProgrammerAction, TextAnchor, TextSearchTarget, TextSelection } from "../../appTypes";
import {
  continueOrderedList,
  findHttpUrlAtOffset,
  getTextOffsetAtPoint,
  getTextSelection,
  openExternalUrl,
  placeCaretAtEndForBlankArea,
  readClipboardText,
  renderTextWithLinks,
  trimTextSelectionWhitespace,
  writeClipboardText,
} from "../editor/editorUtils";
import { useTextEditorSelection } from "./useTextEditorSelection";
import { useTextEditorOverlays } from "./useTextEditorOverlays";
import { getFileDocumentMode } from "./fileDocument";
import { getTextCaretPositions } from "./textCaretLayout";
import { getTextAnchorLine } from "./textAnchors";
import { normalizeTextLineEndings } from "./textLineEndings";
import { MarkdownEditorModal } from "./MarkdownEditorModal";
import { MarkdownContent } from "./MarkdownContent";
import { findLocalFileAtOffset, getLocalFileLinks } from "./localFileLinks";
import { getNoteReferences, noteIdFromUrl, type NoteReferenceTarget } from "./noteReferences";
import { useNoteReferencePicker } from "./useNoteReferencePicker";
import { NoteReferenceText } from "./NoteReferenceText";

const EMPTY_SELECTION: TextSelection = { start: 0, end: 0 };
const EMPTY_ANCHORS: TextAnchor[] = [];
const EMPTY_NOTE_TARGETS: NoteReferenceTarget[] = [];

type FileViewProps = {
  tab: FileTab;
  noteTargets?: readonly NoteReferenceTarget[];
  onOpenNote?: (id: string) => void;
  showTitleBar?: boolean;
  title?: string;
  titleMenuItems?: MenuProps["items"];
  searchValue: string;
  searchTarget: TextSearchTarget | null;
  programmerMode: boolean;
  viewState?: FileViewState;
  onViewStateChange: (patch: Partial<FileViewState>) => void;
  onContentChange: (content: string, metadata?: TextEditMetadata) => void;
  historyRestore?: TextHistoryRestore | null;
  onHistoryRestoreHandled?: (requestId: number) => void;
  onAddTextAnchor: (selectionStart: number, selectionEnd: number) => void;
  onRemoveTextAnchor: (anchorId: string) => void;
  onFontSizeChange: (delta: number) => void;
  onProgrammerAction: (action: ProgrammerAction, selectionStart: number, selectionEnd: number) => void;
  onSearchTargetHandled: (requestId: number) => void;
};

const CALLBACK_KEYS = ["onOpenNote", "onViewStateChange", "onContentChange", "onHistoryRestoreHandled", "onAddTextAnchor", "onRemoveTextAnchor", "onFontSizeChange", "onProgrammerAction", "onSearchTargetHandled"] as const;
type MenuItem = NonNullable<MenuProps["items"]>[number];
function sameMenu(left: MenuProps["items"], right: MenuProps["items"]) {
  return left?.length === right?.length && (left ?? []).every((item, index) => {
    const other = right?.[index];
    if (!item || !other) return item === other;
    const keys = new Set([...Object.keys(item), ...Object.keys(other)]);
    return [...keys].every(key => key === "onClick" || (item as unknown as Record<string, unknown>)[key] === (other as unknown as Record<string, unknown>)[key]);
  });
}

// Parent callbacks may be recreated on every keystroke. Forward events to the
// latest props while allowing untouched panes to skip rendering entirely.
export function FileView(props: FileViewProps) {
  const latest = useRef(props);
  latest.current = props;
  const events = useMemo(() => Object.fromEntries(CALLBACK_KEYS.map(key => [key, (...args: unknown[]) => {
    const handler = latest.current[key] as ((...args: unknown[]) => unknown) | undefined;
    return handler?.(...args);
  }])) as Pick<FileViewProps, typeof CALLBACK_KEYS[number]>, []);
  const menus = useRef<{ source: MenuProps["items"]; items: MenuProps["items"] } | null>(null);
  if (!menus.current || !sameMenu(menus.current.source, props.titleMenuItems)) {
    menus.current = { source: props.titleMenuItems, items: props.titleMenuItems?.map((item, index): MenuItem => {
      if (!item || !("onClick" in item) || !item.onClick) return item;
      return { ...item, onClick: info => {
        const current = latest.current.titleMenuItems?.[index];
        if (current && "onClick" in current) current.onClick?.(info);
      } };
    }) };
  }
  return <MemoFileEditor {...props} {...events} titleMenuItems={menus.current.items} />;
}
const MemoFileEditor = memo(FileEditor);

function FileEditor({
  tab,
  noteTargets = EMPTY_NOTE_TARGETS,
  onOpenNote,
  showTitleBar = true,
  title,
  titleMenuItems,
  searchValue,
  searchTarget,
  programmerMode,
  viewState,
  onViewStateChange,
  onContentChange: onDocumentChange,
  historyRestore,
  onHistoryRestoreHandled,
  onAddTextAnchor,
  onRemoveTextAnchor,
  onFontSizeChange,
  onProgrammerAction,
  onSearchTargetHandled,
}: FileViewProps) {
  const markdownClientKey = useId();
  const selectionLayerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const markdownPreviewRef = useRef<HTMLDivElement>(null);
  const markdownLivePreviewRef = useRef<HTMLDivElement>(null);
  const markdownScrollSyncRef = useRef<"source" | "preview" | null>(null);
  const markdownScrollSnapshotRef = useRef<{ sourceTop: number; sourceLeft: number; previewTop: number } | null>(null);
  const restoredViewRef = useRef<string | null>(null);
  const [markdownEditorOpen, setMarkdownEditorOpen] = useState(false);
  const [textReferenceEditorId, setTextReferenceEditorId] = useState<string | null>(null);
  const pendingReferenceAnchor = useRef<TextAnchor | null>(null);
  const [anchorMenuOpen, setAnchorMenuOpen] = useState(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [selection, setSelection] = useState<TextSelection>(EMPTY_SELECTION);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);
  const [messageApi, messageContext] = message.useMessage();
  const [markdownRender, setMarkdownRender] = useState<{
    tabId: string;
    content: string;
    filePath?: string;
    blocks: string[];
  } | null>(null);
  const fontSize = tab.fontSize ?? 13;
  const documentMode = getFileDocumentMode(tab);
  const noteReferences = useMemo(() => getNoteReferences(tab.content), [tab.content]);
  const hasTextReferences = documentMode === "text" && noteReferences.length > 0;
  const textReferencePreview = hasTextReferences && textReferenceEditorId !== tab.id;
  const hasSelection = selection.end > selection.start;
  const textAnchors = tab.textAnchors ?? EMPTY_ANCHORS;
  const activeSearchTarget = searchTarget?.tabId === tab.id ? searchTarget : null;
  const displayTitle = title?.trim() || tab.title.trim() || uiText("未命名文本");
  const editActionTitle = hasTextReferences && !textReferencePreview ? uiText("完成") : uiText("编辑");
  const titleBar = (
    <header className="file-title-bar" aria-label={uiText("文档标题栏")}>
      <h1 className="file-title" title={displayTitle}>{displayTitle}</h1>
      <Tooltip
        title={textAnchors.length > 0 ? uiText("锚点") : uiText("选中文本后右键设为锚点")}
        placement="bottom"
      >
        <Dropdown
          menu={{
            items: textAnchors.map((anchor, index) => ({
              key: anchor.id,
              className: activeAnchorId === anchor.id ? "text-anchor-menu-item-active" : undefined,
              label: (
                <div className="text-anchor-menu-label">
                  <span className="text-anchor-menu-text"><b>{index + 1}.</b>{anchor.label}</span>
                  <button
                    type="button"
                    className="text-anchor-menu-remove"
                    aria-label={uiText("移除锚点 {0}", [index + 1])}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveTextAnchor(anchor.id);
                    }}
                  >
                    <CloseOutlined />
                  </button>
                </div>
              ),
              onClick: () => {
                jumpToTextAnchor(anchor);
                setAnchorMenuOpen(false);
              },
            })),
          }}
          trigger={["click"]}
          placement="bottomRight"
          overlayClassName="tab-context-menu text-anchor-dropdown"
          open={anchorMenuOpen && textAnchors.length > 0}
          onOpenChange={(open) => {
            if (open && documentMode === "markdown" && !markdownEditorOpen) {
              setMarkdownEditorOpen(true);
            }
            setAnchorMenuOpen(open && textAnchors.length > 0);
          }}
        >
          <Button
            type="text"
            className={`file-title-anchor${anchorMenuOpen ? " active" : ""}`}
            icon={<AimOutlined />}
            aria-label={uiText("锚点")}
            aria-expanded={anchorMenuOpen && textAnchors.length > 0}
          >
            {textAnchors.length > 0 ? <span className="file-title-anchor-count">{textAnchors.length}</span> : null}
          </Button>
        </Dropdown>
      </Tooltip>
      {documentMode === "markdown" || hasTextReferences ? (
        <Tooltip title={editActionTitle} placement="bottom">
          <Button
            type="text"
            className="file-title-edit"
            icon={<EditOutlined />}
            aria-label={editActionTitle}
            onClick={() => documentMode === "markdown" ? setMarkdownEditorOpen(true) : setTextReferenceEditorId(textReferencePreview ? tab.id : null)}
          />
        </Tooltip>
      ) : null}
      {titleMenuItems?.length ? (
        <Dropdown menu={{ items: titleMenuItems }} trigger={["click"]} overlayClassName="tab-context-menu" placement="bottomLeft">
          <Button type="text" className="file-title-more" icon={<EllipsisOutlined />} aria-label={uiText("文档操作")} />
        </Dropdown>
      ) : null}
    </header>
  );

  const lastSelectionRef = useRef<EditorSelectionState | null>(null);
  const pendingBeforeInputRef = useRef<EditorSelectionState | null>(null);
  const pendingProgrammaticSelectionRef = useRef<{ content: string; selection: EditorSelectionState } | null>(null);
  const compositionRef = useRef<{ before: EditorSelectionState; group: string } | null>(null);
  const multiCaretsRef = useRef<number[]>([]);
  const restoredHistoryRef = useRef<number | null>(null);

  const onContentChange = (content: string, metadata?: TextEditMetadata) => {
    const editor = editorRef.current;
    if (editor && documentMode === "text") setTextReferenceEditorId(tab.id);
    let inferred: ReturnType<typeof createTextHistoryEntry> | undefined;
    const infer = () => inferred ??= createTextHistoryEntry(tab.content, content);
    const before = metadata?.before ?? compositionRef.current?.before ?? pendingBeforeInputRef.current ?? infer().before.selection;
    const after = metadata?.after ?? (editor && editor.value === content
      ? captureEditorSelection(editor) : { ...before, ...infer().after.selection, scrollTop: before.scrollTop, scrollLeft: before.scrollLeft });
    pendingBeforeInputRef.current = null;
    onDocumentChange(content, { before, after, group: metadata?.group ?? compositionRef.current?.group });
  };

  const commitProgrammaticEdit = (content: string, caret: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const before = captureEditorSelection(editor);
    const after: EditorSelectionState = { ...before, selectionStart: caret, selectionEnd: caret, selectionDirection: "none" };
    pendingProgrammaticSelectionRef.current = { content, selection: after };
    onContentChange(content, { before, after });
  };

  const {
    multiCarets,
    restoreMultiCarets,
    clearMultiCarets,
    handleSelectionMouseDown,
    handleMultiCaretKeyDown,
    handleMultiCaretPaste,
  } = useTextEditorSelection({
    editorRef,
    mirrorRef: highlightRef,
    content: tab.content,
    onContentChange,
    onSelectionChange: setSelection,
  });

  multiCaretsRef.current = multiCarets;

  const beforeInputListenerRef = useRef<{ editor: HTMLTextAreaElement; listener: () => void } | null>(null);
  const attachEditorRef = useCallback((editor: HTMLTextAreaElement | null) => {
    const previousListener = beforeInputListenerRef.current;
    previousListener?.editor.removeEventListener("beforeinput", previousListener.listener);
    beforeInputListenerRef.current = null;
    editorRef.current = editor;
    if (!editor) return;
    const captureBeforeInput = () => {
      const current = captureEditorSelection(editor, multiCaretsRef.current);
      const candidates = [pendingBeforeInputRef.current, lastSelectionRef.current];
      const previous = candidates.find(state => state?.selectionStart === current.selectionStart && state.selectionEnd === current.selectionEnd);
      // Preserve the user's direction if Chromium normalized it before input.
      if (previous) current.selectionDirection = previous.selectionDirection;
      pendingBeforeInputRef.current = current;
    };
    editor.addEventListener("beforeinput", captureBeforeInput);
    beforeInputListenerRef.current = { editor, listener: captureBeforeInput };
  }, []);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    const saved = lastSelectionRef.current;
    // React restores selection endpoints during commits, but omits direction.
    // Repair that single attribute only while the endpoints still match; never
    // control the caret during normal typing or navigation.
    if (editor && saved && saved.selectionStart !== saved.selectionEnd &&
        editor.selectionStart === saved.selectionStart && editor.selectionEnd === saved.selectionEnd &&
        editor.selectionDirection !== saved.selectionDirection) {
      editor.setSelectionRange(saved.selectionStart, saved.selectionEnd, saved.selectionDirection);
    }
  });

  const { caretPositions, anchorPositions, scheduleOverlayMeasurement, revealMirror } = useTextEditorOverlays({
    mirrorRef: highlightRef,
    editorRef,
    carets: multiCarets,
    selectionLayerRef,
    anchors: textAnchors,
    content: tab.content,
    fontSize,
    searchValue,
    searchRequestId: activeSearchTarget?.requestId,
    documentMode,
    editorOpen: markdownEditorOpen || !textReferencePreview,
    requiresMirror: documentMode === "text" && (Boolean(searchValue.trim()) || Boolean(activeSearchTarget) || /https?:\/\/|super-note:\/\/|[a-z]:[\\/]|\\\\/i.test(tab.content)),
  });

  const references = useNoteReferencePicker({ tabId: tab.id, targets: noteTargets, editorRef, mirrorRef: highlightRef, revealMirror,
    insert: (content, caret) => { clearMultiCarets(); commitProgrammaticEdit(content, caret); } });
  const openLocalPath = async (filePath: string) => {
    try {
      const result = await window.superNote?.openPath(filePath);
      if (!result?.ok) messageApi.error(uiText("无法打开文件，请确认路径存在且已设置默认应用"));
    } catch { messageApi.error(uiText("无法打开文件，请确认路径存在且已设置默认应用")); }
  };

  useEffect(() => {
    setMarkdownEditorOpen(false);
    setTextReferenceEditorId(null);
    pendingReferenceAnchor.current = null;
    setAnchorMenuOpen(false);
    setActiveAnchorId(null);
    setSelection(EMPTY_SELECTION);
    clearMultiCarets();
  }, [clearMultiCarets, documentMode, tab.id]);

  useLayoutEffect(() => {
    // Saved state is a tab/mode entry snapshot, not a controlled caret value.
    // Reapplying it after input rewinds the native caret to the previous keystroke.
    const viewKey = JSON.stringify([tab.id, documentMode, markdownEditorOpen, textReferencePreview]);
    if (restoredViewRef.current === viewKey) return;
    restoredViewRef.current = viewKey;
    pendingBeforeInputRef.current = null;
    pendingProgrammaticSelectionRef.current = null;
    compositionRef.current = null;
    lastSelectionRef.current = null;
    const editor = editorRef.current;
    if (editor && viewState) {
      editor.scrollTop = viewState.editorScrollTop;
      editor.scrollLeft = viewState.editorScrollLeft;
      const start = Math.max(0, Math.min(viewState.selectionStart, editor.value.length));
      const end = Math.max(start, Math.min(viewState.selectionEnd, editor.value.length));
      editor.setSelectionRange(start, end, viewState.selectionDirection);
      lastSelectionRef.current = captureEditorSelection(editor);
      setSelection({ start, end });
      if (highlightRef.current) {
        highlightRef.current.scrollTop = viewState.editorScrollTop;
        highlightRef.current.scrollLeft = viewState.editorScrollLeft;
      }
    }
    if (markdownPreviewRef.current && viewState) {
      markdownPreviewRef.current.scrollTop = viewState.previewScrollTop;
    }
    if (markdownLivePreviewRef.current && viewState) {
      markdownLivePreviewRef.current.scrollTop = viewState.livePreviewScrollTop;
    }
  }, [documentMode, markdownEditorOpen, textReferencePreview, tab.id, viewState]);

  useLayoutEffect(() => {
    if (hasTextReferences && !textReferencePreview) {
      editorRef.current?.focus({ preventScroll: true });
      const anchor = pendingReferenceAnchor.current;
      pendingReferenceAnchor.current = null;
      if (anchor) jumpToTextAnchor(anchor);
    }
  }, [hasTextReferences, textReferencePreview]);

  useLayoutEffect(() => {
    const request = historyRestore?.tabId === tab.id ? historyRestore : null;
    const pending = pendingProgrammaticSelectionRef.current;
    const restoreHistory = request && request.requestId !== restoredHistoryRef.current && request.content === tab.content;
    if (!restoreHistory && (!pending || pending.content !== tab.content)) return;
    if (documentMode === "markdown" && !markdownEditorOpen) { setMarkdownEditorOpen(true); return; }
    const editor = editorRef.current;
    if (!editor) return;
    const state = clampEditorSelection(restoreHistory ? request.selection : pending!.selection, editor.value.length);
    if (restoreHistory) {
      restoredHistoryRef.current = request.requestId;
      markdownScrollSnapshotRef.current = null;
      pendingBeforeInputRef.current = null;
      restoreMultiCarets(state.carets ?? []);
    }
    pendingProgrammaticSelectionRef.current = null;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(state.selectionStart, state.selectionEnd, state.selectionDirection);
    editor.scrollTop = state.scrollTop;
    editor.scrollLeft = state.scrollLeft;
    if (highlightRef.current) { highlightRef.current.scrollTop = editor.scrollTop; highlightRef.current.scrollLeft = editor.scrollLeft; }
    setSelection({ start: state.selectionStart, end: state.selectionEnd });
    lastSelectionRef.current = captureEditorSelection(editor, state.carets);
    onViewStateChange({ selectionStart: state.selectionStart, selectionEnd: state.selectionEnd, selectionDirection: state.selectionDirection, editorScrollTop: editor.scrollTop, editorScrollLeft: editor.scrollLeft });
    if (restoreHistory) onHistoryRestoreHandled?.(request.requestId);
  }, [historyRestore, tab.id, tab.content, documentMode, markdownEditorOpen, restoreMultiCarets]);

  useEffect(() => {
    if (documentMode !== "markdown" || tab.isPreviewOnly) {
      setMarkdownRender(null);
      return;
    }
    let active = true;
    let cancel: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      void (async () => {
        const client = await import("./markdownWorkerClient");
        if (!active) return;
        cancel = () => client.cancelMarkdownRender(markdownClientKey);
        let blocks: string[] | null;
        try { blocks = await client.renderMarkdownInWorker(markdownClientKey, tab.content, tab.filePath); }
        catch {
          if (!active) return;
          // Preserve editing in environments without worker support.
          const { renderMarkdownBlocks } = await import("./markdownRenderer");
          blocks = renderMarkdownBlocks(tab.content, tab.filePath);
        }
        if (active && blocks !== null) setMarkdownRender({ tabId: tab.id, content: tab.content, filePath: tab.filePath, blocks });
      })();
    }, markdownRender?.tabId === tab.id ? 120 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
      cancel?.();
    };
  }, [documentMode, tab.content, tab.filePath, tab.id, markdownClientKey]);

  useLayoutEffect(() => {
    if (documentMode !== "markdown" || !markdownEditorOpen || markdownRender?.content !== tab.content) {
      return;
    }
    const snapshot = markdownScrollSnapshotRef.current;
    const source = editorRef.current;
    const preview = markdownLivePreviewRef.current;
    if (!snapshot || !source || !preview) {
      return;
    }

    source.scrollTop = snapshot.sourceTop;
    source.scrollLeft = snapshot.sourceLeft;
    const sourceMax = Math.max(0, source.scrollHeight - source.clientHeight);
    const previewMax = Math.max(0, preview.scrollHeight - preview.clientHeight);
    const ratio = sourceMax > 0
      ? Math.min(1, Math.max(0, snapshot.sourceTop / sourceMax))
      : previewMax > 0
        ? Math.min(1, Math.max(0, snapshot.previewTop / previewMax))
        : 0;
    markdownScrollSyncRef.current = "source";
    preview.scrollTop = ratio * previewMax;
    markdownScrollSnapshotRef.current = null;
    window.requestAnimationFrame(() => {
      if (markdownScrollSyncRef.current === "source") {
        markdownScrollSyncRef.current = null;
      }
    });
    onViewStateChange({
      editorScrollTop: source.scrollTop,
      editorScrollLeft: source.scrollLeft,
      livePreviewScrollTop: preview.scrollTop,
    });
  }, [documentMode, markdownEditorOpen, markdownRender?.content, tab.content]);

  useEffect(() => {
    if (!activeSearchTarget) {
      return;
    }
    if (documentMode === "markdown" && !markdownEditorOpen) {
      setMarkdownEditorOpen(true);
      return;
    }
    if (textReferencePreview) {
      setTextReferenceEditorId(tab.id);
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const start = Math.max(0, Math.min(activeSearchTarget.selectionStart, editor.value.length));
    const end = Math.max(start, Math.min(activeSearchTarget.selectionEnd, editor.value.length));
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(start, end);
    setSelection({ start, end });

    const positionMarker = highlightRef.current?.querySelector<HTMLElement>(".file-search-position-marker");
    if (positionMarker) {
      const editorRect = editor.getBoundingClientRect();
      const markerRect = positionMarker.getBoundingClientRect();
      const markerTop = editor.scrollTop + markerRect.top - editorRect.top;
      editor.scrollTop = Math.max(0, markerTop - editor.clientHeight * 0.42);
    } else {
      const lineHeight = Number.parseFloat(window.getComputedStyle(editor).lineHeight) || fontSize * 1.65;
      const line = editor.value.slice(0, start).split(/\r?\n/).length - 1;
      editor.scrollTop = Math.max(0, line * lineHeight - editor.clientHeight * 0.42);
    }

    if (highlightRef.current) {
      highlightRef.current.scrollTop = editor.scrollTop;
      highlightRef.current.scrollLeft = editor.scrollLeft;
    }
    onSearchTargetHandled(activeSearchTarget.requestId);
  }, [activeSearchTarget?.requestId, documentMode, fontSize, markdownEditorOpen, textReferencePreview]);

  const syncSelection = (editor: HTMLTextAreaElement, rememberDirection = true) => {
    const captured = captureEditorSelection(editor, multiCaretsRef.current);
    const previous = lastSelectionRef.current;
    if (!rememberDirection && previous?.selectionStart === captured.selectionStart && previous.selectionEnd === captured.selectionEnd) captured.selectionDirection = previous.selectionDirection;
    lastSelectionRef.current = captured;
    const nextSelection = getTextSelection(editor);
    setSelection(nextSelection);
    onViewStateChange({
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      selectionDirection: captured.selectionDirection,
    });
  };

  const syncEditorScroll = (editor: HTMLTextAreaElement) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = editor.scrollTop;
      highlightRef.current.scrollLeft = editor.scrollLeft;
    }
    scheduleOverlayMeasurement();
    onViewStateChange({ editorScrollTop: editor.scrollTop, editorScrollLeft: editor.scrollLeft });
  };

  const syncMarkdownScroll = (origin: "source" | "preview") => {
    const source = origin === "source" ? editorRef.current : markdownLivePreviewRef.current;
    const target = origin === "source" ? markdownLivePreviewRef.current : editorRef.current;
    if (!source || !target) return;

    if (markdownScrollSyncRef.current && markdownScrollSyncRef.current !== origin) {
      markdownScrollSyncRef.current = null;
      return;
    }

    const sourceMax = Math.max(0, source.scrollHeight - source.clientHeight);
    const targetMax = Math.max(0, target.scrollHeight - target.clientHeight);
    const ratio = sourceMax > 0 ? Math.min(1, Math.max(0, source.scrollTop / sourceMax)) : 0;
    markdownScrollSyncRef.current = origin;
    target.scrollTop = ratio * targetMax;
    window.requestAnimationFrame(() => {
      if (markdownScrollSyncRef.current === origin) markdownScrollSyncRef.current = null;
    });
  };

  const handleMarkdownSourceScroll = (editor: HTMLTextAreaElement) => {
    syncEditorScroll(editor);
    syncMarkdownScroll("source");
    onViewStateChange({ livePreviewScrollTop: markdownLivePreviewRef.current?.scrollTop ?? 0 });
  };

  const handleMarkdownPreviewScroll = (preview: HTMLDivElement) => {
    syncMarkdownScroll("preview");
    onViewStateChange({
      editorScrollTop: editorRef.current?.scrollTop ?? 0,
      livePreviewScrollTop: preview.scrollTop,
    });
  };

  const replaceSelection = (insertion: string, removeSelection = true) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    insertion = normalizeTextLineEndings(insertion);
    const current = getTextSelection(editor);
    const start = removeSelection ? current.start : current.end;
    const end = removeSelection ? current.end : current.end;
    const nextContent = `${editor.value.slice(0, start)}${insertion}${editor.value.slice(end)}`;
    const nextCaret = start + insertion.length;
    commitProgrammaticEdit(nextContent, nextCaret);
  };

  const copySelection = async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = getTextSelection(editor);
    if (current.end <= current.start) {
      return;
    }
    await writeClipboardText(editor.value.slice(current.start, current.end));
  };

  const cutSelection = async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = getTextSelection(editor);
    if (current.end <= current.start) {
      return;
    }
    await writeClipboardText(editor.value.slice(current.start, current.end));
    replaceSelection("");
  };

  const pasteSelection = async () => {
    const text = await readClipboardText();
    if (text) {
      replaceSelection(text);
    }
  };

  const runProgrammerAction = (action: ProgrammerAction) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = getTextSelection(editor);
    if (current.end <= current.start) {
      return;
    }
    onProgrammerAction(action, current.start, current.end);
  };

  const contextMenuItems: MenuProps["items"] = [
    {
      key: "cut",
      label: uiText("剪切"),
      icon: <ScissorOutlined />,
      disabled: !hasSelection,
      onClick: () => void cutSelection(),
    },
    {
      key: "paste",
      label: uiText("粘贴"),
      icon: <SnippetsOutlined />,
      onClick: () => void pasteSelection(),
    },
    {
      key: "copy",
      label: uiText("复制"),
      icon: <CopyOutlined />,
      disabled: !hasSelection,
      onClick: () => void copySelection(),
    },
    {
      key: "set-text-anchor",
      label: uiText("设为锚点"),
      icon: <AimOutlined />,
      disabled: !hasSelection,
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        const current = getTextSelection(editor);
        if (current.end <= current.start) return;
        onAddTextAnchor(current.start, current.end);
      },
    },
    ...(programmerMode && !tab.isPreviewOnly
      ? [
          { type: "divider" as const },
          {
            key: "format-json",
            label: uiText("转为 JSON"),
            icon: <CodeOutlined />,
            disabled: !hasSelection,
            onClick: () => runProgrammerAction("format-json"),
          },
          {
            key: "minify-json",
            label: uiText("压缩 JSON"),
            icon: <CodeOutlined />,
            disabled: !hasSelection,
            onClick: () => runProgrammerAction("minify-json"),
          },
          {
            key: "string-to-json",
            label: uiText("字符串转 JSON"),
            icon: <CodeOutlined />,
            disabled: !hasSelection,
            onClick: () => runProgrammerAction("string-to-json"),
          },
        ]
      : []),
  ];

  const handleTextAreaMouseDown = (event: ReactMouseEvent<HTMLTextAreaElement>) => {
    pointerDown.current = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    revealMirror();
    if (handleSelectionMouseDown(event)) return;

    const endMarker = highlightRef.current?.querySelector<HTMLElement>(".file-highlight-end-marker");
    if (placeCaretAtEndForBlankArea(event, endMarker)) {
      syncSelection(event.currentTarget);
    }
  };

  const handleFontSizeWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (!event.ctrlKey || event.deltaY === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onFontSizeChange(event.deltaY < 0 ? 1 : -1);
  };

  const handleTextAreaMouseUp = (event: ReactMouseEvent<HTMLTextAreaElement>) => {
    if (event.button === 1) {
      return;
    }
    const editor = event.currentTarget;
    syncSelection(editor);
    const down = pointerDown.current;
    pointerDown.current = null;
    if (event.button !== 0 || !event.ctrlKey || !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) {
      return;
    }
    revealMirror();
    const offset = getTextOffsetAtPoint(editor, highlightRef.current, event.clientX, event.clientY) ?? editor.selectionStart;
    const reference = noteReferences.find(link => offset >= link.start && offset < link.end);
    if (reference) { event.preventDefault(); onOpenNote?.(reference.id); return; }
    const filePath = findLocalFileAtOffset(editor.value, offset);
    if (filePath) { event.preventDefault(); void openLocalPath(filePath); return; }
    const url = findHttpUrlAtOffset(editor.value, offset);
    if (url) {
      event.preventDefault();
      void openExternalUrl(url);
    }
  };

  const editorEvents = {
    onMouseDown: handleTextAreaMouseDown,
    onMouseUp: handleTextAreaMouseUp,
    onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => syncSelection(event.currentTarget, false),
    onDoubleClick: (event: React.MouseEvent<HTMLTextAreaElement>) => trimTextSelectionWhitespace(event.currentTarget),
    onKeyUp: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      syncSelection(event.currentTarget);
      if (!compositionRef.current && multiCarets.length === 0) references.refresh(event.currentTarget);
    },
    onBlur: () => references.close(),
    onContextMenu: (event: ReactMouseEvent<HTMLTextAreaElement>) => syncSelection(event.currentTarget),
    onCompositionStart: (event: React.CompositionEvent<HTMLTextAreaElement>) => {
      references.close();
      compositionRef.current = { before: captureEditorSelection(event.currentTarget), group: crypto.randomUUID() };
    },
    onCompositionEnd: (event: React.CompositionEvent<HTMLTextAreaElement>) => {
      onContentChange(event.currentTarget.value);
      compositionRef.current = null;
      syncSelection(event.currentTarget);
      references.refresh(event.currentTarget);
    },
    onAuxClick: (event: ReactMouseEvent<HTMLTextAreaElement>) => {
      if (event.button === 1) event.preventDefault();
    },
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (references.onKeyDown(event)) return;
    pendingBeforeInputRef.current = captureEditorSelection(event.currentTarget, multiCarets);
    if (!handleMultiCaretKeyDown(event)) {
      continueOrderedList(event, (content, caret) => commitProgrammaticEdit(content, caret ?? content.length), true);
    }
  };

  const handleEditorPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    handleMultiCaretPaste(event);
  };

  const handleMarkdownLinkClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !event.currentTarget.contains(anchor)) {
      if (event.ctrlKey) {
        const element = (event.target as HTMLElement).closest<HTMLElement>("code, p, li, td, pre");
        const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
        if (element && range && element.contains(range.startContainer)) {
          const before = document.createRange(); before.selectNodeContents(element); before.setEnd(range.startContainer, range.startOffset);
          const filePath = findLocalFileAtOffset(element.textContent ?? "", before.toString().length);
          if (filePath) { event.preventDefault(); void openLocalPath(filePath); }
        }
      }
      return;
    }
    event.preventDefault();
    const noteId = noteIdFromUrl(anchor.getAttribute("href") ?? "");
    if (noteId) { onOpenNote?.(noteId); return; }
    if (event.ctrlKey) {
      const href = anchor.getAttribute("href") ?? "";
      const local = getLocalFileLinks(href)[0];
      if (local) void openLocalPath(local.path);
      else void openExternalUrl(anchor.href);
    }
  };

  function jumpToTextAnchor(anchor: TextAnchor) {
    const editor = editorRef.current;
    if (!editor) {
      if (textReferencePreview) {
        pendingReferenceAnchor.current = anchor;
        setTextReferenceEditorId(tab.id);
      }
      return;
    }
    const offset = Math.max(0, Math.min(anchor.start, editor.value.length));
    const measured = getTextCaretPositions(highlightRef.current, [offset], editor.value)[0];
    const lineHeight = Number.parseFloat(window.getComputedStyle(editor).lineHeight) || fontSize * 1.65;
    const line = getTextAnchorLine(tab.content, offset) - 1;
    const targetTop = measured
      ? editor.scrollTop + measured.top - editor.clientHeight * 0.28
      : line * lineHeight - editor.clientHeight * 0.28;
    editor.scrollTop = Math.max(0, Math.min(targetTop, editor.scrollHeight - editor.clientHeight));
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(offset, offset);
    setSelection({ start: offset, end: offset });
    setActiveAnchorId(anchor.id);
    syncEditorScroll(editor);
  }

  const plainHighlight = useMemo<ReactNode>(() => {
    if (documentMode === "markdown" || tab.isPreviewOnly || textReferencePreview) return null;
    const start = activeSearchTarget?.selectionStart;
    const end = activeSearchTarget?.selectionEnd;
    if (start == null || end == null || start < 0 || end < start || start > tab.content.length) {
      return renderTextWithLinks(tab.content || " ", searchValue);
    }
    const boundedEnd = Math.min(end, tab.content.length);
    return (
      <>
        {renderTextWithLinks(tab.content.slice(0, start), searchValue)}
        <span className="file-search-position-marker">{"\u200b"}</span>
        {renderTextWithLinks(tab.content.slice(start, boundedEnd), searchValue)}
        {renderTextWithLinks(tab.content.slice(boundedEnd), searchValue)}
      </>
    );
  }, [documentMode, tab.isPreviewOnly, tab.content, searchValue, activeSearchTarget?.selectionStart, activeSearchTarget?.selectionEnd, textReferencePreview]);

  const renderSelection = () => (
    <div ref={selectionLayerRef} className="file-selection-layer" aria-hidden />
  );

  const renderAnchorMarkers = () => (
    <div className="file-anchor-layer" aria-hidden>
      {anchorPositions.map((position) => (
        <span
          key={position.id}
          className={`file-anchor-marker${activeAnchorId === position.id ? " active" : ""}`}
          style={{ left: position.left, top: position.top }}
        >
          {position.index}
        </span>
      ))}
    </div>
  );

  const renderedMarkdown =
    markdownRender?.tabId === tab.id &&
    markdownRender.filePath === tab.filePath
      ? markdownRender.blocks
      : null;

  const renderMarkdownPreview = (className = "") =>
    tab.content.trim() && renderedMarkdown === null ? (
      <article className={`markdown-body markdown-loading ${className}`}>{uiText("正在加载 Markdown...")}</article>
    ) : tab.content.trim() ? (
      <MarkdownContent
        className={`markdown-body ${className}`}
        onClick={handleMarkdownLinkClick}
        blocks={renderedMarkdown ?? []}
      />
    ) : (
      <article className={`markdown-body markdown-empty ${className}`}>{uiText("开始写 Markdown...")}</article>
    );

  if (tab.isPreviewOnly) {
    const previewKilobytes = Math.max(1, Math.round((tab.previewBytes ?? tab.content.length) / 1024));
    return (
      <div className="file-view file-preview-only" data-tab-id={tab.id} style={{ ["--file-font-size" as string]: `${fontSize}px` }}>
        {showTitleBar ? titleBar : null}
        <section className="file-large-preview" aria-label={uiText("大文本预览")}>
          <p>{uiText("为避免卡顿，仅显示前 {0} KB，原文件保持不变", [previewKilobytes])}</p>
          <pre>{tab.content}</pre>
        </section>
      </div>
    );
  }

  if (documentMode === "markdown") {
    const markdownEditor = (
      <textarea
        ref={attachEditorRef}
        className="file-editor markdown-source-editor"
        value={tab.content}
        spellCheck={false}
        placeholder={uiText("# 标题\n\n开始编写 Markdown...")}
        onKeyDown={handleEditorKeyDown}
        onPaste={handleEditorPaste}
        onScroll={(event) => handleMarkdownSourceScroll(event.currentTarget)}
        onChange={(event) => {
          markdownScrollSnapshotRef.current = {
            sourceTop: event.currentTarget.scrollTop,
            sourceLeft: event.currentTarget.scrollLeft,
            previewTop: markdownLivePreviewRef.current?.scrollTop ?? 0,
          };
          clearMultiCarets();
          onContentChange(event.target.value);
          syncSelection(event.currentTarget);
          if (!compositionRef.current && multiCarets.length === 0) references.refresh(event.currentTarget);
        }}
        {...editorEvents}
      />
    );

    return (
      <div
        className="file-view markdown-file markdown-preview-mode"
        data-tab-id={tab.id}
        style={{ ["--file-font-size" as string]: `${fontSize}px` }}
        onWheel={handleFontSizeWheel}
      >
        {titleBar}
        {messageContext}{references.popup}
        <div
          ref={markdownPreviewRef}
          className="markdown-preview-scroll"
          onScroll={(event) => onViewStateChange({ previewScrollTop: event.currentTarget.scrollTop })}
          onDoubleClick={() => setMarkdownEditorOpen(true)}
        >
          {renderMarkdownPreview("markdown-preview")}
        </div>
        <MarkdownEditorModal
          open={markdownEditorOpen}
          title={displayTitle}
          onClose={() => setMarkdownEditorOpen(false)}
          source={
            <Dropdown menu={{ items: contextMenuItems }} trigger={["contextMenu"]}>
              <div className="markdown-source-anchor-wrap">
                <pre ref={highlightRef} className="file-highlight markdown-source-highlight" aria-hidden>
                  {tab.content || " "}<span className="file-highlight-end-marker">{"\u200b"}</span>
                </pre>
                {renderSelection()}
                {markdownEditor}
                {renderAnchorMarkers()}
              </div>
            </Dropdown>
          }
          preview={
            <div
              ref={markdownLivePreviewRef}
              className="markdown-live-scroll"
              onScroll={(event) => handleMarkdownPreviewScroll(event.currentTarget)}
            >
              {renderMarkdownPreview("markdown-live-preview")}
            </div>
          }
        />
      </div>
    );
  }

  const textEditor = (
    <div className={`file-editor-wrap${multiCarets.length > 0 ? " has-multi-carets" : ""}`}>
      <pre ref={highlightRef} className="file-highlight" aria-hidden>
        {plainHighlight}<span className="file-highlight-end-marker">{"\u200b"}</span>
      </pre>
      {renderSelection()}
      <div className="file-caret-layer" aria-hidden>
        {caretPositions.map(caret => (
          <span key={caret.offset} className="file-multi-caret" style={{ left: caret.left, top: caret.top, height: caret.height }} />
        ))}
      </div>
      {renderAnchorMarkers()}
      <textarea
        ref={attachEditorRef}
        className="file-editor"
        value={tab.content}
        spellCheck={false}
        placeholder={uiText("文件为空，可以直接编辑")}
        onScroll={(event) => {
          syncEditorScroll(event.currentTarget);
        }}
        onKeyDown={handleEditorKeyDown}
        onPaste={handleEditorPaste}
        onChange={(event) => {
          clearMultiCarets();
          onContentChange(event.target.value);
          syncSelection(event.currentTarget);
          if (!compositionRef.current && multiCarets.length === 0) references.refresh(event.currentTarget);
        }}
        {...editorEvents}
      />
    </div>
  );

  return (
    <div className="file-view" data-tab-id={tab.id} style={{ ["--file-font-size" as string]: `${fontSize}px` }} onWheel={handleFontSizeWheel}>
      {showTitleBar ? titleBar : null}
      {messageContext}{references.popup}
        {textReferencePreview ? (
          <div className="file-editor-wrap">
            <pre className="file-highlight note-reference-text" tabIndex={0}
              ref={element => { if (element) element.scrollTop = viewState?.previewScrollTop ?? 0; }}
              onScroll={event => onViewStateChange({ previewScrollTop: event.currentTarget.scrollTop })}
              onClick={handleMarkdownLinkClick}
              onDoubleClick={(event) => {
                if (!(event.target as HTMLElement).closest("a")) setTextReferenceEditorId(tab.id);
              }}
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === "F2")) { event.preventDefault(); setTextReferenceEditorId(tab.id); } }}>
              <NoteReferenceText content={tab.content} query={searchValue} targets={noteTargets} />
            </pre>
          </div>
        ) : <Dropdown menu={{ items: contextMenuItems }} trigger={["contextMenu"]}>{textEditor}</Dropdown>}
    </div>
  );
}
