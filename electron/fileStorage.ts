import { copyFile, mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

export type FileMetadata = {
  exists: boolean;
  mtimeMs?: number;
  size?: number;
};

export type JsonFileCandidate = {
  value?: unknown;
  error?: string;
};

function isMissingFile(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

export async function getFileMetadata(filePath: string): Promise<FileMetadata> {
  try {
    const info = await stat(filePath);
    return { exists: true, mtimeMs: info.mtimeMs, size: info.size };
  } catch (error) {
    if (isMissingFile(error)) {
      return { exists: false };
    }
    throw error;
  }
}

export async function readJsonFileCandidate(filePath: string): Promise<JsonFileCandidate> {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return isMissingFile(error) ? {} : { error: String(error) };
  }
}

export function isWorkspaceJson(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as { version?: unknown; tabs?: unknown };
  return (
    typeof candidate.version === "number" &&
    candidate.version >= 1 &&
    candidate.version <= 5 &&
    Number.isInteger(candidate.version) &&
    Array.isArray(candidate.tabs)
  );
}

export async function atomicWriteText(
  filePath: string,
  content: string,
  options: { backupPath?: string; validateExisting?: (content: string) => boolean } = {},
) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    handle = await open(tempPath, "w");
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;

    if (options.backupPath) {
      try {
        const existing = await readFile(filePath, "utf8");
        if (!options.validateExisting || options.validateExisting(existing)) {
          await copyFile(filePath, options.backupPath);
        }
      } catch (error) {
        if (!isMissingFile(error)) {
          throw error;
        }
      }
    }

    await rename(tempPath, filePath);
    return getFileMetadata(filePath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}
