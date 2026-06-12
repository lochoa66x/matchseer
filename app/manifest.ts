import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MatchSeer",
    short_name: "MatchSeer",
    description:
      "Playful World Cup match forecasts powered by real stats and AI readouts.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ed",
    theme_color: "#101820",
    categories: ["sports", "entertainment"],
  };
}
