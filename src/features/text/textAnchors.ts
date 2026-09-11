import type { TextAnchor } from "../../appTypes";

export const MAX_TEXT_ANCHORS = 80;
const MAX_ANCHOR_LABEL_LENGTH = 88;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeLabel(content: string, start: number, end: number) {
  return content
    .slice(start, end)
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_ANCHOR_LABEL_LENGTH);
}

export function createTextAnchor(content: string, selectionStart: number, selectionEnd: number, id: string): TextAnchor | null {
  let start = clamp(Math.min(selectionStart, selectionEnd), 0, content.length);
  let end = clamp(Math.max(selectionStart, selectionEnd), 0, content.length);
  while (start < end && /\s/u.test(content[start])) start += 1;
  while (end > start && /\s/u.test(content[end - 1])) end -= 1;
  const label = makeLabel(content, start, end);
  return id && end > start && label ? { id, start, end, label } : null;
}

export function normalizeTextAnchors(value: unknown, content: string): TextAnchor[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const seenRanges = new Set<string>();
  const normalized: TextAnchor[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<TextAnchor>;
    if (
      typeof candidate.id !== "string" ||
      !candidate.id ||
      typeof candidate.start !== "number" ||
      !Number.isFinite(candidate.start) ||
      typeof candidate.end !== "number" ||
      !Number.isFinite(candidate.end)
    ) {
      continue;
    }
    const anchor = createTextAnchor(content, Math.round(candidate.start), Math.round(candidate.end), candidate.id);
    if (!anchor) continue;
    const rangeKey = `${anchor.start}:${anchor.end}`;
    if (seenIds.has(anchor.id) || seenRanges.has(rangeKey)) continue;
    seenIds.add(anchor.id);
    seenRanges.add(rangeKey);
    normalized.push(anchor);
    if (normalized.length >= MAX_TEXT_ANCHORS) break;
  }

  return normalized.sort((left, right) => left.start - right.start || left.end - right.end);
}

function findChangedRange(previousContent: string, nextContent: string) {
  let start = 0;
  const sharedLength = Math.min(previousContent.length, nextContent.length);
  while (start < sharedLength && previousContent[start] === nextContent[start]) start += 1;

  let suffixLength = 0;
  while (
    suffixLength < previousContent.length - start &&
    suffixLength < nextContent.length - start &&
    previousContent[previousContent.length - 1 - suffixLength] === nextContent[nextContent.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  return {
    start,
    previousEnd: previousContent.length - suffixLength,
    nextEnd: nextContent.length - suffixLength,
  };
}

export function updateTextAnchors(previousContent: string, nextContent: string, value: unknown): TextAnchor[] {
  const anchors = normalizeTextAnchors(value, previousContent);
  if (previousContent === nextContent || anchors.length === 0) {
    return anchors;
  }

  const change = findChangedRange(previousContent, nextContent);
  const delta = change.nextEnd - change.previousEnd;
  const insertionOnly = change.previousEnd === change.start;

  const adjusted = anchors.flatMap((anchor) => {
    let start = anchor.start;
    let end = anchor.end;

    if (insertionOnly) {
      if (anchor.end <= change.start) {
        return [anchor];
      }
      if (anchor.start >= change.start) {
        start += delta;
        end += delta;
      } else {
        end += delta;
      }
    } else if (anchor.end <= change.start) {
      return [anchor];
    } else if (anchor.start >= change.previousEnd) {
      start += delta;
      end += delta;
    } else {
      start = anchor.start <= change.start ? anchor.start : change.start;
      end = anchor.end >= change.previousEnd ? anchor.end + delta : change.nextEnd;
    }

    const next = createTextAnchor(nextContent, start, end, anchor.id);
    return next ? [next] : [];
  });

  return normalizeTextAnchors(adjusted, nextContent);
}

export function getTextAnchorLine(content: string, offset: number) {
  return content.slice(0, clamp(offset, 0, content.length)).split(/\r?\n/u).length;
}
