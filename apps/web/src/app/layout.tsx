import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'FileFlow', template: '%s | FileFlow' },
  description: 'Private file tools that run locally whenever possible.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
