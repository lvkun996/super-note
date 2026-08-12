import * as electron from "electron";

const { contextBridge, ipcRenderer } = electron;

function getInitialMindMapStyleState() {
  const prefix = "--mindmap-style-state=";
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (!argument) {
    return null;
  }
  try {
    return JSON.parse(decodeURIComponent(argument.slice(prefix.length)));
  } catch {
    return null;
  }
}

contextBridge.exposeInMainWorld("superNote", {
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  saveWorkspace: (workspace: unknown) => ipcRenderer.invoke("workspace:save", workspace),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  notifyRendererReady: () => ipcRenderer.invoke("app:rendererReady"),
  notifyWorkspaceFlushed: () => ipcRenderer.invoke("app:workspaceFlushed"),
  onPrepareQuit: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("app:prepareQuit", listener);
    return () => ipcRenderer.removeListener("app:prepareQuit", listener);
  },
  onOpenFiles: (callback: (files: unknown) => void) => {
    const listener = (_event: electron.IpcRendererEvent, files: unknown) => callback(files);
    ipcRenderer.on("files:open", listener);
    return () => ipcRenderer.removeListener("files:open", listener);
  },
  readFile: (filePath: string) => ipcRenderer.invoke("file:read", filePath),
  getFileSnapshots: (filePaths: string[]) => ipcRenderer.invoke("file:getSnapshots", filePaths),
  saveFile: (payload: unknown) => ipcRenderer.invoke("file:save", payload),
  saveCanvasImage: (payload: unknown) => ipcRenderer.invoke("canvas:saveImage", payload),
  getInitialMindMapStyleState,
  openMindMapStyle: (payload: unknown) => ipcRenderer.invoke("mindmap-style:open", payload),
  syncMindMapStyle: (payload: unknown) => ipcRenderer.invoke("mindmap-style:sync", payload),
  updateMindMapStyle: (payload: unknown) => ipcRenderer.invoke("mindmap-style:update", payload),
  onMindMapStyleState: (callback: (payload: unknown) => void) => {
    const listener = (_event: electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("mindmap-style:state", listener);
    return () => ipcRenderer.removeListener("mindmap-style:state", listener);
  },
  onMindMapStyleUpdate: (callback: (payload: unknown) => void) => {
    const listener = (_event: electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("mindmap-style:update", listener);
    return () => ipcRenderer.removeListener("mindmap-style:update", listener);
  },
  setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke("window:setAlwaysOnTop", enabled),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggleMaximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  syncTrayTabs: (state: unknown) => ipcRenderer.invoke("tray:syncTabs", state),
  getTrayMenuState: () => ipcRenderer.invoke("tray:getMenuState"),
  trayMenuAction: (action: unknown) => ipcRenderer.invoke("tray:menuAction", action),
  onTrayAction: (callback: (action: unknown) => void) => {
    const listener = (_event: electron.IpcRendererEvent, action: unknown) => callback(action);
    ipcRenderer.on("tray:action", listener);
    return () => ipcRenderer.removeListener("tray:action", listener);
  },
  onTrayMenuState: (callback: (state: unknown) => void) => {
    const listener = (_event: electron.IpcRendererEvent, state: unknown) => callback(state);
    ipcRenderer.on("tray:state", listener);
    return () => ipcRenderer.removeListener("tray:state", listener);
  },
  getPathForFile: (file: File) =>
    electron.webUtils?.getPathForFile(file) || (file as File & { path?: string }).path || "",
  readClipboardText: () => ipcRenderer.invoke("clipboard:readText"),
  writeClipboardText: (text: string) => ipcRenderer.invoke("clipboard:writeText", text),
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  getUpdateStatus: () => ipcRenderer.invoke("update:getStatus"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
});
