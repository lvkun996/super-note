import { uiText } from "../../../electron/uiLanguage";
import type { NoteTab, QuickOpenItem, RecentFile, SearchResult } from "../../appTypes";
import { getTabDisplayTitle } from "../tabs/tabTitle";

export const SEARCH_RESULT_LIMIT = 80;
export const QUICK_OPEN_RESULT_LIMIT = 40;

type TextMatch = {
  line: number;
  preview: string;
  selectionStart: number;
  selectionEnd: number;
};

function makePreview(text: string, query: string, matchIndex?: number) {
  const index = matchIndex ?? text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, 80);
  const start = Math.max(0, index - 28);
  const end = Math.min(text.length, index + query.length + 36);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export function findTextMatches(content: string, query: string, limit = SEARCH_RESULT_LIMIT): TextMatch[] {
  const needle = query.trim();
  if (!needle || limit <= 0) return [];
  const lowerNeedle = needle.toLowerCase();
  const lineBreaks = /\r\n|\r|\n/g;
  const matches: TextMatch[] = [];
  let lineStart = 0;
  let lineNumber = 1;

  // Scan one line at a time and stop at the result limit. No full-file line array
  // or progressively sliced remainder is needed, even for large documents.
  while (lineStart <= content.length) {
    const separator = lineBreaks.exec(content);
    const lineEnd = separator?.index ?? content.length;
    const line = content.slice(lineStart, lineEnd);
    const lowerLine = line.toLowerCase();
    let index = lowerLine.indexOf(lowerNeedle);
    while (index >= 0) {
      const selectionStart = lineStart + index;
      matches.push({
        line: lineNumber,
        preview: makePreview(line, needle, index),
        selectionStart,
        selectionEnd: selectionStart + needle.length,
      });
      if (matches.length >= limit) return matches;
      index = lowerLine.indexOf(lowerNeedle, index + lowerNeedle.length);
    }
    if (!separator) break;
    lineStart = lineEnd + separator[0].length;
    lineNumber += 1;
  }
  return matches;
}

export function getQuickOpenResults(tabs: NoteTab[], recentFiles: RecentFile[], query: string, limit = QUICK_OPEN_RESULT_LIMIT): QuickOpenItem[] {
  const results: QuickOpenItem[] = [];
  if (limit <= 0) return results;
  const needle = query.trim().toLowerCase();

  for (const tab of tabs) {
    const title = getTabDisplayTitle(tab);
    if (needle && !title.toLowerCase().includes(needle) && !tab.filePath?.toLowerCase().includes(needle)) continue;
    results.push({
      id: `tab:${tab.id}`,
      kind: "tab",
      title,
      detail: tab.filePath ?? (tab.kind === "canvas" ? uiText("当前画板") : uiText("未保存文本")),
      tabId: tab.id,
    });
    if (results.length >= limit) return results;
  }

  const openPaths = new Set(tabs.flatMap((tab) => tab.filePath ? [tab.filePath.toLowerCase()] : []));
  for (const file of recentFiles) {
    const path = file.path.toLowerCase();
    if (openPaths.has(path) || (needle && !file.name.toLowerCase().includes(needle) && !path.includes(needle))) continue;
    results.push({ id: `recent:${path}`, kind: "recent", title: file.name, detail: file.path, filePath: file.path });
    if (results.length >= limit) break;
  }
  return results;
}

type WorkspaceSearchOptions = {
  tabs: NoteTab[];
  recentFiles: RecentFile[];
  query: string;
  scope: "current" | "all";
  activeTabId: string;
  limit?: number;
};

export function searchWorkspace({ tabs, recentFiles, query, scope, activeTabId, limit = SEARCH_RESULT_LIMIT }: WorkspaceSearchOptions): SearchResult[] {
  const needle = query.trim();
  const results: SearchResult[] = [];
  if (!needle || limit <= 0) return results;
  const lowerNeedle = needle.toLowerCase();

  for (const tab of tabs) {
    if (scope === "current" && tab.id !== activeTabId) continue;
    const title = getTabDisplayTitle(tab);
    if (title.toLowerCase().includes(lowerNeedle)) {
      results.push({
        id: `${tab.id}:title`,
        tabId: tab.id,
        kind: "tab-title",
        title,
        preview: tab.filePath ?? (tab.kind === "canvas" ? uiText("画板标题匹配") : uiText("标签标题匹配")),
      });
      if (results.length >= limit) return results;
    }

    if (tab.kind === "canvas") {
      for (const item of tab.items) {
        if (item.type !== "text" || !item.text.toLowerCase().includes(lowerNeedle)) continue;
        results.push({ id: `${tab.id}:${item.id}`, tabId: tab.id, itemId: item.id, kind: "canvas-text", title: tab.title, preview: makePreview(item.text, needle) });
        if (results.length >= limit) return results;
      }
    } else {
      for (const match of findTextMatches(tab.content, needle, limit - results.length)) {
        results.push({ id: `${tab.id}:match:${match.selectionStart}`, tabId: tab.id, kind: "file", title: tab.title, ...match });
      }
      if (results.length >= limit) return results;
    }
  }

  if (scope === "all") {
    const openPaths = new Set(tabs.flatMap((tab) => tab.filePath ? [tab.filePath.toLowerCase()] : []));
    for (const file of recentFiles) {
      const path = file.path.toLowerCase();
      if (openPaths.has(path) || (!file.name.toLowerCase().includes(lowerNeedle) && !path.includes(lowerNeedle))) continue;
      results.push({ id: `recent:${path}`, filePath: file.path, kind: "recent-file", title: file.name, preview: file.path });
      if (results.length >= limit) break;
    }
  }
  return results;
}
