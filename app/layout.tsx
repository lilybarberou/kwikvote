import Footer from "@/components/Footer";
import Navigation from "@/components/Navigation";
import { Providers } from "@/components/Providers";
import { Toaster } from "@/components/ui/toaster";
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import Script from "next/script";

import "./globals.css";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "KwikVote",
  description:
    "Créez un sondage en quelques secondes et partagez-le avec vos amis.",
  manifest: "/manifest.json",
  openGraph: {
    title: "KwikVote",
    description:
      "Créez un sondage en quelques secondes et partagez-le avec vos amis.",
    locale: "fr_FR",
    url: "https://kwikvote.app",
    siteName: "KwikVote",
    type: "website",
    images: [
      {
        url: "https://api.lilybarberou.fr/assets/screenshots/kwikvote.app/kwikvote.app.png",
        width: 1200,
        height: 630,
        alt: "KwikVote",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="1737b9ee-eca6-41c3-82c5-d0a58c2b4ea0"
        />
      </head>
      <body
        className={`dark flex min-h-screen flex-col items-center bg-background font-sans antialiased ${fontSans.variable}`}
      >
        <Providers>
          <Navigation />
          <main className="w-full max-w-6xl px-4">
            {children}
            <Toaster />
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
