import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

function getBundledNodePath() {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    return "";
  }
  return path.join(home, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "bin", "node.exe");
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
const bundledNode = getBundledNodePath();
if (Number.isFinite(nodeMajor) && nodeMajor < 18 && bundledNode && existsSync(bundledNode) && path.resolve(process.execPath) !== path.resolve(bundledNode)) {
  const result = spawnSync(bundledNode, [scriptPath, ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}

const args = new Set(process.argv.slice(2));
const builderCache = path.join(root, ".cache", "electron-builder");
const electronCache = path.join(root, ".cache", "electron");
const localHome = path.join(root, ".cache", "home");
const localAppData = path.join(localHome, "AppData", "Local");
const roamingAppData = path.join(localHome, "AppData", "Roaming");
const localTemp = path.join(root, ".cache", "tmp");
const npmCache = path.join(root, ".cache", "npm");
const npmPrefix = path.join(root, ".cache", "npm-prefix");
const npmUserConfig = path.join(root, ".cache", "npmrc");
const toolBin = path.join(root, ".cache", "bin");
const inheritedUserProfile = process.env.USERPROFILE;
const inheritedHome = process.env.HOME;

mkdirSync(builderCache, { recursive: true });
mkdirSync(electronCache, { recursive: true });
mkdirSync(localAppData, { recursive: true });
mkdirSync(roamingAppData, { recursive: true });
mkdirSync(localTemp, { recursive: true });
mkdirSync(npmCache, { recursive: true });
mkdirSync(npmPrefix, { recursive: true });
mkdirSync(toolBin, { recursive: true });

function normalizeForPathCheck(value) {
  return value ? path.resolve(value).toLowerCase() : "";
}

function makePath() {
  const unsafeRoots = [inheritedUserProfile, inheritedHome]
    .map(normalizeForPathCheck)
    .filter(Boolean);
  const originalPath = process.env.PATH ?? process.env.Path ?? "";
  const safeEntries = originalPath
    .split(path.delimiter)
    .filter(Boolean)
    .filter((entry) => {
      const normalized = normalizeForPathCheck(entry);
      if (!normalized) {
        return false;
      }
      if (normalized.includes(`${path.sep}.codex${path.sep}tmp${path.sep}`.toLowerCase())) {
        return false;
      }
      return !unsafeRoots.some((unsafeRoot) => normalized.startsWith(unsafeRoot));
    });
  return [toolBin, ...safeEntries].join(path.delimiter);
}

function createNpmShim() {
  const shimCmd = path.join(toolBin, "npm.cmd");
  const shimJs = path.join(toolBin, "npm-shim.cjs");
  const nodeExe = process.execPath.replace(/"/g, '\\"');

  writeFileSync(
    shimCmd,
    `@echo off\r\n"${nodeExe}" "%~dp0\\npm-shim.cjs" %*\r\n`,
    "utf8",
  );

  writeFileSync(
    shimJs,
    String.raw`
const fs = require("node:fs");
const path = require("node:path");

const root = process.env.SUPER_NOTE_RELEASE_ROOT || process.cwd();
const args = process.argv.slice(2);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function packagePath(name) {
  return path.join(root, "node_modules", ...name.split("/"));
}

function collectProductionDependencies() {
  const lock = readJson(path.join(root, "package-lock.json"));
  const rootPackage = lock.packages[""] || readJson(path.join(root, "package.json"));
  const queue = Object.keys({
    ...(rootPackage.dependencies || {}),
    ...(rootPackage.optionalDependencies || {}),
  });
  const collected = new Set();

  for (let index = 0; index < queue.length; index += 1) {
    const name = queue[index];
    if (collected.has(name)) {
      continue;
    }

    const location = "node_modules/" + name;
    const lockEntry = lock.packages[location];
    const diskPath = packagePath(name);
    const packageJsonPath = path.join(diskPath, "package.json");
    if (!lockEntry || !fs.existsSync(packageJsonPath)) {
      continue;
    }

    collected.add(name);
    for (const child of Object.keys({
      ...(lockEntry.dependencies || {}),
      ...(lockEntry.optionalDependencies || {}),
    })) {
      if (!collected.has(child)) {
        queue.push(child);
      }
    }
  }

  return [...collected].sort();
}

function buildListTree() {
  const rootPackage = readJson(path.join(root, "package.json"));
  const dependencyNames = collectProductionDependencies();
  const dependencies = {};
  const dependencyVersions = {};

  for (const name of dependencyNames) {
    const diskPath = packagePath(name);
    const packageJson = readJson(path.join(diskPath, "package.json"));
    dependencyVersions[name] = packageJson.version || "0.0.0";
    dependencies[name] = {
      name,
      version: packageJson.version || "0.0.0",
      path: diskPath,
      _dependencies: {},
      dependencies: {},
    };
  }

  return {
    name: rootPackage.name,
    version: rootPackage.version,
    path: root,
    _dependencies: dependencyVersions,
    dependencies,
  };
}

if (args[0] === "prefix" && args[1] === "-w") {
  console.log(root);
  process.exit(0);
}

if (args[0] === "config" && args[1] === "list") {
  console.log("node-linker=hoisted");
  process.exit(0);
}

if (args[0] === "list") {
  console.log(JSON.stringify(buildListTree()));
  process.exit(0);
}

console.error("super-note npm shim does not implement: " + args.join(" "));
process.exit(1);
`.trimStart(),
    "utf8",
  );
}

createNpmShim();

function createBuildEnv(extraEnv = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      key.toLowerCase() === "path" ||
      key.toLowerCase() === "home" ||
      key.toLowerCase() === "userprofile" ||
      key.toLowerCase() === "appdata" ||
      key.toLowerCase() === "localappdata" ||
      key.toLowerCase() === "tmp" ||
      key.toLowerCase() === "temp" ||
      key.toLowerCase() === "tmpdir"
    ) {
      delete env[key];
    }
  }

  return {
    ...env,
    ELECTRON_BUILDER_CACHE: builderCache,
    ELECTRON_CACHE: electronCache,
    HOME: localHome,
    USERPROFILE: localHome,
    LOCALAPPDATA: localAppData,
    APPDATA: roamingAppData,
    TMP: localTemp,
    TEMP: localTemp,
    TMPDIR: localTemp,
    NPM_CONFIG_CACHE: npmCache,
    NPM_CONFIG_PREFIX: npmPrefix,
    NPM_CONFIG_USERCONFIG: npmUserConfig,
    INIT_CWD: root,
    npm_package_json: path.join(root, "package.json"),
    npm_config_local_prefix: root,
    npm_config_user_agent: "npm/10 super-note-release",
    Path: makePath(),
    SUPER_NOTE_RELEASE_ROOT: root,
    ...extraEnv,
  };
}

function run(command, commandArgs, extraEnv = {}) {
  console.log(`\n> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: "inherit",
    env: createBuildEnv(extraEnv),
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [path.join(root, "scripts", "cache-packager-deps.mjs")]);
run(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.electron.json"]);
run(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "build"]);

const builderArgs = [path.join(root, "node_modules", "electron-builder", "cli.js")];

if (args.has("--win7-8")) {
  builderArgs.push("--config", "electron-builder.win7-8.json", "--publish", "never");
}

if (args.has("--dir")) {
  builderArgs.push("--dir");
}

run(process.execPath, builderArgs);
