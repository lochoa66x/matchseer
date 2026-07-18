export type SoccerCompetitionKey =
  | "world-cup"
  | "liga-mx"
  | "champions-league";

export type SoccerCompetitionMode =
  | "international-knockout"
  | "domestic-league"
  | "continental-league";

export type SoccerCompetitionConfig = {
  key: SoccerCompetitionKey;
  name: string;
  shortName: string;
  route: string;
  mode: SoccerCompetitionMode;
  region: string;
  seasonLabel: string;
  heroLabel: string;
  promise: string;
  liveDataStatus: "connected" | "provider-ready" | "manual-needed";
  footballDataCode?: string;
  databaseCompetitionSlug: string;
  databaseCompetitionName: string;
  primaryStageLabel: string;
  tableLabel: string;
  bracketLabel: string;
  accent: string;
  secondaryAccent: string;
  modelNotes: string[];
};

export const soccerCompetitions: SoccerCompetitionConfig[] = [
  {
    key: "world-cup",
    name: "World Cup",
    shortName: "WC",
    route: "/soccer/world-cup",
    mode: "international-knockout",
    region: "Global",
    seasonLabel: "2026",
    heroLabel: "Cup Seer",
    promise:
      "Tournament reads, knockout paths, travel, rest, weather, and Seer receipts.",
    liveDataStatus: "connected",
    footballDataCode: "WC",
    databaseCompetitionSlug: "fifa-world-cup-2026",
    databaseCompetitionName: "World Cup",
    primaryStageLabel: "Knockout path",
    tableLabel: "Group archive",
    bracketLabel: "Tournament path",
    accent: "#D8B45D",
    secondaryAccent: "#37B889",
    modelNotes: [
      "Separate 90-minute draw reads from advancement reads.",
      "Keep penalties, extra time, travel, and rest visible as receipts.",
      "Retire completed rounds into archive mode once the tournament closes.",
    ],
  },
  {
    key: "liga-mx",
    name: "Liga MX",
    shortName: "LMX",
    route: "/soccer/liga-mx",
    mode: "domestic-league",
    region: "Mexico",
    seasonLabel: "Apertura / Clausura",
    heroLabel: "Liga Seer",
    promise:
      "Matchday reads for altitude, travel, form streaks, table pressure, and liguilla paths.",
    liveDataStatus: "manual-needed",
    databaseCompetitionSlug: "liga-mx-2026",
    databaseCompetitionName: "Liga MX",
    primaryStageLabel: "Current matchday",
    tableLabel: "Table pressure",
    bracketLabel: "Liguilla path",
    accent: "#D8B45D",
    secondaryAccent: "#9DB7E8",
    modelNotes: [
      "Altitude and travel matter more than generic home advantage.",
      "Separate regular-season table pressure from liguilla knockout logic.",
      "Use short-tournament volatility so early streaks do not become gospel.",
    ],
  },
  {
    key: "champions-league",
    name: "Champions League",
    shortName: "UCL",
    route: "/soccer/champions-league",
    mode: "continental-league",
    region: "Europe",
    seasonLabel: "2026-27",
    heroLabel: "Continental Seer",
    promise:
      "League-phase table reads, fixture congestion, travel, squad depth, and knockout paths.",
    liveDataStatus: "provider-ready",
    footballDataCode: "CL",
    databaseCompetitionSlug: "uefa-champions-league-2026",
    databaseCompetitionName: "Champions League",
    primaryStageLabel: "League phase",
    tableLabel: "League table",
    bracketLabel: "Knockout path",
    accent: "#D8B45D",
    secondaryAccent: "#9DB7E8",
    modelNotes: [
      "Fixture congestion and squad rotation are first-class model inputs.",
      "Away travel and rest gaps should nudge confidence, not overwhelm team strength.",
      "The league phase needs qualification-band logic before knockout logic turns on.",
    ],
  },
];

const soccerCompetitionByKey = new Map(
  soccerCompetitions.map((competition) => [competition.key, competition]),
);

export function findSoccerCompetition(
  key: string | null | undefined,
): SoccerCompetitionConfig | null {
  if (!key) {
    return null;
  }

  return soccerCompetitionByKey.get(key as SoccerCompetitionKey) ?? null;
}

export function getSoccerCompetition(
  key: string | null | undefined,
): SoccerCompetitionConfig {
  return findSoccerCompetition(key) ?? soccerCompetitions[0];
}

export function soccerCompetitionKeys() {
  return soccerCompetitions.map((competition) => competition.key);
}
