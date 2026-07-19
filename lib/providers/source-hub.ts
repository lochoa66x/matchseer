import { soccerCompetitions } from "../soccer-competitions";

export type SourceHubStatus = {
  source: "football-data" | "open-meteo" | "polymarket" | "kalshi" | "metaculus";
  label: string;
  purpose: string;
  status: "live" | "ready" | "needs-config" | "manual-needed";
  mode: "results" | "weather" | "crowd-signal" | "forecast-receipt";
  affectsModel: "baseline" | "calibrated-nudge" | "receipt-only";
  requiredEnv: string[];
  envStatus: Record<string, boolean>;
  note: string;
};

export function buildSourceHubStatus(): SourceHubStatus[] {
  const hasFootballDataToken = Boolean(process.env.FOOTBALL_DATA_API_TOKEN);
  const hasSyncSecret = Boolean(process.env.MATCHSEER_SYNC_SECRET);
  const hasKalshiEndpoint = Boolean(process.env.KALSHI_MARKETS_URL);
  const hasKalshiKey = Boolean(process.env.KALSHI_API_KEY);
  const hasMetaculusEndpoint = Boolean(process.env.METACULUS_QUESTIONS_URL);

  return [
    {
      source: "football-data",
      label: "football-data",
      purpose: "Real fixtures, final results, match status, venue names, and standings when the competition supports them.",
      status: hasFootballDataToken && hasSyncSecret ? "live" : "needs-config",
      mode: "results",
      affectsModel: "baseline",
      requiredEnv: ["FOOTBALL_DATA_API_TOKEN", "MATCHSEER_SYNC_SECRET"],
      envStatus: {
        FOOTBALL_DATA_API_TOKEN: hasFootballDataToken,
        MATCHSEER_SYNC_SECRET: hasSyncSecret,
      },
      note: "World Cup and Champions League can use this provider. Liga MX still needs a separate provider or manual import.",
    },
    {
      source: "open-meteo",
      label: "Open-Meteo",
      purpose: "Venue weather context for heat, wind, humidity, and matchday conditions.",
      status: "live",
      mode: "weather",
      affectsModel: "calibrated-nudge",
      requiredEnv: [],
      envStatus: {},
      note: "Keyless feed. Works when venues have coordinates.",
    },
    {
      source: "polymarket",
      label: "Polymarket",
      purpose: "Public crowd/market pulse for open match markets.",
      status: hasSyncSecret ? "ready" : "needs-config",
      mode: "crowd-signal",
      affectsModel: "calibrated-nudge",
      requiredEnv: ["MATCHSEER_SYNC_SECRET"],
      envStatus: {
        MATCHSEER_SYNC_SECRET: hasSyncSecret,
      },
      note: "Already wired as a capped nudge. Settled or illiquid markets are ignored.",
    },
    {
      source: "kalshi",
      label: "Kalshi",
      purpose: "Regulated market signal, useful as a separate crowd receipt when relevant sports markets exist.",
      status: hasKalshiEndpoint && (hasKalshiKey || process.env.KALSHI_PUBLIC_ONLY === "1")
        ? "ready"
        : "needs-config",
      mode: "forecast-receipt",
      affectsModel: "receipt-only",
      requiredEnv: ["KALSHI_MARKETS_URL"],
      envStatus: {
        KALSHI_MARKETS_URL: hasKalshiEndpoint,
        KALSHI_API_KEY: hasKalshiKey,
        KALSHI_PUBLIC_ONLY: process.env.KALSHI_PUBLIC_ONLY === "1",
      },
      note: "Keep as receipt-only until market matching and calibration are proven.",
    },
    {
      source: "metaculus",
      label: "Metaculus",
      purpose: "Forecast-community questions that can become a long-horizon receipt for tournaments and title paths.",
      status: hasMetaculusEndpoint ? "ready" : "needs-config",
      mode: "forecast-receipt",
      affectsModel: "receipt-only",
      requiredEnv: ["METACULUS_QUESTIONS_URL"],
      envStatus: {
        METACULUS_QUESTIONS_URL: hasMetaculusEndpoint,
      },
      note: "Use for tournament/title receipts first, not direct match probabilities.",
    },
  ];
}

export function buildCompetitionDataStatus() {
  return soccerCompetitions.map((competition) => ({
    key: competition.key,
    name: competition.name,
    liveDataStatus: competition.liveDataStatus,
    footballDataCode: competition.footballDataCode ?? null,
    databaseCompetitionSlug: competition.databaseCompetitionSlug,
    note:
      competition.footballDataCode
        ? `${competition.name} can sync through football-data with code ${competition.footballDataCode}.`
        : `${competition.name} still needs a dedicated results/statistics provider before it is live-data complete.`,
  }));
}
