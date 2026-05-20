import type { Metadata } from 'next';
import './globals.css';

const faviconUrl = '/favicon.ico?v=predictarena-logo-20260520';

export const metadata: Metadata = {
  title: 'PredictArena',
  description: 'Autonomous prediction-market agent arena for Arc Testnet signal bonds.',
  icons: {
    icon: [
      { url: faviconUrl, sizes: 'any', type: 'image/x-icon' },
      { url: '/predictarena-logo.png', type: 'image/png', sizes: '1024x1024' }
    ],
    shortcut: [{ url: faviconUrl, type: 'image/x-icon' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
