'use client';

import React, { useRef, useState } from 'react';
import { Badge, Button, Select } from '@fileflow/ui';
import Image from 'next/image';
import {
  API_URL,
  createSocialImport,
  waitForCleanUpload,
  waitForSocialImport,
  type SocialImport,
} from '../cloud-api';
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
    download: 'Download original video',
    operations: ['Compress video', 'Convert to MP4', 'Resize video', 'Extract audio'],
    errors: {
      platform_auth_required:
        'The platform requested verification. Upload the video file directly or try again later.',
      platform_auth_unavailable: 'Platform authentication is not configured on this server.',
      platform_ip_blocked:
        'The platform blocked this server address. Please try again later.',
      media_unavailable: 'This video is unavailable or private.',
      supported_format_unavailable: 'No supported video format is available.',
      import_failed: 'The platform could not import this link.',
    },
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
    download: 'Скачать исходное видео',
    operations: ['Сжать видео', 'Преобразовать в MP4', 'Изменить размер', 'Извлечь аудио'],
    errors: {
      platform_auth_required:
        'Платформа запросила подтверждение. Загрузите видеофайл напрямую или повторите попытку позже.',
      platform_auth_unavailable: 'На сервере не настроена авторизация для этой платформы.',
      platform_ip_blocked:
        'Платформа заблокировала адрес этого сервера. Повторите попытку позже.',
      media_unavailable: 'Это видео недоступно или является приватным.',
      supported_format_unavailable: 'Не найден поддерживаемый формат видео.',
      import_failed: 'Не удалось импортировать видео по этой ссылке.',
    },
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
    download: 'Descargar vídeo original',
    operations: ['Comprimir vídeo', 'Convertir a MP4', 'Redimensionar vídeo', 'Extraer audio'],
    errors: {
      platform_auth_required:
        'La plataforma solicitó una verificación. Sube el archivo de vídeo directamente o inténtalo más tarde.',
      platform_auth_unavailable:
        'La autenticación para esta plataforma no está configurada en el servidor.',
      platform_ip_blocked:
        'La plataforma bloqueó la dirección de este servidor. Inténtalo de nuevo más tarde.',
      media_unavailable: 'Este vídeo no está disponible o es privado.',
      supported_format_unavailable: 'No hay ningún formato de vídeo compatible disponible.',
      import_failed: 'No se pudo importar el vídeo desde este enlace.',
    },
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
      if (completed.upload_id) {
        await waitForCleanUpload(completed.upload_id, () => undefined, controller.signal);
      }
      setState({ status: 'completed', item: completed });
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof DOMException && error.name === 'AbortError'
            ? text.cancelled
            : error instanceof Error
              ? (text.errors[error.message as keyof typeof text.errors] ?? text.failed)
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
          <a className="image-download" href={`${API_URL}/imports/${state.item.id}/result`}>
            {text.download}
          </a>
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
