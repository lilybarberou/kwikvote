import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import Navigation from '@/components/Navigation';
import './globals.css';
import Head from 'next/head';
import Footer from '@/components/Footer';

export const fontSans = FontSans({
    subsets: ['latin'],
    variable: '--font-sans',
});

export const metadata: Metadata = {
    title: 'KwikVote',
    description: 'Créez un sondage en quelques secondes et partagez-le avec vos amis.',
    manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
            <Head>
                <link rel="icon" href="/favicon.ico" />
                <meta name="theme-color" content="#000000" />
            </Head>
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
