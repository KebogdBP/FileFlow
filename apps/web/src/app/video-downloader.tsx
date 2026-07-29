'use client';

import { AudioLines, FileMusic, Film, ListMusic, ListVideo, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import {
  createSocialImport,
  downloadSocialImportResult,
  waitForCleanUpload,
  waitForSocialImport,
  type SocialImportOptions,
} from './cloud-api';
import type { FileFlowLanguage } from './use-fileflow-language';

type Mode = 'video' | 'video-playlist' | 'audio-playlist' | 'audio' | 'mp3';

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
    ready: 'The download has started.',
    failed: 'The file could not be downloaded.',
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
    ready: 'Скачивание началось.',
    failed: 'Не удалось скачать файл.',
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
    ready: 'La descarga ha comenzado.',
    failed: 'No se pudo descargar el archivo.',
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
  const [status, setStatus] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
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
    try {
      const item = await createSocialImport(url.trim(), options);
      const completed = await waitForSocialImport(item.id);
      if (completed.upload_id) {
        await waitForCleanUpload(completed.upload_id, () => undefined);
      }
      await downloadSocialImportResult(completed.id);
      setStatus('ready');
      setMessage(text.ready);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error && error.message ? error.message : text.failed);
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
            }}
          />
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
                {activeMode === mode &&
                (mode === 'video-playlist' || mode === 'audio-playlist') ? (
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
