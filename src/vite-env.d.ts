/// <reference types="vite/client" />

type OpenedFile = {
  path?: string;
  name: string;
  content: string;
  mtimeMs?: number;
  size?: number;
};

type WorkspaceResult = {
  ok: boolean;
  workspace?: unknown;
  backupWorkspace?: unknown;
  path?: string;
  backupPath?: string;
  error?: string;
};

type SaveWorkspaceResult = {
  ok: boolean;
  path?: string;
  backupPath?: string;
  error?: string;
};

type SaveFilePayload = {
  path?: string;
  content: string;
  defaultName?: string;
  defaultDirectory?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
  requiredExtension?: string;
};

type SaveFileResult = {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  name?: string;
  mtimeMs?: number;
  size?: number;
  error?: string;
};

type SaveCanvasImagePayload = {
  dataUrl: string;
  defaultName?: string;
  defaultDirectory?: string;
};

type MindMapStyleIpcPayload = {
  tabId: string;
  title?: string;
  style: unknown;
  darkMode?: boolean;
};

type ReadFileResult = {
  ok: boolean;
  file?: OpenedFile;
  path?: string;
  error?: string;
};

type FileSnapshot = {
  path: string;
  exists: boolean;
  mtimeMs?: number;
  size?: number;
  error?: string;
};

type OpenFileResult = {
  canceled: boolean;
  files: OpenedFile[];
};

type AppInfo = {
  version: string;
  author: string;
  desc: string;
  globalShortcut?: string;
};

type UpdateStatus = {
  state: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "installing" | "error";
  channel: "latest" | "win7-8";
  currentVersion: string;
  latestVersion?: string;
  progress?: number;
  error?: string;
  downloadAttempt?: number;
  maxDownloadAttempts?: number;
};

type TrayTabState = {
  activeTabId: string;
  tabs: Array<{ id: string; title: string; kind: "file" | "canvas" }>;
};

type TrayAction = { type: "new-text" } | { type: "open-tab"; tabId: string };

interface Window {
  superNote?: {
    loadWorkspace: () => Promise<WorkspaceResult>;
    saveWorkspace: (workspace: unknown) => Promise<SaveWorkspaceResult>;
    openFile: () => Promise<OpenFileResult>;
    notifyRendererReady: () => Promise<{ ok: boolean }>;
    notifyWorkspaceFlushed: () => Promise<{ ok: boolean }>;
    onPrepareQuit: (callback: () => void) => () => void;
    onOpenFiles: (callback: (files: OpenedFile[]) => void) => () => void;
    readFile: (filePath: string) => Promise<ReadFileResult>;
    getFileSnapshots: (filePaths: string[]) => Promise<FileSnapshot[]>;
    saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult>;
    selectDirectory: (defaultPath?: string) => Promise<{ canceled: boolean; path?: string }>;
    saveCanvasImage: (payload: SaveCanvasImagePayload) => Promise<SaveFileResult>;
    getInitialMindMapStyleState: () => unknown;
    openMindMapStyle: (payload: MindMapStyleIpcPayload) => Promise<{ ok: boolean; error?: string }>;
    syncMindMapStyle: (payload: MindMapStyleIpcPayload) => Promise<{ ok: boolean }>;
    updateMindMapStyle: (payload: MindMapStyleIpcPayload) => Promise<{ ok: boolean }>;
    onMindMapStyleState: (callback: (payload: unknown) => void) => () => void;
    onMindMapStyleUpdate: (callback: (payload: MindMapStyleIpcPayload) => void) => () => void;
    setAlwaysOnTop: (enabled: boolean) => Promise<{ ok: boolean; enabled: boolean }>;
    minimizeWindow: () => Promise<{ ok: boolean }>;
    toggleMaximizeWindow: () => Promise<{ ok: boolean; maximized: boolean }>;
    toggleFullscreenWindow: () => Promise<{ ok: boolean; fullscreen: boolean }>;
    closeWindow: () => Promise<{ ok: boolean }>;
    syncTrayTabs: (state: TrayTabState) => Promise<{ ok: boolean }>;
    getTrayMenuState: () => Promise<{ tabs: TrayTabState["tabs"] }>;
    trayMenuAction: (action: unknown) => Promise<{ ok: boolean }>;
    onTrayAction: (callback: (action: TrayAction) => void) => () => void;
    onTrayMenuState: (callback: (state: { tabs: TrayTabState["tabs"] }) => void) => () => void;
    getPathForFile: (file: File) => string;
    readClipboardText: () => Promise<string>;
    writeClipboardText: (text: string) => Promise<{ ok: boolean }>;
    openExternal: (url: string) => Promise<{ ok: boolean }>;
    showItemInFolder: (filePath: string) => Promise<{ ok: boolean }>;
    getAppInfo: () => Promise<AppInfo>;
    setLanguage: (language: "zh-CN" | "en-US") => Promise<{ ok: boolean }>;
    getUpdateStatus: () => Promise<UpdateStatus>;
    checkForUpdates: () => Promise<UpdateStatus>;
    downloadUpdate: () => Promise<UpdateStatus>;
    installUpdate: () => Promise<UpdateStatus>;
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  };
}
