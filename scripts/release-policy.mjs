import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const { valid, gt } = createRequire(import.meta.url)("semver");

export function parseReleaseOptions(args) {
  const options = { includeLegacy: false, dryRun: false, check: false, help: false, resume: false, verifyOnly: false, notesFile: undefined, pagesTimeoutMs: 10 * 60 * 1000 };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--with-win7-8") options.includeLegacy = true;
    else if (argument === "--no-win7-8") options.includeLegacy = false;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--check") options.check = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--resume") options.resume = true;
    else if (argument === "--verify-only") options.verifyOnly = true;
    else if (argument === "--notes-file") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error("--notes-file requires a Markdown file path.");
      options.notesFile = value;
    } else if (argument === "--pages-timeout") {
      const seconds = Number(args[++index]);
      if (!Number.isFinite(seconds) || seconds < 30 || seconds > 3600) throw new Error("--pages-timeout must be 30..3600 seconds.");
      options.pagesTimeoutMs = seconds * 1000;
    } else throw new Error(`Unknown release option: ${argument}`);
  }
  if ([options.check, options.dryRun, options.verifyOnly].filter(Boolean).length > 1) throw new Error("Choose only one of --check, --dry-run and --verify-only.");
  if (options.verifyOnly && options.resume) throw new Error("--verify-only cannot resume or mutate a release.");
  return options;
}

export function ensureVersionAdvances(version, latestTag) {
  if (!latestTag) return;
  const latest = latestTag.replace(/^v/, "");
  if (!valid(latest) || !gt(version, latest)) throw new Error("The new version must be higher than the current published release.");
}

export function ensureVersionMetadata(packageJson, lock, site, includeLegacy) {
  const version = packageJson.version;
  if (!/^\d+\.\d+\.\d+$/.test(version) || !valid(version)) throw new Error("A stable x.y.z package version is required.");
  if (lock.version !== version || lock.packages?.[""]?.version !== version) throw new Error("package.json and package-lock.json versions differ.");
  const tag = `v${version}`;
  const currentLink = `releases/download/${tag}/Super.Note.Setup.${version}.exe`;
  if (!site.includes(tag) || !site.includes(currentLink)) throw new Error(`site/index.html must reference ${tag} and its installer link.`);
  if (includeLegacy && !site.includes(`releases/download/${tag}/Super.Note.Setup.${version}.Win7-8.exe`)) throw new Error(`site/index.html must reference the ${tag} Win7/8 installer link.`);
}

export function ensureReleaseBranch(branch, workflow) {
  // The repository's Pages workflow currently deploys master, not arbitrary branches.
  if (branch !== "master" || !/branches:\s*\[master\]/.test(workflow)) throw new Error("Release must run on master, matching .github/workflows/pages.yml.");
}

export function ensureTagMatchesHead(tagCommit, head) {
  if (tagCommit && tagCommit !== head) throw new Error("The release tag points to another commit. Use a new version; tags are never force-replaced.");
}

export function ensureReleaseCanResume(release, resume) {
  if (!release) return;
  if (!resume) throw new Error("This release already exists. Use --resume only for an interrupted draft, or choose a new version.");
  if (!release.draft) throw new Error("Published releases are never overwritten. Choose a new version.");
}

export function assetDescriptor(name, data) {
  return { name, size: data.length, digest: `sha256:${createHash("sha256").update(data).digest("hex")}` };
}

export function verifyAssetMetadata(local, remote) {
  if (!remote || remote.name !== local.name || remote.state !== "uploaded" || remote.size !== local.size || !remote.size) throw new Error(`Release asset is missing, incomplete or the wrong size: ${local.name}`);
  if (remote.digest && remote.digest !== local.digest) throw new Error(`Release asset checksum mismatch: ${local.name}`);
}

export function selectPagesRun(runs, head, branch) {
  return runs.filter(run => run.head_sha === head && run.head_branch === branch)
    .sort((left, right) => right.id - left.id)[0];
}
