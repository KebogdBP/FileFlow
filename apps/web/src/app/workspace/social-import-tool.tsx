'use client';

import React, { useRef, useState } from 'react';
import { Badge, Button, Input, Select } from '@fileflow/ui';
import Image from 'next/image';
import {
  API_URL,
  createSocialImport,
  waitForCleanUpload,
  waitForSocialImport,
  type SocialImport,
  type SocialImportOptions,
} from '../cloud-api';
import { CloudJobTool } from './cloud-job-tool';
import type { FileFlowLanguage } from '../use-fileflow-language';
import { recordCompletedOperations } from '../visitor-counter';

const socialCopy = {
  en: {
    stages: ['Queueing import', 'Importing from'],
    cancelled: 'Waiting was cancelled. The server task may finish in the background.',
    failed: 'Import failed.',
    chooseFile: 'Choose a file instead',
    invalidRange: 'End time must be greater than start time.',
    start: 'Import media',
    importing: 'IMPORTING',
    stop: 'Stop waiting',
    thumbnail: 'Imported media thumbnail',
    imported: 'IMPORTED',
    fallbackTitle: ['Imported video', 'Imported audio'],
    next: 'What next?',
    download: ['Download video', 'Download MP3'],
    mediaType: 'Import as',
    mediaTypes: ['Video', 'Audio (MP3)'],
    videoQuality: 'Video quality',
    qualities: ['Best available', 'Up to 1080p', 'Up to 720p', 'Up to 480p'],
    audioQuality: 'MP3 quality',
    startTime: 'Start (seconds, optional)',
    endTime: 'End (seconds, optional)',
    playlistItem: 'Playlist item (optional)',
    playlistHint: 'Imports one numbered item so every job still has one safe result.',
    videoOperations: ['Compress video', 'Convert to MP4', 'Remove video metadata', 'Extract audio'],
    audioOperations: ['Optimize audio', 'Convert to MP3', 'Convert to WAV', 'Trim audio'],
    errors: {
      platform_auth_required:
        'The platform requested verification. Upload the file directly or try again later.',
      platform_auth_unavailable: 'Platform authentication is not configured on this server.',
      platform_ip_blocked: 'The platform blocked this server address. Please try again later.',
      platform_rate_limited: 'The platform rate-limited this server. Please try again later.',
      extractor_outdated:
        'The platform changed its page format. The server extractor needs an update.',
      media_unavailable: 'This media is unavailable or private.',
      supported_format_unavailable: 'No supported media format is available.',
      import_failed: 'The platform could not import this link.',
    },
  },
  ru: {
    stages: ['Добавляем импорт в очередь', 'Импортируем из'],
    cancelled: 'Ожидание отменено. Серверная задача может завершиться в фоне.',
    failed: 'Не удалось импортировать медиа.',
    chooseFile: 'Выбрать файл с устройства',
    invalidRange: 'Конечное время должно быть больше начального.',
    start: 'Импортировать медиа',
    importing: 'ИМПОРТ',
    stop: 'Прекратить ожидание',
    thumbnail: 'Превью импортированного медиа',
    imported: 'ИМПОРТИРОВАНО',
    fallbackTitle: ['Импортированное видео', 'Импортированное аудио'],
    next: 'Что сделать дальше?',
    download: ['Скачать видео', 'Скачать MP3'],
    mediaType: 'Импортировать как',
    mediaTypes: ['Видео', 'Аудио (MP3)'],
    videoQuality: 'Качество видео',
    qualities: ['Лучшее доступное', 'До 1080p', 'До 720p', 'До 480p'],
    audioQuality: 'Качество MP3',
    startTime: 'Начало (секунды, необязательно)',
    endTime: 'Конец (секунды, необязательно)',
    playlistItem: 'Номер в плейлисте (необязательно)',
    playlistHint: 'Импортируется один выбранный элемент — один безопасный результат на задачу.',
    videoOperations: ['Сжать', 'MP4', 'Удалить метаданные видео', 'Извлечь аудио'],
    audioOperations: [
      'Оптимизировать аудио',
      'Преобразовать в MP3',
      'Преобразовать в WAV',
      'Обрезать аудио',
    ],
    errors: {
      platform_auth_required:
        'Платформа запросила подтверждение. Загрузите файл напрямую или повторите позже.',
      platform_auth_unavailable: 'На сервере не настроена авторизация для этой платформы.',
      platform_ip_blocked: 'Платформа заблокировала адрес сервера. Повторите попытку позже.',
      platform_rate_limited:
        'Платформа временно ограничила запросы сервера. Повторите попытку позже.',
      extractor_outdated:
        'Платформа изменила формат страницы. Нужно обновить серверный экстрактор.',
      media_unavailable: 'Это медиа недоступно или является приватным.',
      supported_format_unavailable: 'Поддерживаемый формат медиа не найден.',
      import_failed: 'Не удалось импортировать медиа по этой ссылке.',
    },
  },
  es: {
    stages: ['Añadiendo la importación a la cola', 'Importando desde'],
    cancelled: 'La espera se canceló. La tarea puede terminar en segundo plano.',
    failed: 'La importación falló.',
    chooseFile: 'Elegir un archivo del dispositivo',
    invalidRange: 'El tiempo final debe ser mayor que el inicial.',
    start: 'Importar contenido',
    importing: 'IMPORTANDO',
    stop: 'Dejar de esperar',
    thumbnail: 'Miniatura del contenido importado',
    imported: 'IMPORTADO',
    fallbackTitle: ['Vídeo importado', 'Audio importado'],
    next: '¿Qué hacer después?',
    download: ['Descargar vídeo', 'Descargar MP3'],
    mediaType: 'Importar como',
    mediaTypes: ['Vídeo', 'Audio (MP3)'],
    videoQuality: 'Calidad de vídeo',
    qualities: ['Mejor disponible', 'Hasta 1080p', 'Hasta 720p', 'Hasta 480p'],
    audioQuality: 'Calidad MP3',
    startTime: 'Inicio (segundos, opcional)',
    endTime: 'Fin (segundos, opcional)',
    playlistItem: 'Elemento de playlist (opcional)',
    playlistHint: 'Importa un elemento numerado para mantener un resultado seguro por tarea.',
    videoOperations: ['Comprimir vídeo', 'Convertir a MP4', 'Eliminar metadatos', 'Extraer audio'],
    audioOperations: ['Optimizar audio', 'Convertir a MP3', 'Convertir a WAV', 'Recortar audio'],
    errors: {
      platform_auth_required:
        'La plataforma solicitó verificación. Sube el archivo directamente o inténtalo más tarde.',
      platform_auth_unavailable: 'La autenticación no está configurada en este servidor.',
      platform_ip_blocked: 'La plataforma bloqueó la dirección del servidor. Inténtalo más tarde.',
      platform_rate_limited: 'La plataforma limitó temporalmente el servidor. Inténtalo más tarde.',
      extractor_outdated: 'La plataforma cambió su formato. Hay que actualizar el extractor.',
      media_unavailable: 'Este contenido no está disponible o es privado.',
      supported_format_unavailable: 'No hay un formato compatible disponible.',
      import_failed: 'No se pudo importar el contenido desde este enlace.',
    },
  },
} as const;

export function SocialImportTool({
  url,
  language = 'en',
  onChooseFile,
}: {
  url: string;
  language?: FileFlowLanguage;
  onChooseFile?: () => void;
}) {
  const text = socialCopy[language];
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [videoQuality, setVideoQuality] = useState<'best' | '1080' | '720' | '480'>('best');
  const [audioBitrate, setAudioBitrate] = useState<128 | 192 | 320>(192);
  const [startSeconds, setStartSeconds] = useState('');
  const [endSeconds, setEndSeconds] = useState('');
  const [playlistItem, setPlaylistItem] = useState('');
  const [operation, setOperation] = useState('compress-video');
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'running'; stage: string }
    | { status: 'completed'; item: SocialImport }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  const aborter = useRef<AbortController | null>(null);

  async function start() {
    const startValue = startSeconds === '' ? undefined : Number(startSeconds);
    const endValue = endSeconds === '' ? undefined : Number(endSeconds);
    if (startValue !== undefined && endValue !== undefined && endValue <= startValue) {
      setState({ status: 'error', message: text.invalidRange });
      return;
    }
    const options: SocialImportOptions = {
      media_type: mediaType,
      video_quality: videoQuality,
      audio_bitrate_kbps: audioBitrate,
      ...(startValue === undefined ? {} : { start_seconds: startValue }),
      ...(endValue === undefined ? {} : { end_seconds: endValue }),
      ...(playlistItem === '' ? {} : { playlist_item: Number(playlistItem) }),
    };
    setOperation(mediaType === 'audio' ? 'optimize-audio' : 'compress-video');
    const controller = new AbortController();
    aborter.current = controller;
    setState({ status: 'running', stage: text.stages[0] });
    try {
      const created = await createSocialImport(url, options, controller.signal);
      setState({ status: 'running', stage: `${text.stages[1]} ${created.provider}` });
      const completed = await waitForSocialImport(created.id, controller.signal);
      if (completed.upload_id) {
        await waitForCleanUpload(completed.upload_id, () => undefined, controller.signal);
      }
      setState({ status: 'completed', item: completed });
      void recordCompletedOperations();
    } catch (error) {
      setState({
        status: 'error',
        message:
          error instanceof DOMException && error.name === 'AbortError'
            ? text.cancelled
            : error instanceof Error
              ? (text.errors[error.message as keyof typeof text.errors] ??
                error.message ??
                text.failed)
              : text.failed,
      });
    } finally {
      aborter.current = null;
    }
  }

  const editable = state.status === 'idle' || state.status === 'error';
  const completedType = state.status === 'completed' ? state.item.media_type : mediaType;
  const operations =
    completedType === 'audio'
      ? [
          ['optimize-audio', text.audioOperations[0]],
          ['audio-to-mp3', text.audioOperations[1]],
          ['audio-to-wav', text.audioOperations[2]],
          ['trim-audio', text.audioOperations[3]],
        ]
      : [
          ['compress-video', text.videoOperations[0]],
          ['video-to-mp4', text.videoOperations[1]],
          ['remove-video-metadata', text.videoOperations[2]],
          ['extract-audio', text.videoOperations[3]],
        ];

  return (
    <div className="social-import-tool">
      {editable ? (
        <div className="cloud-controls social-import-controls">
          <Select
            id="social-media-type"
            className="social-import-select"
            label={text.mediaType}
            value={mediaType}
            onChange={(event) => setMediaType(event.target.value as 'video' | 'audio')}
          >
            <option value="video">{text.mediaTypes[0]}</option>
            <option value="audio">{text.mediaTypes[1]}</option>
          </Select>
          {mediaType === 'video' ? (
            <Select
              id="social-video-quality"
              className="social-import-select"
              label={text.videoQuality}
              value={videoQuality}
              onChange={(event) =>
                setVideoQuality(event.target.value as 'best' | '1080' | '720' | '480')
              }
            >
              {(['best', '1080', '720', '480'] as const).map((value, index) => (
                <option key={value} value={value}>
                  {text.qualities[index]}
                </option>
              ))}
            </Select>
          ) : (
            <Select
              id="social-audio-quality"
              className="social-import-select"
              label={text.audioQuality}
              value={String(audioBitrate)}
              onChange={(event) => setAudioBitrate(Number(event.target.value) as 128 | 192 | 320)}
            >
              <option value="320">320 kbps</option>
              <option value="192">192 kbps</option>
              <option value="128">128 kbps</option>
            </Select>
          )}
          <Input
            id="social-start"
            label={text.startTime}
            type="number"
            min="0"
            max="86400"
            step="0.1"
            value={startSeconds}
            onChange={(event) => setStartSeconds(event.target.value)}
          />
          <Input
            id="social-end"
            label={text.endTime}
            type="number"
            min="0.1"
            max="86400"
            step="0.1"
            value={endSeconds}
            onChange={(event) => setEndSeconds(event.target.value)}
          />
          <Input
            id="social-playlist-item"
            label={text.playlistItem}
            description={text.playlistHint}
            type="number"
            min="1"
            max="500"
            step="1"
            value={playlistItem}
            onChange={(event) => setPlaylistItem(event.target.value)}
          />
        </div>
      ) : null}
      {editable ? (
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
        <div className="social-import-error">
          <p className="input-error" role="alert">
            {state.message}
          </p>
          {onChooseFile ? (
            <Button type="button" variant="secondary" onClick={onChooseFile}>
              {text.chooseFile}
            </Button>
          ) : null}
        </div>
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
              <strong>
                {state.item.title ?? text.fallbackTitle[state.item.media_type === 'audio' ? 1 : 0]}
              </strong>
              <span>{state.item.creator ?? state.item.provider}</span>
            </div>
          </div>
          <Select
            id="import-operation"
            label={text.next}
            value={operation}
            onChange={(event) => setOperation(event.target.value)}
          >
            {operations.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <a className="image-download" href={`${API_URL}/imports/${state.item.id}/result`}>
            {text.download[state.item.media_type === 'audio' ? 1 : 0]}
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
