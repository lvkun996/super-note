export function normalizePaneWidths(widths: number[], count: number) {
  if (count <= 0) {
    return [];
  }
  if (widths.length !== count || widths.some((width) => !Number.isFinite(width) || width <= 0)) {
    return Array.from({ length: count }, () => 100 / count);
  }
  const total = widths.reduce((sum, width) => sum + width, 0);
  return widths.map((width) => (width / total) * 100);
}

export function insertPaneWidth(widths: number[], paneIndex: number, direction: "left" | "right") {
  const normalized = normalizePaneWidths(widths, widths.length);
  const sourceWidth = normalized[paneIndex] ?? 100;
  const half = sourceWidth / 2;
  const next = [...normalized];
  next.splice(direction === "left" ? paneIndex : paneIndex + 1, 0, half);
  next[direction === "left" ? paneIndex + 1 : paneIndex] = half;
  return normalizePaneWidths(next, next.length);
}

export function removePaneWidth(widths: number[], paneIndex: number) {
  if (widths.length <= 1) {
    return [100];
  }
  const next = normalizePaneWidths(widths, widths.length);
  const removed = next[paneIndex];
  next.splice(paneIndex, 1);
  const targetIndex = paneIndex > 0 ? paneIndex - 1 : 0;
  next[targetIndex] += removed;
  return normalizePaneWidths(next, next.length);
}

export function makePaneGridTemplate(widths: number[]) {
  return widths.flatMap((width, index) => [
    `minmax(0, ${width}fr)`,
    ...(index < widths.length - 1 ? ["7px"] : []),
  ]).join(" ");
}
