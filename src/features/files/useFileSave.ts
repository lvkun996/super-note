import { useCallback } from "react";
import { uiText } from "../../../electron/uiLanguage";
import type { AppSettings, NoteTab, RecentFile } from "../../appTypes";
import type { AppFeedback, StateSetter } from "../workspace/controllerTypes";
import { createCanvasPayload, getFileName, getFileSaveFilters } from "../tabs/tabDocument";
import { getTabDisplayTitle } from "../tabs/tabTitle";
import { getFileDocumentMode, isMarkdownFileName } from "../text/fileDocument";
import { updateTextAnchors } from "../text/textAnchors";
import { rememberRecentFiles } from "../workspace/workspaceUtils";
import { buildSaveFileName } from "./saveFileName";

type FileSaveOptions = {
  activeTab: NoteTab | null | undefined;
  message: AppFeedback["message"];
  settings: AppSettings;
  setTabs: StateSetter<NoteTab[]>;
  setRecentFiles: StateSetter<RecentFile[]>;
  setEditingText: (value: null) => void;
};

export function useFileSave({
  activeTab,
  message,
  settings,
  setTabs,
  setRecentFiles,
  setEditingText,
}: FileSaveOptions) {
  const saveCurrentTab = useCallback(async () => {
    if (!activeTab) {
      return;
    }
    if (document.activeElement instanceof HTMLTextAreaElement && document.activeElement.classList.contains("text-note-editor")) {
      document.activeElement.blur();
    }
    setEditingText(null);

    try {
      if (activeTab.kind === "file") {
        if (activeTab.isPreviewOnly) {
          message.warning(uiText("大文本以只读预览打开，不能直接保存；原文件未被修改"));
          return;
        }
        const isNewFile = !activeTab.filePath;
        const documentMode = getFileDocumentMode(activeTab);
        const requiredExtension = documentMode === "markdown" ? "md" : "txt";
        const result = await window.superNote?.saveFile({
          path: activeTab.filePath,
          content: activeTab.content,
          defaultName: isNewFile
            ? buildSaveFileName(
                getTabDisplayTitle(activeTab),
                requiredExtension,
                documentMode === "markdown" ? uiText("未命名 Markdown") : uiText("未命名文本"),
              )
            : activeTab.fileName,
          defaultDirectory: settings.defaultSaveDirectory,
          filters: getFileSaveFilters(activeTab),
          requiredExtension: isNewFile ? requiredExtension : undefined,
        });
        if (!result || result.canceled) {
          return;
        }
        if (!result.ok) {
          throw new Error(result.error ?? uiText("保存失败"));
        }
        setTabs((current) =>
          current.map((tab) =>
            tab.id === activeTab.id && tab.kind === "file"
              ? {
                  ...tab,
                  filePath: result.path,
                  fileName: result.name ?? getFileName(result.path ?? tab.fileName),
                  title: result.name ?? getFileName(result.path ?? tab.title),
                  documentMode: tab.documentMode === "markdown" || isMarkdownFileName(result.name) || isMarkdownFileName(result.path) ? "markdown" : "text",
                  lastKnownMtimeMs: result.mtimeMs,
                  lastKnownSize: result.size,
                  content: result.content ?? tab.content,
                  textAnchors: updateTextAnchors(tab.content, result.content ?? tab.content, tab.textAnchors),
                  dirty: false,
                }
              : tab,
          ),
        );
        if (result.path) {
          setRecentFiles((current) =>
            rememberRecentFiles(current, [{ path: result.path!, name: result.name ?? getFileName(result.path!) }]),
          );
        }
        message.success(uiText("已保存到本地文件"));
        return;
      }

      const payload = JSON.stringify(createCanvasPayload(activeTab), null, 2);
      const result = await window.superNote?.saveFile({
        path: activeTab.filePath,
        content: payload,
        defaultName: `${activeTab.title === uiText("未知") ? "untitled" : activeTab.title}.snote`,
        defaultDirectory: settings.defaultSaveDirectory,
        filters: [
          { name: "Super Note", extensions: ["snote"] },
          { name: "All Files", extensions: ["*"] },
        ],
        requiredExtension: "snote",
      });
      if (!result || result.canceled) {
        return;
      }
      if (!result.ok) {
        throw new Error(result.error ?? uiText("保存失败"));
      }
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTab.id && tab.kind === "canvas"
            ? {
                ...tab,
                filePath: result.path,
                title: result.name ?? getFileName(result.path ?? tab.title),
                autoTitle: false,
                lastKnownMtimeMs: result.mtimeMs,
                lastKnownSize: result.size,
                dirty: false,
              }
            : tab,
          ),
      );
      if (result.path) {
        setRecentFiles((current) =>
          rememberRecentFiles(current, [{ path: result.path!, name: result.name ?? getFileName(result.path!) }]),
        );
      }
      message.success(uiText("已保存为 Super Note 文件"));
    } catch (error) {
      message.error(uiText("保存失败：{0}", [String(error)]));
    }
  }, [activeTab, message, settings.defaultSaveDirectory]);

  return saveCurrentTab;
}
