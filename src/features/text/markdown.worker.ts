import { renderMarkdownBlocks } from "./markdownRenderer";
type Request = { id: number; content: string; filePath?: string };
self.onmessage = (event: MessageEvent<Request>) => {
  const { id, content, filePath } = event.data;
  try { self.postMessage({ id, blocks: renderMarkdownBlocks(content, filePath) }); }
  catch (error) { self.postMessage({ id, error: String(error) }); }
};
