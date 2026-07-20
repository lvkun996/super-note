import * as electron from "electron";

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld("superNote", {
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  saveWorkspace: (workspace: unknown) => ipcRenderer.invoke("workspace:save", workspace),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  saveFile: (payload: unknown) => ipcRenderer.invoke("file:save", payload),
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
