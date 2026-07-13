import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import './globals.css';
import { getMessages, type Locale } from '@/lib/i18n';

export const metadata = {
  title: 'Core',
  description: 'Merit, not noise.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const headerList = headers();
  const locale = (headerList.get('x-core-locale') as Locale) ?? 'ar';
  const dir = headerList.get('x-core-dir') ?? 'rtl';

  return (
    <html lang={locale} dir={dir} className="dark">
      <body className="min-h-screen bg-bg-base text-ink-primary antialiased">
        {/* Messages are read server-side per-page (getMessages(locale)) and
            passed down rather than re-fetched per component, so the whole
            tree renders in one locale with no flash of the wrong direction. */}
        <div data-locale={locale}>{children}</div>
        <script
          // Registers the offline-first service worker. Kept inline + tiny
          // rather than a separate bundle, since this is the only JS that
          // must run before hydration.
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js')); }`,
          }}
        />
      </body>
    </html>
  );
}
