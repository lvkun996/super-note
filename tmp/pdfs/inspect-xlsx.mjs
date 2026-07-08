import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const outputDir = process.argv[3] ?? ".";

if (!inputPath) {
  throw new Error("Usage: node inspect-xlsx.mjs <input.xlsx> [outputDir]");
}

await fs.mkdir(outputDir, { recursive: true });

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,drawing",
  maxChars: 12000,
  tableMaxRows: 4,
  tableMaxCols: 6,
  tableMaxCellChars: 80,
});

await fs.writeFile(path.join(outputDir, "inspect-summary.ndjson"), summary.ndjson, "utf8");
console.log(summary.ndjson);

const sheets = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 4000,
});

const sheetNames = [];
for (const line of sheets.ndjson.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  if (record.name) sheetNames.push(record.name);
}

console.log(JSON.stringify({ sheetNames }, null, 2));

for (const sheetName of sheetNames) {
  const safeName = sheetName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80);
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, `${safeName}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}
