import type {Metadata} from 'next';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FirebaseProvider } from '@/components/FirebaseProvider';
import { AudioProvider } from '@/components/AudioProvider';
import { AppLayout } from '@/components/AppLayout';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LanguageProvider } from '@/components/LanguageProvider';
import { ThemeCustomizerProvider } from '@/components/ThemeCustomizerProvider';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: 'Pfeilwurf.de – Dart Turnier & Liga Manager',
    template: '%s | Pfeilwurf.de',
  },
  description: 'Verwalte Dart-Turniere, Liga-Spieltage und Spielerstatistiken. Pfeilwurf.de – die digitale Dart-Verwaltung für dein Team.',
  keywords: ['Dart', 'Turnier', 'Liga', 'Darts', 'Pfeilwurf', 'Manager', 'Statistiken'],
  authors: [{ name: 'Pfeilwurf.de' }],
  creator: 'Pfeilwurf.de',
  robots: {
    index: false,
    follow: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pfeilwurf',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Pfeilwurf.de – Dart Turnier & Liga Manager',
    description: 'Turniere, Liga & Statistiken – alles für dein Dart-Team',
    type: 'website',
    locale: 'de_DE',
    siteName: 'Pfeilwurf.de',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="de" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#e11d48" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ThemeCustomizerProvider>
            <LanguageProvider>
              <ErrorBoundary>
                <FirebaseProvider>
                  <AudioProvider>
                    <AppLayout>
                      {children}
                    </AppLayout>
                  </AudioProvider>
                </FirebaseProvider>
              </ErrorBoundary>
            </LanguageProvider>
          </ThemeCustomizerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
