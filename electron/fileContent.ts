import { open, readFile } from "node:fs/promises";
import path from "node:path";

export const LARGE_TEXT_PREVIEW_BYTES = 512 * 1024;

export function formatContentForSave(filePath: string, content: string) {
  if (path.extname(filePath).toLowerCase() !== ".json" || !content.trim()) {
    return content;
  }
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

export async function readTextFilePreview(filePath: string, size: number) {
  if (size <= LARGE_TEXT_PREVIEW_BYTES) {
    return { content: await readFile(filePath, "utf8"), truncated: false };
  }

  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(LARGE_TEXT_PREVIEW_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return { content: buffer.subarray(0, bytesRead).toString("utf8"), truncated: true };
  } finally {
    await handle.close();
  }
}
