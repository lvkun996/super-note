import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { getUiLanguage, setUiLanguage, uiText } from "./uiLanguage";
import { englishMessages } from "./uiMessages";

afterEach(() => setUiLanguage("zh-CN"));

describe("interface language", () => {
  it("switches authored text without translating interpolated document names", () => {
    setUiLanguage("en-US");
    expect(getUiLanguage()).toBe("en-US");
    expect(uiText("置顶")).toBe("Pinned");
    expect(uiText("关闭 {0}", ["我的笔记"]).includes("我的笔记")).toBe(true);
    setUiLanguage("zh-CN");
    expect(uiText("置顶")).toBe("置顶");
  });

  it("has English translations for every static uiText key and preserves placeholders", () => {
    const missing: string[] = [];
    const inspect = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) { inspect(file); continue; }
        if (!/\.tsx?$/.test(file) || file.endsWith(".test.ts")) continue;
        const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
          if (ts.isCallExpression(node) && node.expression.getText(source) === "uiText" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
            const key = node.arguments[0].text;
            if (!englishMessages[key]) missing.push(`${file}: ${key}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    };
    inspect("src");
    inspect("electron");
    expect(missing).toEqual([]);
    for (const [key, value] of Object.entries(englishMessages)) {
      expect(value.match(/\{\d+\}/g)?.sort() ?? [], key).toEqual(key.match(/\{\d+\}/g)?.sort() ?? []);
    }
  });
});
