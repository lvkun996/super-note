export type MultiCaretEditResult = {
  content: string;
  carets: number[];
};

function normalizeCarets(carets: number[], contentLength: number) {
  return Array.from(new Set(carets.map((caret) => Math.max(0, Math.min(contentLength, caret))))).sort((a, b) => a - b);
}

export function insertAtCarets(content: string, carets: number[], insertion: string): MultiCaretEditResult {
  const positions = normalizeCarets(carets, content.length);
  let cursor = 0;
  let nextContent = "";
  const nextCarets: number[] = [];

  positions.forEach((position) => {
    nextContent += content.slice(cursor, position);
    nextContent += insertion;
    nextCarets.push(nextContent.length);
    cursor = position;
  });

  nextContent += content.slice(cursor);
  return { content: nextContent, carets: nextCarets };
}

export function deleteAtCarets(content: string, carets: number[], direction: "backward" | "forward"): MultiCaretEditResult {
  const positions = normalizeCarets(carets, content.length);
  const deletedIndexes = Array.from(
    new Set(
      positions
        .map((position) => (direction === "backward" ? position - 1 : position))
        .filter((index) => index >= 0 && index < content.length),
    ),
  ).sort((a, b) => a - b);
  const deleted = new Set(deletedIndexes);
  const nextContent = content.split("").filter((_, index) => !deleted.has(index)).join("");
  const nextCarets = positions.map((position) => position - deletedIndexes.filter((index) => index < position).length);

  return { content: nextContent, carets: Array.from(new Set(nextCarets)) };
}
