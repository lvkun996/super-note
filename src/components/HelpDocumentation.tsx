type HelpDocumentationShortcuts = {
  newCanvas: string;
  newText: string;
  closeTab: string;
  fileFontIncrease: string;
  fileFontDecrease: string;
  save: string;
  search: string;
  undo: string;
  redo: string;
  redoAlt: string;
  paste: string;
  deleteSelected: string;
  previousTab: string;
  nextTab: string;
  splitLeft: string;
  splitRight: string;
};

type HelpDocumentationProps = {
  canvasPluginEnabled: boolean;
  shortcuts: HelpDocumentationShortcuts;
};

export function HelpDocumentation({ canvasPluginEnabled, shortcuts }: HelpDocumentationProps) {
  const operations = [
    ["新建文本模块", "点击标签栏右侧的 +，或从“文件 / 操作”菜单中新建。"],
    ["启用画板插件", "打开左上角“插件”，选中“画板插件”。"],
    [
      "新建画板",
      canvasPluginEnabled
        ? "点击标签栏右侧的画板图标，或使用画板快捷键。"
        : "需要先在“插件”中启用画板插件。未启用时画板快捷键不会生效。",
    ],
    ["编辑画板", "在画板中双击创建文字区，双击已有文字再次编辑，拖拽元素可移动位置；图片会以纯图片形式显示。"],
    ["思维导图", "在画板顶部点击“新建思维导图”。拖动同级主题可调整顺序；Tab 添加子主题、Enter 添加同级主题、Delete 删除分支，双击主题可编辑。"],
    ["关联主题与内容", "点击画板顶部“关联”，先选择子主题，再选择画板文字或图片即可建立连线；拖动连线可改变最近一端的吸附边，选中后按 Delete 或右键可删除。"],
    ["调整主题层级", "拖到另一个主题中部可成为其子主题，拖到主题上、下边缘可调整同级顺序。"],
    ["导图样式", "点击画板顶部“样式”，在独立窗口中调整左右结构、分支线型、粗细、彩色分支、主题形状、间距和导出背景。"],
    ["导出画板图片", "点击画板顶部“导出图片”，会按照全部内容边界生成清晰的 PNG，不受当前缩放和视口范围限制。"],
    ["打开链接", "在文本模块或画板文字中按住 Ctrl 并单击 HTTP/HTTPS 链接，会使用外部浏览器打开。"],
    ["保存内容", "当前标签有文件路径时直接保存；新内容会弹出保存位置选择。"],
    ["搜索内容", "打开全局搜索后，可在文本模块和画板文字中定位匹配项。"],
    ["关闭标签", "关闭最后一个标签后会进入空工作区。"],
    ["侧边栏与快捷键", "左边是侧边栏，可以选择通过侧边栏操作，也可以使用快捷键切换。"],
  ];

  const shortcutRows = [
    ["新建文本模块", shortcuts.newText],
    ["新建画板", canvasPluginEnabled ? shortcuts.newCanvas : `${shortcuts.newCanvas}（插件未启用）`],
    ["关闭当前标签", shortcuts.closeTab],
    ["保存当前标签", shortcuts.save],
    ["搜索", shortcuts.search],
    ["撤销 / 重做", `${shortcuts.undo} / ${shortcuts.redo}`],
    ["备用重做", shortcuts.redoAlt],
    ["粘贴", shortcuts.paste],
    ["删除选中元素", shortcuts.deleteSelected],
    ["放大 / 缩小文本字号", `${shortcuts.fileFontIncrease} / ${shortcuts.fileFontDecrease}`],
    ["打开左侧 / 右侧标签", `${shortcuts.previousTab} / ${shortcuts.nextTab}`],
    ["向左 / 向右分割视图", `${shortcuts.splitLeft} / ${shortcuts.splitRight}`],
  ];

  return (
    <div className="help-docs">
      <section>
        <h3>操作</h3>
        <dl>
          {operations.map(([title, desc]) => (
            <div key={title} className="help-doc-row">
              <dt>{title}</dt>
              <dd>{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3>快捷键</h3>
        <dl>
          {shortcutRows.map(([title, shortcut]) => (
            <div key={title} className="help-doc-row shortcut">
              <dt>{title}</dt>
              <dd>
                {shortcut.split(" / ").map((part, index) => (
                  <span key={`${part}-${index}`} className="help-doc-shortcut-part">
                    {index > 0 ? <span className="help-doc-shortcut-separator">/</span> : null}
                    <span className="help-doc-shortcut-key">{part}</span>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
