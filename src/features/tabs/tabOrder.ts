export type TabDropPosition = "before" | "after";

type PinnableTab = { id: string; pinned?: boolean };

export function sortPinnedTabs<T extends PinnableTab>(tabs: T[]): T[] {
  const sorted = [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)];
  return sorted.every((tab, index) => tab === tabs[index]) ? tabs : sorted;
}

export function toggleTabPinned<T extends PinnableTab>(tabs: T[], tabId: string): T[] {
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab) return tabs;
  const updated = { ...tab, pinned: !tab.pinned };
  return sortPinnedTabs([updated, ...tabs.filter((item) => item.id !== tabId)]);
}

export function reorderTabsById<T extends PinnableTab>(
  tabs: T[],
  movingId: string,
  targetId: string,
  position: TabDropPosition,
  scopeIds?: ReadonlySet<string>,
) {
  if (movingId === targetId) {
    return tabs;
  }

  const scopedTabs = scopeIds ? tabs.filter((tab) => scopeIds.has(tab.id)) : tabs;
  const movingIndex = scopedTabs.findIndex((tab) => tab.id === movingId);
  const targetIndex = scopedTabs.findIndex((tab) => tab.id === targetId);
  if (movingIndex < 0 || targetIndex < 0) {
    return tabs;
  }
  // Dragging changes order inside a group, never the persisted pin state.
  if (Boolean(scopedTabs[movingIndex].pinned) !== Boolean(scopedTabs[targetIndex].pinned)) {
    return tabs;
  }

  const reordered = [...scopedTabs];
  const [moving] = reordered.splice(movingIndex, 1);
  const nextTargetIndex = reordered.findIndex((tab) => tab.id === targetId);
  reordered.splice(position === "after" ? nextTargetIndex + 1 : nextTargetIndex, 0, moving);

  if (!scopeIds) {
    return reordered.every((tab, index) => tab === tabs[index]) ? tabs : reordered;
  }

  let scopedIndex = 0;
  const next = tabs.map((tab) => (scopeIds.has(tab.id) ? reordered[scopedIndex++] : tab));
  return next.every((tab, index) => tab === tabs[index]) ? tabs : next;
}
