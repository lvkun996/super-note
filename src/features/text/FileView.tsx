import { CodeOutlined, CopyOutlined, EllipsisOutlined, FolderOutlined, ScissorOutlined, SnippetsOutlined } from "@ant-design/icons";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";
import type { FileTab, FileViewState, ProgrammerAction, TextSearchTarget, TextSelection } from "../../appTypes";
import {
  continueOrderedList,
  findHttpUrlAtOffset,
  getTextOffsetAtPoint,
  getTextSelection,
  openExternalUrl,
  placeCaretAtEndForBlankArea,
  readClipboardText,
  renderTextWithLinks,
  writeClipboardText,
} from "../editor/editorUtils";
import { useTextEditorSelection } from "./useTextEditorSelection";
import { getFileDocumentMode } from "./fileDocument";
import { getTextCaretPositions, type TextCaretPosition } from "./textCaretLayout";

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
  onFontSizeChange,
  onProgrammerAction,
  onSearchTargetHandled,
}: FileViewProps) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const markdownPreviewRef = useRef<HTMLDivElement>(null);
  const markdownLivePreviewRef = useRef<HTMLDivElement>(null);
  const restoredViewRef = useRef<string | null>(null);
  const [markdownMode, setMarkdownMode] = useState<"edit" | "preview">(viewState?.markdownMode ?? "preview");
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
  const activeSearchTarget = searchTarget?.tabId === tab.id ? searchTarget : null;
  const displayTitle = title?.trim() || tab.title.trim() || "未命名文本";
  const titleBar = (
    <header className="file-title-bar" aria-label="文档标题栏">
      <FolderOutlined className="file-title-icon" aria-hidden />
      <h1 className="file-title" title={displayTitle}>{displayTitle}</h1>
      {titleMenuItems?.length ? (
        <Dropdown menu={{ items: titleMenuItems }} trigger={["click"]} overlayClassName="tab-context-menu" placement="bottomLeft">
          <Button type="text" className="file-title-more" icon={<EllipsisOutlined />} aria-label="文档操作" title="文档操作" />
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
    setMarkdownMode(viewState?.markdownMode ?? "preview");
    setSelection(EMPTY_SELECTION);
    clearMultiCarets();
  }, [clearMultiCarets, documentMode, tab.id, viewState?.markdownMode]);

  useLayoutEffect(() => {
    // Saved state is a tab/mode entry snapshot, not a controlled caret value.
    // Reapplying it after input rewinds the native caret to the previous keystroke.
    const viewKey = JSON.stringify([tab.id, documentMode, markdownMode]);
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
  }, [documentMode, markdownMode, tab.id, viewState]);

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

  useEffect(() => {
    if (!activeSearchTarget) {
      return;
    }
    if (markdownMode !== "edit") {
      setMarkdownMode("edit");
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
  }, [activeSearchTarget?.requestId, documentMode, fontSize, markdownMode]);

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

  const changeMarkdownMode = (mode: "edit" | "preview") => {
    setMarkdownMode(mode);
    onViewStateChange({ markdownMode: mode });
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
      label: "剪切",
      icon: <ScissorOutlined />,
      disabled: !hasSelection,
      onClick: () => void cutSelection(),
    },
    {
      key: "paste",
      label: "粘贴",
      icon: <SnippetsOutlined />,
      onClick: () => void pasteSelection(),
    },
    {
      key: "copy",
      label: "复制",
      icon: <CopyOutlined />,
      disabled: !hasSelection,
      onClick: () => void copySelection(),
    },
    ...(programmerMode
      ? [
          { type: "divider" as const },
          {
            key: "format-json",
            label: "转为 JSON",
            icon: <CodeOutlined />,
            disabled: !hasSelection,
            onClick: () => runProgrammerAction("format-json"),
          },
          {
            key: "minify-json",
            label: "压缩 JSON",
            icon: <CodeOutlined />,
            disabled: !hasSelection,
            onClick: () => runProgrammerAction("minify-json"),
          },
          {
            key: "string-to-json",
            label: "字符串转 JSON",
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

  const renderedMarkdown =
    markdownRender?.tabId === tab.id &&
    markdownRender.content === tab.content &&
    markdownRender.filePath === tab.filePath
      ? markdownRender.html
      : null;

  const renderMarkdownPreview = (className = "") =>
    tab.content.trim() && renderedMarkdown === null ? (
      <article className={`markdown-body markdown-loading ${className}`}>正在加载 Markdown...</article>
    ) : tab.content.trim() ? (
      <article
        className={`markdown-body ${className}`}
        onClick={handleMarkdownLinkClick}
        dangerouslySetInnerHTML={{ __html: renderedMarkdown ?? "" }}
      />
    ) : (
      <article className={`markdown-body markdown-empty ${className}`}>开始写 Markdown...</article>
    );

  if (documentMode === "markdown") {
    const markdownEditor = (
      <textarea
        ref={editorRef}
        className="file-editor markdown-source-editor"
        value={tab.content}
        spellCheck={false}
        placeholder={"# 标题\n\n开始编写 Markdown..."}
        onKeyDown={handleEditorKeyDown}
        onPaste={handleEditorPaste}
        onScroll={(event) => syncEditorScroll(event.currentTarget)}
        onChange={(event) => {
          clearMultiCarets();
          onContentChange(event.target.value);
        }}
        {...editorEvents}
      />
    );

    return (
      <div
        className={`file-view markdown-file ${markdownMode === "preview" ? "markdown-preview-mode" : "markdown-edit-mode"}`}
        data-tab-id={tab.id}
        style={{ ["--file-font-size" as string]: `${fontSize}px` }}
        onWheel={handleFontSizeWheel}
      >
        {showTitleBar ? titleBar : null}
        <div className="markdown-toolbar">
          <span className="markdown-toolbar-title">Markdown</span>
          <Button.Group size="small">
            <Button type={markdownMode === "edit" ? "primary" : "default"} onClick={() => changeMarkdownMode("edit")}>
              编辑
            </Button>
            <Button type={markdownMode === "preview" ? "primary" : "default"} onClick={() => changeMarkdownMode("preview")}>
              预览
            </Button>
          </Button.Group>
        </div>

        {markdownMode === "preview" ? (
          <div
            ref={markdownPreviewRef}
            className="markdown-preview-scroll"
            onScroll={(event) => onViewStateChange({ previewScrollTop: event.currentTarget.scrollTop })}
            onDoubleClick={() => changeMarkdownMode("edit")}
          >
            {renderMarkdownPreview("markdown-preview")}
          </div>
        ) : (
          <div className="markdown-editor-layout">
            <Dropdown menu={{ items: contextMenuItems }} trigger={["contextMenu"]}>
              <div className="markdown-source-pane">{markdownEditor}</div>
            </Dropdown>
            <div
              ref={markdownLivePreviewRef}
              className="markdown-live-pane"
              onScroll={(event) => onViewStateChange({ livePreviewScrollTop: event.currentTarget.scrollTop })}
            >
              {renderMarkdownPreview("markdown-live-preview")}
            </div>
          </div>
        )}
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
        placeholder="文件为空，可以直接编辑"
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
