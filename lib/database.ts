import { sampleMatches } from "./sample-data";

export type DataSourceStatus = "sample" | "database-unavailable";

export async function listMatches() {
  return {
    source: "sample" satisfies DataSourceStatus,
    matches: sampleMatches,
  };
}

export async function getMatch(matchId: string) {
  return {
    source: "sample" satisfies DataSourceStatus,
    match: sampleMatches.find((match) => match.id === matchId) ?? null,
  };
}

export function getDatabaseReadiness() {
  return {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    driver: "pending-install",
    note: "Neon is connected in Vercel. Local package installation for the Neon driver was blocked by npm registry DNS during Sprint 2.",
  };
}

