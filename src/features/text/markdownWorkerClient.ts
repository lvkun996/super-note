import MarkdownWorker from "./markdown.worker?worker&inline";
type Task = { id: number; key: string; content: string; filePath?: string; resolve: (blocks: string[] | null) => void; reject: (error: Error) => void };
let worker: Worker | null = null, running: Task | null = null, sequence = 0;
let unavailable = false, idleTimer: ReturnType<typeof setTimeout> | undefined;
const queued = new Map<string, Task>();

function dispatch() {
  if (running) return;
  if (!queued.size) {
    if (worker && !idleTimer) idleTimer = setTimeout(() => { worker?.terminate(); worker = null; idleTimer = undefined; }, 30000);
    return;
  }
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = undefined; }
  if (unavailable) throw new Error("Markdown worker is unavailable");
  if (!worker) {
    try { worker = new MarkdownWorker(); }
    catch (error) { unavailable = true; throw error; }
    worker.onmessage = event => {
      const task = running;
      if (!task || event.data.id !== task.id) return;
      running = null;
      if (event.data.error) task.reject(new Error(event.data.error));
      else task.resolve(event.data.blocks);
      dispatch();
    };
    worker.onerror = event => {
      const error = new Error(event.message || "Markdown worker failed");
      running?.reject(error); running = null;
      for (const task of queued.values()) task.reject(error);
      queued.clear(); worker?.terminate(); worker = null; unavailable = true;
    };
  }
  const task = queued.values().next().value as Task;
  queued.delete(task.key); running = task;
  try { worker.postMessage({ id: task.id, content: task.content, filePath: task.filePath }); }
  catch (error) { running = null; task.reject(error instanceof Error ? error : new Error(String(error))); dispatch(); }
}

export function renderMarkdownInWorker(key: string, content: string, filePath?: string) {
  return new Promise<string[] | null>((resolve, reject) => {
    // At most one pending revision per pane; obsolete revisions never queue up.
    queued.get(key)?.resolve(null);
    queued.set(key, { id: ++sequence, key, content, filePath, resolve, reject });
    try { dispatch(); } catch (error) { queued.delete(key); reject(error); }
  });
}

export function cancelMarkdownRender(key: string) {
  queued.get(key)?.resolve(null); queued.delete(key);
}
