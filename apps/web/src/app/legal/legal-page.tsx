'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useFileFlowLanguage } from '../use-fileflow-language';

type LegalKind = 'privacy' | 'security' | 'terms';
type LegalDocument = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: readonly (readonly [string, string])[];
};

const shared = {
  en: { back: 'Back to FileFlow', updated: 'Effective July 19, 2026' },
  ru: { back: 'Вернуться в FileFlow', updated: 'Действует с 19 июля 2026 года' },
  es: { back: 'Volver a FileFlow', updated: 'Vigente desde el 19 de julio de 2026' },
} as const;

const documents: Record<LegalKind, Record<'en' | 'ru' | 'es', LegalDocument>> = {
  privacy: {
    en: { eyebrow: 'Privacy notice', title: 'Privacy you can verify', intro: 'FileFlow minimizes collection and shows where processing happens before it starts.', sections: [['Local processing', 'Files handled locally stay in your browser and are not sent to FileFlow.'], ['Cloud processing', 'Temporary cloud files are quarantined, scanned, access-controlled and scheduled for automatic deletion.'], ['Accounts and analytics', 'Account data supports sessions, limits and private history. Analytics never includes filenames, URLs or file contents.'], ['Your choices', 'Use local tools without an account and revoke an authenticated session at any time.']] },
    ru: { eyebrow: 'Уведомление о приватности', title: 'Приватность, которую можно проверить', intro: 'FileFlow сводит сбор данных к минимуму и заранее показывает, где выполняется обработка.', sections: [['Локальная обработка', 'Файлы остаются в браузере и не отправляются в FileFlow.'], ['Облачная обработка', 'Временные облачные файлы помещаются в карантин, проверяются, защищаются и автоматически удаляются.'], ['Аккаунты и аналитика', 'Данные аккаунта нужны для сессий, лимитов и приватной истории. Аналитика не содержит имён, ссылок или содержимого файлов.'], ['Ваш выбор', 'Локальные инструменты доступны без аккаунта, а авторизованную сессию можно отозвать в любой момент.']] },
    es: { eyebrow: 'Aviso de privacidad', title: 'Privacidad que puedes verificar', intro: 'FileFlow minimiza la recopilación y muestra dónde se procesa cada archivo antes de empezar.', sections: [['Procesamiento local', 'Los archivos locales permanecen en el navegador y no se envían a FileFlow.'], ['Procesamiento en la nube', 'Los archivos temporales se aíslan, analizan, protegen y eliminan automáticamente.'], ['Cuentas y analítica', 'La cuenta permite sesiones, límites e historial privado. La analítica no incluye nombres, URL ni contenido.'], ['Tus opciones', 'Usa herramientas locales sin cuenta y revoca la sesión cuando quieras.']] },
  },
  security: {
    en: { eyebrow: 'Security', title: 'Security at FileFlow', intro: 'Defense in depth protects temporary cloud files while local processing avoids upload entirely.', sections: [['Controls', 'Cloud inputs remain quarantined until checks pass. Jobs use isolated workspaces, ownership checks and short-lived access.'], ['Responsible disclosure', 'Report a suspected vulnerability to security@fileflow.app with reproducible steps.'], ['Response', 'We triage reports, contain exposure, preserve evidence and communicate material impact.']] },
    ru: { eyebrow: 'Безопасность', title: 'Безопасность FileFlow', intro: 'Многоуровневая защита оберегает временные облачные файлы, а локальная обработка исключает загрузку.', sections: [['Меры защиты', 'Облачные файлы остаются в карантине до завершения проверок. Задачи работают изолированно и используют кратковременный доступ.'], ['Ответственное раскрытие', 'Сообщайте об уязвимостях на security@fileflow.app и прикладывайте воспроизводимые шаги.'], ['Реагирование', 'Мы проверяем сообщения, ограничиваем риски, сохраняем доказательства и сообщаем о существенном влиянии.']] },
    es: { eyebrow: 'Seguridad', title: 'Seguridad en FileFlow', intro: 'La protección por capas cubre los archivos temporales; el procesamiento local evita la carga.', sections: [['Controles', 'Los archivos en la nube permanecen en cuarentena hasta superar los análisis. Los trabajos usan entornos aislados y acceso breve.'], ['Divulgación responsable', 'Informa de una vulnerabilidad a security@fileflow.app e incluye pasos reproducibles.'], ['Respuesta', 'Analizamos los informes, contenemos la exposición, preservamos pruebas y comunicamos el impacto.']] },
  },
  terms: {
    en: { eyebrow: 'Beta terms', title: 'Terms for the FileFlow beta', intro: 'These terms set expectations for the closed beta while the service is being validated.', sections: [['Closed beta', 'Access may be limited, changed or withdrawn during testing.'], ['Your files', 'You keep ownership and must have the right to process submitted content.'], ['Availability', 'Beta features are provided as available and may fail. Keep independent copies.'], ['Acceptable use', 'Do not distribute malware, violate rights or evade platform safeguards.']] },
    ru: { eyebrow: 'Условия бета-версии', title: 'Условия использования FileFlow', intro: 'Эти условия определяют правила использования сервиса во время тестирования.', sections: [['Закрытая бета-версия', 'Доступ во время тестирования может быть ограничен, изменён или отозван.'], ['Ваши файлы', 'Вы сохраняете права на файлы и должны иметь право обрабатывать отправляемые материалы.'], ['Доступность', 'Бета-функции могут работать нестабильно. Храните независимые копии важных файлов.'], ['Допустимое использование', 'Нельзя распространять вредоносное ПО, нарушать права или обходить защиту платформ.']] },
    es: { eyebrow: 'Términos beta', title: 'Términos de la beta de FileFlow', intro: 'Estos términos definen el uso del servicio mientras se valida.', sections: [['Beta cerrada', 'El acceso puede limitarse, modificarse o retirarse durante las pruebas.'], ['Tus archivos', 'Conservas la propiedad y debes tener derecho a procesar el contenido enviado.'], ['Disponibilidad', 'Las funciones beta pueden fallar. Mantén copias independientes de los archivos importantes.'], ['Uso aceptable', 'No distribuyas malware, infrinjas derechos ni eludas las protecciones de la plataforma.']] },
  },
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const { language } = useFileFlowLanguage();
  const text = documents[kind][language];
  const common = shared[language];
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link className="landing-brand" href="/" aria-label="FileFlow home">
          <Image src="/brand/fileflow-mark.png" alt="" width={34} height={30} priority />
          <strong>FileFlow</strong>
        </Link>
        <Link href="/#workspace-flow">{common.back}</Link>
      </header>
      <article className="legal-document">
        <p className="legal-eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p className="legal-intro">{text.intro}</p>
        <p className="legal-updated">{common.updated}</p>
        {text.sections.map(([title, body]) => (
          <section key={title}><h2>{title}</h2><p>{body}</p></section>
        ))}
      </article>
    </main>
  );
}
