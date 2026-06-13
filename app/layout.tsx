import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://matchseer.com"),
  title: {
    default: "MatchSeer",
    template: "%s | MatchSeer",
  },
  description:
    "Playful World Cup match forecasts powered by real stats, AI readouts, weather, team form, and player sparks. No betting advice.",
  applicationName: "MatchSeer",
  authors: [{ name: "MatchSeer" }],
  icons: {
    icon: [
      {
        url: "/brand/matchseer-app-icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "/brand/matchseer-app-icon.svg",
        type: "image/svg+xml",
      },
    ],
  },
  keywords: [
    "MatchSeer",
    "World Cup",
    "football forecasts",
    "soccer stats",
    "AI sports analysis",
    "team comparison",
    "player comparison",
  ],
  openGraph: {
    title: "MatchSeer",
    description:
      "Real stats, playful World Cup readouts, and zero betting energy.",
    url: "https://matchseer.com",
    siteName: "MatchSeer",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "MatchSeer matchday forecast preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MatchSeer",
    description:
      "Real stats, playful World Cup readouts, and zero betting energy.",
    images: ["/twitter-image"],
  },
  alternates: {
    canonical: "https://matchseer.com",
    languages: {
      en: "https://matchseer.com?lang=en",
      es: "https://matchseer.com?lang=es",
      fr: "https://matchseer.com?lang=fr",
    },
  },
  category: "sports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
