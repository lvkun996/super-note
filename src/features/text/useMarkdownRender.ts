import { useEffect, useId, useState } from "react";

export function useMarkdownRender(enabled: boolean, tabId: string, content: string, filePath?: string) {
  const clientKey = useId();
  const [result, setResult] = useState<{ tabId: string; content: string; filePath?: string; blocks: string[] } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      return;
    }

    let active = true;
    let cancel: (() => void) | undefined;
    const timer = window.setTimeout(async () => {
      const client = await import("./markdownWorkerClient");
      if (!active) return;
      cancel = () => client.cancelMarkdownRender(clientKey);
      let blocks: string[] | null;
      try {
        blocks = await client.renderMarkdownInWorker(clientKey, content, filePath);
      } catch {
        if (!active) return;
        const { renderMarkdownBlocks } = await import("./markdownRenderer");
        if (!active) return;
        blocks = renderMarkdownBlocks(content, filePath);
      }
      if (active && blocks !== null) setResult({ tabId, content, filePath, blocks });
    }, result?.tabId === tabId ? 120 : 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
      cancel?.();
    };
  }, [enabled, tabId, content, filePath, clientKey]);

  return enabled && result?.tabId === tabId && result.filePath === filePath ? result : null;
}
