import { copyFileSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
const tag = `v${version}`;
const releaseDir = path.join(root, "release");
const legacyReleaseDir = path.join(root, "release-win7-8");

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: options.stdio ?? "inherit",
    input: options.input,
    encoding: options.encoding,
    timeout: options.timeout,
    env: { ...process.env, ...(options.env ?? {}) },
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result.stdout ?? "";
}

function capture(command, args, options = {}) {
  return run(command, args, { ...options, stdio: "pipe", encoding: "utf8" }).trim();
}

function captureMaybe(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "pipe",
    input: options.input,
    encoding: "utf8",
    timeout: options.timeout ?? 10000,
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    return "";
  }
  return (result.stdout ?? "").trim();
}

function ensureCleanWorktree() {
  const status = capture("git", ["status", "--porcelain"]);
  if (status) {
    throw new Error(`Worktree is not clean. Commit the release changes first:\n${status}`);
  }
}

function parseGitHubRemote() {
  const remote = capture("git", ["remote", "get-url", "origin"]);
  const match = remote.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/);
  if (!match?.groups) {
    throw new Error(`Cannot parse GitHub origin remote: ${remote}`);
  }
  return match.groups;
}

function ensureSiteMatchesVersion() {
  const site = readFileSync(path.join(root, "site", "index.html"), "utf8");
  const winCurrent = `releases/download/${tag}/Super.Note.Setup.${version}.exe`;
  const winLegacy = `releases/download/${tag}/Super.Note.Setup.${version}.Win7-8.exe`;
  if (!site.includes(tag) || !site.includes(winCurrent) || !site.includes(winLegacy)) {
    throw new Error(`site/index.html does not reference ${tag} download links yet.`);
  }
}

function buildInstallers() {
  rmSync(releaseDir, { recursive: true, force: true });
  rmSync(legacyReleaseDir, { recursive: true, force: true });

  run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit"]);
  run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.electron.json", "--noEmit"]);
  run(process.execPath, [path.join(root, "scripts", "build-installer.mjs")]);
  run(process.execPath, [path.join(root, "scripts", "build-installer.mjs"), "--win7-8"]);

  const legacyLatest = path.join(legacyReleaseDir, "latest.yml");
  const legacyChannel = path.join(legacyReleaseDir, "win7-8.yml");
  if (!existsSync(legacyLatest)) {
    throw new Error("release-win7-8/latest.yml was not generated.");
  }
  copyFileSync(legacyLatest, legacyChannel);
}

function getAssets() {
  const assets = [
    path.join(releaseDir, `Super.Note.Setup.${version}.exe`),
    path.join(releaseDir, `Super.Note.Setup.${version}.exe.blockmap`),
    path.join(releaseDir, "latest.yml"),
    path.join(legacyReleaseDir, `Super.Note.Setup.${version}.Win7-8.exe`),
    path.join(legacyReleaseDir, `Super.Note.Setup.${version}.Win7-8.exe.blockmap`),
    path.join(legacyReleaseDir, "win7-8.yml"),
  ];

  for (const asset of assets) {
    if (!existsSync(asset)) {
      throw new Error(`Missing release asset: ${path.relative(root, asset)}`);
    }
    if (statSync(asset).size === 0) {
      throw new Error(`Release asset is empty: ${path.relative(root, asset)}`);
    }
  }
  return assets;
}

function getToken() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) {
    return fromEnv;
  }

  const fromGh = captureMaybe("gh", ["auth", "token"]);
  if (fromGh) {
    return fromGh;
  }

  const credential = captureMaybe("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    timeout: 10000,
  });
  const password = credential
    .split(/\r?\n/)
    .find((line) => line.startsWith("password="))
    ?.slice("password=".length);

  if (password) {
    return password;
  }

  throw new Error("GitHub token not found. Set GH_TOKEN or GITHUB_TOKEN, or login with GitHub CLI.");
}

function requestJson(token, method, apiPath, body) {
  const payload = body == null ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "api.github.com",
        path: apiPath,
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": payload?.length ?? 0,
          "User-Agent": "super-note-release-script",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          const data = raw ? JSON.parse(raw) : null;
          if ((response.statusCode ?? 500) >= 400) {
            const error = new Error(data?.message || raw || `GitHub API error ${response.statusCode}`);
            error.statusCode = response.statusCode;
            reject(error);
            return;
          }
          resolve(data);
        });
      },
    );
    request.on("error", reject);
    if (payload) {
      request.write(payload);
    }
    request.end();
  });
}

function uploadAsset(token, uploadPath, assetPath) {
  const body = readFileSync(assetPath);
  const name = encodeURIComponent(path.basename(assetPath));
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: "uploads.github.com",
        path: `${uploadPath}?name=${name}`,
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": body.length,
          "User-Agent": "super-note-release-script",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          const data = raw ? JSON.parse(raw) : null;
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(data?.message || raw || `Upload failed ${response.statusCode}`));
            return;
          }
          resolve(data);
        });
      },
    );
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function releaseBody() {
  if (version === "0.1.7") {
    return [
      "Super Note v0.1.7",
      "",
      "- 更换透明背景的新 logo，并同步安装图标与系统托盘图标。",
      "- 作者寄语弹窗改为全屏展示。",
      "- 优化标签栏 tab 标签边框，减少与工作区的视觉重叠。",
      "- 暂时移除文本对比插件入口，后续打磨后再重新启用。",
    ].join("\n");
  }

  if (version === "0.1.6") {
    return [
      "Super Note v0.1.6",
      "",
      "- 根据凯哥的提议，新增客户端自动更新入口。",
      "- 自动识别 Windows 7 / 8 与 Windows 10 / 11 通道，下载对应安装包。",
      "- 新增 Ctrl + Alt + 空格全局打开/隐藏。",
      "- 清理文本模块顶部冗余工具条，并补齐一键发布脚本。",
    ].join("\n");
  }

  return `Super Note ${tag}`;
}

async function getOrCreateRelease(token, owner, repo, branch) {
  const releasePath = `/repos/${owner}/${repo}/releases/tags/${tag}`;
  try {
    const existing = await requestJson(token, "GET", releasePath);
    return requestJson(token, "PATCH", `/repos/${owner}/${repo}/releases/${existing.id}`, {
      name: tag,
      body: releaseBody(),
      draft: false,
      prerelease: false,
    });
  } catch (error) {
    if (error.statusCode !== 404) {
      throw error;
    }
    return requestJson(token, "POST", `/repos/${owner}/${repo}/releases`, {
      tag_name: tag,
      target_commitish: branch,
      name: tag,
      body: releaseBody(),
      draft: false,
      prerelease: false,
    });
  }
}

async function uploadReleaseAssets(token, owner, repo, release, assets) {
  const uploadPath = new URL(release.upload_url.replace("{?name,label}", "")).pathname;
  const existingAssets = await requestJson(token, "GET", `/repos/${owner}/${repo}/releases/${release.id}/assets?per_page=100`);

  for (const assetPath of assets) {
    const name = path.basename(assetPath);
    const existing = existingAssets.find((asset) => asset.name === name);
    if (existing) {
      console.log(`Deleting old asset ${name}`);
      await requestJson(token, "DELETE", `/repos/${owner}/${repo}/releases/assets/${existing.id}`);
    }

    console.log(`Uploading ${name}`);
    await uploadAsset(token, uploadPath, assetPath);
  }
}

function pushBranchAndTag(branch) {
  const localTag = captureMaybe("git", ["tag", "--list", tag]);
  if (!localTag) {
    run("git", ["tag", "-a", tag, "-m", `Super Note ${tag}`]);
  }

  run("git", ["push", "origin", branch]);
  run("git", ["push", "origin", tag]);
}

async function main() {
  ensureCleanWorktree();
  ensureSiteMatchesVersion();

  const branch = capture("git", ["branch", "--show-current"]);
  if (!branch) {
    throw new Error("Release script must run on a branch, not detached HEAD.");
  }

  const { owner, repo } = parseGitHubRemote();
  buildInstallers();
  const assets = getAssets();
  pushBranchAndTag(branch);

  const token = getToken();
  const release = await getOrCreateRelease(token, owner, repo, branch);
  await uploadReleaseAssets(token, owner, repo, release, assets);

  console.log(`\nRelease ${tag} is ready.`);
  console.log("Pages will update from the pushed branch via the GitHub Pages workflow.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
