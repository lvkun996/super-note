// Run with Electron, never installs or closes the user's running application.
const { app } = require("electron");
const { mkdtempSync, mkdirSync, statSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { NsisUpdater } = require("electron-updater");
const { ElectronHttpExecutor } = require("electron-updater/out/electronHttpExecutor");

const [configPath, fromVersion, expectedVersion] = process.argv.slice(2);
if (!configPath || !fromVersion || !expectedVersion) {
  console.error("Usage: electron scripts/verify-online-update.cjs <app-update.yml> <from-version> <expected-version>");
  app.exit(1);
} else {
  const directory = mkdtempSync(path.join(os.tmpdir(), "super-note-online-update-"));
  const userDataPath = path.join(directory, "user-data");
  mkdirSync(userDataPath);
  app.setPath("userData", userDataPath);
  app.disableHardwareAcceleration();
  const adapter = {
    version: fromVersion, name: "super-note", isPackaged: true,
    appUpdateConfigPath: path.resolve(configPath), userDataPath,
    baseCachePath: path.join(directory, "cache"),
    whenReady: () => app.whenReady(),
    quit: () => { throw new Error("Installing is forbidden in the online smoke test"); },
    relaunch: () => { throw new Error("Relaunching is forbidden in the online smoke test"); },
    onQuit: () => { throw new Error("Automatic installation is forbidden in the online smoke test"); },
  };
  const updater = new NsisUpdater(null, adapter);
  updater.httpExecutor = new ElectronHttpExecutor();
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.disableDifferentialDownload = true;
  updater.disableWebInstaller = true;
  updater.logger = { info() {}, debug() {}, warn: console.warn, error: console.error };
  let progressBucket = -1;
  updater.on("download-progress", ({ percent }) => {
    const bucket = Math.floor(percent / 25);
    if (bucket > progressBucket) { progressBucket = bucket; console.log(`Download progress: ${Math.round(percent)}%`); }
  });
  app.whenReady().then(async () => {
    const checked = await updater.checkForUpdates();
    if (checked?.updateInfo.version !== expectedVersion) throw new Error(`Unexpected release: ${checked?.updateInfo.version}`);
    console.log(`Online update detected: ${fromVersion} -> ${expectedVersion}`);
    const files = await updater.downloadUpdate();
    console.log(JSON.stringify({ version: expectedVersion, verifiedByUpdater: true, installed: false, files: files.map(file => ({ path: file, size: statSync(file).size })) }));
    app.exit(0);
  }).catch(error => { console.error(error); app.exit(1); });
}
