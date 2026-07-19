'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getLocalProcessingCapability,
  LocalJobRunner,
  type LocalJobHandle,
  type WorkerTransport,
} from '@fileflow/local-processing';
import { Badge, Button, Select, Slider } from '@fileflow/ui';
import { batchOverallProgress, type BatchItemStatus } from './batch-model';
import { validateWebPResult, webPFileName } from './image-result';
import { formatFileSize } from './input-policy';

type BatchImage = { file: File; sourceMime: 'image/jpeg' | 'image/png' };
type ItemState = BatchImage & {
  status: BatchItemStatus;
  progress: number;
  stage: string;
  result?: { url: string; size: number };
  error?: string;
};

export function BatchImageTool({ images }: { images: readonly BatchImage[] }) {
  const [quality, setQuality] = useState(82);
  const [maxDimension, setMaxDimension] = useState(0);
  const [items, setItems] = useState<ItemState[]>(() => initialItems(images));
  const [running, setRunning] = useState(false);
  const activeHandle = useRef<LocalJobHandle | null>(null);
  const cancelled = useRef(false);
  const resultUrls = useRef<string[]>([]);

  useEffect(() => {
    setItems(initialItems(images));
  }, [images]);

  useEffect(
    () => () => {
      cancelled.current = true;
      activeHandle.current?.cancel();
      resultUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function update(index: number, change: Partial<ItemState>) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...change } : item)),
    );
  }

  async function runBatch() {
    const capability = getLocalProcessingCapability();
    if (!capability.supported) {
      setItems((current) =>
        current.map((item) => ({ ...item, status: 'failed', error: capability.reason })),
      );
      return;
    }
    cancelled.current = false;
    setRunning(true);
    setItems(initialItems(images));
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      if (!image || cancelled.current) break;
      update(index, { status: 'running', progress: 0, stage: 'Reading source' });
      try {
        const input = await image.file.arrayBuffer();
        if (cancelled.current) break;
        const runner = new LocalJobRunner({
          capability,
          createWorker: () =>
            new Worker(new URL('./local-image.worker.ts', import.meta.url), {
              type: 'module',
            }) as WorkerTransport,
        });
        const job = runner.run(
          {
            id: `batch-image-${index}-${Date.now()}`,
            operationId: 'optimize-image',
            input,
            options: { sourceMime: image.sourceMime, quality: quality / 100, maxDimension },
          },
          ({ progress, stage }) => update(index, { progress, stage }),
        );
        activeHandle.current = job;
        const result = await job.promise;
        const validation = validateWebPResult(result.output);
        if (!validation.ok) throw new Error(validation.error);
        const url = URL.createObjectURL(new Blob([result.output], { type: 'image/webp' }));
        resultUrls.current.push(url);
        update(index, {
          status: 'completed',
          progress: 100,
          stage: 'Validated',
          result: { url, size: validation.size },
        });
      } catch (error) {
        update(index, {
          status: cancelled.current ? 'cancelled' : 'failed',
          progress: 100,
          stage: cancelled.current ? 'Cancelled' : 'Failed',
          error: error instanceof Error ? error.message : 'Image processing failed.',
        });
      } finally {
        activeHandle.current = null;
      }
    }
    if (cancelled.current) {
      setItems((current) =>
        current.map((item) =>
          item.status === 'queued' ? { ...item, status: 'cancelled', progress: 100 } : item,
        ),
      );
    }
    setRunning(false);
  }

  function cancelBatch() {
    cancelled.current = true;
    activeHandle.current?.cancel();
  }

  const progress = batchOverallProgress(items);
  const completed = items.filter((item) => item.status === 'completed').length;
  return (
    <section className="batch-workspace" aria-labelledby="batch-title">
      <div className="batch-heading">
        <div>
          <Badge variant="local">LOCAL BATCH</Badge>
          <h3 id="batch-title">Optimize {images.length} images together</h3>
          <p>One shared plan, processed one at a time to keep browser memory bounded.</p>
        </div>
        <strong>{running ? `${progress}%` : `${completed}/${images.length} complete`}</strong>
      </div>
      <div className="image-tool-controls">
        <Slider
          id="batch-quality"
          label="Quality"
          min={40}
          max={100}
          value={quality}
          valueLabel={`${quality}%`}
          disabled={running}
          onChange={(event) => setQuality(Number(event.target.value))}
        />
        <Select
          id="batch-size"
          label="Maximum dimension"
          value={maxDimension}
          disabled={running}
          onChange={(event) => setMaxDimension(Number(event.target.value))}
        >
          <option value={0}>Keep original dimensions</option>
          <option value={1920}>1920 px</option>
          <option value={1280}>1280 px</option>
          <option value={800}>800 px</option>
        </Select>
      </div>
      <div className="batch-progress" aria-live="polite">
        <span>
          <span style={{ width: `${progress}%` }} />
        </span>
        <small>
          {running ? 'Batch processing locally' : 'Ready · source files never leave this device'}
        </small>
      </div>
      <ol className="batch-list">
        {items.map((item, index) => (
          <li key={`${item.file.name}-${index}`} data-status={item.status}>
            <span className="batch-index">{index + 1}</span>
            <div>
              <strong>{item.file.name}</strong>
              <small>
                {formatFileSize(item.file.size)} · {item.stage || 'Queued'}
              </small>
            </div>
            {item.result ? (
              <a href={item.result.url} download={webPFileName(item.file.name)}>
                Download · {formatFileSize(item.result.size)}
              </a>
            ) : (
              <Badge
                variant={
                  item.status === 'failed'
                    ? 'warning'
                    : item.status === 'completed'
                      ? 'success'
                      : 'neutral'
                }
              >
                {item.status.toUpperCase()}
              </Badge>
            )}
            {item.error ? <p className="input-error">{item.error}</p> : null}
          </li>
        ))}
      </ol>
      <div className="batch-actions">
        <Button
          type="button"
          variant={running ? 'secondary' : 'primary'}
          onClick={running ? cancelBatch : () => void runBatch()}
        >
          {running ? 'Cancel batch' : completed ? 'Run batch again' : 'Process batch locally'}
        </Button>
        <span>Results are validated individually before download.</span>
      </div>
    </section>
  );
}

function initialItems(images: readonly BatchImage[]): ItemState[] {
  return images.map((image) => ({ ...image, status: 'queued', progress: 0, stage: '' }));
}
