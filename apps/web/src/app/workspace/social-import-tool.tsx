'use client';

import React, { useRef, useState } from 'react';
import { Badge, Button, Select } from '@fileflow/ui';
import Image from 'next/image';
import { createSocialImport, waitForSocialImport, type SocialImport } from '../cloud-api';
import { CloudJobTool } from './cloud-job-tool';
import type { FileFlowLanguage } from '../use-fileflow-language';

const socialCopy = {
  en: {
    stages: ['Queueing import', 'Importing from'],
    cancelled: 'Import cancelled locally. The server task may finish in the background.',
    failed: 'Import failed.',
    start: 'Start cloud import',
    importing: 'IMPORTING',
    stop: 'Stop waiting',
    thumbnail: 'Imported media thumbnail',
    imported: 'IMPORTED',
    video: 'Imported video',
    next: 'What next?',
    operations: ['Compress video', 'Convert to MP4', 'Resize video', 'Extract audio'],
  },
  ru: {
    stages: ['Постановка импорта в очередь', 'Импорт из'],
    cancelled: 'Ожидание импорта отменено. Серверная задача может завершиться в фоне.',
    failed: 'Не удалось импортировать медиа.',
    start: 'Начать облачный импорт',
    importing: 'ИМПОРТ',
    stop: 'Прекратить ожидание',
    thumbnail: 'Превью импортированного медиа',
    imported: 'ИМПОРТИРОВАНО',
    video: 'Импортированное видео',
    next: 'Что сделать дальше?',
    operations: ['Сжать видео', 'Преобразовать в MP4', 'Изменить размер', 'Извлечь аудио'],
  },
  es: {
    stages: ['Añadiendo la importación a la cola', 'Importando desde'],
    cancelled: 'La espera se canceló. La tarea del servidor puede terminar en segundo plano.',
    failed: 'La importación ha fallado.',
    start: 'Iniciar importación en la nube',
    importing: 'IMPORTANDO',
    stop: 'Dejar de esperar',
    thumbnail: 'Miniatura del medio importado',
    imported: 'IMPORTADO',
    video: 'Vídeo importado',
    next: '¿Qué hacer después?',
    operations: ['Comprimir vídeo', 'Convertir a MP4', 'Redimensionar vídeo', 'Extraer audio'],
  },
} as const;

export function SocialImportTool({
  url,
  language = 'en',
}: {
  url: string;
  language?: FileFlowLanguage;
}) {
  const text = socialCopy[language];
  const [operation, setOperation] = useState('compress-video');
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'running'; stage: string }
    | { status: 'completed'; item: SocialImport }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const aborter = useRef<AbortController | null>(null);

  async function start() {
    const controller = new AbortController();
    aborter.current = controller;
    setState({ status: 'running', stage: text.stages[0] });
    try {
      const created = await createSocialImport(url, controller.signal);
      setState({ status: 'running', stage: `${text.stages[1]} ${created.provider}` });
      const completed = await waitForSocialImport(created.id, controller.signal);
      setState({ status: 'completed', item: completed });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof DOMException && error.name === 'AbortError'
            ? text.cancelled
            : error instanceof Error
              ? error.message
              : text.failed,
      });
    } finally {
      aborter.current = null;
    }
  }

  return (
    <div className="social-import-tool">
      {state.status === 'idle' || state.status === 'error' ? (
        <Button type="button" onClick={() => void start()}>
          {text.start}
        </Button>
      ) : null}
      {state.status === 'running' ? (
        <div className="cloud-tool-actions">
          <Badge variant="cloud">{text.importing}</Badge>
          <strong>{state.stage}</strong>
          <Button type="button" variant="secondary" onClick={() => aborter.current?.abort()}>
            {text.stop}
          </Button>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <p className="input-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === 'completed' && state.item.upload_id ? (
        <>
          <div className="import-result">
            {state.item.thumbnail_url ? (
              <Image
                src={state.item.thumbnail_url}
                alt={text.thumbnail}
                width={120}
                height={68}
                unoptimized
              />
            ) : null}
            <div>
              <Badge variant="success">{text.imported}</Badge>
              <strong>{state.item.title ?? text.video}</strong>
              <span>{state.item.creator ?? state.item.provider}</span>
            </div>
          </div>
          <Select
            id="import-operation"
            label={text.next}
            value={operation}
            onChange={(event) => setOperation(event.target.value)}
          >
            <option value="compress-video">{text.operations[0]}</option>
            <option value="video-to-mp4">{text.operations[1]}</option>
            <option value="resize-video">{text.operations[2]}</option>
            <option value="extract-audio">{text.operations[3]}</option>
          </Select>
          <CloudJobTool
            operationId={operation}
            existingUploadId={state.item.upload_id}
            language={language}
          />
        </>
      ) : null}
    </div>
  );
}
