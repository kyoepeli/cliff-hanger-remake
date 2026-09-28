/// Web Worker entry: runs the (potentially heavy) precalc search off the
/// main thread so the scene keeps animating while it works.
import { ensureRapierInit } from './physics.js';
import { runAttempt } from './search.js';
import { getScreen } from '../screens/index.js';
import type { PlayerInput, SearchResult } from './types.js';

export type WorkerRequest =
  | { kind: 'warmup'; id: number }
  | { kind: 'attempt'; id: number; screenId: string; input: PlayerInput; failedAttempts: number };

export type WorkerResponse =
  | { kind: 'ready'; id: number }
  | { kind: 'result'; id: number; result: SearchResult }
  | { kind: 'error'; id: number; message: string };

const ctx = self as unknown as {
  postMessage(m: WorkerResponse): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};

ctx.onmessage = async (e) => {
  const msg = e.data;
  try {
    await ensureRapierInit();
    if (msg.kind === 'warmup') {
      ctx.postMessage({ kind: 'ready', id: msg.id });
    } else {
      const result = runAttempt(getScreen(msg.screenId), msg.input, msg.failedAttempts);
      ctx.postMessage({ kind: 'result', id: msg.id, result });
    }
  } catch (err) {
    ctx.postMessage({ kind: 'error', id: msg.id, message: String(err) });
  }
};
