import { uiText } from "../../../electron/uiLanguage";
import { AimOutlined, CloseOutlined, CodeOutlined, CopyOutlined, EditOutlined, EllipsisOutlined, ScissorOutlined, SnippetsOutlined } from "@ant-design/icons";
import { Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { getFileDocumentMode } from "./fileDocument";
import { getTextCaretPositions, type TextCaretPosition } from "./textCaretLayout";
import { getTextAnchorLine } from "./textAnchors";
import { MarkdownEditorModal } from "./MarkdownEditorModal";

const EMPTY_SELECTION: TextSelection = { start: 0, end: 0 };

type FileViewProps = {
  tab: FileTab;
  showTitleBar?: boolean;
  title?: string;
  titleMenuItems?: MenuProps["items"];
  searchValue: string;
  searchTarget: TextSearchTarget | null;
  programmerMode: boolean;
  viewState?: FileViewState;
  onViewStateChange: (patch: Partial<FileViewState>) => void;
  onContentChange: (content: string) => void;
  onAddTextAnchor: (selectionStart: number, selectionEnd: number) => void;
  onRemoveTextAnchor: (anchorId: string) => void;
  onFontSizeChange: (delta: number) => void;
  onProgrammerAction: (action: ProgrammerAction, selectionStart: number, selectionEnd: number) => void;
  onSearchTargetHandled: (requestId: number) => void;
};

export function FileView({
  tab,
  showTitleBar = true,
  title,
  titleMenuItems,
  searchValue,
  searchTarget,
  programmerMode,
  viewState,
  onViewStateChange,
  onContentChange,
  onAddTextAnchor,
  onRemoveTextAnchor,
  onFontSizeChange,
  onProgrammerAction,
  onSearchTargetHandled,
}: FileViewProps) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const markdownPreviewRef = useRef<HTMLDivElement>(null);
  const markdownLivePreviewRef = useRef<HTMLDivElement>(null);
  const markdownScrollSyncRef = useRef<"source" | "preview" | null>(null);
  const markdownScrollSnapshotRef = useRef<{ sourceTop: number; sourceLeft: number; previewTop: number } | null>(null);
  const restoredViewRef = useRef<string | null>(null);
  const [markdownEditorOpen, setMarkdownEditorOpen] = useState(false);
  const [anchorMenuOpen, setAnchorMenuOpen] = useState(false);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [selection, setSelection] = useState<TextSelection>(EMPTY_SELECTION);
  const [markdownRender, setMarkdownRender] = useState<{
    tabId: string;
    content: string;
    filePath?: string;
    html: string;
  } | null>(null);
  const fontSize = tab.fontSize ?? 13;
  const documentMode = getFileDocumentMode(tab);
  const hasSelection = selection.end > selection.start;
  const textAnchors = tab.textAnchors ?? [];
  const activeSearchTarget = searchTarget?.tabId === tab.id ? searchTarget : null;
  const displayTitle = title?.trim() || tab.title.trim() || uiText("未命名文本");
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
      {documentMode === "markdown" ? (
        <Tooltip title={uiText("编辑")} placement="bottom">
          <Button
            type="text"
            className="file-title-edit"
            icon={<EditOutlined />}
            aria-label={uiText("编辑")}
            onClick={() => setMarkdownEditorOpen(true)}
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

  const {
    multiCarets,
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

  const [caretPositions, setCaretPositions] = useState<TextCaretPosition[]>([]);
  const syncCaretPositions = useCallback(() => {
    setCaretPositions(getTextCaretPositions(highlightRef.current, multiCarets, tab.content.length));
  }, [multiCarets, tab.content.length]);

  useLayoutEffect(() => {
    syncCaretPositions();
    const mirror = highlightRef.current;
    if (!mirror || multiCarets.length === 0) return;
    const observer = new ResizeObserver(syncCaretPositions);
    observer.observe(mirror);
    return () => observer.disconnect();
  }, [syncCaretPositions, multiCarets.length, tab.content, fontSize, searchValue, documentMode]);

  useEffect(() => {
    setMarkdownEditorOpen(false);
    setAnchorMenuOpen(false);
    setActiveAnchorId(null);
    setSelection(EMPTY_SELECTION);
    clearMultiCarets();
  }, [clearMultiCarets, documentMode, tab.id]);

  useLayoutEffect(() => {
    // Saved state is a tab/mode entry snapshot, not a controlled caret value.
    // Reapplying it after input rewinds the native caret to the previous keystroke.
    const viewKey = JSON.stringify([tab.id, documentMode, markdownEditorOpen]);
    if (restoredViewRef.current === viewKey) return;
    restoredViewRef.current = viewKey;
    const editor = editorRef.current;
    if (editor && viewState) {
      editor.scrollTop = viewState.editorScrollTop;
      editor.scrollLeft = viewState.editorScrollLeft;
      const start = Math.max(0, Math.min(viewState.selectionStart, editor.value.length));
      const end = Math.max(start, Math.min(viewState.selectionEnd, editor.value.length));
      editor.setSelectionRange(start, end, viewState.selectionDirection);
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
  }, [documentMode, markdownEditorOpen, tab.id, viewState]);

  useEffect(() => {
    if (documentMode !== "markdown") {
      setMarkdownRender(null);
      return;
    }
    let active = true;
    void import("./markdownRenderer").then(({ renderMarkdownContent }) => {
      if (active) {
        setMarkdownRender({
          tabId: tab.id,
          content: tab.content,
          filePath: tab.filePath,
          html: renderMarkdownContent(tab.content, tab.filePath),
        });
      }
    });
    return () => {
      active = false;
    };
  }, [documentMode, tab.content, tab.filePath, tab.id]);

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
  }, [activeSearchTarget?.requestId, documentMode, fontSize, markdownEditorOpen]);

  const syncSelection = (editor: HTMLTextAreaElement) => {
    const nextSelection = getTextSelection(editor);
    setSelection(nextSelection);
    onViewStateChange({
      selectionStart: editor.selectionStart,
      selectionEnd: editor.selectionEnd,
      selectionDirection: editor.selectionDirection,
    });
  };

  const syncEditorScroll = (editor: HTMLTextAreaElement) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = editor.scrollTop;
      highlightRef.current.scrollLeft = editor.scrollLeft;
    }
    syncCaretPositions();
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
    const current = getTextSelection(editor);
    const start = removeSelection ? current.start : current.end;
    const end = removeSelection ? current.end : current.end;
    const nextContent = `${editor.value.slice(0, start)}${insertion}${editor.value.slice(end)}`;
    const nextCaret = start + insertion.length;
    onContentChange(nextContent);
    setSelection({ start: nextCaret, end: nextCaret });
    window.requestAnimationFrame(() => {
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(nextCaret, nextCaret);
    });
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
    ...(programmerMode
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
    if (!event.ctrlKey) {
      return;
    }
    const offset = getTextOffsetAtPoint(editor, highlightRef.current, event.clientX, event.clientY) ?? editor.selectionStart;
    const url = findHttpUrlAtOffset(editor.value, offset);
    if (url) {
      event.preventDefault();
      void openExternalUrl(url);
    }
  };

  const editorEvents = {
    onMouseDown: handleTextAreaMouseDown,
    onMouseUp: handleTextAreaMouseUp,
    onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) => syncSelection(event.currentTarget),
    onDoubleClick: (event: React.MouseEvent<HTMLTextAreaElement>) => trimTextSelectionWhitespace(event.currentTarget),
    onKeyUp: (event: React.KeyboardEvent<HTMLTextAreaElement>) => syncSelection(event.currentTarget),
    onContextMenu: (event: ReactMouseEvent<HTMLTextAreaElement>) => syncSelection(event.currentTarget),
    onAuxClick: (event: ReactMouseEvent<HTMLTextAreaElement>) => {
      if (event.button === 1) event.preventDefault();
    },
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!handleMultiCaretKeyDown(event)) {
      continueOrderedList(event, onContentChange);
    }
  };

  const handleEditorPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    handleMultiCaretPaste(event);
  };

  const handleMarkdownLinkClick = (event: ReactMouseEvent<HTMLElement>) => {
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !event.currentTarget.contains(anchor)) {
      return;
    }
    event.preventDefault();
    if (event.ctrlKey) {
      void openExternalUrl(anchor.href);
    }
  };

  function jumpToTextAnchor(anchor: TextAnchor) {
    const editor = editorRef.current;
    if (!editor) return;
    const offset = Math.max(0, Math.min(anchor.start, editor.value.length));
    const measured = getTextCaretPositions(highlightRef.current, [offset], editor.value.length)[0];
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

  const renderedMarkdown =
    markdownRender?.tabId === tab.id &&
    markdownRender.content === tab.content &&
    markdownRender.filePath === tab.filePath
      ? markdownRender.html
      : null;

  const renderMarkdownPreview = (className = "") =>
    tab.content.trim() && renderedMarkdown === null ? (
      <article className={`markdown-body markdown-loading ${className}`}>{uiText("正在加载 Markdown...")}</article>
    ) : tab.content.trim() ? (
      <article
        className={`markdown-body ${className}`}
        onClick={handleMarkdownLinkClick}
        dangerouslySetInnerHTML={{ __html: renderedMarkdown ?? "" }}
      />
    ) : (
      <article className={`markdown-body markdown-empty ${className}`}>{uiText("开始写 Markdown...")}</article>
    );

  if (documentMode === "markdown") {
    const markdownEditor = (
      <textarea
        ref={editorRef}
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
              <div className="markdown-source-anchor-wrap">{markdownEditor}</div>
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

  const renderPlainHighlight = (): ReactNode => {
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
  };

  const textEditor = (
    <div className={`file-editor-wrap${multiCarets.length > 0 ? " has-multi-carets" : ""}`}>
      <pre ref={highlightRef} className="file-highlight" aria-hidden>
        {renderPlainHighlight()}<span className="file-highlight-end-marker">{"\u200b"}</span>
      </pre>
      <div className="file-caret-layer" aria-hidden>
        {caretPositions.map(caret => (
          <span key={caret.offset} className="file-multi-caret" style={{ left: caret.left, top: caret.top, height: caret.height }} />
        ))}
      </div>
      <textarea
        ref={editorRef}
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
        }}
        {...editorEvents}
      />
    </div>
  );

  return (
    <div className="file-view" data-tab-id={tab.id} style={{ ["--file-font-size" as string]: `${fontSize}px` }} onWheel={handleFontSizeWheel}>
      {showTitleBar ? titleBar : null}
      <Dropdown menu={{ items: contextMenuItems }} trigger={["contextMenu"]}>
        {textEditor}
      </Dropdown>
    </div>
  );
}
