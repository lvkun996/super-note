import MarkdownIt from "markdown-it";
import type { TextSelection } from "../../appTypes";
import { normalizeTextLineEndings } from "./textLineEndings";

let parser: MarkdownIt | undefined;
const TABLE_SEPARATOR_LINE = /\n[ \t]*[|:\-][ \t|:\-]*(?=\r?\n|$)/;
export const MAX_TABLE_CELLS = 100_000;

export type MarkdownTable = {
  start: number;
  end: number;
  rowStarts: number[];
  rows: string[];
  columns: number;
  separator: string;
};

export function findMarkdownTables(content: string): MarkdownTable[] {
  // A pipe also occurs in logs, source code, and prose. Skip parsing until
  // the document contains a line that could actually be a table separator.
  if (!content.includes("|") || !TABLE_SEPARATOR_LINE.test(content)) return [];
  const tableParser = parser ??= new MarkdownIt();
  const tokens: ReturnType<typeof tableParser.parse> = [];
  tableParser.block.parse(content, tableParser, {}, tokens);
  const ranges = tokens.flatMap((token) => token.type === "table_open" && token.level === 0 && token.map ? [token.map] : []);
  if (!ranges.length) return [];

  const lines = content.split("\n");
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);

  return ranges.map(([start, end]) => {
    const separator = lines[start + 1];
    const rowStarts = [offsets[start], ...offsets.slice(start + 2, end)];
    return {
      start: offsets[start],
      end: offsets[end] - 1,
      rowStarts,
      rows: [lines[start], ...lines.slice(start + 2, end)],
      columns: separator.trim().split("|").filter((part) => part.trim()).length,
      separator,
    };
  });
}

export function rowAtOffset(table: MarkdownTable, offset: number) {
  let low = 0;
  let high = table.rowStarts.length;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (table.rowStarts[middle] <= offset) low = middle;
    else high = middle;
  }
  return low;
}

export function readMarkdownRow(line: string) {
  const cells = line.trim().split(/(?<!\\)\|/);
  if (cells[0] === "") cells.shift();
  if (cells.at(-1) === "") cells.pop();
  return cells.map((cell) => cell.trim());
}

export function formatMarkdownRow(cells: readonly string[]) {
  return `| ${cells.join(" | ")} |`;
}

export function formatMarkdownTable(rows: readonly (readonly string[])[], separator?: string) {
  return [
    formatMarkdownRow(rows[0]),
    separator ?? formatMarkdownRow(rows[0].map(() => "---")),
    ...rows.slice(1).map(formatMarkdownRow),
  ].join("\n");
}

export function buildTableInsertion(content: string, { start, end }: TextSelection, source: string) {
  const before = content.slice(0, start);
  const after = content.slice(end);
  const prefix = !before || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const suffix = !after || after.startsWith("\n") ? after.startsWith("\n\n") ? "" : "\n" : "\n\n";
  return { content: `${before}${prefix}${source}${suffix}${after}`, caret: before.length + prefix.length + source.length };
}

export function buildTableRowEdit(content: string, table: MarkdownTable, row: number, action: "above" | "below" | "duplicate") {
  const line = action === "duplicate" ? table.rows[row] : formatMarkdownRow(Array<string>(table.columns).fill(""));
  if (action === "above") {
    const start = table.rowStarts[row];
    return { content: `${content.slice(0, start)}${line}\n${content.slice(start)}`, caret: start + 2 };
  }
  const end = row + 1 < table.rowStarts.length ? table.rowStarts[row + 1] - 1 : table.end;
  return { content: `${content.slice(0, end)}\n${line}${content.slice(end)}`, caret: end + 1 + Math.min(2, line.length) };
}

function encodePlainCell(text: string) {
  return normalizeTextLineEndings(text).replace(/[\n\t&\\|`*_[\]<>~!]/g, (char) => `&#${char.charCodeAt(0)};`);
}

function rowsToMarkdown(rows: string[][]) {
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (!columns || rows.length * columns > MAX_TABLE_CELLS) return "";
  return formatMarkdownTable(rows.map((row) => Array.from({ length: columns }, (_, column) => encodePlainCell(row[column] ?? ""))));
}

function readTsv(text: string) {
  if (!text.includes("\t")) return "";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { cell += char; index += 1; }
      else if (char === '"' && (next === "\t" || next === "\n" || !next)) quoted = false;
      else cell += char;
    } else if (char === '"' && !cell) quoted = true;
    else if (char === "\t" || char === "\n") {
      row.push(cell);
      cell = "";
      if (char === "\n") { rows.push(row); row = []; }
    } else cell += char;
  }
  if (quoted) return "";
  if (cell || row.length || !text.endsWith("\n")) rows.push([...row, cell]);
  if (!rows[0] || rows[0].length < 2 || rows.some((cells) => cells.length !== rows[0].length)) return "";
  return rowsToMarkdown(rows);
}

function readHtmlTable(table: HTMLTableElement) {
  const htmlRows = Array.from(table.rows);
  const rows: string[][] = htmlRows.map(() => []);
  for (const row of htmlRows) {
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      while (rows[row.rowIndex][column] !== undefined) column += 1;
      if ((column + cell.colSpan) * rows.length > MAX_TABLE_CELLS) return "";
      cell.querySelectorAll("script, style, template").forEach((element) => element.remove());
      cell.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
      cell.querySelectorAll("p, li").forEach((element) => element.after("\n"));
      rows[row.rowIndex][column] = cell.textContent?.trim() ?? "";
      const end = cell.rowSpan ? Math.min(row.rowIndex + cell.rowSpan, rows.length) : rows.length;
      for (let r = row.rowIndex; r < end && htmlRows[r].parentElement === row.parentElement; r += 1) {
        for (let c = column; c < column + cell.colSpan; c += 1) rows[r][c] ??= "";
      }
      column += cell.colSpan;
    }
  }
  return rowsToMarkdown(rows);
}

export function readPastedTable(text: string, html = "") {
  const normalized = normalizeTextLineEndings(text);
  const markdown = normalized.replace(/^\n+|\n+$/g, "");
  if (markdown.includes("|")) {
    const [table] = findMarkdownTables(markdown);
    if (table?.start === 0 && table.end === markdown.length) return markdown;
  }

  if (/<table[\s>]/i.test(html)) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const tables = Array.from(template.content.querySelectorAll("table")).filter((table) => !table.parentElement?.closest("table"));
    const sources = tables.map(readHtmlTable);
    if (sources.length && sources.every(Boolean)) return sources.join("\n\n");
  }
  return readTsv(normalized);
}
