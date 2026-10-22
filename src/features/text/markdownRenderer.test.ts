import { describe, expect, it } from "vitest";
import { renderMarkdownContent, renderMarkdownBlocks, resolveMarkdownAssetUrl } from "./markdownRenderer";

describe("markdown renderer", () => {
  it.each([
    "# 标题\n\n段落 **bold**\n\n第二段🙂",
    "- first\n  - nested\n- second\n\n> quote\n>\n> another paragraph",
    "1. first\n\n   indented paragraph\n\n2. second",
    "| a | b |\n| - | - |\n| 1 | 2 |\n\n---\n\n```js\nx()\n```",
    "[reference][id]\n\n[id]: https://example.com\n\n![image](images/a.png)",
    "<script>alert(1)</script>\n\nhttps://example.com\n\nline  \nbreak",
    "", "[id]: https://example.com",
  ])("block rendering preserves canonical HTML for %j", content => {
    expect(renderMarkdownBlocks(content, "D:/notes/doc.md").join("")).toBe(renderMarkdownContent(content, "D:/notes/doc.md"));
  });
  it("resolves local images relative to the markdown file", () => {
    expect(resolveMarkdownAssetUrl("images/a b.png", "D:\\Notes\\doc.md")).toBe("file:///D:/Notes/images/a%20b.png");
    expect(resolveMarkdownAssetUrl("C:\\Images\\cover.png")).toBe("file:///C:/Images/cover.png");
  });

  it("leaves remote assets unchanged and hardens rendered links", () => {
    expect(resolveMarkdownAssetUrl("https://example.com/image.png", "D:\\Notes\\doc.md")).toBe("https://example.com/image.png");
    const html = renderMarkdownContent("[OpenAI](https://openai.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });
});
