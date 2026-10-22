// Keep one in-flight write and only the newest pending snapshot. All callers
// awaiting replaced pending snapshots wait for the snapshot that superseded it.
export function createCoalescingQueue<T>() {
  type Job = { run: () => Promise<T>; waiters: Array<{ resolve: (value: T) => void; reject: (error: unknown) => void }> };
  let running = false, pending: Job | undefined;
  async function drain() {
    running = true;
    while (pending) {
      const job = pending; pending = undefined;
      try { const value = await job.run(); for (const waiter of job.waiters) waiter.resolve(value); }
      catch (error) { for (const waiter of job.waiters) waiter.reject(error); }
    }
    running = false;
  }
  return (run: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    if (pending) { pending.run = run; pending.waiters.push({ resolve, reject }); }
    else pending = { run, waiters: [{ resolve, reject }] };
    if (!running) void drain();
  });
}
