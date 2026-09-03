import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
const includeLegacy = !process.argv.includes("--no-win7-8");

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
  if (!site.includes(tag) || !site.includes(winCurrent)) {
    throw new Error(`site/index.html does not reference the ${tag} Windows download link yet.`);
  }
  if (includeLegacy && !site.includes(winLegacy)) {
    throw new Error(`site/index.html does not reference the ${tag} Win7/8 download link yet.`);
  }
}

function ensureCurrentUpdateManifest() {
  const installerName = `Super.Note.Setup.${version}.exe`;
  const installerPath = path.join(releaseDir, installerName);
  const manifestPath = path.join(releaseDir, "latest.yml");
  if (existsSync(manifestPath)) {
    return;
  }
  if (!existsSync(installerPath)) {
    throw new Error(`Cannot generate latest.yml because ${installerName} is missing.`);
  }

  const installer = readFileSync(installerPath);
  const sha512 = createHash("sha512").update(installer).digest("base64");
  const manifest = [
    `version: ${version}`,
    "files:",
    `  - url: ${installerName}`,
    `    sha512: ${sha512}`,
    `    size: ${installer.length}`,
    `path: ${installerName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    "",
  ].join("\n");
  writeFileSync(manifestPath, manifest, "utf8");
  console.log("Generated release/latest.yml from the verified installer.");
}

function buildInstallers() {
  rmSync(releaseDir, { recursive: true, force: true });
  if (includeLegacy) {
    rmSync(legacyReleaseDir, { recursive: true, force: true });
  }

  run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit"]);
  run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.electron.json", "--noEmit"]);
  run(process.execPath, [path.join(root, "scripts", "build-installer.mjs"), "--low-memory"]);
  ensureCurrentUpdateManifest();
  if (!includeLegacy) {
    return;
  }

  run(process.execPath, [path.join(root, "scripts", "build-installer.mjs"), "--win7-8", "--low-memory"]);

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
  ];
  if (includeLegacy) {
    assets.push(
      path.join(legacyReleaseDir, `Super.Note.Setup.${version}.Win7-8.exe`),
      path.join(legacyReleaseDir, `Super.Note.Setup.${version}.Win7-8.exe.blockmap`),
      path.join(legacyReleaseDir, "win7-8.yml"),
    );
  }

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
  if (version === "0.1.21") {
    return [
      "Super Note v0.1.21",
      "",
      "- 托盘图标左键直接打开主窗口，右键继续显示托盘菜单。",
      "- 横栏布局直接显示文本编辑区，不再重复展示文档标题栏。",
      "- 点击左上角 Super Note、首次启动和完全重启后显示默认欢迎页“你想写些什么？”。",
      "- 点击任意标签即可从欢迎页返回编辑状态。",
    ].join("\n");
  }

  if (version === "0.1.20") {
    return [
      "Super Note v0.1.20",
      "",
      "- 文本与 Markdown 模块新增顶部圆角和文档标题栏，标题同步当前标签名称。",
      "- 标题栏更多菜单支持编辑名称、置顶和打开所在文件夹。",
      "- 修复连续输入时光标回退、文字出现在光标右侧的问题。",
      "- 中键拖选多光标采用静态独立覆盖层，不再闪烁或挤动文字，保留多行输入与删除。",
      "- 保留标签切换后的选区和滚动位置，并增加真实编辑器回归测试。",
    ].join("\n");
  }

  if (version === "0.1.19") {
    return [
      "Super Note v0.1.19",
      "",
      "- 修复客户端检测到新版本后，下载时报 resources/app-update.yml 缺失的问题。",
      "- 安装包包含自动更新源与缓存目录配置，打包校验会拦截缺失或无效配置。",
      "- 新增真实更新器缓存回归测试和在线下载验收脚本。",
      "",
      "旧客户端如已缺少 app-update.yml，需要先补齐本地配置并完全退出重启，才能通过客户端在线更新。",
    ].join("\n");
  }

  if (version === "0.1.18") {
    return [
      "Super Note v0.1.18",
      "",
      "- 顶部操作栏、顶部标签栏与左侧标签栏统一渐变配色，操作栏高度缩小为 32px。",
      "- 左侧标签新增 Pinned 置顶分组，支持取消置顶，并在重启后保留置顶状态。",
      "- 纯文本首次保存使用当前标签标题和 .txt 后缀；侧栏使用 Ctrl+↑/↓ 切换标签。",
      "- 切换标签后保留文本滚动和光标位置；Ctrl+F 搜索当前页，再按一次搜索全部标签。",
      "- 移除搜索空态留白，优化缩放恢复按钮，并改进中键纵向多光标操作。",
    ].join("\n");
  }

  if (version === "0.1.17") {
    return [
      "Super Note v0.1.17",
      "",
      "- 首次保存文本时使用当前标签标题作为文件名，没有可用标题时回退为“未命名文本”。",
      "- 新建文本统一保存为 .snote 文件，已打开的外部文本文件继续按原路径保存。",
      "- 缩小并重新润色顶部与侧栏标签的右键菜单。",
    ].join("\n");
  }

  if (version === "0.1.16") {
    return [
      "Super Note v0.1.16",
      "",
      "- 顶栏与侧栏标签右键支持置顶、删除、编辑名称和在资源管理器打开。",
      "- 新增默认保存位置、显式布局模式设置、右上角搜索入口，以及 3 秒缩放反馈和一键恢复 100%。",
      "- 文本支持长按竖向生成多光标并同步输入，修复从右向左拖选；帮助菜单新增打赏作者全屏收款码。",
      "- 官网保留滚动循环版本环，并淡化非当前版本卡片。",
    ].join("\n");
  }

  if (version === "0.1.15") {
    return [
      "Super Note v0.1.15",
      "",
      "- 左侧标签栏支持拖拽边界实时调整宽度，并隐藏标题文字与左侧颜色标识。",
      "- 侧栏模式专注单栏编辑，不再提供分割视图入口或快捷键操作。",
      "- 新增 Ctrl + H 切换全屏、文本缩放倍率提示，以及 Ctrl + 0 快速恢复 100%。",
    ].join("\n");
  }

  if (version === "0.1.14") {
    return [
      "Super Note v0.1.14",
      "",
      "- 标签支持鼠标左键拖拽排序，新的顺序会随工作区自动保存。",
      "- Ctrl + B 可在顶部标签栏与左侧紧凑标签菜单之间切换，并保留分栏、关闭历史和编辑状态。",
      "- 优化标签导航代码层级与拖拽渲染性能，扩展 Windows 默认打开和资源管理器文本预览支持。",
    ].join("\n");
  }

  if (version === "0.1.13") {
    return [
      "Super Note v0.1.13",
      "",
      "- 画板模式新增思维导图、主题跨层级拖动和 PNG 图片导出。",
      "- 思维导图主题支持关联文字或图片，关联线可拖拽调整吸附边，并支持 Delete 与右键删除。",
      "- 图片和文字移动时关联线实时跟随且吸附边保持稳定，样式面板增加夜间模式并显著优化启动速度。",
    ].join("\n");
  }

  if (version === "0.1.12") {
    return [
      "Super Note v0.1.12",
      "",
      "- 修复高版本客户端仍提示安装低版本更新的问题。",
      "- 中键拖动改为竖向文本选中，并增加文本模块 Ctrl + 滚轮调整字号。",
      "- 内容区域字体统一为 Codex 正文使用的系统无衬线字体，Markdown 默认进入预览模式。",
    ].join("\n");
  }

  if (version === "0.1.11") {
    return [
      "Super Note v0.1.11",
      "",
      "- 增加工作区原子保存、备份恢复和损坏工作区自动恢复。",
      "- 增加外部文件修改与删除检测，支持最近文件和 Ctrl + P 快速打开。",
      "- 全局搜索支持标签标题、文件名和文件路径，并优化 Markdown 预览体验。",
    ].join("\n");
  }

  if (version === "0.1.10") {
    return [
      "Super Note v0.1.10",
      "",
      "- 当前标签的选中标识移动到尾部操作区域，鼠标移入后切换为关闭图标。",
      "- 修复作者与版本全屏弹窗右侧残留空白。",
      "- 新增 .snote 文件的 Windows 资源管理器预览注册。",
    ].join("\n");
  }

  if (version === "0.1.9") {
    return [
      "Super Note v0.1.9",
      "",
      "- 分栏快捷键调整为 Ctrl + Shift + 左/右，Ctrl + 左/右用于切换相邻标签页。",
      "- 未保存文本标签会根据内容自动显示预览标题。",
      "- 系统托盘改为最近标签菜单，支持 More、新建文本和直接打开标签。",
      "- 优化文档与版本更新弹窗滚动、全屏版本页和窄窗口标签栏溢出。",
    ].join("\n");
  }

  if (version === "0.1.8") {
    return [
      "Super Note v0.1.8",
      "",
      "- 修复文本模块底部部分区域无法点击，以及搜索结果无法滚动到匹配位置的问题。",
      "- 文本模块与画板支持 Ctrl + 单击 HTTP/HTTPS 链接，在外部浏览器中打开。",
      "- 右键菜单新增剪切、粘贴、复制，并限制 JSON 工具仅处理选中文本。",
      "- 帮助菜单新增官网入口，调整顶部菜单顺序，并按功能拆分核心代码。",
    ].join("\n");
  }

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
