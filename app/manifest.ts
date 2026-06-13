import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MatchSeer",
    short_name: "MatchSeer",
    description:
      "Playful World Cup match forecasts powered by real stats and AI readouts.",
    start_url: "/",
    display: "standalone",
    background_color: "#070A11",
    theme_color: "#0B132B",
    categories: ["sports", "entertainment"],
    icons: [
      {
        src: "/brand/matchseer-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
