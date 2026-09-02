import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { verifyUpdateConfig } from "./update-config.mjs";

const require = createRequire(import.meta.url);
const { NsisUpdater } = require("electron-updater");
const temporaryDirectories = [];
function fixture(content) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "super-note-update-config-"));
  temporaryDirectories.push(directory);
  const file = path.join(directory, "app-update.yml");
  if (content !== undefined) writeFileSync(file, content);
  return { directory, file };
}
const valid = "provider: generic\nurl: https://github.com/lvkun996/super-note/releases/latest/download/\nchannel: latest\nupdaterCacheDirName: super-note-updater\n";
afterEach(() => { for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("packaged updater configuration", () => {
  it("rejects missing configuration before publishing", () => {
    expect(() => verifyUpdateConfig(fixture().file)).toThrow();
  });
  it("requires the provider, release URL, channel and safe cache name", () => {
    expect(verifyUpdateConfig(fixture(valid).file).updaterCacheDirName).toBe("super-note-updater");
    for (const broken of [valid.replace("generic", "github"), valid.replace("https:", "http:"), valid.replace("channel: latest", "channel: win7-8"), valid.replace("super-note-updater", "../outside")]) {
      expect(() => verifyUpdateConfig(fixture(broken).file)).toThrow();
    }
  });
  it("reproduces the real updater ENOENT and creates its download cache with the repaired file", async () => {
    const { file, directory } = fixture();
    const adapter = { version: "0.1.18", name: "super-note", isPackaged: true, appUpdateConfigPath: file, userDataPath: directory, baseCachePath: directory };
    const missing = new NsisUpdater(null, adapter);
    missing.logger = null;
    await expect(missing.getOrCreateDownloadHelper()).rejects.toMatchObject({ code: "ENOENT" });
    writeFileSync(file, valid);
    const repaired = new NsisUpdater(null, adapter);
    repaired.logger = null;
    const helper = await repaired.getOrCreateDownloadHelper();
    expect(helper.cacheDir).toBe(path.join(directory, "super-note-updater"));
  });
});
