/// <reference types="vite/client" />

type OpenedFile = {
  path?: string;
  name: string;
  content: string;
};

type WorkspaceResult = {
  ok: boolean;
  workspace?: unknown;
  path?: string;
  error?: string;
};

type SaveWorkspaceResult = {
  ok: boolean;
  path?: string;
  error?: string;
};

type SaveFilePayload = {
  path?: string;
  content: string;
  defaultName?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
};

type SaveFileResult = {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  name?: string;
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
    saveFile: (payload: SaveFilePayload) => Promise<SaveFileResult>;
    setAlwaysOnTop: (enabled: boolean) => Promise<{ ok: boolean; enabled: boolean }>;
    minimizeWindow: () => Promise<{ ok: boolean }>;
    toggleMaximizeWindow: () => Promise<{ ok: boolean; maximized: boolean }>;
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
    getAppInfo: () => Promise<AppInfo>;
    getUpdateStatus: () => Promise<UpdateStatus>;
    checkForUpdates: () => Promise<UpdateStatus>;
    downloadUpdate: () => Promise<UpdateStatus>;
    installUpdate: () => Promise<UpdateStatus>;
    onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
  };
}
