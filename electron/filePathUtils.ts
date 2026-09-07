import path from "node:path";

/**
 * Add the document's default extension only when the user did not provide one.
 * An explicit extension in a save dialog is always respected.
 */
export function appendExtensionIfMissing(filePath: string, extension: string) {
  const normalizedExtension = extension.replace(/^\.+/, "").toLowerCase();
  if (!normalizedExtension || path.extname(path.basename(filePath))) {
    return filePath;
  }
  return `${filePath}.${normalizedExtension}`;
}
