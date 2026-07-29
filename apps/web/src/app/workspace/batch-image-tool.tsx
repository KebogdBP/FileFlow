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
import type { FileFlowLanguage } from '../use-fileflow-language';
import { recordCompletedOperations } from '../visitor-counter';

const batchCopy = {
  en: {
    badge: 'LOCAL BATCH',
    title: 'Optimize images together',
    lead: 'One shared plan, processed one at a time to keep browser memory bounded.',
    complete: 'complete',
    quality: 'Quality',
    dimension: 'Maximum dimension',
    original: 'Keep original dimensions',
    running: 'Batch processing locally',
    ready: 'Ready · source files never leave this device',
    queued: 'Queued',
    download: 'Download',
    actions: ['Cancel batch', 'Run batch again', 'Process batch locally'],
    result: 'Results are validated individually before download.',
  },
  ru: {
    badge: 'ЛОКАЛЬНЫЙ ПАКЕТ',
    title: 'Оптимизировать изображения вместе',
    lead: 'Один общий план, обработка по очереди для экономии памяти браузера.',
    complete: 'готово',
    quality: 'Качество',
    dimension: 'Максимальный размер',
    original: 'Сохранить исходные размеры',
    running: 'Локальная пакетная обработка',
    ready: 'Готово · исходные файлы остаются на устройстве',
    queued: 'В очереди',
    download: 'Скачать',
    actions: ['Отменить пакет', 'Запустить пакет снова', 'Обработать пакет локально'],
    result: 'Каждый результат проверяется отдельно перед скачиванием.',
  },
  es: {
    badge: 'LOTE LOCAL',
    title: 'Optimizar imágenes juntas',
    lead: 'Un plan común, procesado uno por uno para limitar la memoria del navegador.',
    complete: 'completado',
    quality: 'Calidad',
    dimension: 'Dimensión máxima',
    original: 'Conservar dimensiones originales',
    running: 'Procesamiento local por lotes',
    ready: 'Listo · los archivos originales permanecen en el dispositivo',
    queued: 'En cola',
    download: 'Descargar',
    actions: ['Cancelar lote', 'Ejecutar lote de nuevo', 'Procesar lote localmente'],
    result: 'Cada resultado se verifica por separado antes de descargarlo.',
  },
} as const;

type BatchImage = { file: File; sourceMime: 'image/jpeg' | 'image/png' };
type ItemState = BatchImage & {
  status: BatchItemStatus;
  progress: number;
  stage: string;
  result?: { url: string; size: number };
  error?: string;
};

export function BatchImageTool({
  images,
  language = 'en',
}: {
  images: readonly BatchImage[];
  language?: FileFlowLanguage;
}) {
  const text = batchCopy[language];
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
        void recordCompletedOperations();
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
          <Badge variant="local">{text.badge}</Badge>
          <h3 id="batch-title">
            {images.length} ·{' '}
            {language === 'en' ? `Optimize ${images.length} images together` : text.title}
          </h3>
          <p>{text.lead}</p>
        </div>
        <strong>
          {running ? `${progress}%` : `${completed}/${images.length} ${text.complete}`}
        </strong>
      </div>
      <div className="image-tool-controls">
        <Slider
          id="batch-quality"
          label={text.quality}
          min={40}
          max={100}
          value={quality}
          valueLabel={`${quality}%`}
          disabled={running}
          onChange={(event) => setQuality(Number(event.target.value))}
        />
        <Select
          id="batch-size"
          label={text.dimension}
          value={maxDimension}
          disabled={running}
          onChange={(event) => setMaxDimension(Number(event.target.value))}
        >
          <option value={0}>{text.original}</option>
          <option value={1920}>1920 px</option>
          <option value={1280}>1280 px</option>
          <option value={800}>800 px</option>
        </Select>
      </div>
      <div className="batch-progress" aria-live="polite">
        <span>
          <span style={{ width: `${progress}%` }} />
        </span>
        <small>{running ? text.running : text.ready}</small>
      </div>
      <ol className="batch-list">
        {items.map((item, index) => (
          <li key={`${item.file.name}-${index}`} data-status={item.status}>
            <span className="batch-index">{index + 1}</span>
            <div>
              <strong>{item.file.name}</strong>
              <small>
                {formatFileSize(item.file.size)} · {item.stage || text.queued}
              </small>
            </div>
            {item.result ? (
              <a href={item.result.url} download={webPFileName(item.file.name)}>
                {text.download} · {formatFileSize(item.result.size)}
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
          {running ? text.actions[0] : completed ? text.actions[1] : text.actions[2]}
        </Button>
        <span>{text.result}</span>
      </div>
    </section>
  );
}

function initialItems(images: readonly BatchImage[]): ItemState[] {
  return images.map((image) => ({ ...image, status: 'queued', progress: 0, stage: '' }));
}
