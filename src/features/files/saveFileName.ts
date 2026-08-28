const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function buildSnoteFileName(title?: string) {
  const normalized = (title ?? "")
    .trim()
    .replace(/\.snote$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  const baseName = normalized && !WINDOWS_RESERVED_NAME.test(normalized) ? normalized : "未命名文本";
  return `${baseName}.snote`;
}
