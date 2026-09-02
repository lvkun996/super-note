import MarkdownIt from "markdown-it";
import type { MarkdownRenderEnv } from "../../appTypes";

function isAbsoluteWindowsPath(filePath: string) {
  return /^[a-z]:[\\/]/i.test(filePath) || filePath.startsWith("\\\\");
}

function encodeFileUrlPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized
    .split("/")
    .map((part, index) => (index === 0 && /^[a-z]:$/i.test(part) ? part : encodeURIComponent(part)))
    .join("/");
}

function joinMarkdownAssetPath(baseDir: string, assetPath: string) {
  const parts = `${baseDir.replace(/\\/g, "/")}/${assetPath.replace(/\\/g, "/")}`.split("/");
  const normalized: string[] = [];
  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") {
      if (normalized.length > 1) normalized.pop();
      return;
    }
    normalized.push(part);
  });
  return normalized.join("/");
}

export function resolveMarkdownAssetUrl(src: string, filePath?: string) {
  const suffixStart = src.search(/[?#]/);
  const assetPath = suffixStart >= 0 ? src.slice(0, suffixStart) : src;
  const suffix = suffixStart >= 0 ? src.slice(suffixStart) : "";
  if (isAbsoluteWindowsPath(assetPath)) return `file:///${encodeFileUrlPath(assetPath)}${suffix}`;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(src) || src.startsWith("/")) return src;
  if (!assetPath) return src;
  if (!filePath) return src;

  const baseDir = filePath.replace(/[\\/][^\\/]*$/, "");
  if (!baseDir) return src;
  return `file:///${encodeFileUrlPath(joinMarkdownAssetPath(baseDir, assetPath))}${suffix}`;
}

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});
const defaultMarkdownLinkOpen = markdownRenderer.renderer.rules.link_open;
const defaultMarkdownImage = markdownRenderer.renderer.rules.image;

markdownRenderer.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet("target", "_blank");
  tokens[index].attrSet("rel", "noreferrer");
  return defaultMarkdownLinkOpen ? defaultMarkdownLinkOpen(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
};

markdownRenderer.renderer.rules.image = (tokens, index, options, env, self) => {
  const src = tokens[index].attrGet("src");
  if (src) {
    tokens[index].attrSet("src", resolveMarkdownAssetUrl(src, (env as MarkdownRenderEnv).filePath));
    tokens[index].attrSet("loading", "lazy");
  }
  return defaultMarkdownImage ? defaultMarkdownImage(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
};

export function renderMarkdownContent(content: string, filePath?: string) {
  return markdownRenderer.render(content || "", { filePath });
}
