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
};

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
    getPathForFile: (file: File) => string;
    readClipboardText: () => Promise<string>;
    getAppInfo: () => Promise<AppInfo>;
  };
}
