'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  getLocalProcessingCapability,
  LocalJobRunner,
  type LocalJobHandle,
  type WorkerTransport,
} from '@fileflow/local-processing';
import { Badge, Button, Select, Slider } from '@fileflow/ui';
import { formatFileSize } from './input-policy';
import {
  metadataFreeJpegFileName,
  savingPercent,
  validateJpegResult,
  validateWebPResult,
  webPFileName,
} from './image-result';
import type { FileFlowLanguage } from '../use-fileflow-language';
import { recordCompletedOperations } from '../visitor-counter';

const localImageCopy = {
  en: {
    badge: 'LOCAL IMAGE TOOL',
    titles: ['Create a lighter WebP', 'Create a metadata-free WebP'],
    metadata: 'Re-encoding removes embedded metadata',
    quality: 'Quality',
    dimension: 'Maximum dimension',
    original: 'Keep original dimensions',
    cancel: 'Cancel',
    actions: ['Create WebP locally', 'Remove metadata locally'],
    source: 'Source',
    never: 'never uploaded',
    valid: 'VALID WEBP',
    saved: 'saved',
    download: 'Download WebP',
    unavailable: 'Local processing is unavailable.',
    tooLarge: 'This image is too large for reliable processing on this device.',
    reading: 'Reading source',
    failed: 'Image processing failed.',
  },
  ru: {
    badge: 'ЛОКАЛЬНЫЙ ИНСТРУМЕНТ',
    titles: ['Создать лёгкий WebP', 'Создать WebP без метаданных'],
    metadata: 'Повторное кодирование удаляет встроенные метаданные',
    quality: 'Качество',
    dimension: 'Максимальный размер',
    original: 'Сохранить исходные размеры',
    cancel: 'Отменить',
    actions: ['Создать WebP локально', 'Удалить метаданные локально'],
    source: 'Источник',
    never: 'не загружается',
    valid: 'ПРОВЕРЕННЫЙ WEBP',
    saved: 'экономии',
    download: 'Скачать WebP',
    unavailable: 'Локальная обработка недоступна.',
    tooLarge: 'Изображение слишком большое для надёжной обработки на этом устройстве.',
    reading: 'Чтение файла',
    failed: 'Не удалось обработать изображение.',
  },
  es: {
    badge: 'HERRAMIENTA LOCAL',
    titles: ['Crear un WebP más ligero', 'Crear un WebP sin metadatos'],
    metadata: 'La recodificación elimina los metadatos incrustados',
    quality: 'Calidad',
    dimension: 'Dimensión máxima',
    original: 'Conservar dimensiones originales',
    cancel: 'Cancelar',
    actions: ['Crear WebP localmente', 'Eliminar metadatos localmente'],
    source: 'Origen',
    never: 'nunca se carga',
    valid: 'WEBP VERIFICADO',
    saved: 'ahorrado',
    download: 'Descargar WebP',
    unavailable: 'El procesamiento local no está disponible.',
    tooLarge: 'La imagen es demasiado grande para procesarla de forma fiable.',
    reading: 'Leyendo archivo',
    failed: 'No se pudo procesar la imagen.',
  },
} as const;

const metadataResultCopy = {
  en: {
    title: 'Remove JPEG metadata',
    note: 'Embedded metadata is removed without changing JPEG quality',
    valid: 'VALID JPEG',
    download: 'Download JPEG',
  },
  ru: {
    title: 'Удалить метаданные JPEG',
    note: 'Метаданные удаляются без изменения качества JPEG',
    valid: 'ПРОВЕРЕННЫЙ JPEG',
    download: 'Скачать JPEG',
  },
  es: {
    title: 'Eliminar metadatos JPEG',
    note: 'Los metadatos se eliminan sin cambiar la calidad JPEG',
    valid: 'JPEG VERIFICADO',
    download: 'Descargar JPEG',
  },
} as const;

type ToolState =
  | { status: 'idle' }
  | { status: 'running'; progress: number; stage: string }
  | { status: 'completed'; url: string; size: number; width: number; height: number }
  | { status: 'error'; message: string };

export function LocalImageTool({
  file,
  sourceMime,
  operationId = 'optimize-image',
  language = 'en',
}: {
  file: File;
  sourceMime: string;
  operationId?: string;
  language?: FileFlowLanguage;
}) {
  const text = localImageCopy[language];
  const metadataOnlyJpeg = operationId === 'remove-image-metadata' && sourceMime === 'image/jpeg';
  const [quality, setQuality] = useState(82);
  const [maxDimension, setMaxDimension] = useState(0);
  const [state, setState] = useState<ToolState>({ status: 'idle' });
  const handle = useRef<LocalJobHandle | null>(null);
  const resultUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      handle.current?.cancel();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
  }, []);

  async function processImage() {
    const capability = getLocalProcessingCapability();
    if (!capability.supported) {
      setState({
        status: 'error',
        message: capability.reason ?? text.unavailable,
      });
      return;
    }
    if (file.size > capability.maxInputBytes) {
      setState({
        status: 'error',
        message: text.tooLarge,
      });
      return;
    }

    setState({ status: 'running', progress: 0, stage: text.reading });
    try {
      const input = await file.arrayBuffer();
      const runner = new LocalJobRunner({
        capability,
        createWorker: () =>
          new Worker(new URL('./local-image.worker.ts', import.meta.url), {
            type: 'module',
          }) as WorkerTransport,
      });
      const job = runner.run(
        {
          id: `image-${Date.now()}`,
          operationId,
          input,
          options: {
            sourceMime,
            quality: quality / 100,
            maxDimension,
            removeMetadataOnly: operationId === 'remove-image-metadata',
          },
        },
        ({ progress, stage }) => setState({ status: 'running', progress, stage }),
      );
      handle.current = job;
      const result = await job.promise;
      const validation = metadataOnlyJpeg
        ? validateJpegResult(result.output)
        : validateWebPResult(result.output);
      if (!validation.ok) throw new Error(validation.error);
      const width = Number(result.metadata?.width ?? 0);
      const height = Number(result.metadata?.height ?? 0);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      const url = URL.createObjectURL(
        new Blob([result.output], { type: metadataOnlyJpeg ? 'image/jpeg' : 'image/webp' }),
      );
      resultUrl.current = url;
      setState({ status: 'completed', url, size: validation.size, width, height });
      void recordCompletedOperations();
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : text.failed,
      });
    }
  }

  const running = state.status === 'running';
  return (
    <section className="local-image-tool" aria-labelledby="local-image-title">
      <div className="image-tool-heading">
        <div>
          <Badge variant="local">{text.badge}</Badge>
          <h3 id="local-image-title">
            {metadataOnlyJpeg
              ? metadataResultCopy[language].title
              : operationId === 'remove-image-metadata'
                ? text.titles[1]
                : text.titles[0]}
          </h3>
        </div>
        <span>{metadataOnlyJpeg ? metadataResultCopy[language].note : text.metadata}</span>
      </div>
      {operationId !== 'remove-image-metadata' ? (
        <div className="image-tool-controls">
          <Slider
            id="image-quality"
            label={text.quality}
            min={40}
            max={100}
            value={quality}
            valueLabel={`${quality}%`}
            disabled={running}
            onChange={(event) => setQuality(Number(event.target.value))}
          />
          <Select
            id="image-size"
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
      ) : null}
      <div className="image-tool-action">
        {running ? (
          <Button type="button" variant="secondary" onClick={() => handle.current?.cancel()}>
            {text.cancel}
          </Button>
        ) : (
          <Button type="button" onClick={() => void processImage()}>
            {operationId === 'remove-image-metadata' ? text.actions[1] : text.actions[0]}
          </Button>
        )}
        <span>
          {text.source}: {formatFileSize(file.size)} · {text.never}
        </span>
      </div>
      <div className="image-tool-feedback" aria-live="polite">
        {running ? (
          <div>
            <span>
              <span style={{ width: `${state.progress}%` }} />
            </span>
            <small>
              {state.stage} · {state.progress}%
            </small>
          </div>
        ) : null}
        {state.status === 'error' ? (
          <p className="input-error" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === 'completed' ? (
          <div className="image-result-card">
            <div>
              <Badge variant={state.size < file.size ? 'success' : 'warning'}>
                {metadataOnlyJpeg ? metadataResultCopy[language].valid : text.valid}
              </Badge>
              {state.width > 0 && state.height > 0 ? (
                <strong>
                  {state.width} × {state.height}
                </strong>
              ) : null}
              <span>
                {formatFileSize(file.size)} → {formatFileSize(state.size)} ·{' '}
                {savingPercent(file.size, state.size)}% {text.saved}
              </span>
            </div>
            <a
              className="image-download"
              href={state.url}
              download={
                metadataOnlyJpeg ? metadataFreeJpegFileName(file.name) : webPFileName(file.name)
              }
            >
              {metadataOnlyJpeg ? metadataResultCopy[language].download : text.download}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
