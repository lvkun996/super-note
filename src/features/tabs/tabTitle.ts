import { uiText } from "../../../electron/uiLanguage";
import type { NoteTab } from "../../appTypes";

// Read only the displayed prefix, rather than normalizing/copying the whole file.
export function getTextTitlePrefix(content: string, limit = 14) {
  let prefix = "";
  let length = 0;
  let pendingSpace = false;
  if (limit <= 0) return prefix;

  for (const character of content) {
    if (/\s/u.test(character)) {
      pendingSpace = length > 0;
      continue;
    }
    if (pendingSpace) {
      prefix += " ";
      length += 1;
      pendingSpace = false;
      if (length >= limit) break;
    }
    prefix += character;
    length += 1;
    if (length >= limit) break;
  }
  return prefix;
}

export function getTabDisplayTitle(tab: NoteTab) {
  if (tab.kind !== "file" || tab.filePath || !tab.title.startsWith(uiText("未命名"))) {
    return tab.title;
  }
  const preview = getTextTitlePrefix(tab.content);
  return preview ? `${preview}...` : tab.title;
}
