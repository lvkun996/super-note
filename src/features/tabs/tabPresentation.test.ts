import { describe, expect, it } from "vitest";
import type { FileTab } from "../../appTypes";
import { createTabPresentationCache } from "./tabPresentation";
const tab = (id: string): FileTab => ({ id, kind: "file", title: "named", fileName: "file.txt", content: "text", themeIndex: 0, dirty: true });
describe("stable tab presentation", () => {
  it("does not invalidate navigation for body edits with the same presentation", () => {
    const get = createTabPresentationCache(), a = tab("a"), b = tab("b");
    const before = get([a, b]);
    expect(get([{ ...a, content: "different body" }, b])).toBe(before);
    const renamed = get([{ ...a, title: "renamed" }, b]);
    expect(renamed).not.toBe(before); expect(renamed[1]).toBe(before[1]);
    expect(get([b, { ...a, title: "renamed" }]).map(row => row.id)).toEqual(["b", "a"]);
    expect(get([b])).toHaveLength(1);
  });
  it("updates dirty state and content-derived titles", () => {
    const get = createTabPresentationCache(), original = { ...tab("a"), title: "未命名文本" };
    const first = get([original]);
    expect(get([{ ...original, content: "changed" }])[0].title).not.toBe(first[0].title);
    expect(get([{ ...original, dirty: false }])[0].dirty).toBe(false);
  });
});
