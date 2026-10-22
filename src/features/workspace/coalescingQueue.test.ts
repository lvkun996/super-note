import { describe, expect, it } from "vitest";
import { createCoalescingQueue } from "./coalescingQueue";
describe("latest workspace snapshot queue", () => {
  it("keeps the running snapshot and the latest pending snapshot, waiting for durable completion", async () => {
    const submit = createCoalescingQueue<number>();
    const calls: number[] = [];
    let complete!: () => void;
    const gate = new Promise<void>(resolve => { complete = resolve; });
    const first = submit(async () => { calls.push(1); await gate; return 1; });
    const second = submit(async () => { calls.push(2); return 2; });
    const third = submit(async () => { calls.push(3); return 3; });
    let flushed = false;
    const flush = submit(async () => { calls.push(4); flushed = true; return 4; });
    expect(flushed).toBe(false); complete();
    expect(await Promise.all([first, second, third, flush])).toEqual([1, 4, 4, 4]);
    expect(calls).toEqual([1, 4]); expect(flushed).toBe(true);
  });
  it("does not let a failed write block a newer save", async () => {
    const submit = createCoalescingQueue<boolean>();
    const failure = submit(async () => { throw new Error("disk failure"); });
    const newer = submit(async () => true);
    await expect(failure).rejects.toThrow("disk failure");
    expect(await newer).toBe(true);
  });
});
