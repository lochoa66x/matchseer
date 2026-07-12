import type { MetadataRoute } from "next";
import { soccerCompetitions } from "../lib/soccer-competitions";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://matchseer.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://matchseer.com/profootball",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://matchseer.com/fantasyseer",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://matchseer.com/soccer",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.75,
    },
    ...soccerCompetitions.map((competition) => ({
      url: `https://matchseer.com${competition.route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: competition.key === "world-cup" ? 0.9 : 0.72,
    })),
  ];
}
