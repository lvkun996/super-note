// Match textarea.value's newline normalization. Each lone CR is a line break;
// CRCRLF therefore remains two breaks, rather than silently losing a blank line.
export function normalizeTextLineEndings(content: string) {
  return content.replace(/\r\n?/g, "\n");
}

/** Translate persisted raw-text offsets into the textarea's LF-only offsets. */
export function normalizeTextLineEndingOffsets(content: string, offsets: number[]): number[] {
  const ordered = offsets.map((offset, index) => ({
    offset: Math.max(0, Math.min(content.length, Math.trunc(offset))), index,
  })).sort((left, right) => left.offset - right.offset);
  const result = new Array<number>(offsets.length);
  const pairs = /\r\n/g;
  let pair = pairs.exec(content);
  let removed = 0;

  for (const { offset, index } of ordered) {
    while (pair && pair.index + 1 < offset) {
      removed += 1;
      pair = pairs.exec(content);
    }
    result[index] = offset - removed;
  }
  return result;
}
