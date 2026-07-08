/**
 * Background job abstraction. The MVP runs jobs synchronously in-process
 * (awaited immediately) — good enough for single-instance deployments and
 * keeps the UX simple (the caller can show a spinner and get a definitive
 * result). The interface is intentionally queue-shaped so swapping in
 * BullMQ + Redis later only means implementing RedisJobQueue here; no
 * calling code (extraction pipeline, PDF generation) needs to change.
 */
export interface JobQueue {
  enqueue<T>(jobName: string, fn: () => Promise<T>): Promise<T>;
}

class InProcessJobQueue implements JobQueue {
  async enqueue<T>(_jobName: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

let cached: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!cached) cached = new InProcessJobQueue();
  return cached;
}
