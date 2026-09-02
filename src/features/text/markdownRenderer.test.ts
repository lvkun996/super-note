import { describe, expect, it } from "vitest";
import { renderMarkdownContent, resolveMarkdownAssetUrl } from "./markdownRenderer";

describe("markdown renderer", () => {
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
