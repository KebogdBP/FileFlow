import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fileflow.app'),
  title: { default: 'File Flow — private file tools', template: '%s | File Flow' },
  description:
    'Convert, compress and prepare documents and media with visible privacy controls.',
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
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
