import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fileflow.app'),
  title: { default: 'File Flow — private file tools', template: '%s | File Flow' },
  description: 'Convert, compress and prepare documents and media with visible privacy controls.',
  applicationName: 'File Flow',
  category: 'productivity',
  keywords: [
    'file converter',
    'compress PDF',
    'compress video',
    'PDF tools',
    'video converter',
    'private file tools',
  ],
  authors: [{ name: 'File Flow' }],
  creator: 'File Flow',
  publisher: 'File Flow',
  formatDetection: { email: false, address: false, telephone: false },
  icons: { icon: '/brand/fileflow-mark.png', apple: '/brand/fileflow-mark.png' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    try {
      const savedTheme = localStorage.getItem('fileflow-theme');
      const dark = savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const savedLanguage = localStorage.getItem('fileflow-language');
      if (savedLanguage === 'en' || savedLanguage === 'ru' || savedLanguage === 'es') {
        document.documentElement.lang = savedLanguage;
      }
    } catch {}
  `;
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
