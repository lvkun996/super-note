import {
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ScissorOutlined,
  SearchOutlined,
  SnippetsOutlined,
} from "@ant-design/icons";
import { Dropdown } from "antd";
import type { MenuProps } from "antd";
import { useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type {
  CanvasItem,
  CanvasTab,
  CanvasViewState,
  ImageCanvasItem,
  PaneKey,
  ProgrammerAction,
  SelectedItem,
  TextCanvasItem,
  TextSelection,
} from "../../appTypes";
import {
  continueOrderedList,
  findHttpUrlAtOffset,
  getTextSelection,
  openExternalUrl,
  readClipboardText,
  renderTextWithLinks,
  writeClipboardText,
} from "../editor/editorUtils";
import { getItemLayout, getPointOnCanvas } from "./canvasUtils";

type CanvasTextEditorProps = {
  item: TextCanvasItem;
  pane: PaneKey;
  matched: boolean;
  handwritten: boolean;
  style: CSSProperties;
  onTextChange: (text: string) => void;
  onTextCommit: (size: { width: number; height: number }, text: string) => void;
};

function CanvasTextEditor({
  item,
  pane,
  matched,
  handwritten,
  style,
  onTextChange,
  onTextCommit,
}: CanvasTextEditorProps) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const hasSelection = selection.end > selection.start;

  const syncSelection = (editor: HTMLTextAreaElement) => setSelection(getTextSelection(editor));

  const resizeEditor = (editor: HTMLTextAreaElement) => {
    editor.style.height = "0px";
    editor.style.height = `${Math.max(48, editor.scrollHeight + 2)}px`;
  };

  const commitEditor = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    onTextCommit(
      { width: editor.offsetWidth, height: Math.max(48, editor.scrollHeight + 2) },
      editor.value,
    );
  };

  const replaceSelection = (insertion: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = getTextSelection(editor);
    const nextText = `${editor.value.slice(0, current.start)}${insertion}${editor.value.slice(current.end)}`;
    const nextCaret = current.start + insertion.length;
    onTextChange(nextText);
    setSelection({ start: nextCaret, end: nextCaret });
    window.requestAnimationFrame(() => {
      const currentEditor = editorRef.current;
      if (!currentEditor) {
        return;
      }
      resizeEditor(currentEditor);
      currentEditor.focus({ preventScroll: true });
      currentEditor.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const copySelection = async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const current = getTextSelection(editor);
    if (current.end > current.start) {
      await writeClipboardText(editor.value.slice(current.start, current.end));
    }
  };

  const contextMenuItems: MenuProps["items"] = [
    {
      key: "cut",
      label: "剪切",
      icon: <ScissorOutlined />,
      disabled: !hasSelection,
      onClick: () => {
        void copySelection().then(() => replaceSelection(""));
      },
    },
    {
      key: "paste",
      label: "粘贴",
      icon: <SnippetsOutlined />,
      onClick: () => void readClipboardText().then((text) => text && replaceSelection(text)),
    },
    {
      key: "copy",
      label: "复制",
      icon: <CopyOutlined />,
      disabled: !hasSelection,
      onClick: () => void copySelection(),
    },
  ];

  return (
    <Dropdown
      menu={{ items: contextMenuItems }}
      trigger={["contextMenu"]}
      onOpenChange={(open) => {
        setContextMenuOpen(open);
        if (!open && document.activeElement !== editorRef.current) {
          window.setTimeout(commitEditor, 0);
        }
      }}
    >
      <textarea
        ref={(editor) => {
          editorRef.current = editor;
          if (editor) {
            resizeEditor(editor);
          }
        }}
        id={`text-${pane}-${item.id}`}
        data-item-id={item.id}
        className={`${matched ? "text-note-editor matched" : "text-note-editor"}${handwritten ? " handwritten" : ""}`}
        style={style}
        value={item.text}
        placeholder="输入文字"
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => {
          syncSelection(event.currentTarget);
          if (event.ctrlKey) {
            const url = findHttpUrlAtOffset(event.currentTarget.value, event.currentTarget.selectionStart);
            if (url) {
              event.preventDefault();
              void openExternalUrl(url);
            }
          }
        }}
        onSelect={(event) => syncSelection(event.currentTarget)}
        onKeyUp={(event) => syncSelection(event.currentTarget)}
        onContextMenu={(event) => syncSelection(event.currentTarget)}
        onKeyDown={(event) => continueOrderedList(event, onTextChange)}
        onChange={(event) => {
          resizeEditor(event.currentTarget);
          onTextChange(event.target.value);
        }}
        onBlur={() => {
          if (!contextMenuOpen) {
            window.setTimeout(commitEditor, 0);
          }
        }}
      />
    </Dropdown>
  );
}

type CanvasViewProps = {
  tab: CanvasTab;
  pane: PaneKey;
  viewState: CanvasViewState;
  editingTextId: string | null;
  selectedItem: SelectedItem;
  searchValue: string;
  activeSearchItemId: string | null;
  handwritten: boolean;
  programmerMode: boolean;
  accent: string;
  onDoubleClick: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: ReactMouseEvent<HTMLDivElement>) => void;
  onWheel: (tab: CanvasTab, pane: PaneKey, event: React.WheelEvent<HTMLDivElement>) => void;
  onDrop: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: React.DragEvent<HTMLDivElement>) => void;
  onSurfaceMouseDown: (tab: CanvasTab, pane: PaneKey, viewState: CanvasViewState, event: ReactMouseEvent<HTMLDivElement>) => void;
  onPointChange: (point: { x: number; y: number }) => void;
  onTextChange: (itemId: string, text: string) => void;
  onTextCommit: (item: TextCanvasItem, size: { width: number; height: number }, text: string) => void;
  onTextDoubleClick: (item: TextCanvasItem, event: ReactMouseEvent<HTMLDivElement>) => void;
  onItemMouseDown: (item: CanvasItem, event: React.MouseEvent<HTMLElement>) => void;
  onItemContextMenu: (item: CanvasItem) => void;
  onDeleteItem: (item: CanvasItem) => void;
  onEditItem: (item: CanvasItem) => void;
  onPreviewImage: (item: ImageCanvasItem) => void;
  onProgrammerAction: (item: CanvasItem, action: ProgrammerAction) => void;
};

export function CanvasView({
  tab,
  pane,
  viewState,
  editingTextId,
  selectedItem,
  searchValue,
  activeSearchItemId,
  handwritten,
  programmerMode,
  accent,
  onDoubleClick,
  onWheel,
  onDrop,
  onSurfaceMouseDown,
  onPointChange,
  onTextChange,
  onTextCommit,
  onTextDoubleClick,
  onItemMouseDown,
  onItemContextMenu,
  onDeleteItem,
  onEditItem,
  onPreviewImage,
  onProgrammerAction,
}: CanvasViewProps) {
  const needle = searchValue.trim().toLowerCase();

  const makeItemMenu = (item: CanvasItem): MenuProps["items"] => [
    {
      key: "edit",
      label: "编辑",
      icon: <EditOutlined />,
      onClick: () => onEditItem(item),
    },
    {
      key: "delete",
      label: "删除",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDeleteItem(item),
    },
    ...(item.type === "image"
      ? [
          {
            key: "preview",
            label: "预览",
            icon: <SearchOutlined />,
            onClick: () => onPreviewImage(item),
          },
        ]
      : []),
    ...(programmerMode && item.type === "text"
      ? [
          { type: "divider" as const },
          {
            key: "format-json",
            label: "转为 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "format-json"),
          },
          {
            key: "minify-json",
            label: "压缩 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "minify-json"),
          },
          {
            key: "string-to-json",
            label: "字符串转 JSON",
            icon: <CodeOutlined />,
            onClick: () => onProgrammerAction(item, "string-to-json"),
          },
        ]
      : []),
  ];

  return (
    <div className="canvas-frame" style={{ ["--accent" as string]: accent }}>
      <div
        data-tab-id={tab.id}
        data-pane={pane}
        className="canvas-viewport"
        style={{
          ["--canvas-pan-x" as string]: `${viewState.panX}px`,
          ["--canvas-pan-y" as string]: `${viewState.panY}px`,
        }}
        onWheel={(event) => onWheel(tab, pane, event)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => onDrop(tab, pane, viewState, event)}
        onMouseMove={(event) => {
          const surface = event.currentTarget.querySelector<HTMLDivElement>(".canvas-surface");
          if (surface) {
            onPointChange(getPointOnCanvas(event.clientX, event.clientY, surface, viewState.scale));
          }
        }}
      >
        <div
          data-tab-id={tab.id}
          data-pane={pane}
          className="canvas-surface"
          style={{ transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.scale})` }}
          onDoubleClick={(event) => onDoubleClick(tab, pane, viewState, event)}
          onMouseDown={(event) => onSurfaceMouseDown(tab, pane, viewState, event)}
        >
          {tab.items.map((item, index) => {
            const zIndex = index + 1;
            const layout = getItemLayout(item, viewState);
            const isSelected = selectedItem?.tabId === tab.id && selectedItem.itemId === item.id && selectedItem.pane === pane;
            const isSearchTarget = activeSearchItemId === item.id;
            if (item.type === "text") {
              const matched = Boolean(needle && item.text.toLowerCase().includes(needle));
              const fontSize = (layout as TextCanvasItem).fontSize;
              const editorStyle: CSSProperties = {
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                fontSize,
                zIndex,
              };
              const viewStyle: CSSProperties = {
                left: layout.x,
                top: layout.y,
                width: layout.width,
                minHeight: layout.height,
                fontSize,
                zIndex,
              };

              if (editingTextId === item.id) {
                return (
                  <CanvasTextEditor
                    key={item.id}
                    item={item}
                    pane={pane}
                    matched={matched}
                    handwritten={handwritten}
                    style={editorStyle}
                    onTextChange={(text) => onTextChange(item.id, text)}
                    onTextCommit={(size, text) => onTextCommit(item, size, text)}
                  />
                );
              }

              return (
                <Dropdown key={item.id} menu={{ items: makeItemMenu(item) }} trigger={["contextMenu"]}>
                  <div
                    data-item-id={item.id}
                    className={`${matched ? "text-note-view matched" : "text-note-view"}${isSelected ? " selected" : ""}${isSearchTarget ? " search-target" : ""}`}
                    style={viewStyle}
                    onContextMenu={() => onItemContextMenu(item)}
                    onMouseDown={(event) => {
                      const target = event.target as HTMLElement;
                      if (event.ctrlKey && target.closest("[data-http-url]")) {
                        event.stopPropagation();
                        return;
                      }
                      onItemMouseDown(item, event);
                    }}
                    onClick={(event) => {
                      if (!event.ctrlKey) {
                        return;
                      }
                      const link = (event.target as HTMLElement).closest<HTMLElement>("[data-http-url]");
                      const url = link?.dataset.httpUrl;
                      if (url) {
                        event.preventDefault();
                        event.stopPropagation();
                        void openExternalUrl(url);
                      }
                    }}
                    onDoubleClick={(event) => onTextDoubleClick(item, event)}
                  >
                    {item.text.trim() ? renderTextWithLinks(item.text, searchValue) : <span className="text-placeholder">双击编辑</span>}
                  </div>
                </Dropdown>
              );
            }

            return (
              <Dropdown key={item.id} menu={{ items: makeItemMenu(item) }} trigger={["contextMenu"]}>
                <div
                  data-item-id={item.id}
                  className={`image-note${isSelected ? " selected" : ""}${isSearchTarget ? " search-target" : ""}`}
                  style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height, zIndex }}
                  onContextMenu={() => onItemContextMenu(item)}
                  onMouseDown={(event) => onItemMouseDown(item, event)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onPreviewImage(item);
                  }}
                >
                  <img src={item.src} alt={item.name} draggable={false} />
                  <span>{item.name}</span>
                </div>
              </Dropdown>
            );
          })}
        </div>
      </div>
    </div>
  );
}
