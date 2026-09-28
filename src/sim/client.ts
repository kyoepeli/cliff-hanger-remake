import type { PlayerInput, SearchResult } from './types.js';
import type { WorkerRequest, WorkerResponse } from './worker.js';

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

/** Main-thread handle to the sim worker. */
export class SimClient {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: WorkerResponse) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.kind === 'error') p.reject(new Error(e.data.message));
      else p.resolve(e.data);
    };
  }

  private send(req: DistributiveOmit<WorkerRequest, 'id'>): Promise<WorkerResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...req, id });
    });
  }

  /** Load the physics WASM in the worker ahead of the first attempt. */
  async warmup(): Promise<void> {
    await this.send({ kind: 'warmup' });
  }

  async runAttempt(screenId: string, input: PlayerInput, failedAttempts: number): Promise<SearchResult> {
    const res = await this.send({ kind: 'attempt', screenId, input, failedAttempts });
    if (res.kind !== 'result') throw new Error('Unexpected worker response');
    return res.result;
  }
}
