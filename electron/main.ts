import { app, BrowserWindow, Menu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, screen, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayMenuWindow: BrowserWindow | null = null;
let forceQuit = false;
let installUpdateAfterDownload = false;
let updateDownloadPromise: Promise<UpdateStatus> | null = null;

const workspaceFileName = "workspace.json";
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const globalToggleShortcut = "Control+Alt+Space";
const updateFeedUrl = "https://github.com/lvkun996/super-note/releases/latest/download/";
const updateDownloadMaxAttempts = 3;
const updateDownloadRetryDelayMs = 3000;

type TrayTab = { id: string; title: string; kind: "file" | "canvas" };
let trayTabState: { activeTabId: string; tabs: TrayTab[] } = { activeTabId: "", tabs: [] };

const trayMenuHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; background: transparent; font: 13px/1.45 "Segoe UI", "Microsoft YaHei", sans-serif; color: #172033; }
    body { padding: 6px; overflow: hidden; }
    .menu { overflow: hidden; border: 1px solid #dce3ee; border-radius: 12px; background: rgba(255,255,255,.98); box-shadow: 0 12px 32px rgba(31,45,61,.22); }
    .section-title { padding: 13px 14px 6px; color: #697386; font-size: 12px; }
    .row { width: 100%; min-height: 38px; padding: 8px 14px; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 12px; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
    .row:hover, .row:focus-visible { background: #f1f6ff; outline: none; }
    .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { color: #788397; font-size: 12px; }
    .divider { height: 1px; margin: 7px 0; background: #dce3ee; }
    .empty { padding: 8px 14px 13px; color: #98a1b1; }
  </style>
</head>
<body>
  <div class="menu">
    <div class="section-title">Recent</div>
    <div id="recent"></div>
    <button id="more" class="row" type="button"><span>More</span><span class="meta">›</span></button>
    <div class="divider"></div>
    <button id="new-text" class="row" type="button"><span>新建文本</span><span class="meta">＋</span></button>
    <div class="divider"></div>
    <button id="exit" class="row" type="button"><span>Exit</span><span></span></button>
  </div>
  <script>
    const recent = document.getElementById("recent");
    const more = document.getElementById("more");
    let state = { tabs: [] };
    let expanded = false;
    function resize() {
      requestAnimationFrame(function () {
        window.superNote.trayMenuAction({ type: "resize", height: document.body.scrollHeight + 6 });
      });
    }
    function render(next) {
      state = next || { tabs: [] };
      recent.replaceChildren();
      const visible = expanded ? state.tabs : state.tabs.slice(0, 4);
      recent.style.maxHeight = expanded ? "320px" : "none";
      recent.style.overflowY = expanded ? "auto" : "visible";
      if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "暂无标签页";
        recent.appendChild(empty);
      }
      visible.forEach(function (tab) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "row";
        const title = document.createElement("span");
        title.className = "title";
        title.textContent = tab.title;
        const meta = document.createElement("span");
        meta.className = "meta";
        meta.textContent = tab.kind === "canvas" ? "画板" : "文本";
        button.append(title, meta);
        button.addEventListener("click", function () {
          window.superNote.trayMenuAction({ type: "open-tab", tabId: tab.id });
        });
        recent.appendChild(button);
      });
      more.hidden = state.tabs.length <= 4;
      more.firstElementChild.textContent = expanded ? "收起" : "More";
      more.lastElementChild.textContent = expanded ? "‹" : "›";
      resize();
    }
    more.addEventListener("click", function () { expanded = !expanded; render(state); });
    document.getElementById("new-text").addEventListener("click", function () { window.superNote.trayMenuAction({ type: "new-text" }); });
    document.getElementById("exit").addEventListener("click", function () { window.superNote.trayMenuAction({ type: "exit" }); });
    window.superNote.getTrayMenuState().then(render);
    window.superNote.onTrayMenuState(render);
  </script>
</body>
</html>`;

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

function getTrayMenuState() {
  const active = trayTabState.tabs.find((tab) => tab.id === trayTabState.activeTabId);
  const others = [...trayTabState.tabs].reverse().filter((tab) => tab.id !== trayTabState.activeTabId);
  return { tabs: active ? [active, ...others] : others };
}

function positionTrayMenu() {
  if (!tray || !trayMenuWindow) {
    return;
  }
  const trayBounds = tray.getBounds();
  const windowBounds = trayMenuWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;
  const x = Math.max(workArea.x, Math.min(trayBounds.x + trayBounds.width - windowBounds.width, workArea.x + workArea.width - windowBounds.width));
  const trayIsBelowWorkArea = trayBounds.y >= workArea.y + workArea.height;
  const y = trayIsBelowWorkArea
    ? workArea.y + workArea.height - windowBounds.height
    : Math.min(trayBounds.y + trayBounds.height, workArea.y + workArea.height - windowBounds.height);
  trayMenuWindow.setPosition(Math.round(x), Math.round(Math.max(workArea.y, y)), false);
}

function createTrayMenuWindow() {
  if (trayMenuWindow) {
    return trayMenuWindow;
  }
  trayMenuWindow = new BrowserWindow({
    width: 360,
    height: 280,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  trayMenuWindow.setMenuBarVisibility(false);
  trayMenuWindow.on("blur", () => trayMenuWindow?.hide());
  trayMenuWindow.on("closed", () => {
    trayMenuWindow = null;
  });
  void trayMenuWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(trayMenuHtml)}`);
  return trayMenuWindow;
}

function toggleTrayMenu() {
  const menuWindow = createTrayMenuWindow();
  if (menuWindow.isVisible()) {
    menuWindow.hide();
    return;
  }
  menuWindow.webContents.send("tray:state", getTrayMenuState());
  positionTrayMenu();
  menuWindow.show();
  menuWindow.focus();
}

function sendTrayAction(action: { type: "new-text" } | { type: "open-tab"; tabId: string }) {
  showMainWindow();
  mainWindow?.webContents.send("tray:action", action);
  trayMenuWindow?.hide();
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
  tray.on("click", toggleTrayMenu);
  tray.on("right-click", toggleTrayMenu);
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

ipcMain.handle("tray:syncTabs", (event, state: { activeTabId?: unknown; tabs?: unknown }) => {
  if (event.sender !== mainWindow?.webContents || !Array.isArray(state?.tabs)) {
    return { ok: false };
  }
  trayTabState = {
    activeTabId: typeof state.activeTabId === "string" ? state.activeTabId : "",
    tabs: state.tabs
      .filter(
        (tab): tab is TrayTab =>
          Boolean(tab) &&
          typeof tab.id === "string" &&
          typeof tab.title === "string" &&
          (tab.kind === "file" || tab.kind === "canvas"),
      )
      .map((tab) => ({ id: tab.id, title: tab.title.slice(0, 120), kind: tab.kind })),
  };
  trayMenuWindow?.webContents.send("tray:state", getTrayMenuState());
  return { ok: true };
});

ipcMain.handle("tray:getMenuState", () => getTrayMenuState());

ipcMain.handle("tray:menuAction", (event, action: { type?: unknown; tabId?: unknown; height?: unknown }) => {
  if (event.sender !== trayMenuWindow?.webContents) {
    return { ok: false };
  }
  if (action?.type === "resize" && typeof action.height === "number") {
    trayMenuWindow.setSize(360, Math.max(180, Math.min(Math.round(action.height), 520)), false);
    positionTrayMenu();
    return { ok: true };
  }
  if (action?.type === "new-text") {
    sendTrayAction({ type: "new-text" });
    return { ok: true };
  }
  if (action?.type === "open-tab" && typeof action.tabId === "string") {
    sendTrayAction({ type: "open-tab", tabId: action.tabId });
    return { ok: true };
  }
  if (action?.type === "exit") {
    forceQuit = true;
    app.quit();
    return { ok: true };
  }
  return { ok: false };
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
