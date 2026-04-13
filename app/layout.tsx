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
  title: 'Dart Tournament Manager',
  description: 'Digital tournament manager for dart events',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
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
