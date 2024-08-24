import { Providers } from "@/components/Providers";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/navigation/Navigation";
import { Toaster } from "@/components/ui/toaster";
import { fontSans } from "@/lib/fonts";
import type { Metadata } from "next";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KwikVote",
    template: "%s | KwikVote",
  },
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
    <html lang="fr" suppressHydrationWarning>
      <head>
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="1737b9ee-eca6-41c3-82c5-d0a58c2b4ea0"
        />
      </head>
      <body
        className={`flex min-h-screen flex-col items-center bg-background font-sans antialiased ${fontSans.variable}`}
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
