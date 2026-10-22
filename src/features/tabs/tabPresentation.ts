import type { NoteTab } from "../../appTypes";
import { getUiLanguage } from "../../../electron/uiLanguage";
import { getTabDisplayTitle } from "./tabTitle";
export type TabPresentation = { id: string; title: string; themeIndex: number; dirty: boolean; filePath?: string; pinned?: boolean; kind: NoteTab["kind"] };

export function createTabPresentationCache() {
  let previous: TabPresentation[] = [], language = getUiLanguage();
  let byTab = new WeakMap<NoteTab, TabPresentation>();
  return (tabs: NoteTab[]) => {
    if (getUiLanguage() !== language) { language = getUiLanguage(); byTab = new WeakMap(); previous = []; }
    const byId = new Map(previous.map(row => [row.id, row]));
    const next = tabs.map(tab => {
      const cached = byTab.get(tab);
      if (cached) return cached;
      const row: TabPresentation = { id: tab.id, title: getTabDisplayTitle(tab), kind: tab.kind, themeIndex: tab.themeIndex, dirty: tab.dirty, filePath: tab.filePath, pinned: tab.pinned };
      const old = byId.get(tab.id);
      const result = old && Object.keys(row).every(key => row[key as keyof TabPresentation] === old[key as keyof TabPresentation]) ? old : row;
      byTab.set(tab, result); return result;
    });
    if (next.length !== previous.length || next.some((row, i) => row !== previous[i])) previous = next;
    return previous;
  };
}
