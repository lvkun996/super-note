import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "release.mjs");
const snapshot = () => {
  const files = ["package.json", "package-lock.json", "site/index.html", "release/latest.yml"];
  return files.map(file => {
    const target = path.join(root, file);
    return existsSync(target) ? [file, statSync(target).mtimeMs, readFileSync(target, "utf8")] : [file, null];
  });
};
const invoke = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 15000, env: { ...process.env, GH_TOKEN: "", GITHUB_TOKEN: "" } });

describe("release CLI no-write modes", () => {
  it("help documents verification and draft resumption without credentials", () => {
    const before = snapshot(), result = invoke("--help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--verify-only");
    expect(result.stdout).toContain("--resume");
    expect(snapshot()).toEqual(before);
  });
  it("dry-run plans both channels without builds, pushes or uploads", () => {
    const before = snapshot(), result = invoke("--dry-run", "--with-win7-8");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Windows 10/11 + Win7/8");
    expect(result.stdout).not.toContain("\n> ");
    expect(snapshot()).toEqual(before);
  });
  it("local check stops at preflight even in a dirty or detached checkout", () => {
    const before = snapshot(), result = invoke("--check");
    expect([0, 1]).toContain(result.status);
    expect(result.stdout).not.toContain("build-installer.mjs");
    expect(result.stdout).not.toContain("Uploading");
    expect(result.stdout).not.toContain("\n> git push");
    expect(result.stderr).not.toContain("GitHub token not found");
    expect(snapshot()).toEqual(before);
  });
});
