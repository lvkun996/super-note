import type { FileDocumentMode, FileTab } from "../../appTypes";

export function isMarkdownFileName(fileName?: string) {
  return Boolean(fileName && /\.(md|markdown|mdown|mkd)$/i.test(fileName));
}

export function isJsonFileName(fileName?: string) {
  return Boolean(fileName && /\.json$/i.test(fileName));
}

export function formatOpenedFileContent(content: string, ...fileNames: Array<string | undefined>) {
  if (!fileNames.some(isJsonFileName) || !content.trim()) return content;
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

export function getFileDocumentMode(file: Pick<FileTab, "fileName" | "filePath" | "documentMode">): FileDocumentMode {
  if (file.documentMode) return file.documentMode;
  return isMarkdownFileName(file.fileName) || isMarkdownFileName(file.filePath) ? "markdown" : "text";
}
