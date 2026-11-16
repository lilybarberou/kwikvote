import { Providers } from "@/components/Providers";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/navigation/Navigation";
import { Toaster } from "@/components/ui/toaster";
import { env } from "@/lib/env";
import type { Metadata } from "next";
import Script from "next/script";
import { NuqsAdapter } from "nuqs/adapters/next/app";

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
    // Next 16 no longer resets the smooth scroll of globals.css on navigation
    // without this attribute
    <html lang="fr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script
          src="https://umami.lilybarberou.fr/script.js"
          data-website-id={env.UMAMI_WEBSITE_ID}
          // never the query strings (?password= of the admin, ?email=)
          data-exclude-search="true"
        />
      </head>
      <body
        className="flex min-h-screen flex-col items-center bg-background font-sans antialiased"
      >
        <NuqsAdapter>
          <Providers>
            {/* first stop of the keyboard, only visible when focused */}
            <a
              href="#contenu"
              className="sr-only rounded-md bg-background px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:ring-2 focus:ring-ring"
            >
              Aller au contenu
            </a>
            <Navigation />
            <main id="contenu" className="w-full max-w-6xl px-4">
              {children}
              <Toaster />
            </main>
            <Footer />
          </Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}
