export const MAX_BATCH_FILES = 20;

export type BatchItemStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type BatchProgressItem = {
  status: BatchItemStatus;
  progress: number;
};

export function batchOverallProgress(items: readonly BatchProgressItem[]): number {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => {
    if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
      return sum + 100;
    }
    return sum + Math.min(100, Math.max(0, item.progress));
  }, 0);
  return Math.round(total / items.length);
}

export function validateBatchCount(files: readonly File[]): string | undefined {
  if (files.length < 2) return 'Choose at least two files for a batch.';
  if (files.length > MAX_BATCH_FILES) {
    return `A batch can contain up to ${MAX_BATCH_FILES} files.`;
  }
}
