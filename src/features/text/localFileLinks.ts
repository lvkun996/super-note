export type LocalFileLink = { path: string; start: number; end: number };

/** Quoted paths support spaces; bare paths stop at whitespace and prose punctuation. */
export function getLocalFileLinks(text: string): LocalFileLink[] {
  const pattern = /(["'`])((?:[a-z]:[\\/]|\\\\)[^\r\n]*?)\1|(?<![\w/:\\])(?:[a-z]:[\\/]|\\\\)[^\s<>"'`|?*，。；：！？（）【】、]+/gi;
  return Array.from(text.matchAll(pattern)).map(match => {
    const quoted = Boolean(match[1]);
    const value = quoted ? match[2] : match[0].replace(/[),.;!\]}]+$/, "");
    const start = match.index! + (quoted ? 1 : 0);
    return { path: value, start, end: start + value.length };
  });
}

export function findLocalFileAtOffset(text: string, offset: number) {
  return getLocalFileLinks(text).find(link => offset >= link.start && offset < link.end)?.path ?? null;
}
