import type { AppSettings, ShortcutConfig } from "../../appTypes";
import { DEFAULT_PLUGIN_SETTINGS, normalizePluginSettings } from "../../pluginSettings";

export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  newCanvas: "Ctrl+D",
  newText: "Ctrl+T",
  closeTab: "Ctrl+Q",
  fileFontIncrease: "Ctrl++",
  fileFontDecrease: "Ctrl+-",
  fileFontReset: "Ctrl+0",
  toggleFullscreen: "Ctrl+H",
  save: "Ctrl+S",
  search: "Ctrl+F",
  quickOpen: "Ctrl+P",
  undo: "Ctrl+Z",
  redo: "Ctrl+Y",
  redoAlt: "Ctrl+Shift+Z",
  paste: "Ctrl+V",
  deleteSelected: "Backspace",
  previousTab: "Ctrl+Left",
  nextTab: "Ctrl+Right",
  toggleTabLayout: "Ctrl+B",
  splitLeft: "Ctrl+Shift+Left",
  splitRight: "Ctrl+Shift+Right",
};

export const DEFAULT_SETTINGS: AppSettings = {
  language: "zh-CN",
  handwritten: false,
  programmerMode: false,
  darkMode: false,
  followSystemTheme: false,
  tabLayout: "top",
  sidebarWidth: 220,
  defaultSaveDirectory: "",
  plugins: DEFAULT_PLUGIN_SETTINGS,
  shortcuts: DEFAULT_SHORTCUTS,
};

function splitShortcutParts(value: string) {
  const clean = value.replace(/Command/gi, "Meta").replace(/Cmd/gi, "Meta");
  const parts = clean.split("+").map((part) => part.trim()).filter(Boolean);
  if (clean.trim().endsWith("+")) parts.push("+");
  return parts;
}

function normalizeShortcutKey(part: string) {
  const lower = part.toLowerCase();
  if (lower === "plus" || lower === "add" || lower === "numpadadd" || part === "+" || part === "=") return "+";
  if (lower === "minus" || lower === "subtract" || lower === "numpadsubtract" || part === "-" || part === "_") return "-";
  if (lower === "left" || lower === "arrowleft") return "Left";
  if (lower === "right" || lower === "arrowright") return "Right";
  if (lower === "up" || lower === "arrowup") return "Up";
  if (lower === "down" || lower === "arrowdown") return "Down";
  if (part.length === 1) return part.toUpperCase();
  return part[0].toUpperCase() + part.slice(1);
}

export function normalizeShortcut(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  const modifiers = new Set<string>();
  let key = "";
  splitShortcutParts(clean).forEach((part) => {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") modifiers.add("Ctrl");
    else if (lower === "meta" || lower === "win" || lower === "super") modifiers.add("Meta");
    else if (lower === "alt" || lower === "option") modifiers.add("Alt");
    else if (lower === "shift") modifiers.add("Shift");
    else key = normalizeShortcutKey(part);
  });
  return ["Ctrl", "Meta", "Alt", "Shift"].filter((part) => modifiers.has(part)).concat(key ? [key] : []).join("+");
}

export function shortcutFromEvent(event: KeyboardEvent | { key: string; code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }) {
  const key = event.key;
  if (["Control", "Meta", "Alt", "Shift"].includes(key)) return "";
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
              : key === "ArrowUp"
                ? "Up"
                : key === "ArrowDown"
                  ? "Down"
              : key.length === 1
                ? key.toUpperCase()
                : key;
  const includeShift = event.shiftKey && normalizedKey !== "+";
  return [event.ctrlKey ? "Ctrl" : "", event.metaKey ? "Meta" : "", event.altKey ? "Alt" : "", includeShift ? "Shift" : "", normalizedKey]
    .filter(Boolean)
    .join("+");
}

export function shortcutMatches(event: KeyboardEvent, shortcut: string) {
  return normalizeShortcut(shortcutFromEvent(event)) === normalizeShortcut(shortcut);
}

export function normalizeSettings(value?: Partial<AppSettings>): AppSettings {
  const shortcuts = { ...DEFAULT_SHORTCUTS, ...(value?.shortcuts ?? {}) };
  if (!value?.shortcuts?.deleteSelected || value.shortcuts.deleteSelected === "Delete") shortcuts.deleteSelected = DEFAULT_SHORTCUTS.deleteSelected;
  if (!value?.shortcuts?.previousTab && value?.shortcuts?.splitLeft === "Ctrl+Left") shortcuts.splitLeft = DEFAULT_SHORTCUTS.splitLeft;
  if (!value?.shortcuts?.nextTab && value?.shortcuts?.splitRight === "Ctrl+Right") shortcuts.splitRight = DEFAULT_SHORTCUTS.splitRight;

  return {
    handwritten: Boolean(value?.handwritten),
    language: value?.language === "en-US" ? "en-US" : "zh-CN",
    programmerMode: Boolean(value?.programmerMode),
    darkMode: Boolean(value?.darkMode),
    followSystemTheme: Boolean(value?.followSystemTheme),
    tabLayout: value?.tabLayout === "left" ? "left" : "top",
    sidebarWidth: Math.min(480, Math.max(160, Number(value?.sidebarWidth) || DEFAULT_SETTINGS.sidebarWidth)),
    defaultSaveDirectory: typeof value?.defaultSaveDirectory === "string" ? value.defaultSaveDirectory : "",
    plugins: normalizePluginSettings(value?.plugins),
    shortcuts,
  };
}
