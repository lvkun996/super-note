import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile, stat, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWorkspaceStore } from "./workspaceStore";
const directories: string[] = [];
async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "super-note-incremental-"));
  directories.push(directory);
  const file = path.join(directory, "workspace.json");
  return { file, store: createWorkspaceStore(file) };
}
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });
const tab = (id: string, content: string) => ({ id, kind: "file", content });

describe("incremental workspace persistence", () => {
  it("reads legacy data and preserves the legacy backup during migration", async () => {
    const { file, store } = await fixture();
    const old = { version: 5, tabs: [tab("a", "未保存正文🙂")], activeTabId: "a" };
    await writeFile(file, JSON.stringify(old));
    expect((await store.load()).workspace).toEqual(old);
    await store.save(old);
    expect(JSON.parse(await readFile(`${file}.bak`, "utf8"))).toEqual(old);
    expect((await createWorkspaceStore(file).load()).workspace).toEqual(old);
    expect(await readFile(file, "utf8")).not.toContain("未保存正文");
  });
  it("updates only changed tabs, preserves order/removals and avoids rewriting unchanged blobs", async () => {
    const { file, store } = await fixture();
    await store.save({ version: 5, tabs: [tab("a", "one"), tab("b", "two")] });
    const manifest = JSON.parse(await readFile(file, "utf8"));
    const unchanged = path.join(`${file}.tabs`, `${manifest.tabs[1].blob}.json`);
    const modified = (await stat(unchanged)).mtimeMs;
    await store.save({ metadata: { version: 5, activeTabId: "b" }, tabIds: ["b", "a"], changedTabs: [tab("a", "new")] }, true);
    expect((await stat(unchanged)).mtimeMs).toBe(modified);
    expect((await createWorkspaceStore(file).load()).workspace?.tabs).toEqual([tab("b", "two"), tab("a", "new")]);
    await store.save({ metadata: { version: 5 }, tabIds: ["b"], changedTabs: [] }, true);
    const result = await createWorkspaceStore(file).load();
    expect(result.workspace?.tabs).toEqual([tab("b", "two")]);
    expect(result.backupWorkspace?.tabs).toHaveLength(2);
  });
  it("recovers from corrupted shared primary data using an independent backup and can save again", async () => {
    const { file, store } = await fixture();
    const workspace = { version: 5, tabs: [tab("a", "kept")] };
    await store.save(workspace);
    await store.save({ metadata: { version: 5 }, tabIds: ["a"], changedTabs: [] }, true);
    const manifest = JSON.parse(await readFile(file, "utf8"));
    await writeFile(path.join(`${file}.tabs`, `${manifest.tabs[0].blob}.json`), "damaged");
    const recovered = createWorkspaceStore(file);
    const result = await recovered.load();
    expect(result.workspace).toBeNull(); expect(result.backupWorkspace).toEqual(workspace);
    await recovered.save({ metadata: { version: 5 }, tabIds: ["a"], changedTabs: [] }, true);
    expect((await createWorkspaceStore(file).load()).workspace).toEqual(workspace);
  });
  it("serializes overlapping saves, survives a failed delta and collects obsolete blobs safely", async () => {
    const { file, store } = await fixture();
    await store.save({ version: 5, tabs: [tab("a", "0")] });
    await expect(store.save({ metadata: { version: 5 }, tabIds: ["missing"], changedTabs: [] }, true)).rejects.toThrow();
    await Promise.all(Array.from({ length: 20 }, (_, index) => store.save({ metadata: { version: 5 }, tabIds: ["a"], changedTabs: [tab("a", String(index + 1))] }, true)));
    const result = await createWorkspaceStore(file).load();
    expect(result.workspace?.tabs[0].content).toBe("20");
    expect(result.backupWorkspace?.tabs[0].content).toBe("19");
    expect((await readdir(`${file}.tabs`)).length).toBeLessThanOrEqual(2);
    expect((await readdir(`${file}.tabs-backup`)).length).toBeLessThanOrEqual(2);
  });
  it("reports a missing blob as damage rather than an empty new workspace", async () => {
    const { file, store } = await fixture();
    await store.save({ version: 5, tabs: [tab("a", "unsaved")] });
    const manifest = JSON.parse(await readFile(file, "utf8"));
    await unlink(path.join(`${file}.tabs`, `${manifest.tabs[0].blob}.json`));
    const result = await createWorkspaceStore(file).load();
    expect(result.ok).toBe(false); expect(result.error).toBeTruthy();
  });
});
