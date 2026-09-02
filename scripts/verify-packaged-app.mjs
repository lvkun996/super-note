import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFile, listPackage } from "@electron/asar";
import { verifyUpdateConfig } from "./update-config.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const outputDir = path.resolve(root, process.argv[2] || "release");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeEntry(entry) {
  return entry.replaceAll("\\", "/").replace(/^\/+/, "");
}

function resolveManifest(packageName, parentDir) {
  const localRequire = createRequire(path.join(parentDir, "package.json"));
  for (const searchPath of localRequire.resolve.paths(packageName) || []) {
    const candidate = path.join(searchPath, ...packageName.split("/"), "package.json");
    if (existsSync(candidate)) {
      const manifest = readJson(candidate);
      return { manifest, manifestPath: candidate, packageDir: path.dirname(candidate) };
    }
  }

  throw new Error(`Cannot resolve package manifest for ${packageName} from ${parentDir}`);
}

function collectRuntimeManifests() {
  const appManifest = readJson(path.join(root, "package.json"));
  const collected = new Map();

  function visit(packageName, parentDir, optional = false) {
    let resolved;
    try {
      resolved = resolveManifest(packageName, parentDir);
    } catch (error) {
      if (optional) {
        return;
      }
      throw error;
    }

    const key = path.normalize(resolved.manifestPath).toLowerCase();
    if (collected.has(key)) {
      return;
    }
    collected.set(key, resolved.manifestPath);

    for (const dependencyName of Object.keys(resolved.manifest.dependencies || {})) {
      visit(dependencyName, resolved.packageDir);
    }
    for (const dependencyName of Object.keys(resolved.manifest.optionalDependencies || {})) {
      visit(dependencyName, resolved.packageDir, true);
    }
  }

  for (const dependencyName of Object.keys(appManifest.dependencies || {})) {
    visit(dependencyName, root);
  }
  for (const dependencyName of Object.keys(appManifest.optionalDependencies || {})) {
    visit(dependencyName, root, true);
  }

  return [...collected.values()];
}

if (!existsSync(outputDir)) {
  throw new Error(`Packaged output directory does not exist: ${outputDir}`);
}

const appArchives = readdirSync(outputDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^win(?:-.+)?-unpacked$/i.test(entry.name))
  .map((entry) => path.join(outputDir, entry.name, "resources", "app.asar"))
  .filter(existsSync);

if (appArchives.length === 0) {
  throw new Error(`No packaged app.asar found under ${outputDir}`);
}

const runtimeManifests = collectRuntimeManifests();

for (const archivePath of appArchives) {
  const packagedConfig = verifyUpdateConfig(
    path.join(path.dirname(archivePath), "app-update.yml"),
    path.basename(outputDir).includes("win7-8") ? "win7-8" : "latest",
  );
  console.log(`Verified updater configuration and cache directory: ${packagedConfig.updaterCacheDirName}`);
  const archiveEntries = listPackage(archivePath);
  const rawEntryByNormalized = new Map(
    archiveEntries.map((entry) => [normalizeEntry(entry), entry.replace(/^[\\/]+/, "")]),
  );
  const normalizedEntries = new Set(archiveEntries.map(normalizeEntry));
  const requiredAppEntries = ["dist/index.html", "dist-electron/main.js", "dist-electron/preload.js"];
  const missingAppEntries = requiredAppEntries.filter((entry) => !normalizedEntries.has(entry));
  const hasRendererScript = [...normalizedEntries].some((entry) => /^dist\/assets\/.+\.js$/i.test(entry));
  const hasRendererStyles = [...normalizedEntries].some((entry) => /^dist\/assets\/.+\.css$/i.test(entry));
  if (!hasRendererScript) {
    missingAppEntries.push("dist/assets/<renderer>.js");
  }
  if (!hasRendererStyles) {
    missingAppEntries.push("dist/assets/<renderer>.css");
  }
  if (missingAppEntries.length > 0) {
    throw new Error(`Packaged application entry check failed for ${archivePath}:\n${missingAppEntries.join("\n")}`);
  }

  const indexHtml = extractFile(archivePath, rawEntryByNormalized.get("dist/index.html")).toString("utf8");
  const referencedAssets = [...indexHtml.matchAll(/(?:src|href)=["']\.\/(assets\/[^"']+)["']/g)].map(
    (match) => `dist/${match[1]}`,
  );
  const missingReferencedAssets = referencedAssets.filter((entry) => !normalizedEntries.has(entry));
  if (missingReferencedAssets.length > 0) {
    throw new Error(`Packaged renderer asset check failed for ${archivePath}:\n${missingReferencedAssets.join("\n")}`);
  }

  const manifestEntries = archiveEntries.filter((entry) => {
    const normalized = normalizeEntry(entry);
    return normalized.includes("node_modules/") && normalized.endsWith("/package.json");
  });
  const packagedPackageIds = new Set(
    manifestEntries.flatMap((entry) => {
      try {
        const manifest = JSON.parse(extractFile(archivePath, entry.replace(/^[\\/]+/, "")).toString("utf8"));
        return manifest.name && manifest.version ? [`${manifest.name}@${manifest.version}`] : [];
      } catch {
        return [];
      }
    }),
  );
  const missing = runtimeManifests
    .map((manifestPath) => readJson(manifestPath))
    .map((manifest) => `${manifest.name}@${manifest.version}`)
    .filter((packageId) => !packagedPackageIds.has(packageId));

  if (missing.length > 0) {
    throw new Error(`Packaged dependency check failed for ${archivePath}:\n${missing.join("\n")}`);
  }

  console.log(`Verified ${runtimeManifests.length} runtime package manifests in ${archivePath}`);
}
