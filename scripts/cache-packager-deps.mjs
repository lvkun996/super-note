import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import https from "node:https";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const electronDist = path.join(root, "node_modules", "electron", "dist", "electron.exe");
const electronCache = path.join(root, ".cache", "electron");
const legacyElectronVersion = "22.3.27";
const legacyElectronDist = path.join(electronCache, "win7-8");
const electronMirror = process.env.ELECTRON_MIRROR ?? "https://npmmirror.com/mirrors/electron/";

mkdirSync(electronCache, { recursive: true });
mkdirSync(legacyElectronDist, { recursive: true });

if (existsSync(electronDist)) {
  console.log("Electron runtime already cached.");
} else {
  const installScript = path.join(root, "node_modules", "electron", "install.js");
  const env = {
    ...process.env,
    ELECTRON_CACHE: process.env.ELECTRON_CACHE ?? electronCache,
    ELECTRON_MIRROR: electronMirror,
  };

  console.log("Caching Electron runtime for Windows 10 / 11 packaging...");
  const result = spawnSync(process.execPath, [installScript], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function legacyElectronUrl(fileName) {
  return `${electronMirror.replace(/\/?$/, "/")}v${legacyElectronVersion}/${fileName}`;
}

function downloadFile(url, destination) {
  const tempFile = `${destination}.download`;
  rmSync(tempFile, { force: true });

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
        response.resume();
        downloadFile(response.headers.location, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed: ${response.statusCode} ${url}`));
        return;
      }

      const file = createWriteStream(tempFile);
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          renameSync(tempFile, destination);
          resolve();
        });
      });
      file.on("error", reject);
    });

    request.on("error", reject);
  });
}

for (const arch of ["x64", "ia32"]) {
  const fileName = `electron-v${legacyElectronVersion}-win32-${arch}.zip`;
  const destination = path.join(legacyElectronDist, fileName);

  if (existsSync(destination)) {
    console.log(`Electron ${legacyElectronVersion} ${arch} already cached.`);
    continue;
  }

  console.log(`Caching Electron ${legacyElectronVersion} ${arch} for Windows 7 / 8 packaging...`);
  await downloadFile(legacyElectronUrl(fileName), destination);
}
