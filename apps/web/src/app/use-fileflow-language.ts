'use client';

import { useEffect, useState } from 'react';

export type FileFlowLanguage = 'en' | 'ru' | 'es';

const LANGUAGE_KEY = 'fileflow-language';

export function useFileFlowLanguage() {
  const [language, setLanguageState] = useState<FileFlowLanguage>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'en' || saved === 'ru' || saved === 'es') setLanguageState(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_KEY, language);
    window.dispatchEvent(new CustomEvent('fileflow-language-change', { detail: language }));
  }, [language, ready]);

  useEffect(() => {
    const sync = (event: Event) => {
      const next =
        event instanceof CustomEvent ? event.detail : window.localStorage.getItem(LANGUAGE_KEY);
      if (next === 'en' || next === 'ru' || next === 'es') setLanguageState(next);
    };
    window.addEventListener('storage', sync);
    window.addEventListener('fileflow-language-change', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('fileflow-language-change', sync);
    };
  }, []);

  return { language, setLanguage: setLanguageState };
}
