import { uiText } from "../../electron/uiLanguage";
type HelpDocumentationShortcuts = {
  newCanvas: string;
  newText: string;
  closeTab: string;
  fileFontIncrease: string;
  fileFontDecrease: string;
  fileFontReset: string;
  toggleFullscreen: string;
  save: string;
  search: string;
  undo: string;
  redo: string;
  redoAlt: string;
  paste: string;
  deleteSelected: string;
  previousTab: string;
  nextTab: string;
  toggleTabLayout: string;
  splitLeft: string;
  splitRight: string;
};

type HelpDocumentationProps = {
  canvasPluginEnabled: boolean;
  shortcuts: HelpDocumentationShortcuts;
};

export function HelpDocumentation({ canvasPluginEnabled }: HelpDocumentationProps) {
  const operations = [
    [uiText("新建文本模块"), uiText("点击标签栏右侧的 +，或从“文件 / 操作”菜单中新建。")],
    [uiText("启用画板插件"), uiText("打开左上角“插件”，选中“画板插件”。")],
    [
      uiText("新建画板"),
      canvasPluginEnabled
        ? uiText("点击标签栏右侧的画板图标。")
        : uiText("先在“插件”菜单中启用画板插件。"),
    ],
    [uiText("编辑画板"), uiText("在画板中双击创建文字区，双击已有文字再次编辑，拖拽元素可移动位置；图片会以纯图片形式显示。")],
    [uiText("思维导图"), uiText("点击画板顶部“新建思维导图”，用工具栏添加主题、删除分支，双击主题编辑内容。")],
    [uiText("关联主题与内容"), uiText("点击画板顶部“关联”，先选择子主题，再选择画板文字或图片即可建立连线；拖动连线可改变最近一端的吸附边，选中后右键删除。")],
    [uiText("调整主题层级"), uiText("拖到另一个主题中部可成为其子主题，拖到主题上、下边缘可调整同级顺序。")],
    [uiText("导图样式"), uiText("点击画板顶部“样式”，在独立窗口中调整左右结构、分支线型、粗细、彩色分支、主题形状、间距和导出背景。")],
    [uiText("导出画板图片"), uiText("点击画板顶部“导出图片”，会按照全部内容边界生成清晰的 PNG，不受当前缩放和视口范围限制。")],
    [uiText("打开链接"), uiText("在文本模块或画板文字中按住 Ctrl 并单击 HTTP/HTTPS 链接，会使用外部浏览器打开。")],
    [uiText("保存内容"), uiText("当前标签有文件路径时直接保存；新内容会打开保存窗口，并优先使用设置中的默认文件保存位置。")],
    [uiText("搜索内容"), uiText("点击右上角搜索按钮，在当前页或全部标签中查找内容。")],
    [uiText("竖向选择"), uiText("在文本模块中按住鼠标左键片刻后竖向拖动，可连续选择多行内容；也支持中键直接拖动选择。")],
    [uiText("关闭标签"), uiText("关闭最后一个标签后会进入空工作区。")],
    [uiText("切换标签栏位置"), uiText("设置中可选择顶栏模式或侧边模式；标签支持拖拽排序，右键可置顶、删除、编辑名称或在资源管理器打开。")],
  ];


  return (
    <div className="help-docs">
      <section>
        <h3>{uiText("操作")}</h3>
        <dl>
          {operations.map(([title, desc]) => (
            <div key={title} className="help-doc-row">
              <dt>{title}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
