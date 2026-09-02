import { Button, Input, Modal, Segmented, Switch } from "antd";
import type { AppSettings, ShortcutAction } from "../../appTypes";
import { DEFAULT_SHORTCUTS, normalizeShortcut, shortcutFromEvent } from "./settingsModel";

const SHORTCUT_ROWS: Array<{ action: ShortcutAction; label: string; desc: string }> = [
  { action: "newCanvas", label: "新建画板", desc: "仅在画板插件启用后生效" },
  { action: "newText", label: "新建文本模块", desc: "直接创建一个纯文本编辑模块" },
  { action: "closeTab", label: "关闭当前标签", desc: "关闭当前画板或文本模块" },
  { action: "fileFontIncrease", label: "放大文本模块字号", desc: "仅调整当前文本模块的编辑字号" },
  { action: "fileFontDecrease", label: "缩小文本模块字号", desc: "仅调整当前文本模块的编辑字号" },
  { action: "fileFontReset", label: "恢复文本为 100%", desc: "将当前文本模块字号恢复为默认大小" },
  { action: "toggleFullscreen", label: "切换全屏", desc: "进入或退出 Super Note 全屏模式" },
  { action: "save", label: "保存当前标签", desc: "保存当前文件或画板" },
  { action: "search", label: "搜索当前页", desc: "再次按下快捷键后切换为搜索全部标签" },
  { action: "quickOpen", label: "快速打开", desc: "搜索已打开标签和最近文件" },
  { action: "undo", label: "撤销", desc: "撤销当前模块变更" },
  { action: "redo", label: "重做", desc: "重做当前模块变更" },
  { action: "redoAlt", label: "重做备用", desc: "兼容常见编辑器快捷键" },
  { action: "paste", label: "粘贴", desc: "粘贴文字或图片" },
  { action: "deleteSelected", label: "删除选中元素", desc: "删除画板中选中的元素" },
  { action: "previousTab", label: "打开上一个标签", desc: "顶部布局使用当前设置；左侧布局固定使用 Ctrl+↑" },
  { action: "nextTab", label: "打开下一个标签", desc: "顶部布局使用当前设置；左侧布局固定使用 Ctrl+↓" },
  { action: "toggleTabLayout", label: "切换标签栏位置", desc: "在顶部标签栏和左侧标签菜单之间切换" },
  { action: "splitLeft", label: "向左分割视图", desc: "把当前标签分割到左侧视图" },
  { action: "splitRight", label: "向右分割视图", desc: "把当前标签分割到右侧视图" },
];

type SettingsModalProps = {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
};

export function SettingsModal({ open, settings, onClose, onChange }: SettingsModalProps) {
  const updateShortcut = (action: ShortcutAction, shortcut: string) => {
    onChange({
      ...settings,
      shortcuts: { ...settings.shortcuts, [action]: normalizeShortcut(shortcut) },
    });
  };

  return (
    <Modal
      title="设置"
      open={open}
      footer={null}
      onCancel={onClose}
      width="min(720px, calc(100vw - 32px))"
      style={{ top: 24 }}
      styles={{ body: { maxHeight: "min(72vh, calc(100vh - 140px))", overflowY: "auto", paddingRight: 8 } }}
    >
      <div className="settings-panel">
        <div className="settings-row">
          <span>
            <strong>布局模式</strong>
            <small>选择顶部标签栏或左侧标签栏，也可以使用 {settings.shortcuts.toggleTabLayout} 快速切换。</small>
          </span>
          <Segmented
            value={settings.tabLayout}
            options={[{ label: "顶栏模式", value: "top" }, { label: "侧边模式", value: "left" }]}
            onChange={(value) => onChange({ ...settings, tabLayout: value as AppSettings["tabLayout"] })}
          />
        </div>

        <div className="settings-row settings-directory-row">
          <span>
            <strong>默认文件保存位置</strong>
            <small>新建内容首次保存时优先打开这个文件夹；留空则使用系统默认位置。</small>
          </span>
          <div className="settings-directory-control">
            <Input
              value={settings.defaultSaveDirectory}
              readOnly
              placeholder="使用系统默认位置"
              allowClear
              onChange={(event) => onChange({ ...settings, defaultSaveDirectory: event.target.value })}
            />
            <Button
              onClick={async () => {
                const result = await window.superNote?.selectDirectory(settings.defaultSaveDirectory);
                if (result?.path) onChange({ ...settings, defaultSaveDirectory: result.path });
              }}
            >
              选择
            </Button>
          </div>
        </div>

        <label className="settings-row">
          <span>
            <strong>手绘风格</strong>
            <small>打开后，画板文字切换为偏 Q 版的手绘字体栈。</small>
          </span>
          <Switch checked={settings.handwritten} onChange={(checked) => onChange({ ...settings, handwritten: checked })} />
        </label>

        <label className="settings-row">
          <span>
            <strong>程序员使用</strong>
            <small>打开后，画布文字元素和文本模块右键菜单增加 JSON 工具。</small>
          </span>
          <Switch checked={settings.programmerMode} onChange={(checked) => onChange({ ...settings, programmerMode: checked })} />
        </label>

        <label className="settings-row">
          <span>
            <strong>夜间模式跟随系统设置</strong>
            <small>打开后，夜间模式会跟随系统外观自动切换。</small>
          </span>
          <Switch
            checked={settings.followSystemTheme}
            onChange={(checked) => onChange({ ...settings, followSystemTheme: checked })}
          />
        </label>

        <label className="settings-row">
          <span>
            <strong>全局快速打开/关闭</strong>
            <small>在任意位置按 Ctrl + Alt + 空格，可打开或隐藏 Super Note。</small>
          </span>
          <Input value="Ctrl + Alt + 空格" disabled />
        </label>

        <div className="shortcut-settings">
          <div className="settings-section-title">快捷键设置</div>
          {SHORTCUT_ROWS.map((row) => (
            <label className="shortcut-row" key={row.action}>
              <span>
                <strong>{row.label}</strong>
                <small>{row.desc}</small>
              </span>
              <Input
                value={settings.shortcuts[row.action]}
                onChange={(event) => updateShortcut(row.action, event.target.value)}
                onKeyDown={(event) => {
                  const shortcut = shortcutFromEvent(event);
                  if (shortcut) {
                    event.preventDefault();
                    updateShortcut(row.action, shortcut);
                  }
                }}
              />
            </label>
          ))}
          <Button onClick={() => onChange({ ...settings, shortcuts: DEFAULT_SHORTCUTS })}>恢复默认快捷键</Button>
        </div>
      </div>
    </Modal>
  );
}
