import { app, BrowserWindow, Menu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let forceQuit = false;
let installUpdateAfterDownload = false;
let updateDownloadPromise: Promise<UpdateStatus> | null = null;

const workspaceFileName = "workspace.json";
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const globalToggleShortcut = "Control+Alt+Space";
const updateFeedUrl = "https://github.com/lvkun996/super-note/releases/latest/download/";
const updateDownloadMaxAttempts = 3;
const updateDownloadRetryDelayMs = 3000;

type UpdateState = "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "installing" | "error";

type UpdateStatus = {
  state: UpdateState;
  channel: "latest" | "win7-8";
  currentVersion: string;
  latestVersion?: string;
  progress?: number;
  error?: string;
  downloadAttempt?: number;
  maxDownloadAttempts?: number;
};

let updateStatus: UpdateStatus = {
  state: "idle",
  channel: getUpdateChannel(),
  currentVersion: app.getVersion(),
};

function getWorkspacePath() {
  return path.join(app.getPath("userData"), workspaceFileName);
}

function getIconPath() {
  return path.join(__dirname, "../assets/app-icon.png");
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
  }
  if (mainWindow?.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow?.show();
  mainWindow?.focus();
}

function toggleMainWindow() {
  if (mainWindow?.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
    return;
  }
  showMainWindow();
}

function getUpdateChannel(): "latest" | "win7-8" {
  const electronMajor = Number(process.versions.electron.split(".")[0]);
  return Number.isFinite(electronMajor) && electronMajor <= 22 ? "win7-8" : "latest";
}

function sendUpdateStatus() {
  mainWindow?.webContents.send("update:status", updateStatus);
}

function setUpdateStatus(next: Partial<UpdateStatus>) {
  updateStatus = {
    ...updateStatus,
    ...next,
    channel: getUpdateChannel(),
    currentVersion: app.getVersion(),
  };
  sendUpdateStatus();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUpdateErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.channel = getUpdateChannel();
  autoUpdater.requestHeaders = {
    "Cache-Control": "no-cache",
    "User-Agent": `Super Note/${app.getVersion()}`,
  };
  autoUpdater.setFeedURL({
    provider: "generic",
    url: updateFeedUrl,
    channel: getUpdateChannel(),
  });

  autoUpdater.on("checking-for-update", () => setUpdateStatus({ state: "checking", error: undefined }));
  autoUpdater.on("update-available", (info) =>
    setUpdateStatus({
      state: "available",
      latestVersion: info.version,
      progress: undefined,
      error: undefined,
      downloadAttempt: undefined,
      maxDownloadAttempts: undefined,
    }),
  );
  autoUpdater.on("update-not-available", (info) =>
    setUpdateStatus({
      state: "not-available",
      latestVersion: info.version,
      progress: undefined,
      error: undefined,
      downloadAttempt: undefined,
      maxDownloadAttempts: undefined,
    }),
  );
  autoUpdater.on("download-progress", (progress) =>
    setUpdateStatus({
      state: "downloading",
      progress: Math.round(progress.percent),
      error: undefined,
    }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    setUpdateStatus({
      state: "downloaded",
      latestVersion: info.version,
      progress: 100,
      error: undefined,
      downloadAttempt: undefined,
      maxDownloadAttempts: undefined,
    });
    if (installUpdateAfterDownload) {
      setTimeout(() => installDownloadedUpdate(), 800);
    }
  });
  autoUpdater.on("error", (error) => {
    const message = getUpdateErrorMessage(error);
    if (updateDownloadPromise) {
      setUpdateStatus({
        state: "downloading",
        error: message,
      });
      return;
    }
    setUpdateStatus({
      state: "error",
      progress: undefined,
      error: message,
    });
  });
}

function checkForUpdates() {
  if (!app.isPackaged) {
    setUpdateStatus({ state: "not-available" });
    return updateStatus;
  }
  void autoUpdater.checkForUpdates();
  return updateStatus;
}

async function downloadUpdate() {
  if (!app.isPackaged) {
    return updateStatus;
  }
  if (updateDownloadPromise) {
    return updateDownloadPromise;
  }
  installUpdateAfterDownload = true;
  updateDownloadPromise = downloadUpdateWithRetry().finally(() => {
    updateDownloadPromise = null;
  });
  return updateDownloadPromise;
}

async function downloadUpdateWithRetry() {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= updateDownloadMaxAttempts; attempt += 1) {
    setUpdateStatus({
      state: "downloading",
      progress: 0,
      error: attempt === 1 ? undefined : `下载中断，正在重试 ${attempt}/${updateDownloadMaxAttempts}`,
      downloadAttempt: attempt,
      maxDownloadAttempts: updateDownloadMaxAttempts,
    });

    try {
      await autoUpdater.downloadUpdate();
      return updateStatus;
    } catch (error) {
      lastError = error;
      if (attempt < updateDownloadMaxAttempts) {
        setUpdateStatus({
          state: "downloading",
          error: `下载中断，${Math.round(updateDownloadRetryDelayMs / 1000)} 秒后重试 ${attempt + 1}/${updateDownloadMaxAttempts}：${getUpdateErrorMessage(error)}`,
          downloadAttempt: attempt,
          maxDownloadAttempts: updateDownloadMaxAttempts,
        });
        await delay(updateDownloadRetryDelayMs);
        continue;
      }
    }
  }

  setUpdateStatus({
    state: "error",
    progress: undefined,
    error: `下载失败，已重试 ${updateDownloadMaxAttempts} 次：${getUpdateErrorMessage(lastError)}`,
    downloadAttempt: updateDownloadMaxAttempts,
    maxDownloadAttempts: updateDownloadMaxAttempts,
  });
  return updateStatus;
}

function installDownloadedUpdate() {
  installUpdateAfterDownload = false;
  forceQuit = true;
  setUpdateStatus({ state: "installing", progress: 100, error: undefined });
  autoUpdater.quitAndInstall();
  return updateStatus;
}

function registerGlobalShortcuts() {
  globalShortcut.register(globalToggleShortcut, toggleMainWindow);
}

function createTray() {
  if (tray) {
    return;
  }

  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("Super Note");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示 Super Note",
        click: showMainWindow,
      },
      {
        label: "隐藏窗口",
        click: () => mainWindow?.hide(),
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          forceQuit = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", showMainWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Super Note",
    icon: getIconPath(),
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.on("close", (event) => {
    if (forceQuit) {
      return;
    }
    event.preventDefault();
    mainWindow?.hide();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.webContents.once("did-finish-load", sendUpdateStatus);
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (app.isReady()) {
      showMainWindow();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    configureAutoUpdater();
    createWindow();
    createTray();
    registerGlobalShortcuts();
    setTimeout(() => checkForUpdates(), 2500);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else {
        showMainWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (forceQuit && process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    forceQuit = true;
    globalShortcut.unregisterAll();
  });
}

ipcMain.handle("workspace:load", async () => {
  const filePath = getWorkspacePath();
  try {
    const raw = await readFile(filePath, "utf8");
    return { ok: true, workspace: JSON.parse(raw), path: filePath };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ok: true, workspace: null, path: filePath };
    }
    return { ok: false, error: String(error), path: filePath };
  }
});

ipcMain.handle("workspace:save", async (_event, workspace) => {
  const filePath = getWorkspacePath();
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(workspace, null, 2), "utf8");
    return { ok: true, path: filePath };
  } catch (error) {
    return { ok: false, error: String(error), path: filePath };
  }
});

ipcMain.handle("dialog:openFile", async () => {
  const target = mainWindow ?? BrowserWindow.getFocusedWindow();
  const dialogOptions = {
    title: "打开已有文件",
    properties: ["openFile"],
    filters: [
      { name: "Super Note", extensions: ["snote"] },
      { name: "Text", extensions: ["txt", "md", "json", "csv", "log", "ts", "tsx", "js", "jsx", "css", "html"] },
      { name: "All Files", extensions: ["*"] },
    ],
  } satisfies Electron.OpenDialogOptions;
  const result = target ? await dialog.showOpenDialog(target, dialogOptions) : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, files: [] };
  }

  const files = await Promise.all(
    result.filePaths.map(async (filePath) => ({
      path: filePath,
      name: path.basename(filePath),
      content: await readFile(filePath, "utf8"),
    })),
  );

  return { canceled: false, files };
});

ipcMain.handle(
  "file:save",
  async (
    _event,
    payload: {
      path?: string;
      content: string;
      defaultName?: string;
      filters?: Electron.FileFilter[];
    },
  ) => {
    let filePath = payload.path;

    if (!filePath) {
      const target = mainWindow ?? BrowserWindow.getFocusedWindow();
      const dialogOptions = {
        title: "保存文件",
        defaultPath: payload.defaultName,
        filters: payload.filters ?? [{ name: "All Files", extensions: ["*"] }],
      } satisfies Electron.SaveDialogOptions;
      const result = target ? await dialog.showSaveDialog(target, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }
      filePath = result.filePath;
    }

    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, payload.content, "utf8");
      return { ok: true, canceled: false, path: filePath, name: path.basename(filePath) };
    } catch (error) {
      return { ok: false, canceled: false, path: filePath, error: String(error) };
    }
  },
);

ipcMain.handle("window:setAlwaysOnTop", (_event, enabled: boolean) => {
  const target = mainWindow ?? BrowserWindow.getFocusedWindow();
  target?.setAlwaysOnTop(Boolean(enabled));
  return { ok: true, enabled: Boolean(enabled) };
});

ipcMain.handle("window:minimize", () => {
  const target = mainWindow ?? BrowserWindow.getFocusedWindow();
  target?.minimize();
  return { ok: true };
});

ipcMain.handle("window:toggleMaximize", () => {
  const target = mainWindow ?? BrowserWindow.getFocusedWindow();
  if (!target) {
    return { ok: false, maximized: false };
  }
  if (target.isMaximized()) {
    target.unmaximize();
  } else {
    target.maximize();
  }
  return { ok: true, maximized: target.isMaximized() };
});

ipcMain.handle("window:close", () => {
  const target = mainWindow ?? BrowserWindow.getFocusedWindow();
  target?.close();
  return { ok: true };
});

ipcMain.handle("clipboard:readText", () => clipboard.readText());

ipcMain.handle("clipboard:writeText", (_event, text: unknown) => {
  if (typeof text !== "string") {
    return { ok: false };
  }
  clipboard.writeText(text);
  return { ok: true };
});

ipcMain.handle("shell:openExternal", async (_event, url: unknown) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return { ok: false };
  }
  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle("update:getStatus", () => updateStatus);

ipcMain.handle("update:check", () => checkForUpdates());

ipcMain.handle("update:download", () => downloadUpdate());

ipcMain.handle("update:install", () => installDownloadedUpdate());

ipcMain.handle("app:getInfo", () => ({
  version: app.getVersion(),
  author: "kunkun",
  desc: "认识自身平凡后，依旧拥有改变世界的勇气",
  globalShortcut: "Ctrl+Alt+Space",
}));
