import { describe, expect, it } from "vitest";
import { assetDescriptor, ensureReleaseBranch, ensureReleaseCanResume, ensureTagMatchesHead, ensureVersionAdvances, ensureVersionMetadata, parseReleaseOptions, selectPagesRun, verifyAssetMetadata } from "./release-policy.mjs";

describe("release safety and options", () => {
  it("defaults to modern Windows and accepts no-write modes", () => {
    expect(parseReleaseOptions([]).includeLegacy).toBe(false);
    expect(parseReleaseOptions(["--dry-run"]).dryRun).toBe(true);
    expect(parseReleaseOptions(["--check"]).check).toBe(true);
    expect(parseReleaseOptions(["--verify-only"]).verifyOnly).toBe(true);
    expect(parseReleaseOptions(["--with-win7-8", "--resume", "--notes-file", "notes.md", "--pages-timeout", "90"])).toMatchObject({ includeLegacy: true, resume: true, notesFile: "notes.md", pagesTimeoutMs: 90000 });
    expect(parseReleaseOptions(["--no-win7-8"]).includeLegacy).toBe(false);
  });
  it.each([["--typo"], ["--replace-existing-tag"], ["--notes-file"], ["--notes-file", "--check"], ["--pages-timeout", "NaN"], ["--pages-timeout", "1"], ["--check", "--verify-only"], ["--dry-run", "--check"], ["--verify-only", "--resume"]].map(args => [args]))("rejects unsafe/invalid options %j", (args) => expect(() => parseReleaseOptions(args)).toThrow());
  it("blocks accidental updater downgrades", () => {
    expect(() => ensureVersionAdvances("1.2.3", "v1.2.2")).not.toThrow();
    expect(() => ensureVersionAdvances("1.2.3", undefined)).not.toThrow();
    expect(() => ensureVersionAdvances("1.2.3", "v1.2.3")).toThrow();
    expect(() => ensureVersionAdvances("1.2.3", "v1.3.0")).toThrow();
  });
  it("requires matching stable package/lock/site versions", () => {
    const pkg = { version: "1.2.3" }, lock = { version: "1.2.3", packages: { "": pkg } };
    const site = "v1.2.3 releases/download/v1.2.3/Super.Note.Setup.1.2.3.exe";
    expect(() => ensureVersionMetadata(pkg, lock, site, false)).not.toThrow();
    expect(() => ensureVersionMetadata(pkg, lock, site, true)).toThrow("Win7/8");
    expect(() => ensureVersionMetadata(pkg, { ...lock, version: "1.2.2" }, site, false)).toThrow("versions differ");
    expect(() => ensureVersionMetadata(pkg, lock, "v1.2.3", false)).toThrow("installer link");
    expect(() => ensureVersionMetadata({ version: "1.2.3-beta" }, lock, site, false)).toThrow("stable");
  });
  it("requires the Pages branch and never relocates tags", () => {
    expect(() => ensureReleaseBranch("master", "branches: [master]")).not.toThrow();
    expect(() => ensureReleaseBranch("feature", "branches: [master]")).toThrow();
    expect(() => ensureTagMatchesHead("old", "new")).toThrow();
    expect(() => ensureTagMatchesHead("new", "new")).not.toThrow();
  });
  it("resumes only drafts with explicit intent", () => {
    expect(() => ensureReleaseCanResume(null, false)).not.toThrow();
    expect(() => ensureReleaseCanResume({ draft: true }, false)).toThrow("--resume");
    expect(() => ensureReleaseCanResume({ draft: true }, true)).not.toThrow();
    expect(() => ensureReleaseCanResume({ draft: false }, true)).toThrow("never overwritten");
  });
  it("checks uploaded asset size, state and available digest", () => {
    const local = assetDescriptor("installer.exe", Buffer.from("synthetic"));
    const remote = { ...local, state: "uploaded" };
    expect(() => verifyAssetMetadata(local, remote)).not.toThrow();
    for (const changed of [{ size: 1 }, { digest: "sha256:bad" }, { state: "starter" }]) expect(() => verifyAssetMetadata(local, { ...remote, ...changed })).toThrow();
  });
  it("waits for the exact source commit and branch", () => {
    expect(selectPagesRun([{ id: 4, head_sha: "other", head_branch: "master" }, { id: 3, head_sha: "head", head_branch: "feature" }, { id: 1, head_sha: "head", head_branch: "master" }, { id: 2, head_sha: "head", head_branch: "master" }], "head", "master")?.id).toBe(2);
    expect(selectPagesRun([], "head", "master")).toBeUndefined();
  });
});
