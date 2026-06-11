export type Language = "en" | "es" | "fr";

export type MatchStatus = "Live" | "Upcoming" | "Final";

export type TeamRating = {
  name: string;
  code: string;
  color: string;
  record: string;
  form: string[];
  attack: number;
  control: number;
  defense: number;
  setPieces: number;
};

export type PlayerSpark = {
  name: string;
  team: string;
  role: string;
  club: string;
  league: string;
  spark: number;
  note: string;
};

export type ForecastCopy = {
  tone: Record<Language, string>;
  reasons: Record<Language, string[]>;
};

export type MatchForecast = ForecastCopy & {
  home: number;
  draw: number;
  away: number;
  confidence: number;
  chaos: number;
  projected: string;
};

export type MatchSummary = {
  id: string;
  status: MatchStatus;
  minute?: string;
  group: string;
  time: string;
  venue: string;
  city: string;
  home: TeamRating;
  away: TeamRating;
  score?: string;
  forecast: MatchForecast;
  weather: {
    temp: string;
    wind: string;
    mood: Record<Language, string>;
  };
  referee: {
    name: string;
    cardRisk: string;
  };
  players: PlayerSpark[];
};

export type ForecastInterpretationRequest = {
  matchId: string;
  language: Language;
};

export type ForecastInterpretation = {
  language: Language;
  headline: string;
  summary: string;
  toneLine: string;
  keyFactors: Array<{
    label: string;
    team?: string;
    explanation: string;
  }>;
  missingDataNotes: string[];
  disclaimer: string;
};

export const restrictedBettingTerms = [
  "odds",
  "bets",
  "betting",
  "picks",
  "locks",
  "parlays",
  "lines",
  "wager",
  "guaranteed",
  "sure thing",
  "value bet",
  "bookmaker",
];

export function hasRestrictedBettingLanguage(value: string) {
  const normalized = value.toLowerCase();
  return restrictedBettingTerms.some((term) => normalized.includes(term));
}

