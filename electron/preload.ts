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
  getPathForFile: (file: File) =>
    electron.webUtils?.getPathForFile(file) || (file as File & { path?: string }).path || "",
  readClipboardText: () => ipcRenderer.invoke("clipboard:readText"),
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
