import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { atomicWriteText, isWorkspaceJson, readJsonFileCandidate } from "./fileStorage";

const tempDirectories: string[] = [];

async function makeTempDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "super-note-storage-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("atomic workspace storage", () => {
  it("replaces the primary file and keeps the previous valid content as backup", async () => {
    const directory = await makeTempDirectory();
    const primary = path.join(directory, "workspace.json");
    const backup = `${primary}.bak`;
    const oldContent = JSON.stringify({ version: 4, tabs: [] });
    const nextContent = JSON.stringify({ version: 5, tabs: [] });
    await writeFile(primary, oldContent, "utf8");

    await atomicWriteText(primary, nextContent, {
      backupPath: backup,
      validateExisting: (content) => isWorkspaceJson(JSON.parse(content)),
    });

    expect(await readFile(primary, "utf8")).toBe(nextContent);
    expect(await readFile(backup, "utf8")).toBe(oldContent);
  });

  it("does not overwrite a good backup with a corrupt primary", async () => {
    const directory = await makeTempDirectory();
    const primary = path.join(directory, "workspace.json");
    const backup = `${primary}.bak`;
    await writeFile(primary, "broken", "utf8");
    await writeFile(backup, JSON.stringify({ version: 4, tabs: [] }), "utf8");

    await atomicWriteText(primary, JSON.stringify({ version: 5, tabs: [] }), {
      backupPath: backup,
      validateExisting: (content) => {
        try {
          return isWorkspaceJson(JSON.parse(content));
        } catch {
          return false;
        }
      },
    });

    expect((await readJsonFileCandidate(backup)).value).toEqual({ version: 4, tabs: [] });
  });
});
