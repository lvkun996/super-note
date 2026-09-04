import { uiText } from "../../../electron/uiLanguage";
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function buildSaveFileName(title: string | undefined, extension: string, fallbackTitle = uiText("未命名文本")) {
  const normalizedExtension = extension.replace(/^\.+/, "").toLowerCase() || "txt";
  const normalized = (title ?? "")
    .trim()
    .replace(new RegExp(`\\.${normalizedExtension}$`, "i"), "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  const baseName = normalized && !WINDOWS_RESERVED_NAME.test(normalized) ? normalized : fallbackTitle;
  return `${baseName}.${normalizedExtension}`;
}
