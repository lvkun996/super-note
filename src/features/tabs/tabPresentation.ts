import type { NoteTab } from "../../appTypes";
import { getUiLanguage } from "../../../electron/uiLanguage";
import { getTabDisplayTitle } from "./tabTitle";
export type TabPresentation = { id: string; title: string; themeIndex: number; dirty: boolean; filePath?: string; pinned?: boolean; kind: NoteTab["kind"]; shareable: boolean };

export function createTabPresentationCache() {
  let previous: TabPresentation[] = [];
  let byId = new Map<string, TabPresentation>();
  let byTab = new WeakMap<NoteTab, TabPresentation>();
  let language = getUiLanguage();

  return (tabs: NoteTab[]) => {
    const nextLanguage = getUiLanguage();
    if (nextLanguage !== language) {
      language = nextLanguage;
      byId = new Map();
      byTab = new WeakMap();
      previous = [];
    }

    let next: TabPresentation[] | undefined;
    for (let index = 0; index < tabs.length; index += 1) {
      const tab = tabs[index];
      let row = byTab.get(tab);
      if (!row) {
        const title = getTabDisplayTitle(tab);
        const shareable = tab.kind === "file" && !tab.isPreviewOnly;
        const old = byId.get(tab.id);
        row = old && old.title === title && old.kind === tab.kind && old.themeIndex === tab.themeIndex &&
          old.dirty === tab.dirty && old.filePath === tab.filePath && old.pinned === tab.pinned && old.shareable === shareable
          ? old
          : { id: tab.id, title, kind: tab.kind, themeIndex: tab.themeIndex, dirty: tab.dirty, filePath: tab.filePath, pinned: tab.pinned, shareable };
        byTab.set(tab, row);
      }
      if (!next && row !== previous[index]) next = previous.slice(0, index);
      next?.push(row);
    }
    if (next || previous.length !== tabs.length) {
      previous = next ?? previous.slice(0, tabs.length);
      byId = new Map(previous.map((row) => [row.id, row]));
    }
    return previous;
  };
}
