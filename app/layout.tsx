import type { Metadata } from 'next';
import { Inter as FontSans } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import Navigation from '@/components/Navigation';
import './globals.css';

export const fontSans = FontSans({
    subsets: ['latin'],
    variable: '--font-sans',
});

export const metadata: Metadata = {
    title: 'Kwikvote',
    description: 'Créez un sondage en quelques secondes et partagez-le avec vos amis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
            <body className={`dark py-3 px-5 flex justify-center min-h-screen bg-background font-sans antialiased ${fontSans.variable}`}>
                <main className="w-full max-w-3xl">
                    <Navigation />
                    {children}
                    <Toaster />
                </main>
            </body>
        </html>
    );
}
