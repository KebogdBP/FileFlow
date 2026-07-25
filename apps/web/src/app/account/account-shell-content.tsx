'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AccountDashboard } from './account-dashboard';
import { useFileFlowLanguage } from '../use-fileflow-language';

const copy = {
  en: {
    back: 'Back to FileFlow',
    eyebrow: 'PRIVATE ACCOUNT',
    title: 'Your cloud work, in one place.',
    lead: 'Local operations stay local. Sign in only when you want cloud history and limits.',
  },
  ru: {
    back: 'Вернуться в FileFlow',
    eyebrow: 'ЛИЧНЫЙ АККАУНТ',
    title: 'Вся облачная работа в одном месте.',
    lead: 'Локальные операции остаются на устройстве. Вход нужен только для облачной истории и лимитов.',
  },
  es: {
    back: 'Volver a FileFlow',
    eyebrow: 'CUENTA PRIVADA',
    title: 'Tu trabajo en la nube, en un solo lugar.',
    lead: 'Las operaciones locales siguen siendo locales. Inicia sesión solo para usar el historial y los límites.',
  },
} as const;

export function AccountShellContent() {
  const { language } = useFileFlowLanguage();
  const text = copy[language];

  return (
    <>
      <header className="account-header">
        <Link className="landing-brand" href="/" aria-label="FileFlow home">
          <Image src="/brand/fileflow-mark.png" alt="" width={34} height={30} priority />
          <strong>FileFlow</strong>
        </Link>
        <Link href="/#workspace-flow">{text.back}</Link>
      </header>
      <section className="account-intro">
        <p className="input-eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p>{text.lead}</p>
      </section>
      <AccountDashboard />
    </>
  );
}
