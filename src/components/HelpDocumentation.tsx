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
    ["编辑画板", "在画板中双击创建文字区，双击已有文字再次编辑，拖拽元素可移动位置。"],
    ["保存内容", "当前标签有文件路径时直接保存；新内容会弹出保存位置选择。"],
    ["搜索内容", "打开全局搜索后，可在文本模块和画板文字中定位匹配项。"],
    ["关闭标签", "关闭最后一个标签后会进入空工作区。"],
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
              <dd>{shortcut}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
