export type LocalJobErrorCode =
  | 'unsupported'
  | 'memory_limit'
  | 'busy'
  | 'cancelled'
  | 'timeout'
  | 'worker_error'
  | 'invalid_response';

export class LocalJobError extends Error {
  constructor(
    public readonly code: LocalJobErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LocalJobError';
  }
}

export type LocalJobOptions = Readonly<Record<string, string | number | boolean>>;

export type LocalJobRequest = {
  id: string;
  operationId: string;
  input: ArrayBuffer;
  options?: LocalJobOptions;
};

export type LocalJobResult = {
  jobId: string;
  output: ArrayBuffer;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type LocalJobProgress = {
  jobId: string;
  progress: number;
  stage: string;
};

export type LocalJobHandle = {
  promise: Promise<LocalJobResult>;
  cancel: () => void;
};

export type LocalCapability = {
  supported: boolean;
  maxInputBytes: number;
  reason?: string;
};

export type CapabilityEnvironment = {
  hasWorker: boolean;
  hasArrayBuffer: boolean;
  deviceMemoryGb?: number;
};

export function getLocalProcessingCapability(
  environment: CapabilityEnvironment = browserEnvironment(),
): LocalCapability {
  if (!environment.hasWorker || !environment.hasArrayBuffer) {
    return {
      supported: false,
      maxInputBytes: 0,
      reason:
        'This browser does not provide the worker features required for safe local processing.',
    };
  }

  const memory = environment.deviceMemoryGb;
  const maxInputBytes =
    memory !== undefined && memory <= 2
      ? 64 * 1024 * 1024
      : memory !== undefined && memory <= 4
        ? 128 * 1024 * 1024
        : 256 * 1024 * 1024;
  return { supported: true, maxInputBytes };
}

function browserEnvironment(): CapabilityEnvironment {
  const memory =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    hasWorker: typeof Worker !== 'undefined',
    hasArrayBuffer: typeof ArrayBuffer !== 'undefined',
    deviceMemoryGb: memory,
  };
}

type WorkerStartMessage = {
  type: 'start';
  jobId: string;
  operationId: string;
  input: ArrayBuffer;
  options: LocalJobOptions;
};

type WorkerCancelMessage = { type: 'cancel'; jobId: string };

export type LocalWorkerRequest = WorkerStartMessage | WorkerCancelMessage;

export type LocalWorkerResponse =
  | { type: 'progress'; jobId: string; progress: number; stage: string }
  | {
      type: 'result';
      jobId: string;
      output: ArrayBuffer;
      metadata?: Readonly<Record<string, string | number | boolean>>;
    }
  | { type: 'error'; jobId: string; message: string };

export type WorkerTransport = {
  postMessage: (message: LocalWorkerRequest, transfer?: Transferable[]) => void;
  addEventListener: (
    type: 'message' | 'error',
    listener: EventListenerOrEventListenerObject,
  ) => void;
  removeEventListener: (
    type: 'message' | 'error',
    listener: EventListenerOrEventListenerObject,
  ) => void;
  terminate: () => void;
};

export type LocalJobRunnerOptions = {
  createWorker: () => WorkerTransport;
  capability?: LocalCapability;
  timeoutMs?: number;
};

export class LocalJobRunner {
  private active = false;
  private readonly capability: LocalCapability;
  private readonly timeoutMs: number;

  constructor(private readonly options: LocalJobRunnerOptions) {
    this.capability = options.capability ?? getLocalProcessingCapability();
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  run(request: LocalJobRequest, onProgress?: (progress: LocalJobProgress) => void): LocalJobHandle {
    if (!this.capability.supported) {
      return rejectedHandle(
        new LocalJobError(
          'unsupported',
          this.capability.reason ?? 'Local processing is unavailable.',
        ),
      );
    }
    if (request.input.byteLength > this.capability.maxInputBytes) {
      return rejectedHandle(
        new LocalJobError(
          'memory_limit',
          'This file is too large for reliable processing on this device.',
        ),
      );
    }
    if (this.active) {
      return rejectedHandle(
        new LocalJobError('busy', 'Finish or cancel the current local job first.'),
      );
    }

    this.active = true;
    const worker = this.options.createWorker();
    let settled = false;
    let lastProgress = 0;
    let rejectPromise: (reason: LocalJobError) => void = () => undefined;
    let onMessage: EventListener = () => undefined;
    let onWorkerError: EventListener = () => undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onWorkerError);
      worker.terminate();
      this.active = false;
    };

    const finishError = (error: LocalJobError) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(error);
    };

    const promise = new Promise<LocalJobResult>((resolve, reject) => {
      rejectPromise = reject;
      const finishResult = (result: LocalJobResult) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };

      const handleResponse = (response: LocalWorkerResponse) => {
        if (response.jobId !== request.id) return;
        if (response.type === 'progress') {
          const progress = Math.min(100, Math.max(lastProgress, response.progress));
          lastProgress = progress;
          onProgress?.({ jobId: request.id, progress, stage: response.stage });
          return;
        }
        if (response.type === 'error') {
          finishError(new LocalJobError('worker_error', response.message));
          return;
        }
        if (!(response.output instanceof ArrayBuffer)) {
          finishError(
            new LocalJobError('invalid_response', 'The local worker returned an invalid result.'),
          );
          return;
        }
        finishResult({ jobId: request.id, output: response.output, metadata: response.metadata });
      };

      onMessage = (event: Event) =>
        handleResponse((event as MessageEvent<LocalWorkerResponse>).data);
      onWorkerError = () =>
        finishError(new LocalJobError('worker_error', 'The local worker stopped unexpectedly.'));
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onWorkerError);
      worker.postMessage(
        {
          type: 'start',
          jobId: request.id,
          operationId: request.operationId,
          input: request.input,
          options: request.options ?? {},
        },
        [request.input],
      );
    });

    if (!settled) {
      timeout = setTimeout(
        () =>
          finishError(
            new LocalJobError('timeout', 'The local operation took too long and was stopped.'),
          ),
        this.timeoutMs,
      );
    }

    return {
      promise,
      cancel: () => {
        if (settled) return;
        worker.postMessage({ type: 'cancel', jobId: request.id });
        finishError(new LocalJobError('cancelled', 'The local operation was cancelled.'));
      },
    };
  }
}

function rejectedHandle(error: LocalJobError): LocalJobHandle {
  return { promise: Promise.reject(error), cancel: () => undefined };
}

export type LocalOperationContext = {
  input: ArrayBuffer;
  options: LocalJobOptions;
  signal: AbortSignal;
  reportProgress: (progress: number, stage: string) => void;
};

export type LocalOperationOutput = {
  output: ArrayBuffer;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type LocalOperationHandler = (
  context: LocalOperationContext,
) => Promise<LocalOperationOutput>;

export type WorkerRuntimeScope = {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<LocalWorkerRequest>) => void,
  ) => void;
  postMessage: (message: LocalWorkerResponse, transfer?: Transferable[]) => void;
};

export function installLocalWorkerRuntime(
  scope: WorkerRuntimeScope,
  handlers: Readonly<Record<string, LocalOperationHandler>>,
) {
  const controllers = new Map<string, AbortController>();

  scope.addEventListener('message', (event) => {
    const request = event.data;
    if (request.type === 'cancel') {
      controllers.get(request.jobId)?.abort();
      return;
    }

    const handler = handlers[request.operationId];
    if (!handler) {
      scope.postMessage({
        type: 'error',
        jobId: request.jobId,
        message: `Unknown local operation: ${request.operationId}`,
      });
      return;
    }

    const controller = new AbortController();
    controllers.set(request.jobId, controller);
    const reportProgress = (progress: number, stage: string) => {
      if (controller.signal.aborted) return;
      scope.postMessage({
        type: 'progress',
        jobId: request.jobId,
        progress: Math.min(100, Math.max(0, progress)),
        stage,
      });
    };

    void handler({
      input: request.input,
      options: request.options,
      signal: controller.signal,
      reportProgress,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        scope.postMessage(
          {
            type: 'result',
            jobId: request.jobId,
            output: result.output,
            metadata: result.metadata,
          },
          [result.output],
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        scope.postMessage({
          type: 'error',
          jobId: request.jobId,
          message: error instanceof Error ? error.message : 'The local operation failed.',
        });
      })
      .finally(() => controllers.delete(request.jobId));
  });
}
