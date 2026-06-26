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
  isPlaceholder?: boolean;
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

export type TrailSignal = {
  id: string;
  label: string;
  tone: "boost" | "drag" | "chaos" | "steady";
  text: Record<Language, string>;
};

export type MatchForecast = ForecastCopy & {
  home: number;
  draw: number;
  away: number;
  version?: number;
  generatedAt?: string | null;
  confidence: number;
  chaos: number;
  projected: string;
  isPending?: boolean;
  marketPulse?: MarketPulse | null;
  goalModel?: GoalModelForecast | null;
  knockout?: KnockoutForecast | null;
  trail?: TrailSignal[];
};

export type GoalModelSignal = {
  id: string;
  label: Record<Language, string>;
  value: number;
  tone: "over" | "under" | "clean" | "balanced";
  text: Record<Language, string>;
};

export type GoalModelForecast = {
  homeXg: number;
  awayXg: number;
  totalXg: number;
  homeCleanSheet: number;
  awayCleanSheet: number;
  over25: number;
  under25: number;
  bothTeamsScore: number;
  projectedScore: string;
  signals: GoalModelSignal[];
};

export type KnockoutForecast = {
  phase: string;
  regulationDraw: number;
  extraTime: number;
  penalties: number;
  homeAdvance: number;
  awayAdvance: number;
  projectedAdvancer: "home" | "away";
  summary: Record<Language, string>;
};

export type MarketPulse = {
  source: "polymarket" | "manual";
  capturedAt?: string | null;
  home: number;
  draw: number;
  away: number;
  liquidityScore: number;
  confidenceDelta: number;
  chaosDelta: number;
  adjustedConfidence: number;
  adjustedChaos: number;
  alignment: "aligned" | "split" | "thin";
  leader: "home" | "draw" | "away";
  summary: Record<Language, string>;
};

export type MatchSummary = {
  id: string;
  status: MatchStatus;
  minute?: string;
  startsAt?: string | null;
  stage?: string | null;
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

export const restrictedToneTerms = [
  "sombrero",
  "costume",
  "fiesta",
  "siesta",
  "tequila",
];

export function hasRestrictedBettingLanguage(value: string) {
  const normalized = value.toLowerCase();
  return restrictedBettingTerms.some((term) => normalized.includes(term));
}

export function hasRestrictedToneLanguage(value: string) {
  const normalized = value.toLowerCase();
  return restrictedToneTerms.some((term) => normalized.includes(term));
}
