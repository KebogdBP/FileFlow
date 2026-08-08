'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button } from '@fileflow/ui';
import {
  accountToken,
  askSubtitleAi,
  downloadSubtitleDocx,
  getSocialImportResult,
  type AiChatMessage,
} from '../cloud-api';
import type { FileFlowLanguage } from '../use-fileflow-language';

const copy = {
  en: {
    title: 'Subtitle workspace',
    lead: 'Edit the extracted text, export it or ask a grounded question.',
    editor: 'Extracted subtitles',
    assistant: 'AI assistant',
    placeholder: 'Ask what the speaker said about a topic…',
    ask: 'Ask DeepSeek',
    working: 'Analyzing…',
    signin: 'Sign in to use the AI assistant and DOCX export.',
    exports: ['Download VTT', 'Download TXT', 'Download DOCX'],
    prompts: [
      'Summarize the entire video in one sentence.',
      'Write a clear paragraph summarizing the main ideas.',
      'List the key topics and include useful timestamps.',
      'What conclusions or action items did the speakers mention?',
    ],
    empty: 'No readable subtitle text was returned.',
    loading: 'Opening extracted subtitles…',
    chars: 'characters',
    privacy: 'Only this text and your question are sent to DeepSeek after you press Ask.',
  },
  ru: {
    title: 'Рабочая область субтитров',
    lead: 'Отредактируйте текст, скачайте документ или задайте вопрос по содержанию.',
    editor: 'Извлечённые субтитры',
    assistant: 'AI-помощник',
    placeholder: 'Например: что спикер говорил об инвестициях?',
    ask: 'Спросить DeepSeek',
    working: 'Анализируем…',
    signin: 'Войдите в аккаунт, чтобы использовать AI и экспорт DOCX.',
    exports: ['Скачать VTT', 'Скачать TXT', 'Скачать DOCX'],
    prompts: [
      'Суммируй всё видео одним предложением.',
      'Сделай понятное резюме основных мыслей одним абзацем.',
      'Перечисли ключевые темы и добавь полезные таймкоды.',
      'Какие выводы или следующие действия назвали спикеры?',
    ],
    empty: 'В результате нет читаемого текста субтитров.',
    loading: 'Открываем извлечённые субтитры…',
    chars: 'символов',
    privacy: 'Только этот текст и ваш вопрос отправляются DeepSeek после нажатия кнопки.',
  },
  es: {
    title: 'Espacio de subtítulos',
    lead: 'Edita el texto, expórtalo o haz una pregunta basada en su contenido.',
    editor: 'Subtítulos extraídos',
    assistant: 'Asistente de IA',
    placeholder: 'Pregunta qué dijo el ponente sobre un tema…',
    ask: 'Preguntar a DeepSeek',
    working: 'Analizando…',
    signin: 'Inicia sesión para usar la IA y exportar a DOCX.',
    exports: ['Descargar VTT', 'Descargar TXT', 'Descargar DOCX'],
    prompts: [
      'Resume todo el vídeo en una frase.',
      'Resume las ideas principales en un párrafo claro.',
      'Enumera los temas clave con marcas de tiempo útiles.',
      '¿Qué conclusiones o próximos pasos mencionaron?',
    ],
    empty: 'No se obtuvo texto de subtítulos legible.',
    loading: 'Abriendo los subtítulos…',
    chars: 'caracteres',
    privacy: 'Solo este texto y tu pregunta se envían a DeepSeek al pulsar el botón.',
  },
} as const;

const aiErrors: Record<FileFlowLanguage, Record<string, string>> = {
  en: {
    ai_not_configured: 'The AI assistant is not configured on this server yet.',
    ai_rate_limited: 'DeepSeek is temporarily rate-limited. Please try again later.',
    ai_provider_unavailable: 'DeepSeek is temporarily unavailable. Please try again later.',
    ai_provider_failed: 'DeepSeek could not complete this request.',
  },
  ru: {
    ai_not_configured: 'AI-помощник пока не настроен на сервере.',
    ai_rate_limited: 'DeepSeek временно ограничил запросы. Попробуйте позже.',
    ai_provider_unavailable: 'DeepSeek временно недоступен. Попробуйте позже.',
    ai_provider_failed: 'DeepSeek не смог обработать этот запрос.',
  },
  es: {
    ai_not_configured: 'El asistente de IA aún no está configurado en el servidor.',
    ai_rate_limited: 'DeepSeek ha limitado temporalmente las solicitudes.',
    ai_provider_unavailable: 'DeepSeek no está disponible temporalmente.',
    ai_provider_failed: 'DeepSeek no pudo completar esta solicitud.',
  },
};

export function ImportedSubtitleWorkspace({
  importId,
  language,
}: {
  importId: string;
  language: FileFlowLanguage;
}) {
  const text = copy[language];
  const [result, setResult] = useState<{ text: string; filename: string }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getSocialImportResult(importId)
      .then(async ({ blob, filename }) => {
        const content = await blob.text();
        if (active) setResult({ text: content, filename });
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : text.empty);
      });
    return () => {
      active = false;
    };
  }, [importId, text.empty]);
  if (error) return <p className="input-error">{error}</p>;
  if (!result) return <p className="subtitle-loading">{text.loading}</p>;
  return (
    <SubtitleWorkspace initialText={result.text} filename={result.filename} language={language} />
  );
}

export function SubtitleWorkspace({
  initialText,
  filename,
  language,
}: {
  initialText: string;
  filename: string;
  language: FileFlowLanguage;
}) {
  const labels = copy[language];
  const [subtitleText, setSubtitleText] = useState(initialText);
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<AiChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number>();
  const plainText = useMemo(() => vttToPlainText(subtitleText), [subtitleText]);
  const token = accountToken();

  async function ask(question = prompt) {
    const accessToken = accountToken();
    const cleanQuestion = question.trim();
    if (!accessToken || !cleanQuestion || !plainText) return;
    setBusy(true);
    setError('');
    try {
      const response = await askSubtitleAi(subtitleText, cleanQuestion, history, accessToken);
      setHistory((current) => [
        ...current,
        { role: 'user', content: cleanQuestion },
        { role: 'assistant', content: response.answer },
      ]);
      setRemaining(response.remaining_today);
      setPrompt('');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'AI request failed.';
      setError(aiErrors[language][message] ?? message);
    } finally {
      setBusy(false);
    }
  }

  function downloadText(content: string, extension: string, type: string) {
    const blob = new Blob([content], { type });
    saveBlob(blob, replaceExtension(filename, extension));
  }

  async function downloadDocx() {
    const accessToken = accountToken();
    if (!accessToken) return;
    setError('');
    try {
      saveBlob(
        await downloadSubtitleDocx(filename, plainText, accessToken),
        replaceExtension(filename, '.docx'),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'DOCX export failed.');
    }
  }

  return (
    <section className="subtitle-workspace">
      <div className="subtitle-heading">
        <div>
          <Badge variant="success">SUBTITLES READY</Badge>
          <h4>{labels.title}</h4>
          <p>{labels.lead}</p>
        </div>
        <span>
          {subtitleText.length.toLocaleString()} {labels.chars}
        </span>
      </div>
      <div className="subtitle-layout">
        <div className="subtitle-editor">
          <label htmlFor="subtitle-text">{labels.editor}</label>
          <textarea
            id="subtitle-text"
            value={subtitleText}
            onChange={(event) => setSubtitleText(event.target.value)}
            spellCheck
          />
          <div className="subtitle-export-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadText(subtitleText, '.vtt', 'text/vtt')}
            >
              {labels.exports[0]}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadText(plainText, '.txt', 'text/plain')}
            >
              {labels.exports[1]}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!token}
              onClick={() => void downloadDocx()}
            >
              {labels.exports[2]}
            </Button>
          </div>
        </div>
        <div className="subtitle-ai-panel">
          <div className="subtitle-ai-title">
            <Badge variant="cloud">DEEPSEEK</Badge>
            <h4>{labels.assistant}</h4>
          </div>
          <div className="subtitle-quick-prompts">
            {labels.prompts.map((item) => (
              <button
                key={item}
                type="button"
                disabled={busy || !token}
                onClick={() => void ask(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {history.length ? (
            <div className="subtitle-chat" aria-live="polite">
              {history.map((message, index) => (
                <div className={message.role} key={`${message.role}-${index}`}>
                  <strong>{message.role === 'user' ? 'You' : 'DeepSeek'}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            className="subtitle-question"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={labels.placeholder}
            maxLength={4000}
          />
          <Button
            type="button"
            disabled={busy || !token || !prompt.trim()}
            onClick={() => void ask()}
          >
            {busy ? labels.working : labels.ask}
          </Button>
          {!token ? (
            <p className="cloud-auth-note">
              <a href="/account">{labels.signin}</a>
            </p>
          ) : null}
          {error ? (
            <p className="input-error" role="alert">
              {error}
            </p>
          ) : null}
          {remaining !== undefined ? <small>{remaining} AI requests remaining today</small> : null}
          <small>{labels.privacy}</small>
        </div>
      </div>
    </section>
  );
}

function vttToPlainText(value: string) {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/<[^>]+>/g, '').trim();
    if (!clean || clean === 'WEBVTT' || clean.includes('-->') || /^\d+$/.test(clean)) continue;
    if (output.at(-1) !== clean) output.push(clean);
  }
  return output.join('\n');
}

function replaceExtension(filename: string, extension: string) {
  return `${filename.replace(/\.[^.]+$/, '') || 'fileflow-subtitles'}${extension}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
