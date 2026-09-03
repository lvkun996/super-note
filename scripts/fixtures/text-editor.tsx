import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FileTab, FileViewState } from "../../src/appTypes";
import { FileView } from "../../src/features/text/FileView";
import "../../src/styles.css";

const emptyView = (): FileViewState => ({
  editorScrollTop: 0, editorScrollLeft: 0, selectionStart: 0, selectionEnd: 0,
  selectionDirection: "none", markdownMode: "edit", previewScrollTop: 0, livePreviewScrollTop: 0,
});

function Fixture() {
  const [content, setContent] = useState("");
  const [id, setId] = useState("first");
  const [markdown, setMarkdown] = useState(false);
  const [revision, setRevision] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [title, setTitle] = useState("优化 super-note 保存与右键菜单");
  const states = useRef<Record<string, FileViewState>>({ first: emptyView(), second: emptyView() });
  Object.assign(window, { editorTest: {
    reset(text: string, isMarkdown = false) {
      states.current = { first: emptyView(), second: emptyView() };
      setContent(text); setId("first"); setMarkdown(isMarkdown); setGeneration(value => value + 1);
    },
    switchTab(next: string) { setId(next); },
    rerender() { setRevision(value => value + 1); },
    saved() { return states.current[id]; },
  } });
  const tab: FileTab = { id, kind: "file", title: "Regression", content, fileName: markdown ? "fixture.md" : "fixture.txt", themeIndex: 0, dirty: false };
  return <div className="app-shell" style={{ height: 480, width: 640, maxWidth: "100%" }}><div className="pane-content" style={{ display: "flex" }} data-revision={revision}>
    <FileView key={generation} tab={tab} searchValue="" searchTarget={null} programmerMode={false}
      title={title} titleMenuItems={[{ key: "rename", label: "编辑名称", onClick: () => setTitle("重命名后的文档") }]}
      viewState={states.current[id]}
      onViewStateChange={patch => { states.current[id] = { ...states.current[id], ...patch }; }}
      onContentChange={setContent} onFontSizeChange={() => {}}
      onProgrammerAction={() => {}} onSearchTargetHandled={() => {}} />
  </div></div>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
