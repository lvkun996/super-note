import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ workers: [] as Array<{ onmessage: ((event: { data: unknown }) => void) | null; onerror: ((event: { message: string }) => void) | null; messages: unknown[]; terminated: boolean }> }));
vi.mock("./markdown.worker?worker&inline", () => ({ default: class {
  onmessage = null; onerror = null; messages: unknown[] = []; terminated = false;
  constructor() { state.workers.push(this); }
  postMessage(value: unknown) { this.messages.push(value); }
  terminate() { this.terminated = true; }
} }));
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.resetModules(); state.workers.length = 0; });
describe("bounded Markdown worker scheduling", () => {
  it("retains only the newest pending revision and releases an idle worker", async () => {
    vi.useFakeTimers();
    const client = await import("./markdownWorkerClient");
    const first = client.renderMarkdownInWorker("pane", "old");
    const obsolete = client.renderMarkdownInWorker("pane", "obsolete");
    const latest = client.renderMarkdownInWorker("pane", "latest");
    expect(await obsolete).toBeNull();
    const worker = state.workers[0]; expect(worker.messages).toHaveLength(1);
    const oldId = (worker.messages[0] as { id: number }).id;
    worker.onmessage?.({ data: { id: oldId, blocks: ["old html"] } });
    expect(await first).toEqual(["old html"]); expect(worker.messages).toHaveLength(2);
    const request = worker.messages[1] as { id: number; content: string };
    expect(request.content).toBe("latest");
    worker.onmessage?.({ data: { id: request.id, blocks: ["latest html"] } });
    expect(await latest).toEqual(["latest html"]);
    vi.advanceTimersByTime(30000); expect(worker.terminated).toBe(true);
  });
  it("cancels queued panes without cancelling another pane's task", async () => {
    vi.useFakeTimers();
    const client = await import("./markdownWorkerClient");
    const active = client.renderMarkdownInWorker("a", "one");
    const cancelled = client.renderMarkdownInWorker("b", "two");
    client.cancelMarkdownRender("b"); expect(await cancelled).toBeNull();
    const worker = state.workers[0], request = worker.messages[0] as { id: number };
    worker.onmessage?.({ data: { id: request.id, blocks: ["one"] } });
    expect(await active).toEqual(["one"]); expect(worker.messages).toHaveLength(1);
  });
  it("rejects running and pending work on failure and does not repeatedly restart a broken worker", async () => {
    vi.useFakeTimers();
    const client = await import("./markdownWorkerClient");
    const first = client.renderMarkdownInWorker("a", "one");
    const next = client.renderMarkdownInWorker("b", "two");
    const failed = Promise.allSettled([first, next]);
    state.workers[0].onerror?.({ message: "worker failed" });
    expect((await failed).map(result => result.status)).toEqual(["rejected", "rejected"]);
    await expect(client.renderMarkdownInWorker("a", "three")).rejects.toThrow("unavailable");
    expect(state.workers).toHaveLength(1);
  });
});
