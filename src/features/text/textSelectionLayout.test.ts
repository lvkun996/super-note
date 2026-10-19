import { describe, expect, it } from "vitest";
import { selectedTextRuns } from "./textSelectionLayout";

describe("selection painting without newline blocks", () => {
  it("omits empty and whitespace-only lines while preserving actual offsets", () => {
    const content = "alpha\n\n \t\n中文 beta\n\nend";
    expect(selectedTextRuns(content, { start: 0, end: content.length }).map(run => content.slice(run.start, run.end))).toEqual(["alpha", "中文 beta", "end"]);
    expect(content.slice(0, content.length)).toContain("\n\n \t\n");
  });
  it("keeps partial selections and spaces within text intact", () => {
    const content = "hello world\nnext";
    expect(selectedTextRuns(content, { start: 2, end: 14 })).toEqual([{ start: 2, end: 11 }, { start: 12, end: 14 }]);
  });
  it("does not paint a newline-only or collapsed selection", () => {
    expect(selectedTextRuns("a\n\nb", { start: 1, end: 3 })).toEqual([]);
    expect(selectedTextRuns("a\n\nb", { start: 1, end: 1 })).toEqual([]);
  });
});
