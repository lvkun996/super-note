import { CodeOutlined, CopyOutlined, ScissorOutlined, SnippetsOutlined } from "@ant-design/icons";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { FileDocumentMode, FileTab, ProgrammerAction, TextSearchTarget, TextSelection } from "../../appTypes";
import {
  continueOrderedList,
  findHttpUrlAtOffset,
  getMirrorTextOffsetAtPoint,
  getTextSelection,
  openExternalUrl,
  placeCaretAtEndForBlankArea,
  readClipboardText,
  renderTextWithLinks,
  writeClipboardText,
} from "../editor/editorUtils";

const EMPTY_SELECTION: TextSelection = { start: 0, end: 0 };

function isMarkdownFileName(fileName?: string) {
  return Boolean(fileName && /\.(md|markdown|mdown|mkd)$/i.test(fileName));
}

export function getFileDocumentMode(file: Pick<FileTab, "fileName" | "filePath" | "documentMode">): FileDocumentMode {
  if (file.documentMode) {
    return file.documentMode;
  }
  return isMarkdownFileName(file.fileName) || isMarkdownFileName(file.filePath) ? "markdown" : "text";
}

type FileViewProps = {
  tab: FileTab;
  searchValue: string;
  searchTarget: TextSearchTarget | null;
  programmerMode: boolean;
  renderedMarkdown: string;
  onContentChange: (content: string) => void;
  onProgrammerAction: (action: ProgrammerAction, selectionStart: number, selectionEnd: number) => void;
  onSearchTargetHandled: (requestId: number) => void;
};

export function FileView({
  tab,
  searchValue,
  searchTarget,
  programmerMode,
  renderedMarkdown,
  onContentChange,
  onProgrammerAction,
  onSearchTargetHandled,
}: FileViewProps) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [markdownMode, setMarkdownMode] = useState<"edit" | "preview">("edit");
  const [selection, setSelection] = useState<TextSelection>(EMPTY_SELECTION);
  const fontSize = tab.fontSize ?? 13;
  const documentMode = getFileDocumentMode(tab);
  const hasSelection = selection.end > selection.start;
  const activeSearchTarget = searchTarget?.tabId === tab.id ? searchTarget : null;

  useEffect(() => {
    setMarkdownMode("edit");
    setSelection(EMPTY_SELECTION);
  }, [tab.id]);

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
    setSelection(getTextSelection(editor));
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
    const endMarker = highlightRef.current?.querySelector<HTMLElement>(".file-highlight-end-marker");
    if (placeCaretAtEndForBlankArea(event, endMarker)) {
      syncSelection(event.currentTarget);
    }
  };

  const handleTextAreaMouseUp = (event: ReactMouseEvent<HTMLTextAreaElement>) => {
    const editor = event.currentTarget;
    syncSelection(editor);
    if (!event.ctrlKey) {
      return;
    }
    const offset = getMirrorTextOffsetAtPoint(editor, highlightRef.current, event.clientX, event.clientY) ?? editor.selectionStart;
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

  const renderMarkdownPreview = (className = "") =>
    tab.content.trim() ? (
      <article
        className={`markdown-body ${className}`}
        onClick={handleMarkdownLinkClick}
        dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
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
        onKeyDown={(event) => continueOrderedList(event, onContentChange)}
        onChange={(event) => onContentChange(event.target.value)}
        {...editorEvents}
      />
    );

    return (
      <div
        className={`file-view markdown-file ${markdownMode === "preview" ? "markdown-preview-mode" : "markdown-edit-mode"}`}
        data-tab-id={tab.id}
        style={{ ["--file-font-size" as string]: `${fontSize}px` }}
      >
        <div className="markdown-toolbar">
          <span className="markdown-toolbar-title">Markdown</span>
          <Button.Group size="small">
            <Button type={markdownMode === "edit" ? "primary" : "default"} onClick={() => setMarkdownMode("edit")}>
              编辑
            </Button>
            <Button type={markdownMode === "preview" ? "primary" : "default"} onClick={() => setMarkdownMode("preview")}>
              预览
            </Button>
          </Button.Group>
        </div>

        {markdownMode === "preview" ? (
          <div className="markdown-preview-scroll" onDoubleClick={() => setMarkdownMode("edit")}>
            {renderMarkdownPreview("markdown-preview")}
          </div>
        ) : (
          <div className="markdown-editor-layout">
            <Dropdown menu={{ items: contextMenuItems }} trigger={["contextMenu"]}>
              <div className="markdown-source-pane">{markdownEditor}</div>
            </Dropdown>
            <div className="markdown-live-pane">{renderMarkdownPreview("markdown-live-preview")}</div>
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
    <div className="file-editor-wrap">
      <pre ref={highlightRef} className="file-highlight" aria-hidden>
        {renderPlainHighlight()}<span className="file-highlight-end-marker">{"\u200b"}</span>
      </pre>
      <textarea
        ref={editorRef}
        className="file-editor"
        value={tab.content}
        spellCheck={false}
        placeholder="文件为空，可以直接编辑"
        onScroll={(event) => {
          if (highlightRef.current) {
            highlightRef.current.scrollTop = event.currentTarget.scrollTop;
            highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }
        }}
        onKeyDown={(event) => continueOrderedList(event, onContentChange)}
        onChange={(event) => onContentChange(event.target.value)}
        {...editorEvents}
      />
    </div>
  );

  return (
    <div className="file-view" data-tab-id={tab.id} style={{ ["--file-font-size" as string]: `${fontSize}px` }}>
      <Dropdown menu={{ items: contextMenuItems }} trigger={["contextMenu"]}>
        {textEditor}
      </Dropdown>
    </div>
  );
}
