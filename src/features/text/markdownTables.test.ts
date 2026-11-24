import { describe, expect, it } from "vitest";
import { renderMarkdownContent } from "./markdownRenderer";
import { buildTableInsertion, buildTableRowEdit, findMarkdownTables, readMarkdownRow, readPastedTable, rowAtOffset } from "./markdownTables";

describe("document tables", () => {
  const source = "| 名称 | 值 |\n| :--- | ---: |\n| a\\|b | 3 |";
  const content = `上文\n\n${source}\n\n下文`;

  it("recognizes source rows and keeps alignment, escaped cells and neighboring text on edits", () => {
    const [table] = findMarkdownTables(content);
    expect(content.slice(table.start, table.end)).toBe(source);
    expect(rowAtOffset(table, content.indexOf("a\\|b"))).toBe(1);
    expect(readMarkdownRow(table.rows[1])).toEqual(["a\\|b", "3"]);
    expect(buildTableRowEdit(content, table, 1, "duplicate").content).toBe(content.replace(source, source + "\n| a\\|b | 3 |"));
    expect(buildTableRowEdit(content, table, 1, "above").content).toBe(content.replace("| a\\|b", "|  |  |\n| a\\|b"));
    expect(buildTableRowEdit(content, table, 0, "below").content).toBe(content.replace("| a\\|b", "|  |  |\n| a\\|b"));
    expect(findMarkdownTables(`\`\`\`\n${source}\n\`\`\``)).toEqual([]);
  });

  it("separates inserted tables from paragraphs and preserves pasted Markdown", () => {
    expect(readPastedTable(`\r\n${source}\r\n`)).toBe(source);
    const edit = buildTableInsertion("第一段\n第二段", { start: 4, end: 4 }, source);
    expect(edit.content).toBe(`第一段\n\n${source}\n\n第二段`);
    expect(findMarkdownTables(edit.content)).toHaveLength(1);
  });

  it("keeps valid bare separator rows and ignores ordinary pipe-delimited logs", () => {
    const log = "INFO | task finished | id=42\n".repeat(100);
    expect(findMarkdownTables(log)).toEqual([]);
    const table = findMarkdownTables(log + "\n| Name |\n---\n| First |\n| Last |")[0];
    expect(table.rows).toEqual(["| Name |", "| First |", "| Last |"]);
    expect(rowAtOffset(table, table.rowStarts[2] - 1)).toBe(1);
    expect(rowAtOffset(table, table.rowStarts[2])).toBe(2);
  });

  it("converts TSV including Excel-style quoted cells and preserves literal Markdown punctuation", () => {
    const markdown = readPastedTable('名称\t值\r\n"a|b"\t"多行\r\n**内容**"\r\n');
    const html = renderMarkdownContent(markdown);
    expect(html).toContain("<td>a|b</td>");
    expect(html).toContain("<td>多行\n**内容**</td>");
    expect(readPastedTable("first line\n\tindented")).toBe("");
  });
});
