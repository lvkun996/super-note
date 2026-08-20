export type TabDropPosition = "before" | "after";

export function reorderTabsById<T extends { id: string }>(
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
