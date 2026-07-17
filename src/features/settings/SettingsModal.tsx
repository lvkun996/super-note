import { Button, Input, Modal, Switch } from "antd";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AppSettings, ShortcutAction, ShortcutConfig } from "../../appTypes";
import { DEFAULT_PLUGIN_SETTINGS, normalizePluginSettings } from "../../pluginSettings";

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  newCanvas: "Ctrl+D",
  newText: "Ctrl+T",
  closeTab: "Ctrl+Q",
  fileFontIncrease: "Ctrl++",
  fileFontDecrease: "Ctrl+-",
  save: "Ctrl+S",
  search: "Ctrl+F",
  undo: "Ctrl+Z",
  redo: "Ctrl+Y",
  redoAlt: "Ctrl+Shift+Z",
  paste: "Ctrl+V",
  deleteSelected: "Backspace",
  splitLeft: "Ctrl+Left",
  splitRight: "Ctrl+Right",
};

export const DEFAULT_SETTINGS: AppSettings = {
  handwritten: false,
  programmerMode: false,
  darkMode: false,
  followSystemTheme: false,
  plugins: DEFAULT_PLUGIN_SETTINGS,
  shortcuts: DEFAULT_SHORTCUTS,
};

const SHORTCUT_ROWS: Array<{ action: ShortcutAction; label: string; desc: string }> = [
  { action: "newCanvas", label: "新建画板", desc: "仅在画板插件启用后生效" },
  { action: "newText", label: "新建文本模块", desc: "直接创建一个纯文本编辑模块" },
  { action: "closeTab", label: "关闭当前标签", desc: "关闭当前画板或文本模块" },
  { action: "fileFontIncrease", label: "放大文本模块字号", desc: "仅调整当前文本模块的编辑字号" },
  { action: "fileFontDecrease", label: "缩小文本模块字号", desc: "仅调整当前文本模块的编辑字号" },
  { action: "save", label: "保存当前标签", desc: "保存当前文件或画板" },
  { action: "search", label: "全局搜索", desc: "打开全局搜索面板" },
  { action: "undo", label: "撤销", desc: "撤销当前模块变更" },
  { action: "redo", label: "重做", desc: "重做当前模块变更" },
  { action: "redoAlt", label: "重做备用", desc: "兼容常见编辑器快捷键" },
  { action: "paste", label: "粘贴", desc: "粘贴文字或图片" },
  { action: "deleteSelected", label: "删除选中元素", desc: "删除画板中选中的元素" },
  { action: "splitLeft", label: "向左分割视图", desc: "把当前标签分割到左侧视图" },
  { action: "splitRight", label: "向右分割视图", desc: "把当前标签分割到右侧视图" },
];

function splitShortcutParts(value: string) {
  const clean = value.replace(/Command/gi, "Meta").replace(/Cmd/gi, "Meta");
  const parts = clean
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (clean.trim().endsWith("+")) {
    parts.push("+");
  }
  return parts;
}

function normalizeShortcutKey(part: string) {
  const lower = part.toLowerCase();
  if (lower === "plus" || lower === "add" || lower === "numpadadd" || part === "+" || part === "=") {
    return "+";
  }
  if (lower === "minus" || lower === "subtract" || lower === "numpadsubtract" || part === "-" || part === "_") {
    return "-";
  }
  if (lower === "left" || lower === "arrowleft") {
    return "Left";
  }
  if (lower === "right" || lower === "arrowright") {
    return "Right";
  }
  if (part.length === 1) {
    return part.toUpperCase();
  }
  return part[0].toUpperCase() + part.slice(1);
}

export function normalizeShortcut(value: string) {
  const clean = value.trim();
  if (!clean) {
    return "";
  }
  const rawParts = splitShortcutParts(clean);
  const modifiers = new Set<string>();
  let key = "";
  rawParts.forEach((part) => {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      modifiers.add("Ctrl");
    } else if (lower === "meta" || lower === "win" || lower === "super") {
      modifiers.add("Meta");
    } else if (lower === "alt" || lower === "option") {
      modifiers.add("Alt");
    } else if (lower === "shift") {
      modifiers.add("Shift");
    } else {
      key = normalizeShortcutKey(part);
    }
  });
  return ["Ctrl", "Meta", "Alt", "Shift"]
    .filter((part) => modifiers.has(part))
    .concat(key ? [key] : [])
    .join("+");
}

export function shortcutFromEvent(event: KeyboardEvent | ReactKeyboardEvent) {
  const key = event.key;
  if (["Control", "Meta", "Alt", "Shift"].includes(key)) {
    return "";
  }
  const normalizedKey =
    event.code === "Equal" || event.code === "NumpadAdd" || key === "+" || key === "="
      ? "+"
      : event.code === "Minus" || event.code === "NumpadSubtract" || key === "-" || key === "_"
        ? "-"
        : key === " "
          ? "Space"
          : key === "ArrowLeft"
            ? "Left"
            : key === "ArrowRight"
              ? "Right"
              : key.length === 1
                ? key.toUpperCase()
                : key;
  const includeShift = event.shiftKey && normalizedKey !== "+";
  return [
    event.ctrlKey ? "Ctrl" : "",
    event.metaKey ? "Meta" : "",
    event.altKey ? "Alt" : "",
    includeShift ? "Shift" : "",
    normalizedKey,
  ]
    .filter(Boolean)
    .join("+");
}

export function shortcutMatches(event: KeyboardEvent, shortcut: string) {
  return normalizeShortcut(shortcutFromEvent(event)) === normalizeShortcut(shortcut);
}

export function normalizeSettings(value?: Partial<AppSettings>): AppSettings {
  const shortcuts = { ...DEFAULT_SHORTCUTS, ...(value?.shortcuts ?? {}) };
  if (!value?.shortcuts?.deleteSelected || value.shortcuts.deleteSelected === "Delete") {
    shortcuts.deleteSelected = DEFAULT_SHORTCUTS.deleteSelected;
  }

  return {
    handwritten: Boolean(value?.handwritten),
    programmerMode: Boolean(value?.programmerMode),
    darkMode: Boolean(value?.darkMode),
    followSystemTheme: Boolean(value?.followSystemTheme),
    plugins: normalizePluginSettings(value?.plugins),
    shortcuts,
  };
}

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
