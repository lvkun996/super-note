import { app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let forceQuit = false;

const workspaceFileName = "workspace.json";

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
  mainWindow?.show();
  mainWindow?.focus();
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
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
});

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

ipcMain.handle("app:getInfo", () => ({
  version: app.getVersion(),
  author: "kunkun",
  desc: "认识自身平凡后，依旧拥有改变世界的勇气",
}));
