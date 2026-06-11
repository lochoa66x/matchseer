import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatchSeer",
  description:
    "AI-assisted World Cup forecasts, match tracking, and team/player comparisons.",
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
