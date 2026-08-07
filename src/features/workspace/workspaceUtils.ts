import type { PersistedWorkspace, RecentFile } from "../../appTypes";

export const CURRENT_WORKSPACE_VERSION = 5 as const;
export const RECENT_FILE_LIMIT = 20;

export function isPersistedWorkspace(value: unknown): value is PersistedWorkspace {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PersistedWorkspace>;
  return (
    (candidate.version === 1 ||
      candidate.version === 2 ||
      candidate.version === 3 ||
      candidate.version === 4 ||
      candidate.version === 5) &&
    typeof candidate.savedAt === "string" &&
    Array.isArray(candidate.tabs)
  );
}

export function selectWorkspaceCandidate(primary: unknown, backup: unknown) {
  if (isPersistedWorkspace(primary)) {
    return { workspace: primary, source: "primary" as const };
  }
  if (isPersistedWorkspace(backup)) {
    return { workspace: backup, source: "backup" as const };
  }
  return { workspace: null, source: "none" as const };
}

export function normalizeRecentFiles(value: unknown): RecentFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .filter((item): item is RecentFile => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const candidate = item as Partial<RecentFile>;
      return (
        typeof candidate.path === "string" &&
        candidate.path.length > 0 &&
        typeof candidate.name === "string" &&
        typeof candidate.openedAt === "number" &&
        Number.isFinite(candidate.openedAt)
      );
    })
    .sort((left, right) => right.openedAt - left.openedAt)
    .filter((item) => {
      const key = item.path.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, RECENT_FILE_LIMIT)
    .map((item) => ({
      path: item.path,
      name: item.name || item.path.split(/[\\/]/).pop() || item.path,
      openedAt: item.openedAt,
    }));
}

export function rememberRecentFiles(current: RecentFile[], files: Array<Pick<RecentFile, "path" | "name">>, now = Date.now()) {
  const next = [
    ...files.filter((file) => file.path).map((file, index) => ({ ...file, openedAt: now - index })),
    ...current,
  ];
  return normalizeRecentFiles(next);
}
