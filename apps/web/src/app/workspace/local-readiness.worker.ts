import { installLocalWorkerRuntime, type WorkerRuntimeScope } from '@fileflow/local-processing';

installLocalWorkerRuntime(self as unknown as WorkerRuntimeScope, {
  readiness: async ({ input, signal, reportProgress }) => {
    reportProgress(25, 'Starting worker');
    await Promise.resolve();
    if (signal.aborted) throw new Error('Cancelled');
    reportProgress(75, 'Checking transferable memory');
    await Promise.resolve();
    reportProgress(100, 'Ready');
    return { output: input, metadata: { ready: true } };
  },
});
