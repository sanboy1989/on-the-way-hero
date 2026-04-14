import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title:       'On The Way Hero',
  description: 'Calgary community errand delivery platform',
  manifest:    '/manifest.json',
  appleWebApp: {
    capable:          true,
    statusBarStyle:   'black-translucent',
    title:            'OTW Hero',
  },
};

export const viewport: Viewport = {
  themeColor:    '#FF8C00',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  );
}
