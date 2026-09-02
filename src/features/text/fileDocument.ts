import type { FileDocumentMode, FileTab } from "../../appTypes";

export function isMarkdownFileName(fileName?: string) {
  return Boolean(fileName && /\.(md|markdown|mdown|mkd)$/i.test(fileName));
}

export function getFileDocumentMode(file: Pick<FileTab, "fileName" | "filePath" | "documentMode">): FileDocumentMode {
  if (file.documentMode) return file.documentMode;
  return isMarkdownFileName(file.fileName) || isMarkdownFileName(file.filePath) ? "markdown" : "text";
}
