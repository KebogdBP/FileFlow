'use client';

import { AudioLines, FileMusic, Film, ListMusic, ListVideo, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import {
  createDirectDownload,
  createSocialImport,
  downloadSocialImportResult,
  startBrowserDownload,
  waitForCleanUpload,
  waitForSocialImport,
  type SocialImportOptions,
} from './cloud-api';
import type { FileFlowLanguage } from './use-fileflow-language';
import { recordCompletedOperations } from './visitor-counter';

type Mode = 'video' | 'video-playlist' | 'audio-playlist' | 'audio' | 'mp3';
type DeliveryMode = 'cloud' | 'direct';

const downloaderCopy = {
  en: {
    eyebrow: 'Video Downloader',
    title: 'Direct download',
    lead: 'Download directly to your device',
    placeholder: 'Drop a video or audio link here',
    invalid: 'Paste a valid public HTTPS link.',
    actions: {
      video: 'Video',
      'video-playlist': 'Video playlist',
      'audio-playlist': 'Audio playlist',
      audio: 'Audio',
      mp3: 'MP3',
    },
    quality: 'Video quality',
    count: 'How many files',
    all: 'All',
    working: 'Preparing your download…',
    importing: 'Downloading from the source…',
    checking: 'Checking the downloaded file…',
    downloading: 'Downloading directly to your device…',
    ready: 'The download has started.',
    failed: 'The file could not be downloaded.',
    delivery: 'Delivery mode',
    cloudMode: 'Checked cloud · up to 2 GB',
    directMode: 'Direct to device · no size limit',
    directHint:
      'Direct mode uses temporary server space only and skips cloud storage and malware scanning.',
    directStarting: 'The browser is preparing a direct download…',
    errors: {
      media_too_large: 'This media is larger than the 2 GB checked-cloud limit. Use direct mode.',
      extractor_outdated: 'The platform changed its format. The server extractor needs an update.',
      supported_format_unavailable: 'No supported media format is available.',
      platform_auth_required: 'The platform requires verification. Try again later.',
      platform_ip_blocked: 'The platform blocked the server address. Try again later.',
      platform_rate_limited: 'The platform temporarily rate-limited the server.',
      media_unavailable: 'This media is unavailable or private.',
      import_failed: 'The platform could not download this link.',
    },
  },
  ru: {
    eyebrow: 'Video Downloader',
    title: 'скачивание в два клика',
    lead: 'Скачивайте прямо на своё устройство',
    placeholder: 'Перетащите сюда ссылку на видео или аудио',
    invalid: 'Вставьте корректную публичную HTTPS-ссылку.',
    actions: {
      video: 'Видео',
      'video-playlist': 'ВидеоПлейлист',
      'audio-playlist': 'АудиоПлейлист',
      audio: 'Аудио',
      mp3: 'MP3',
    },
    quality: 'Качество видео',
    count: 'Сколько файлов скачать',
    all: 'Все',
    working: 'Готовим скачивание…',
    importing: 'Скачиваем с источника…',
    checking: 'Проверяем скачанный файл…',
    downloading: 'Скачиваем прямо на ваше устройство…',
    ready: 'Скачивание началось.',
    failed: 'Не удалось скачать файл.',
    delivery: 'Режим скачивания',
    cloudMode: 'Облако с проверкой · до 2 ГБ',
    directMode: 'Напрямую на устройство · без лимита',
    directHint:
      'Прямой режим использует только временное место на сервере, без облачного хранения и антивирусной проверки.',
    directStarting: 'Браузер готовит прямое скачивание…',
    errors: {
      media_too_large: 'Файл превышает лимит облачного режима 2 ГБ. Используйте прямой режим.',
      extractor_outdated: 'Платформа изменила формат. Необходимо обновить серверный экстрактор.',
      supported_format_unavailable: 'Поддерживаемый формат медиа не найден.',
      platform_auth_required: 'Платформа запросила подтверждение. Попробуйте позже.',
      platform_ip_blocked: 'Платформа заблокировала адрес сервера. Попробуйте позже.',
      platform_rate_limited: 'Платформа временно ограничила запросы сервера.',
      media_unavailable: 'Видео или аудио недоступно либо является приватным.',
      import_failed: 'Не удалось скачать файл по этой ссылке.',
    },
  },
  es: {
    eyebrow: 'Video Downloader',
    title: 'Descarga directa',
    lead: 'Descarga directamente en tu dispositivo',
    placeholder: 'Suelta aquí un enlace de vídeo o audio',
    invalid: 'Pega un enlace HTTPS público válido.',
    actions: {
      video: 'Vídeo',
      'video-playlist': 'Lista de vídeos',
      'audio-playlist': 'Lista de audio',
      audio: 'Audio',
      mp3: 'MP3',
    },
    quality: 'Calidad de vídeo',
    count: 'Cuántos archivos',
    all: 'Todos',
    working: 'Preparando la descarga…',
    importing: 'Descargando desde la fuente…',
    checking: 'Comprobando el archivo descargado…',
    downloading: 'Descargando directamente en tu dispositivo…',
    ready: 'La descarga ha comenzado.',
    failed: 'No se pudo descargar el archivo.',
    delivery: 'Modo de entrega',
    cloudMode: 'Nube verificada · hasta 2 GB',
    directMode: 'Directo al dispositivo · sin límite',
    directHint:
      'El modo directo usa solo espacio temporal del servidor, sin almacenamiento en la nube ni análisis antivirus.',
    directStarting: 'El navegador está preparando la descarga directa…',
    errors: {
      media_too_large:
        'El archivo supera el límite de nube verificada de 2 GB. Usa el modo directo.',
      extractor_outdated: 'La plataforma cambió su formato. Hay que actualizar el extractor.',
      supported_format_unavailable: 'No hay un formato compatible disponible.',
      platform_auth_required: 'La plataforma requiere verificación. Inténtalo más tarde.',
      platform_ip_blocked: 'La plataforma bloqueó el servidor. Inténtalo más tarde.',
      platform_rate_limited: 'La plataforma limitó temporalmente el servidor.',
      media_unavailable: 'Este contenido no está disponible o es privado.',
      import_failed: 'No se pudo descargar el contenido desde este enlace.',
    },
  },
} as const;

const actionItems = [
  { mode: 'video' as const, icon: Film },
  { mode: 'video-playlist' as const, icon: ListVideo },
  { mode: 'audio-playlist' as const, icon: ListMusic },
  { mode: 'audio' as const, icon: AudioLines },
  { mode: 'mp3' as const, icon: FileMusic },
];

function isPublicHttpsLink(value: string) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function VideoDownloader({ language }: { language: FileFlowLanguage }) {
  const text = downloaderCopy[language];
  const [url, setUrl] = useState('');
  const [activeMode, setActiveMode] = useState<Mode | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('cloud');
  const [status, setStatus] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const valid = isPublicHttpsLink(url.trim());

  function chooseMode(mode: Mode) {
    setMessage('');
    setStatus('idle');
    if (mode === 'video' || mode === 'video-playlist' || mode === 'audio-playlist') {
      setActiveMode((current) => (current === mode ? null : mode));
      return;
    }
    setActiveMode(mode);
    void startDownload(mode);
  }

  async function startDownload(mode: Mode, value?: string) {
    if (!valid || status === 'running') return;
    const options: SocialImportOptions = {
      media_type: mode === 'video' || mode === 'video-playlist' ? 'video' : 'audio',
      video_quality:
        mode === 'video' ? ((value ?? 'best') as 'best' | '1080' | '720' | '480') : 'best',
      audio_bitrate_kbps: 192,
      ...(mode === 'video-playlist' || mode === 'audio-playlist'
        ? { playlist_count: value === 'all' ? 0 : Number(value ?? 1) }
        : {}),
      ...(mode === 'mp3' ? { generic_audio: true } : {}),
    };

    setStatus('running');
    setMessage(text.working);
    setProgress(1);
    try {
      if (deliveryMode === 'direct') {
        setMessage(text.directStarting);
        setProgress(null);
        const ticket = await createDirectDownload(url.trim(), options);
        startBrowserDownload(ticket.download_path);
        setStatus('ready');
        setMessage(text.ready);
        void recordCompletedOperations();
        return;
      }
      const item = await createSocialImport(url.trim(), options);
      const completed = await waitForSocialImport(item.id, (current) => {
        setMessage(current.status === 'queued' ? text.working : text.importing);
        setProgress(Math.max(2, Math.round(current.progress * 0.78)));
      });
      if (completed.upload_id) {
        setMessage(text.checking);
        await waitForCleanUpload(completed.upload_id, (value) =>
          setProgress(Math.max(79, Math.min(84, Math.round(79 + value / 20)))),
        );
      }
      setMessage(text.downloading);
      await downloadSocialImportResult(completed.id, (value) =>
        setProgress(value === null ? 85 : Math.round(85 + value * 0.15)),
      );
      setStatus('ready');
      setMessage(text.ready);
      void recordCompletedOperations();
    } catch (error) {
      setStatus('error');
      setProgress(null);
      setMessage(
        error instanceof Error && error.message
          ? (text.errors[error.message as keyof typeof text.errors] ?? error.message)
          : text.failed,
      );
    }
  }

  return (
    <section className="ff-downloader-section" aria-labelledby="video-downloader-title">
      <div className="ff-section-heading">
        <div>
          <span className="ff-eyebrow">
            <Film size={15} /> {text.eyebrow}
          </span>
          <h2 id="video-downloader-title">{text.title}</h2>
          <p>{text.lead}</p>
        </div>
      </div>

      <div className="ff-downloader-card glass-panel">
        <div
          className={`ff-link-window ${valid ? 'is-ready' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped =
              event.dataTransfer.getData('text/uri-list') ||
              event.dataTransfer.getData('text/plain');
            if (dropped) setUrl(dropped.trim());
          }}
        >
          <input
            aria-label={text.placeholder}
            inputMode="url"
            type="url"
            value={url}
            placeholder={text.placeholder}
            onChange={(event) => {
              setUrl(event.target.value);
              setActiveMode(null);
              setStatus('idle');
              setMessage('');
              setProgress(null);
            }}
          />
        </div>
        <div className="ff-delivery-mode" role="group" aria-label={text.delivery}>
          <strong>{text.delivery}</strong>
          <div>
            <button
              type="button"
              className={deliveryMode === 'cloud' ? 'is-active' : ''}
              aria-pressed={deliveryMode === 'cloud'}
              onClick={() => setDeliveryMode('cloud')}
              disabled={status === 'running'}
            >
              {text.cloudMode}
            </button>
            <button
              type="button"
              className={deliveryMode === 'direct' ? 'is-active' : ''}
              aria-pressed={deliveryMode === 'direct'}
              onClick={() => setDeliveryMode('direct')}
              disabled={status === 'running'}
            >
              {text.directMode}
            </button>
          </div>
          {deliveryMode === 'direct' ? <small>{text.directHint}</small> : null}
        </div>

        <AnimatePresence initial={false}>
          {url && !valid ? (
            <motion.p
              className="ff-downloader-message is-error"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {text.invalid}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="ff-downloader-actions">
          {actionItems.map(({ mode, icon: Icon }) => (
            <div className="ff-download-action" key={mode}>
              <button
                type="button"
                className={activeMode === mode ? 'is-active' : ''}
                aria-label={text.actions[mode]}
                aria-expanded={
                  mode === 'video' || mode === 'video-playlist' || mode === 'audio-playlist'
                    ? activeMode === mode
                    : undefined
                }
                disabled={!valid || status === 'running'}
                onClick={() => chooseMode(mode)}
              >
                {status === 'running' && activeMode === mode ? (
                  <LoaderCircle className="ff-spinner" size={27} />
                ) : (
                  <Icon size={27} />
                )}
                <span>{text.actions[mode]}</span>
              </button>

              <AnimatePresence>
                {activeMode === mode && mode === 'video' ? (
                  <OptionWindow label={text.quality}>
                    {['best', '1080', '720', '480'].map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        onClick={() => void startDownload(mode, quality)}
                      >
                        {quality === 'best' ? 'Best' : `${quality}p`}
                      </button>
                    ))}
                  </OptionWindow>
                ) : null}
                {activeMode === mode && (mode === 'video-playlist' || mode === 'audio-playlist') ? (
                  <OptionWindow label={text.count}>
                    {['1', '5', '10', '25', 'all'].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => void startDownload(mode, count)}
                      >
                        {count === 'all' ? text.all : count}
                      </button>
                    ))}
                  </OptionWindow>
                ) : null}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {status === 'running' ? (
          <div className="ff-downloader-progress-shell" aria-live="polite">
            <div className="ff-downloader-progress-meta">
              <span>{message}</span>
              <strong>{progress === null ? '•••' : `${progress}%`}</strong>
            </div>
            <div
              className={`ff-downloader-progress ${progress === null ? 'is-indeterminate' : ''}`}
              role="progressbar"
              aria-label={message}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress ?? undefined}
            >
              <span style={progress === null ? undefined : { width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            className={`ff-downloader-message ${status === 'error' ? 'is-error' : ''}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function OptionWindow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <motion.div
      className="ff-download-options glass-panel"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
    >
      <strong>{label}</strong>
      <div>{children}</div>
    </motion.div>
  );
}
