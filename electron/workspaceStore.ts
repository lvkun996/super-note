import { createHash } from "node:crypto";
import { readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { atomicWriteText, isWorkspaceJson } from "./fileStorage";

type Tab = { id: string; [key: string]: unknown };
type Workspace = { version: number; tabs: Tab[]; [key: string]: unknown };
type TabReference = { id: string; blob: string };
type Manifest = Omit<Workspace, "tabs"> & { storage: "tab-blobs-v1"; tabs: TabReference[] };
export type WorkspaceDelta = { metadata: Record<string, unknown>; tabIds: string[]; changedTabs: Tab[] };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function validTab(value: unknown): value is Tab {
  if (!value || typeof value !== "object") return false;
  const tab = value as Tab;
  return typeof tab.id === "string" && Boolean(tab.id) &&
    (tab.kind === "file" && typeof tab.content === "string" || tab.kind === "canvas" && Array.isArray(tab.items));
}

// Immutable tab blobs are committed before the small workspace manifest. Both
// primary and backup manifests therefore always reference complete documents.
export function createWorkspaceStore(filePath: string) {
  const backupPath = `${filePath}.bak`, directory = `${filePath}.tabs`, backupDirectory = `${filePath}.tabs-backup`;
  const knownBackupBlobs = new Set<string>();
  let cached = new Map<string, { tab: Tab; blob?: string }>();
  let lastValidRaw: string | undefined;
  let loaded = false, writes = 0;
  let queue = Promise.resolve();

  async function readCandidate(candidatePath: string) {
    let exists = false;
    try {
      const raw = await readFile(candidatePath, "utf8");
      exists = true;
      const parsed = JSON.parse(raw);
      if (!isWorkspaceJson(parsed)) throw new Error("Invalid workspace");
      const refs = new Map<string, string>();
      if (parsed.storage === "tab-blobs-v1") {
        parsed.tabs = await Promise.all(parsed.tabs.map(async (ref: TabReference) => {
          if (!ref || typeof ref.id !== "string" || !validHash(ref.blob)) throw new Error("Invalid tab reference");
          const text = await readFile(path.join(candidatePath === backupPath ? backupDirectory : directory, `${ref.blob}.json`), "utf8");
          if (hash(text) !== ref.blob) throw new Error("Damaged tab data");
          const tab = JSON.parse(text);
          if (!validTab(tab) || tab.id !== ref.id) throw new Error("Invalid tab data");
          refs.set(ref.id, ref.blob);
          return tab;
        }));
        delete parsed.storage;
      }
      if (!parsed.tabs.every(validTab) || new Set(parsed.tabs.map((tab: Tab) => tab.id)).size !== parsed.tabs.length) throw new Error("Invalid workspace tabs");
      return { value: parsed as Workspace, raw, refs, error: undefined as string | undefined };
    } catch (error) {
      return { value: undefined, raw: undefined, refs: new Map<string, string>(), error: !exists && (error as NodeJS.ErrnoException).code === "ENOENT" ? undefined : String(error) };
    }
  }

  async function load() {
    const [primary, backup] = await Promise.all([readCandidate(filePath), readCandidate(backupPath)]);
    const selected = primary.value ? primary : backup;
    cached = new Map(selected.value?.tabs.map(tab => [tab.id, { tab, blob: primary.value ? selected.refs.get(tab.id) : undefined }]) ?? []);
    knownBackupBlobs.clear();
    for (const blob of backup.refs.values()) if (backup.value) knownBackupBlobs.add(blob);
    lastValidRaw = selected.raw;
    loaded = true;
    return { ok: !primary.error || Boolean(backup.value), workspace: primary.value ?? null, backupWorkspace: backup.value ?? null, path: filePath, backupPath, error: primary.error };
  }

  async function commit(value: unknown, delta: boolean) {
    if (!loaded) await load();
    let workspace: Workspace;
    let changedIds: Set<string>;
    if (delta) {
      const payload = value as WorkspaceDelta;
      if (!payload || !payload.metadata || !Array.isArray(payload.tabIds) || !payload.tabIds.every(id => typeof id === "string") ||
          new Set(payload.tabIds).size !== payload.tabIds.length || !Array.isArray(payload.changedTabs) || !payload.changedTabs.every(validTab)) throw new Error("Invalid workspace delta");
      const changed = new Map(payload.changedTabs.map(tab => [tab.id, tab]));
      const tabs = payload.tabIds.map(id => changed.get(id) ?? cached.get(id)?.tab);
      if (!tabs.every(validTab)) throw new Error("Missing workspace tab; full save required");
      workspace = { ...payload.metadata, tabs } as Workspace;
      changedIds = new Set(changed.keys());
    } else {
      workspace = value as Workspace;
      changedIds = new Set(workspace?.tabs?.map(tab => tab.id));
    }
    if (!isWorkspaceJson(workspace) || !workspace.tabs.every(validTab) || new Set(workspace.tabs.map(tab => tab.id)).size !== workspace.tabs.length) throw new Error("Invalid workspace payload");
    const next = new Map<string, { tab: Tab; blob: string }>();
    const refs: TabReference[] = [];
    for (const tab of workspace.tabs) {
      const previous = cached.get(tab.id);
      let blob = !changedIds.has(tab.id) ? previous?.blob : undefined;
      if (!blob) {
        const text = JSON.stringify(tab);
        blob = hash(text);
        if (blob !== previous?.blob) await atomicWriteText(path.join(directory, `${blob}.json`), text);
      }
      next.set(tab.id, { tab, blob });
      refs.push({ id: tab.id, blob });
    }
    const manifest: Manifest = { ...workspace, storage: "tab-blobs-v1", tabs: refs };
    const raw = JSON.stringify(manifest);
    // Back up the last successfully hydrated/committed version, never a damaged
    // primary file that may have appeared since startup.
    if (lastValidRaw) {
      const previous = JSON.parse(lastValidRaw);
      if (previous.storage === "tab-blobs-v1") {
        for (const ref of previous.tabs as TabReference[]) {
          if (knownBackupBlobs.has(ref.blob)) continue;
          const tab = cached.get(ref.id)?.tab;
          const text = JSON.stringify(tab);
          if (!tab || hash(text) !== ref.blob) throw new Error("Missing backup tab data");
          await atomicWriteText(path.join(backupDirectory, `${ref.blob}.json`), text);
          knownBackupBlobs.add(ref.blob);
        }
      }
      await atomicWriteText(backupPath, lastValidRaw);
    }
    await atomicWriteText(filePath, raw);
    const previousRaw = lastValidRaw;
    lastValidRaw = raw;
    cached = next;
    if (++writes % 20 === 1) {
      const retained = new Set(refs.map(ref => `${ref.blob}.json`));
      if (previousRaw) {
        const backup = JSON.parse(previousRaw);
        if (backup.storage === "tab-blobs-v1") for (const ref of backup.tabs) retained.add(`${ref.blob}.json`);
      }
      // Only our hash-named blobs are eligible; preserve current and backup.
      for (const folder of [directory, backupDirectory]) {
        for (const name of await readdir(folder).catch(() => [] as string[])) {
          if (/^[a-f0-9]{64}\.json$/.test(name) && !retained.has(name)) {
            await unlink(path.join(folder, name)).catch(() => undefined);
            if (folder === backupDirectory) knownBackupBlobs.delete(name.slice(0, -5));
          }
        }
      }
    }
    return { ok: true as const, path: filePath, backupPath };
  }

  function save(value: unknown, delta = false) {
    const operation = queue.then(() => commit(value, delta));
    queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
  return { load: () => queue.then(load), save };
}
