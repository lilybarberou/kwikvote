import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import Navigation from '@/components/Navigation';
import './globals.css';
import Footer from '@/components/Footer';
import Script from 'next/script';

export const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'KwikVote',
  description: 'Créez un sondage en quelques secondes et partagez-le avec vos amis.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'KwikVote',
    description: 'Créez un sondage en quelques secondes et partagez-le avec vos amis.',
    locale: 'fr_FR',
    url: 'https://kwikvote.app',
    siteName: 'KwikVote',
    type: 'website',
    images: [
      {
        url: 'https://api.lilybarberou.fr/assets/screenshots/kwikvote.app/kwikvote.app.png',
        width: 1200,
        height: 630,
        alt: 'KwikVote',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <Script src="https://cloud.umami.is/script.js" data-website-id="1737b9ee-eca6-41c3-82c5-d0a58c2b4ea0" />
      </head>
      <body className={`dark min-h-screen flex flex-col items-center bg-background font-sans antialiased ${fontSans.variable}`}>
        <Navigation />
        <main className="w-full px-4 max-w-6xl">
          {children}
          <Toaster />
        </main>
        <Footer />
      </body>
    </html>
  );
}
