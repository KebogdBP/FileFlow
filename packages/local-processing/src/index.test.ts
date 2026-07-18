import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getLocalProcessingCapability,
  installLocalWorkerRuntime,
  LocalJobError,
  LocalJobRunner,
  type LocalWorkerRequest,
  type LocalWorkerResponse,
  type WorkerTransport,
} from './index';

class FakeWorker implements WorkerTransport {
  messages: LocalWorkerRequest[] = [];
  terminated = false;
  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  postMessage(message: LocalWorkerRequest) {
    this.messages.push(message);
  }

  addEventListener(type: 'message' | 'error', listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: 'message' | 'error', listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener);
  }

  terminate() {
    this.terminated = true;
  }

  emit(response: LocalWorkerResponse) {
    this.dispatch('message', new MessageEvent('message', { data: response }));
  }

  fail() {
    this.dispatch('error', new Event('error'));
  }

  private dispatch(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  }
}

const capability = { supported: true, maxInputBytes: 1024 } as const;

afterEach(() => vi.useRealTimers());

describe('M08 capability and memory guards', () => {
  it('reports missing worker support without starting a job', async () => {
    expect(getLocalProcessingCapability({ hasWorker: false, hasArrayBuffer: true })).toMatchObject({
      supported: false,
      maxInputBytes: 0,
    });
  });

  it('uses conservative limits for low-memory devices', () => {
    expect(
      getLocalProcessingCapability({ hasWorker: true, hasArrayBuffer: true, deviceMemoryGb: 2 }),
    ).toMatchObject({ supported: true, maxInputBytes: 64 * 1024 * 1024 });
    expect(
      getLocalProcessingCapability({ hasWorker: true, hasArrayBuffer: true, deviceMemoryGb: 8 }),
    ).toMatchObject({ supported: true, maxInputBytes: 256 * 1024 * 1024 });
  });

  it('rejects oversized inputs before creating a worker', async () => {
    const createWorker = vi.fn(() => new FakeWorker());
    const runner = new LocalJobRunner({ createWorker, capability });
    const job = runner.run({ id: 'large', operationId: 'test', input: new ArrayBuffer(2048) });

    await expect(job.promise).rejects.toMatchObject({ code: 'memory_limit' });
    expect(createWorker).not.toHaveBeenCalled();
  });
});

describe('M08 local job lifecycle', () => {
  it('forwards monotonic progress and resolves a valid result', async () => {
    const worker = new FakeWorker();
    const progress: number[] = [];
    const runner = new LocalJobRunner({ createWorker: () => worker, capability });
    const job = runner.run(
      { id: 'job-1', operationId: 'test', input: new ArrayBuffer(8) },
      (update) => progress.push(update.progress),
    );

    worker.emit({ type: 'progress', jobId: 'job-1', progress: 45, stage: 'working' });
    worker.emit({ type: 'progress', jobId: 'job-1', progress: 20, stage: 'working' });
    worker.emit({ type: 'progress', jobId: 'job-1', progress: 140, stage: 'finishing' });
    worker.emit({ type: 'result', jobId: 'job-1', output: new ArrayBuffer(4) });

    await expect(job.promise).resolves.toMatchObject({ jobId: 'job-1' });
    expect(progress).toEqual([45, 45, 100]);
    expect(worker.terminated).toBe(true);
  });

  it('supports cancellation and releases the runner for another job', async () => {
    const workers = [new FakeWorker(), new FakeWorker()];
    const runner = new LocalJobRunner({ createWorker: () => workers.shift()!, capability });
    const first = runner.run({ id: 'first', operationId: 'test', input: new ArrayBuffer(2) });
    first.cancel();

    await expect(first.promise).rejects.toMatchObject({ code: 'cancelled' });
    const second = runner.run({ id: 'second', operationId: 'test', input: new ArrayBuffer(2) });
    expect(second.promise).toBeInstanceOf(Promise);
    second.cancel();
    await expect(second.promise).rejects.toBeInstanceOf(LocalJobError);
  });

  it('rejects concurrent jobs with a busy error', async () => {
    const worker = new FakeWorker();
    const runner = new LocalJobRunner({ createWorker: () => worker, capability });
    const first = runner.run({ id: 'first', operationId: 'test', input: new ArrayBuffer(2) });
    const second = runner.run({ id: 'second', operationId: 'test', input: new ArrayBuffer(2) });

    await expect(second.promise).rejects.toMatchObject({ code: 'busy' });
    first.cancel();
    await expect(first.promise).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('normalizes worker and timeout failures', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const runner = new LocalJobRunner({
      createWorker: () => worker,
      capability,
      timeoutMs: 50,
    });
    const timedOut = runner.run({ id: 'slow', operationId: 'test', input: new ArrayBuffer(2) });
    const timeoutExpectation = expect(timedOut.promise).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(51);
    await timeoutExpectation;

    const failedWorker = new FakeWorker();
    const secondRunner = new LocalJobRunner({ createWorker: () => failedWorker, capability });
    const failed = secondRunner.run({
      id: 'failed',
      operationId: 'test',
      input: new ArrayBuffer(2),
    });
    failedWorker.fail();
    await expect(failed.promise).rejects.toMatchObject({ code: 'worker_error' });
  });
});

describe('M08 worker runtime', () => {
  it('runs a registered operation and transfers its result', async () => {
    let listener: ((event: MessageEvent<LocalWorkerRequest>) => void) | undefined;
    const responses: LocalWorkerResponse[] = [];
    const scope = {
      addEventListener: (_type: 'message', next: typeof listener) => {
        listener = next;
      },
      postMessage: (message: LocalWorkerResponse) => responses.push(message),
    };
    installLocalWorkerRuntime(scope, {
      echo: async ({ input, reportProgress }) => {
        reportProgress(50, 'copying');
        return { output: input, metadata: { safe: true } };
      },
    });

    listener?.(
      new MessageEvent('message', {
        data: {
          type: 'start',
          jobId: 'runtime',
          operationId: 'echo',
          input: new ArrayBuffer(3),
          options: {},
        },
      }),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(responses).toMatchObject([
      { type: 'progress', jobId: 'runtime', progress: 50 },
      { type: 'result', jobId: 'runtime', metadata: { safe: true } },
    ]);
  });
});
