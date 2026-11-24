import { Input, InputNumber, Modal } from "antd";
import { useState } from "react";
import { uiText } from "../../../electron/uiLanguage";
import { formatMarkdownRow, formatMarkdownTable, readMarkdownRow, type MarkdownTable } from "./markdownTables";

const MAX_NEW_ROWS = 25;
const MAX_NEW_COLUMNS = 20;

export function TextTableDialog({ table, onCancel, onSave }: {
  table?: MarkdownTable;
  onCancel: () => void;
  onSave: (source: string) => void;
}) {
  const [rowCount, setRowCount] = useState(table?.rows.length ?? 3);
  const [columnCount, setColumnCount] = useState(table?.columns ?? 3);
  const [initial] = useState(() => table?.rows.map(readMarkdownRow) ?? []);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const valueAt = (row: number, column: number) => edits[`${row}:${column}`] ?? initial[row]?.[column] ?? "";

  const save = () => {
    const rows = Array.from({ length: rowCount }, (_, row) =>
      Array.from({ length: columnCount }, (_, col) => valueAt(row, col).replace(/(?<!\\)\|/g, "\\|")));
    if (!table) {
      onSave(formatMarkdownTable(rows));
      return;
    }
    const lines = rows.map((cells, row) => cells.every((cell, column) => cell === (initial[row][column] ?? ""))
      ? table.rows[row]
      : formatMarkdownRow([...cells, ...initial[row].slice(columnCount)]));
    onSave([lines[0], table.separator, ...lines.slice(1)].join("\n"));
  };

  return (
    <Modal
      open
      centered
      className="text-table-dialog"
      width={620}
      title={uiText(table ? "编辑表格" : "新建表格")}
      okText={uiText(table ? "保存" : "插入")}
      cancelText={uiText("取消")}
      onOk={save}
      onCancel={onCancel}
    >
      {!table && (
        <div className="text-table-dimensions">
          <label>
            {uiText("行数（含表头）")}
            <InputNumber min={1} max={MAX_NEW_ROWS} precision={0} value={rowCount}
              onChange={(value) => { if (value !== null && value >= 1 && value <= MAX_NEW_ROWS) setRowCount(value); }} />
          </label>
          <label>
            {uiText("列数")}
            <InputNumber min={1} max={MAX_NEW_COLUMNS} precision={0} value={columnCount}
              onChange={(value) => { if (value !== null && value >= 1 && value <= MAX_NEW_COLUMNS) setColumnCount(value); }} />
          </label>
        </div>
      )}
      <div className="text-table-grid-scroll">
        <table className="text-table-grid">
          <tbody>
            {Array.from({ length: rowCount }, (_, row) => (
              <tr key={row} className={row === 0 ? "text-table-grid-header" : undefined}>
                {Array.from({ length: columnCount }, (_, column) => (
                  <td key={column}>
                    <Input
                      aria-label={row === 0 ? uiText("表头第 {0} 列", [column + 1]) : uiText("第 {0} 行，第 {1} 列", [row + 1, column + 1])}
                      value={valueAt(row, column)}
                      spellCheck={false}
                      onChange={(event) => {
                        const value = event.target.value;
                        setEdits((current) => ({ ...current, [`${row}:${column}`]: value }));
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
