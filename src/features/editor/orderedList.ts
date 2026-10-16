type ListLine = { indent: string; numbers: string[]; delimiter: string; space: string; body: string };

function parseLine(line: string): ListLine | null {
  const match = /^([ \t]*)(\d+(?:\.\d+)*)([.)]?)([ \t]+)(.*)$/.exec(line.replace(/\r$/, ""));
  if (!match || (!match[3] && !match[2].includes("."))) return null;
  const numbers = match[2].split(".");
  if (numbers.some(number => !Number.isSafeInteger(Number(number)))) return null;
  return { indent: match[1], numbers, delimiter: match[3], space: match[4], body: match[5] };
}

function increment(numbers: string[]) {
  const next = [...numbers];
  const last = next.length - 1;
  const value = Number(next[last]) + 1;
  if (!Number.isSafeInteger(value)) return null;
  next[last] = String(value).padStart(next[last].length, "0");
  return next.join(".");
}

export function orderedListEdit(content: string, start: number, end: number, action: "continue" | "child") {
  const lineStart = start === 0 ? 0 : content.lastIndexOf("\n", start - 1) + 1;
  const breakAt = content.indexOf("\n", start);
  const lineEnd = breakAt < 0 ? content.length : breakAt;
  const line = content.slice(lineStart, lineEnd);
  const current = parseLine(line);
  if (action === "continue") {
    if (!current) return null;
    const number = increment(current.numbers);
    if (!number) return null;
    const insertion = `\n${current.indent}${number}${current.delimiter}${current.space}`;
    return { content: content.slice(0, start) + insertion + content.slice(end), caret: start + insertion.length };
  }
  // Tab never replaces selected text or intercepts non-list content.
  if (start !== end) return null;
  const previousEnd = lineStart - 1;
  const previousStart = previousEnd <= 0 ? 0 : content.lastIndexOf("\n", previousEnd - 1) + 1;
  const previous = lineStart > 0 ? parseLine(content.slice(previousStart, previousEnd)) : null;
  if (current) {
    // Shift+Enter has already created the next empty sibling: Tab indents
    // that new item beneath the previous parent, rather than beneath itself.
    const parentNumbers = !current.body && previous && increment(previous.numbers) === current.numbers.join(".")
      ? previous.numbers : current.numbers;
    const prefix = `${current.indent}${parentNumbers.join(".")}.1 `;
    const oldPrefixLength = line.length - current.body.length;
    return {
      content: content.slice(0, lineStart) + prefix + current.body + content.slice(lineEnd),
      caret: lineStart + prefix.length + Math.max(0, start - lineStart - oldPrefixLength),
    };
  }
  if (line.trim() || lineStart === 0) return null;
  if (!previous) return null;
  const number = previous.numbers.length === 1 ? `${previous.numbers[0]}.1` : increment(previous.numbers);
  if (!number) return null;
  const prefix = `${previous.indent}${number} `;
  return { content: content.slice(0, lineStart) + prefix + content.slice(lineEnd), caret: lineStart + prefix.length };
}
