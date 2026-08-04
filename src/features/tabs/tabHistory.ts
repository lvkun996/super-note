export type TabVisitHistory = readonly string[];

export function rememberTabVisit(history: TabVisitHistory, tabId: string): string[] {
  if (!tabId || history[history.length - 1] === tabId) {
    return [...history];
  }
  return [...history.filter((item) => item !== tabId), tabId];
}

export function removeTabVisit(history: TabVisitHistory, tabId: string): string[] {
  return history.filter((item) => item !== tabId);
}

export function resolveTabAfterClose(
  history: TabVisitHistory,
  closingTabId: string,
  orderedTabIds: readonly string[],
): string | undefined {
  const remainingTabIds = orderedTabIds.filter((tabId) => tabId !== closingTabId);
  const remaining = new Set(remainingTabIds);
  const previousVisit = [...history]
    .reverse()
    .find((tabId) => tabId !== closingTabId && remaining.has(tabId));

  if (previousVisit) {
    return previousVisit;
  }

  const closingIndex = orderedTabIds.indexOf(closingTabId);
  if (closingIndex < 0) {
    return remainingTabIds[0];
  }
  return remainingTabIds[Math.max(0, closingIndex - 1)] ?? remainingTabIds[0];
}
