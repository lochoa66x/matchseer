"use client";

import {
  Activity,
  BrainCircuit,
  ChevronRight,
  ClipboardList,
  FileImage,
  Gauge,
  HeartPulse,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  UsersRound,
  Wind,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  applyFantasyProviderBridge,
  buildFantasyMatchupWeaknessPlan,
  createSeededFantasyPlayerPool,
  createManualFantasyLeague,
  createFantasyProviderBridgeImport,
  mergeFantasyPlayerPools,
  sanitizeImportedFantasyLeague,
  type FantasyMatchupPlanPlayer,
  type FantasyMatchupPlanPosition,
  type FantasyMatchupWeaknessPlan,
  type FantasyProviderBridgeImport,
  type FantasyProjectionMatchupContext,
  type FantasySourceProjection,
  type ImportedFantasyLineupSlot,
  type ImportedFantasyLeague,
  type ImportedFantasyTeam,
  type NflFantasyPlayer,
  type SleeperLeagueOption,
} from "../../lib/nfl-fantasy-import";
import type { SeerVoiceId } from "../../lib/domain";
import {
  defaultNflVoiceId,
  getSeerVoice,
  seerVoiceOptionsForMode,
  type SeerVoiceProfile,
} from "../../lib/seer-voices";
import {
  buildFantasyTradePackages,
  type FantasyTradeBuilderResult,
  type FantasyTradeImpactPreview,
  type FantasyTradePlayer,
  type FantasyTradePosition,
  type FantasyTradeTeam,
} from "../../lib/nfl-fantasy-trades";
import {
  rankFantasyLeaguePower,
  type FantasyPowerPositionRank,
  type FantasyPowerRankedTeam,
  type FantasyPowerTeamInput,
  type FantasyPowerTier,
  type FantasyPowerTradePartner,
} from "../../lib/nfl-fantasy-power-map";

type ScoringFormat = "standard" | "halfPpr" | "fullPpr";
type FantasyTeamLens = "redraft" | "dynasty";
type ScoutingPosition = "ALL" | "QB" | "RB" | "WR" | "TE" | "K" | "DST";
type ScoutingPlayerPosition = Exclude<ScoutingPosition, "ALL">;
type ScoutingDepth = "top10" | "top25" | "deep";
type ScoutingBoardMode = "general" | "available" | "topPicks" | "ultraDeep";
type FantasyProviderStatusValue = "live" | "fallback" | "missing" | "error";
type FantasyProviderFreshness = "fresh" | "stale" | "unknown";
type FantasyProviderKind = "sleeper" | "players" | "projections" | "rankings";
type FantasySourceLaneKind = "roster" | "projection" | "ranking" | "context" | "crowd";
type FantasyPosition = ScoutingPlayerPosition;
type FantasyPositionCounts = Record<FantasyPosition, number>;
type NflLabMode = "nfl" | "fantasy";
type FantasyView =
  | "overview"
  | "players"
  | "roster"
  | "league"
  | "trades"
  | "rookies"
  | "compare";
type FantasyActionKind = "start" | "watch" | "swap" | "market";
type FantasyActionStrength = "high" | "medium" | "low";
type FantasyLineupSlotId = string;
type NflSeasonPhase = "preseason" | "regular";
type NflDivision =
  | "AFC East"
  | "AFC North"
  | "AFC South"
  | "AFC West"
  | "NFC East"
  | "NFC North"
  | "NFC South"
  | "NFC West";
type NflSlateGroup = "all" | "AFC" | "NFC" | NflDivision;

type FantasyActionItem = {
  kind: FantasyActionKind;
  state: FantasyDecisionState;
  title: string;
  playerName?: string;
  label: string;
  detail: string;
  meta: string;
  confidence: string;
  edge: string;
  why: string;
  risk: string;
  fallback: string;
  strength: FantasyActionStrength;
};

type FantasyDecisionState =
  | "Start now"
  | "Conditional start"
  | "Conditional move"
  | "True coin flip"
  | "Risk alert"
  | "Waiver/trade idea";

type FantasyPressureLane = {
  label: string;
  priority: string;
  positionLabel: string;
  summary: string;
};

type FantasyCoachMove = {
  call: string;
  confidence: string;
  edge: string;
  fallback: string;
  playerName?: string;
  risk: string;
  state: FantasyDecisionState;
  tone: FantasyActionKind;
  why: string;
};

type FantasyRosterMapItem = {
  band: string;
  detail: string;
  label: string;
  tone: "strong" | "steady" | "watch";
};

type FantasyWeeklyCoachRead = {
  bestMove: FantasyCoachMove;
  pressure: FantasyPressureLane;
  receipts: string[];
  rosterMap: FantasyRosterMapItem[];
};

type NflGameCardRead = {
  confidenceLabel: string;
  favorite: NflTeam;
  favoritePath: string;
  flipFactors: string[];
  gameTypeLabel: string;
  isPreseason: boolean;
  leanLabel: string;
  leanStrengthLabel: string;
  metricNotes: Array<{
    detail: string;
    label: string;
    value: string;
  }>;
  scorePathLabel: string;
  timeline: Array<{
    detail: string;
    label: string;
  }>;
  underdog: NflTeam;
  underdogPath: string;
  verdictHeadline: string;
  verdictSummary: string;
};

type NflOracleAngle = "close" | "weather" | "quarterback" | "trenches" | "clean";

type NflOracleContext = {
  angle: NflOracleAngle;
  favorite: NflTeam;
  gap: number;
  lead: string;
  matchup: NflMatchup;
  scenario: ScenarioImpact;
  underdog: NflTeam;
  weatherTeam: NflTeam;
};

type NflTeam = {
  code: string;
  name: string;
  city: string;
  color: string;
  offense: number;
  defense: number;
  qb: number;
  trenches: number;
  coaching: number;
  injuries: number;
};

type NflMatchup = {
  id: string;
  week: string;
  slot: string;
  startsAt?: string | null;
  venue: string;
  weather: string;
  home: NflTeam;
  away: NflTeam;
  sourceHomeWin?: number;
  sourceAwayWin?: number;
  homeWin: number;
  awayWin: number;
  projected: string;
  confidence: number;
  chaos: number;
  pace: number;
  read: string;
  edges: string[];
  marketPulse?: NflMarketPulse | null;
};

type NflSlateSelection = {
  phase: NflSeasonPhase;
  week: number;
};

type NflStandingRow = {
  code: string;
  name: string;
  division: NflDivision;
  conference: "AFC" | "NFC";
  wins: number;
  losses: number;
  ties: number;
  projectedFor: number;
  projectedAgainst: number;
  strength: number;
};

type FantasyPlayer = NflFantasyPlayer;

type FantasyProjection = {
  projection: number;
  floor: number;
  ceiling: number;
};

type FantasyContextStatusValue = "live" | "partial" | "fallback";
type FantasyContextFreshness = "fresh" | "stale" | "unknown";
type FantasyContextAdjustmentKind =
  | "matchup"
  | "weather"
  | "pace"
  | "role"
  | "volatility";

type FantasyContextAdjustment = {
  kind: FantasyContextAdjustmentKind;
  label: string;
  delta: number;
  summary: string;
};

type FantasyPlayerContext = {
  status: FantasyContextStatusValue;
  freshness: FantasyContextFreshness;
  source: string;
  message: string;
  opponent: string;
  opponentCode: string;
  venue: string;
  weather: string;
  roof: string;
  surface: string;
  pace: number;
  opponentDefense: number;
  defenseVsPosition: number;
  teamHealth: number;
  gameScript: number;
  roleSignal: number;
  redZoneSignal: number;
  touchSignal: number;
  adjustments: FantasyContextAdjustment[];
  projectionNudge: number;
  totalDelta: number;
  chips: string[];
};

type NflFantasyTeamContext = {
  status: FantasyContextStatusValue;
  freshness: FantasyContextFreshness;
  source: string;
  message: string;
  team: string;
  opponent: string;
  opponentCode: string;
  venue: string;
  weather: string;
  roof: string;
  surface: string;
  pace: number;
  teamWin: number;
  opponentWin: number;
  teamOffense: number;
  opponentOffense: number;
  opponentDefense: number;
  opponentTrenches: number;
  opponentCoaching: number;
  teamHealth: number;
};

type FantasyContextLayer = {
  byTeam: Record<string, NflFantasyTeamContext>;
  status: FantasyContextStatus;
};

type FantasyContextStatus = {
  status: FantasyContextStatusValue;
  freshness: FantasyContextFreshness;
  coveredTeams: number;
  totalTeams: number;
  message: string;
  warnings: string[];
};

type ScoutingRow = FantasyPlayer & {
  fantasy: FantasyProjection;
  context: FantasyPlayerContext;
  contextProjection: FantasyProjection;
  rankDelta: number;
  score: number;
};

type FantasyTeam = ImportedFantasyTeam;

type FantasyLineupSlotDefinition = {
  id: FantasyLineupSlotId;
  label: string;
  positions: ScoutingPlayerPosition[];
};

type FantasyLineupSlotPick = {
  id: FantasyLineupSlotId;
  label: string;
  player: ScoutingRow | null;
  context: FantasyPlayerContext | null;
  sourceProjection: number;
  seerProjection: number;
  contextDelta: number;
  delta: number;
  receipt: string;
  tags: string[];
  adjustmentReceipts: FantasyContextAdjustment[];
};

type FantasyDecisionReceipt = {
  label: string;
  player: ScoutingRow;
  sourceProjection: number;
  seerProjection: number;
  delta: number;
  summary: string;
  tags: string[];
  adjustmentReceipts: FantasyContextAdjustment[];
};

type FantasyBenchAlternative = {
  player: ScoutingRow;
  slotLabel: string;
  lift: number;
  summary: string;
};

type FantasyCloseCall = {
  slotLabel: string;
  starter: ScoutingRow;
  challenger: ScoutingRow;
  gap: number;
  summary: string;
};

type FantasyRosterLane = {
  label: string;
  position: FantasyPosition;
  value: number;
  summary: string;
};

type FantasyTeamReport = {
  team: FantasyTeam;
  players: ScoutingRow[];
  benchPlayers: ScoutingRow[];
  lineup: FantasyLineupSlotPick[];
  lineupSourceProjection: number;
  lineupSeerDelta: number;
  startSitReceipts: FantasyDecisionReceipt[];
  benchAlternatives: FantasyBenchAlternative[];
  closeCalls: FantasyCloseCall[];
  strongestLane: FantasyRosterLane;
  weakestLane: FantasyRosterLane;
  projection: number;
  floor: number;
  ceiling: number;
  score: number;
  balance: number;
  depth: number;
  risk: number;
  dynastyCore: number;
  strengths: string[];
  weaknesses: string[];
  moves: string[];
  benchUpgrades: string[];
  tradeIdeas: string[];
};

type FantasyMatchupReport = {
  left: FantasyTeamReport;
  right: FantasyTeamReport;
  edgeTeam: FantasyTeam;
  edgeLabel: string;
  projectionGap: number;
  winLean: number;
  confidence: number;
  chaos: number;
  positionEdges: FantasyPositionEdge[];
  beatPlan: FantasyMatchupWeaknessPlan;
  strongestEdge: FantasyPositionEdge;
  swingFactors: string[];
  recommendation: string;
};

type FantasyLeaguePowerTeam = {
  report: FantasyTeamReport;
  rank: number;
  score: number;
  tier: FantasyPowerTier;
  starterScore: number;
  benchScore: number;
  dynastyScore: number;
  riskScore: number;
  volatility: number;
  injurySensitivity: number;
  strongestPosition: FantasyPositionEdge;
  weakestPosition: FantasyPositionEdge;
  positionRanks: FantasyPowerPositionRank[];
  easiestUpgrade: string;
  matchupWeakness: string;
  recommendation: string;
};

type FantasyMoveTargetKind = "waiver" | "trade" | "drop";
type FantasyMoveRisk = "safe floor" | "upside swing" | "stash" | "avoid";

type FantasyMoveTarget = {
  kind: FantasyMoveTargetKind;
  title: string;
  playerName: string;
  teamLabel: string;
  position: ScoutingPlayerPosition;
  risk: FantasyMoveRisk;
  action: string;
  reason: string;
  value: string;
};

type FantasyDeepResearchRow = {
  action: string;
  available: boolean;
  fit: string;
  player: ScoutingRow;
  reason: string;
  risk: string;
  score: number;
  tags: string[];
};

type FantasyLeaguePowerMap = {
  teams: FantasyLeaguePowerTeam[];
  active: FantasyLeaguePowerTeam;
  rankLabel: string;
  teamCount: number;
  easiestUpgrade: string;
  bestMatchup: FantasyLeaguePowerTeam;
  badMatchup: FantasyLeaguePowerTeam;
  moveTargets: FantasyMoveTarget[];
  tradePartners: FantasyPowerTradePartner[];
  recommendation: string;
};

type FantasyPositionEdge = {
  position: ScoutingPlayerPosition;
  leftProjection: number;
  rightProjection: number;
  gap: number;
  edgeTeamName: string;
  summary: string;
};

type NflScoutingAnalysis = {
  headline: string;
  summary: string;
  factors: string[];
  watchlist: string;
  disclaimer: string;
  source?: string;
};

type ScoutStatus = "idle" | "loading" | "ready" | "error";

type NflDataStatus = "loading" | "ready" | "fallback";
type FantasyImportStatus = "idle" | "loading" | "ready" | "error";
type SleeperImportStatus =
  | "idle"
  | "searching"
  | "leagues-found"
  | "loading-league"
  | "imported"
  | "no-matchup"
  | "error";

type NflProviderStatus = {
  schedule: "live" | "fallback";
  fantasy: "live" | "fallback";
  market: "live" | "fallback";
  notes: string[];
  fantasyProviders?: NflFantasyProviderStatus[];
  fantasyCoverage?: NflFantasyCoverageStatus;
};

type NflFantasyProviderStatus = {
  id: string;
  label: string;
  kind: FantasyProviderKind;
  status: FantasyProviderStatusValue;
  source: string | null;
  count: number;
  updatedAt: string | null;
  freshness: FantasyProviderFreshness;
  positions: FantasyPositionCounts;
  message: string;
};

type NflFantasyCoverageStatus = {
  totalPlayers: number;
  totalProjections: number;
  totalRankings: number;
  positions: Record<
    FantasyPosition,
    { players: number; projections: number; rankings: number; total: number }
  >;
  missingPositions: FantasyPosition[];
};

type FantasySourceRows = {
  roster: number;
  projections: number;
  rankings: number;
  context: number;
  crowd: number;
};

type FantasySourceLane = {
  id: string;
  kind: FantasySourceLaneKind;
  label: string;
  providerName: string;
  status: FantasyProviderStatusValue;
  freshness: FantasyProviderFreshness;
  source: string;
  trustWeight: number;
  rows: FantasySourceRows;
  positions: FantasyPositionCounts;
  message: string;
};

type SleeperLeagueOptionsResponse = {
  mode: "league-options";
  season: string;
  userId: string;
  username?: string;
  week?: number;
  leagues: SleeperLeagueOption[];
  message?: string;
};

type SleeperSavedConnection = {
  importedLeague: ImportedFantasyLeague;
  leagueId: string;
  query: string;
  refreshedAt: string;
  useAutoWeek: boolean;
  userId: string;
  week: string;
};

type NflSeerDataset = {
  source: "espn-scoreboard" | "configured-feed" | "seeded-fallback";
  season: string;
  weekLabel: string;
  updatedAt: string;
  matchups: NflMatchup[];
  fantasyPlayers: FantasyPlayer[];
  providerStatus: NflProviderStatus;
};

type NflMarketPulse = {
  source: "polymarket";
  capturedAt: string | null;
  home: number;
  away: number;
  liquidityScore: number;
  leader: "home" | "away";
  alignment: "aligned" | "split";
  marketSlug: string | null;
  question: string | null;
  nudge: {
    applied: boolean;
    homeDelta: number;
    awayDelta: number;
    cap: number;
    summary: string;
  };
};

const scoutingPositionOptions: Array<{ value: ScoutingPosition; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "QB", label: "QB" },
  { value: "RB", label: "RB" },
  { value: "WR", label: "WR" },
  { value: "TE", label: "TE" },
  { value: "K", label: "Kicker" },
  { value: "DST", label: "Def" },
];

const fantasyCoveragePositions: FantasyPosition[] = ["QB", "RB", "WR", "TE", "K", "DST"];

const nflPhaseLabels: Record<NflSeasonPhase, string> = {
  preseason: "Preseason",
  regular: "Regular season",
};

const nflWeeksByPhase: Record<NflSeasonPhase, number[]> = {
  preseason: [1, 2, 3],
  regular: Array.from({ length: 18 }, (_, index) => index + 1),
};

const nflSlateGroups: NflSlateGroup[] = [
  "all",
  "AFC",
  "NFC",
  "AFC East",
  "AFC North",
  "AFC South",
  "AFC West",
  "NFC East",
  "NFC North",
  "NFC South",
  "NFC West",
];

const nflTeamDivisions: Record<string, NflDivision> = {
  ARI: "NFC West",
  ATL: "NFC South",
  BAL: "AFC North",
  BUF: "AFC East",
  CAR: "NFC South",
  CHI: "NFC North",
  CIN: "AFC North",
  CLE: "AFC North",
  DAL: "NFC East",
  DEN: "AFC West",
  DET: "NFC North",
  GB: "NFC North",
  HOU: "AFC South",
  IND: "AFC South",
  JAX: "AFC South",
  KC: "AFC West",
  LAC: "AFC West",
  LAR: "NFC West",
  LV: "AFC West",
  MIA: "AFC East",
  MIN: "NFC North",
  NE: "AFC East",
  NO: "NFC South",
  NYG: "NFC East",
  NYJ: "AFC East",
  PHI: "NFC East",
  PIT: "AFC North",
  SEA: "NFC West",
  SF: "NFC West",
  TB: "NFC South",
  TEN: "AFC South",
  WAS: "NFC East",
};

const fantasyLineupSlots: FantasyLineupSlotDefinition[] = [
  { id: "QB", label: "QB", positions: ["QB"] },
  { id: "RB1", label: "RB1", positions: ["RB"] },
  { id: "RB2", label: "RB2", positions: ["RB"] },
  { id: "WR1", label: "WR1", positions: ["WR"] },
  { id: "WR2", label: "WR2", positions: ["WR"] },
  { id: "TE", label: "TE", positions: ["TE"] },
  { id: "FLEX", label: "FLEX", positions: ["RB", "WR", "TE"] },
  { id: "K", label: "K", positions: ["K"] },
  { id: "DEF", label: "DEF", positions: ["DST"] },
];

const scoutingDepthOptions: Array<{
  value: ScoutingDepth;
  label: string;
  limit: number;
  summary: string;
}> = [
  { value: "top10", label: "Shortlist", limit: 10, summary: "quick decisions" },
  { value: "top25", label: "Extended", limit: 25, summary: "bench and waivers" },
  { value: "deep", label: "Ultra deep", limit: 80, summary: "dynasty shelf" },
];

const scoutingBoardModeOptions: Array<{
  value: ScoutingBoardMode;
  label: string;
  summary: string;
}> = [
  {
    value: "general",
    label: "All players",
    summary: "full universe",
  },
  {
    value: "available",
    label: "Available now",
    summary: "waiver pool",
  },
  {
    value: "topPicks",
    label: "Top pickups",
    summary: "next add",
  },
  {
    value: "ultraDeep",
    label: "Ultra deep",
    summary: "stash lane",
  },
];

type ScenarioLevers = {
  wind: number;
  healthSwing: number;
  tempo: number;
  homeNoise: number;
};

type ScenarioFactor = {
  label: string;
  value: string;
  detail: string;
};

type ScenarioImpact = {
  awayWin: number;
  homeWin: number;
  projected: string;
  confidence: number;
  chaos: number;
  pace: number;
  weatherDrag: number;
  leanCode: string;
  leanProbability: number;
  read: string;
  factors: ScenarioFactor[];
};

const scoringLabels: Record<ScoringFormat, string> = {
  standard: "Standard",
  halfPpr: "Half PPR",
  fullPpr: "Full PPR",
};

const scoringCopy: Record<ScoringFormat, string> = {
  standard: "Prioritize touchdowns, yardage, and real weekly roles.",
  halfPpr: "Volume matters, but touchdowns still swing the week.",
  fullPpr: "Targets and receptions deserve extra trust.",
};

const teamLensLabels: Record<FantasyTeamLens, string> = {
  redraft: "Season-now",
  dynasty: "Dynasty",
};

const fantasyPowerTierLabels: Record<FantasyPowerTier, string> = {
  contender: "Contender",
  playoffHunt: "Playoff hunt",
  rebuild: "Rebuild",
  chaos: "Chaos team",
};

const receptionPoints: Record<ScoringFormat, number> = {
  standard: 0,
  halfPpr: 0.5,
  fullPpr: 1,
};

const independentSportsDisclaimer =
  "MatchSeer is an independent fantasy and sports analysis tool. It is not affiliated with, sponsored by, or endorsed by the NFL, any professional sports league, team, player, or player association.";
const experimentalUseDisclaimer =
  "Built for entertainment, learning, and real-world algorithm testing only. We do not support betting or gambling. Reads are MatchSeer's own interpretations based on available data, assumptions, and experimental models, and some signals may be speculative, incomplete, inaccurate, or unrelated to real outcomes.";
const proFootballShortDisclaimer =
  `${independentSportsDisclaimer} Pro Football Seer is for fun analysis and algorithm testing, not betting or professional advice.`;
const proFootballFullDisclaimer =
  `Pro Football Seer is an independent, experimental pro football analysis playground by MatchSeer. ${independentSportsDisclaimer} ${experimentalUseDisclaimer} Use it as a fun game companion, not as professional advice.`;
const fantasySeerShortDisclaimer =
  `${independentSportsDisclaimer} Fantasy Seer is for fun lineup analysis and algorithm testing, not betting or professional advice. Player visuals are generic MatchSeer avatars, never official photos, logos, helmets, or team marks.`;
const fantasySeerFullDisclaimer =
  `Fantasy Seer is an independent, experimental fantasy football analysis playground by MatchSeer. ${independentSportsDisclaimer} Player visuals are generic MatchSeer-created placeholders and do not represent official player photos, team logos, helmets, uniforms, or league marks. ${experimentalUseDisclaimer} Use it as a fun decision companion, not as professional advice.`;

const teams = {
  bal: {
    code: "BAL",
    name: "Ravens",
    city: "Baltimore",
    color: "#6b4ad3",
    offense: 88,
    defense: 84,
    qb: 92,
    trenches: 86,
    coaching: 89,
    injuries: 72,
  },
  buf: {
    code: "BUF",
    name: "Bills",
    city: "Buffalo",
    color: "#2f80ed",
    offense: 87,
    defense: 80,
    qb: 94,
    trenches: 78,
    coaching: 83,
    injuries: 76,
  },
  det: {
    code: "DET",
    name: "Lions",
    city: "Detroit",
    color: "#0fb5ff",
    offense: 90,
    defense: 78,
    qb: 84,
    trenches: 93,
    coaching: 91,
    injuries: 82,
  },
  phi: {
    code: "PHI",
    name: "Eagles",
    city: "Philadelphia",
    color: "#2dd4bf",
    offense: 86,
    defense: 85,
    qb: 85,
    trenches: 91,
    coaching: 84,
    injuries: 79,
  },
  kc: {
    code: "KC",
    name: "Chiefs",
    city: "Kansas City",
    color: "#ef4444",
    offense: 89,
    defense: 82,
    qb: 98,
    trenches: 81,
    coaching: 95,
    injuries: 75,
  },
  sf: {
    code: "SF",
    name: "49ers",
    city: "San Francisco",
    color: "#f59e0b",
    offense: 88,
    defense: 86,
    qb: 83,
    trenches: 88,
    coaching: 90,
    injuries: 68,
  },
} satisfies Record<string, NflTeam>;

const seededRegularMatchups: NflMatchup[] = [
  {
    id: "bal-buf",
    week: "Week 1 lab",
    slot: "Sunday night",
    venue: "Highmark Stadium",
    weather: "Wind watch",
    home: teams.buf,
    away: teams.bal,
    homeWin: 48,
    awayWin: 52,
    projected: "BAL 27-24",
    confidence: 58,
    chaos: 66,
    pace: 74,
    read:
      "Two superhero quarterbacks, one windy field, and a thin margin. The Seer leans Ravens because the run threat travels better when the air starts acting weird.",
    edges: ["Mobile QB stress", "Weather drag", "Red-zone scramble value"],
  },
  {
    id: "det-phi",
    week: "Week 1 lab",
    slot: "Late window",
    venue: "Lincoln Financial Field",
    weather: "Clean air",
    home: teams.phi,
    away: teams.det,
    homeWin: 46,
    awayWin: 54,
    projected: "DET 30-27",
    confidence: 61,
    chaos: 59,
    pace: 82,
    read:
      "Detroit brings the cleaner trench signal and enough tempo to turn this into a track meet. Philly stays live through pressure, but the lean tilts Lions.",
    edges: ["Trench edge", "Tempo ceiling", "Fourth-down aggression"],
  },
  {
    id: "kc-sf",
    week: "Week 1 lab",
    slot: "Prime read",
    venue: "Arrowhead Stadium",
    weather: "Clear",
    home: teams.kc,
    away: teams.sf,
    homeWin: 55,
    awayWin: 45,
    projected: "KC 28-24",
    confidence: 63,
    chaos: 57,
    pace: 71,
    read:
      "San Francisco has the deeper roster pulse, but Kansas City has the late-drive wizardry. The Seer gives KC the final possession glow.",
    edges: ["QB closeout", "Home noise", "Coaching counterpunch"],
  },
];

const seededPreseasonMatchups: NflMatchup[] = [
  {
    id: "pre-w1-det-phi",
    week: "Preseason Week 1 lab",
    slot: "QB depth check",
    venue: "Lincoln Financial Field",
    weather: "Warm night",
    home: teams.phi,
    away: teams.det,
    homeWin: 51,
    awayWin: 49,
    projected: "PHI 20-19",
    confidence: 47,
    chaos: 73,
    pace: 59,
    read:
      "Preseason Week 1 is a thin read: QB depth, rotation plans, and roster-bubble urgency matter more than full-team strength.",
    edges: ["QB depth", "Roster bubble snaps", "Vanilla playbook"],
  },
  {
    id: "pre-w1-kc-sf",
    week: "Preseason Week 1 lab",
    slot: "Rotation watch",
    venue: "Levi's Stadium",
    weather: "Clean air",
    home: teams.sf,
    away: teams.kc,
    homeWin: 53,
    awayWin: 47,
    projected: "SF 21-18",
    confidence: 49,
    chaos: 70,
    pace: 58,
    read:
      "San Francisco gets the lean through defensive depth and line continuity, but preseason usage can flip this quickly.",
    edges: ["Defensive depth", "Line continuity", "Starter rest risk"],
  },
  {
    id: "pre-w2-bal-buf",
    week: "Preseason Week 2 lab",
    slot: "Dress rehearsal pulse",
    venue: "Highmark Stadium",
    weather: "Wind watch",
    home: teams.buf,
    away: teams.bal,
    homeWin: 52,
    awayWin: 48,
    projected: "BUF 22-20",
    confidence: 52,
    chaos: 66,
    pace: 63,
    read:
      "Preseason Week 2 can show a little more starter rhythm, but the read still lives with QB depth and coaching intent.",
    edges: ["QB room", "Home rotation", "Kick game"],
  },
  {
    id: "pre-w2-det-kc",
    week: "Preseason Week 2 lab",
    slot: "Depth chart night",
    venue: "Arrowhead Stadium",
    weather: "Clear",
    home: teams.kc,
    away: teams.det,
    homeWin: 50,
    awayWin: 50,
    projected: "KC 23-22",
    confidence: 45,
    chaos: 76,
    pace: 66,
    read:
      "This is the chaos lane: Detroit's line depth versus Kansas City's QB-room comfort, with backups deciding the shape.",
    edges: ["Backup QB value", "Trench depth", "Two-minute reps"],
  },
  {
    id: "pre-w3-sf-bal",
    week: "Preseason Week 3 lab",
    slot: "Roster bubble final",
    venue: "M&T Bank Stadium",
    weather: "Humid watch",
    home: teams.bal,
    away: teams.sf,
    homeWin: 54,
    awayWin: 46,
    projected: "BAL 20-17",
    confidence: 50,
    chaos: 74,
    pace: 57,
    read:
      "Preseason Week 3 is about jobs. Baltimore gets the urgency edge, but late-game depth can hijack the score path.",
    edges: ["Roster urgency", "Mobile QB depth", "Late-game variance"],
  },
  {
    id: "pre-w3-phi-buf",
    week: "Preseason Week 3 lab",
    slot: "Final tune-up",
    venue: "Highmark Stadium",
    weather: "Weather watch",
    home: teams.buf,
    away: teams.phi,
    homeWin: 51,
    awayWin: 49,
    projected: "BUF 19-18",
    confidence: 48,
    chaos: 72,
    pace: 55,
    read:
      "The final preseason room is cautious: depth, special teams, and injury avoidance are louder than the full-strength roster read.",
    edges: ["Special teams", "Depth safety", "Injury avoidance"],
  },
];

const seededMatchups: NflMatchup[] = [
  ...seededRegularMatchups,
  ...seededPreseasonMatchups,
];

const seededFantasyPlayers: FantasyPlayer[] = createSeededFantasyPlayerPool();

const seededPlayerPair = [seededFantasyPlayers[0], seededFantasyPlayers[1]] as const;

const sampleProviderBridgeText =
  "player,team,position,projection,rank,positionRank,provider,season,week,updatedAt\n" +
  "Josh Allen,BUF,QB,25.4,4,2,Friday Sheet,2026,1,2026-09-04T12:00:00.000Z\n" +
  "Amon-Ra St. Brown,DET,WR,22.1,8,3,Friday Sheet,2026,1,2026-09-04T12:00:00.000Z";

const seededNflDataset: NflSeerDataset = {
  source: "seeded-fallback",
  season: "2026",
  weekLabel: "Week 1 lab",
  updatedAt: new Date(0).toISOString(),
  matchups: seededMatchups,
  fantasyPlayers: seededFantasyPlayers,
  providerStatus: {
    schedule: "fallback",
    fantasy: "fallback",
    market: "fallback",
    notes: ["Using seeded lab data until the pro football feed responds."],
  },
};

const sleeperStorageKey = "matchseer:nfl-fantasy:sleeper-connection:v1";

export default function NflLabClient({ mode = "nfl" }: { mode?: NflLabMode }) {
  const [nflDataset, setNflDataset] = useState<NflSeerDataset>(seededNflDataset);
  const [nflDataStatus, setNflDataStatus] = useState<NflDataStatus>("loading");
  const [activeMatchupId, setActiveMatchupId] = useState(seededMatchups[0].id);
  const [nflPhase, setNflPhase] = useState<NflSeasonPhase>("regular");
  const [nflWeek, setNflWeek] = useState(1);
  const [nflSlateGroup, setNflSlateGroup] = useState<NflSlateGroup>("all");
  const [seerQuestion, setSeerQuestion] = useState("");
  const [seerQuestionAsked, setSeerQuestionAsked] = useState(false);
  const [nflVoiceId, setNflVoiceId] = useState<SeerVoiceId>(defaultNflVoiceId);
  const [leftPlayerId, setLeftPlayerId] = useState(seededPlayerPair[0].id);
  const [rightPlayerId, setRightPlayerId] = useState(seededPlayerPair[1].id);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>("fullPpr");
  const [teamLens, setTeamLens] = useState<FantasyTeamLens>("redraft");
  const [activeFantasyTeamId, setActiveFantasyTeamId] = useState("seer-house");
  const [opponentFantasyTeamId, setOpponentFantasyTeamId] = useState("rival-house");
  const [fantasyImport, setFantasyImport] = useState<ImportedFantasyLeague | null>(null);
  const [providerBridgeImport, setProviderBridgeImport] =
    useState<FantasyProviderBridgeImport | null>(null);
  const [providerBridgeText, setProviderBridgeText] = useState(sampleProviderBridgeText);
  const [providerBridgeFileName, setProviderBridgeFileName] = useState("");
  const [providerBridgeStatus, setProviderBridgeStatus] =
    useState<FantasyImportStatus>("idle");
  const [providerBridgeMessage, setProviderBridgeMessage] = useState(
    "Load a projections or rankings CSV/JSON to refresh the Source side.",
  );
  const [sleeperQuery, setSleeperQuery] = useState("");
  const [sleeperImportStatus, setSleeperImportStatus] =
    useState<SleeperImportStatus>("idle");
  const [sleeperImportMessage, setSleeperImportMessage] = useState(
    "Sleeper can load public league rosters by username, league id, or league link.",
  );
  const [sleeperLeagueOptions, setSleeperLeagueOptions] = useState<
    SleeperLeagueOption[]
  >([]);
  const [sleeperLookupUserId, setSleeperLookupUserId] = useState("");
  const [sleeperSelectedLeagueId, setSleeperSelectedLeagueId] = useState("");
  const [sleeperWeek, setSleeperWeek] = useState(
    weekFromDatasetLabel(seededNflDataset.weekLabel) ?? "1",
  );
  const [sleeperUseAutoWeek, setSleeperUseAutoWeek] = useState(true);
  const [sleeperLastRefreshedAt, setSleeperLastRefreshedAt] = useState("");
  const [sleeperRestoreComplete, setSleeperRestoreComplete] = useState(false);
  const [sleeperPendingRestoreRefresh, setSleeperPendingRestoreRefresh] =
    useState(false);
  const [manualRosterText, setManualRosterText] = useState(
    "My Team:\nJosh Allen BUF QB\nAmon-Ra St. Brown DET WR\n\nOpponent:\nLamar Jackson BAL QB\nJahmyr Gibbs DET RB",
  );
  const [manualImportStatus, setManualImportStatus] =
    useState<FantasyImportStatus>("idle");
  const [manualImportMessage, setManualImportMessage] = useState(
    "Paste two rosters with My Team and Opponent headings.",
  );
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState("");
  const [screenshotImportStatus, setScreenshotImportStatus] =
    useState<FantasyImportStatus>("idle");
  const [screenshotImportMessage, setScreenshotImportMessage] = useState(
    "Upload a roster screenshot; vision extraction runs only when an API key is configured.",
  );
  const [scoutingPosition, setScoutingPosition] =
    useState<ScoutingPosition>("ALL");
  const [scoutingDepth, setScoutingDepth] = useState<ScoutingDepth>("top10");
  const [scoutingBoardMode, setScoutingBoardMode] =
    useState<ScoutingBoardMode>("available");
  const [scoutStatus, setScoutStatus] = useState<ScoutStatus>("idle");
  const [scoutRead, setScoutRead] = useState<NflScoutingAnalysis | null>(null);
  const [fantasyView, setFantasyView] = useState<FantasyView>("overview");
  const [scenarioLeversByMatchup, setScenarioLeversByMatchup] = useState<
    Record<string, ScenarioLevers>
  >({});
  const isFantasyMode = mode === "fantasy";
  const isSeededLabMode =
    !isFantasyMode &&
    nflDataStatus === "fallback" &&
    nflDataset.source === "seeded-fallback";
  const matchups = useMemo(
    () => withSeededNflSlateRooms(nflDataset.matchups),
    [nflDataset.matchups],
  );
  const visibleNflMatchups = useMemo(
    () =>
      matchups.filter(
        (matchup) =>
          matchupMatchesSlate(matchup, { phase: nflPhase, week: nflWeek }) &&
          matchupMatchesGroup(matchup, nflSlateGroup),
      ),
    [matchups, nflPhase, nflSlateGroup, nflWeek],
  );
  const nflStandings = useMemo(
    () =>
      buildNflStandings(
        matchups.filter((matchup) => !isPreseasonMatchup(matchup)),
        nflSlateGroup,
      ),
    [matchups, nflSlateGroup],
  );
  const slateLabel = `${nflPhaseLabels[nflPhase]} Week ${nflWeek}`;
  const useSlotLabelsInSlate = visibleNflMatchups.length > 0;
  const baseFantasyPlayers =
    nflDataset.fantasyPlayers.length > 0
      ? nflDataset.fantasyPlayers
      : seededFantasyPlayers;
  const providerBridgeBaseFantasyPlayers = useMemo(
    () =>
      providerBridgeImport
        ? applyFantasyProviderBridge(
            baseFantasyPlayers,
            providerBridgeImport.projections,
            {
              matchups: fantasyProjectionContextsFromMatchups(matchups),
            },
          )
        : baseFantasyPlayers,
    [baseFantasyPlayers, matchups, providerBridgeImport],
  );
  const fantasyPlayers = useMemo(
    () =>
      fantasyImport
        ? mergeFantasyPlayerPools(providerBridgeBaseFantasyPlayers, fantasyImport.players)
        : providerBridgeBaseFantasyPlayers,
    [fantasyImport, providerBridgeBaseFantasyPlayers],
  );
  const fantasyDataset = useMemo(
    () => withFantasyProviderBridgeDataset(nflDataset, providerBridgeImport),
    [nflDataset, providerBridgeImport],
  );
  const fantasyContextLayer = useMemo(
    () =>
      buildFantasyContextLayer({
        dataset: fantasyDataset,
        matchups,
        players: fantasyPlayers,
      }),
    [fantasyDataset, fantasyPlayers, matchups],
  );
  const fantasySourceLanes = useMemo(
    () =>
      buildFantasySourceLanes({
        contextStatus: fantasyContextLayer.status,
        dataset: fantasyDataset,
        fantasyImport,
        matchups,
        players: fantasyPlayers,
        providerBridgeImport,
      }),
    [
      fantasyContextLayer.status,
      fantasyDataset,
      fantasyImport,
      fantasyPlayers,
      matchups,
      providerBridgeImport,
    ],
  );
  const defaultPlayerPair = useMemo(
    () =>
      [
        fantasyPlayers[0] ?? seededPlayerPair[0],
        fantasyPlayers[1] ?? fantasyPlayers[0] ?? seededPlayerPair[1],
      ] as const,
    [fantasyPlayers],
  );
  const activeMatchup =
    visibleNflMatchups.find((matchup) => matchup.id === activeMatchupId) ??
    visibleNflMatchups[0] ??
    matchups[0];
  const activeScenarioLevers = useMemo(
    () =>
      scenarioLeversByMatchup[activeMatchup.id] ??
      defaultScenarioLevers(activeMatchup),
    [activeMatchup, scenarioLeversByMatchup],
  );
  const activeScenario = useMemo(
    () => buildScenarioImpact(activeMatchup, activeScenarioLevers),
    [activeMatchup, activeScenarioLevers],
  );
  const activeGameCard = useMemo(
    () => buildNflGameCardRead(activeMatchup, activeScenario),
    [activeMatchup, activeScenario],
  );
  const activeMatchupPalette = useMemo(
    () => readableMatchupPalette(activeMatchup.away.color, activeMatchup.home.color),
    [activeMatchup.away.color, activeMatchup.home.color],
  );
  const nflVoiceOptions = useMemo(() => seerVoiceOptionsForMode("nfl"), []);
  const nflVoice = useMemo(() => getSeerVoice(nflVoiceId), [nflVoiceId]);
  const seerOracleRead = useMemo(
    () =>
      buildNflSeerOracleRead({
        matchup: activeMatchup,
        question: seerQuestion,
        scenario: activeScenario,
        voice: nflVoice,
      }),
    [activeMatchup, activeScenario, nflVoice, seerQuestion],
  );
  const leftPlayer =
    fantasyPlayers.find((player) => player.id === leftPlayerId) ??
    defaultPlayerPair[0];
  const rightPlayer =
    fantasyPlayers.find((player) => player.id === rightPlayerId) ??
    defaultPlayerPair[1];
  const scoutingBoard = useMemo(
    () => buildScoutingBoard(fantasyPlayers, scoringFormat, fantasyContextLayer.byTeam),
    [fantasyContextLayer.byTeam, fantasyPlayers, scoringFormat],
  );
  const leftScoutingPlayer =
    scoutingBoard.find((player) => player.id === leftPlayer.id) ?? leftPlayer;
  const rightScoutingPlayer =
    scoutingBoard.find((player) => player.id === rightPlayer.id) ?? rightPlayer;
  const startLean = useMemo(
    () => compareFantasyPlayers(leftScoutingPlayer, rightScoutingPlayer, scoringFormat),
    [leftScoutingPlayer, rightScoutingPlayer, scoringFormat],
  );
  const hasLiveOrImportedSourceRankings = Boolean(
    providerBridgeImport?.projections.some(
      (projection) =>
        typeof projection.sourceRank === "number" ||
        typeof projection.positionRank === "number",
    ) ||
      (fantasyDataset.providerStatus.fantasy === "live" &&
        (fantasyDataset.providerStatus.fantasyCoverage?.totalRankings ?? 0) > 0),
  );
  const fantasyTeams = useMemo(() => {
    if (fantasyImport?.teams.length) {
      return fantasyImport.teams;
    }

    return buildFantasyTeams(fantasyPlayers);
  }, [fantasyImport, fantasyPlayers]);
  const activeFantasyTeam =
    fantasyTeams.find((team) => team.id === activeFantasyTeamId) ?? fantasyTeams[0];
  const opponentFantasyTeam =
    fantasyTeams.find((team) => team.id === opponentFantasyTeamId) ??
    fantasyTeams.find((team) => team.id !== activeFantasyTeam.id) ??
    fantasyTeams[0];
  const activeTeamReport = useMemo(
    () =>
      analyzeFantasyTeam({
        allPlayers: fantasyPlayers,
        contextByTeam: fantasyContextLayer.byTeam,
        lens: teamLens,
        scoringFormat,
        team: activeFantasyTeam,
      }),
    [activeFantasyTeam, fantasyContextLayer.byTeam, fantasyPlayers, scoringFormat, teamLens],
  );
  const rosteredScoutingPlayerIds = useMemo(
    () =>
      new Set(
        fantasyImport
          ? fantasyTeams.flatMap((team) => team.rosterIds)
          : [],
      ),
    [fantasyImport, fantasyTeams],
  );
  const visibleScoutingRows = useMemo(
    () =>
      filterScoutingRows({
        depth: scoutingDepth,
        mode: scoutingBoardMode,
        position: scoutingPosition,
        rows: scoutingBoard,
        rosteredIds: rosteredScoutingPlayerIds,
        weakestPosition: activeTeamReport.weakestLane.position,
      }),
    [
      activeTeamReport.weakestLane.position,
      rosteredScoutingPlayerIds,
      scoutingBoard,
      scoutingBoardMode,
      scoutingDepth,
      scoutingPosition,
    ],
  );
  const fantasyMatchupReport = useMemo(
    () =>
      compareFantasyTeams({
        allPlayers: fantasyPlayers,
        contextByTeam: fantasyContextLayer.byTeam,
        left: activeFantasyTeam,
        lens: teamLens,
        right: opponentFantasyTeam,
        scoringFormat,
      }),
    [
      activeFantasyTeam,
      fantasyContextLayer.byTeam,
      fantasyPlayers,
      opponentFantasyTeam,
      scoringFormat,
      teamLens,
    ],
  );
  const fantasyLeaguePowerMap = useMemo(
    () =>
      buildFantasyLeaguePowerMap({
        activeTeamId: activeFantasyTeam.id,
        allPlayers: fantasyPlayers,
        contextByTeam: fantasyContextLayer.byTeam,
        lens: teamLens,
        scoringFormat,
        teams: fantasyTeams,
      }),
    [
      activeFantasyTeam.id,
      fantasyContextLayer.byTeam,
      fantasyPlayers,
      fantasyTeams,
      scoringFormat,
      teamLens,
    ],
  );
  const fantasyTradeBuilder = useMemo(
    () =>
      buildFantasyTradePackages({
        activeTeamId: activeFantasyTeam.id,
        lens: teamLens === "dynasty" ? "dynasty" : "redraft",
        scoringFormat,
        teams: fantasyTradeTeamsFromLeagueMap(fantasyLeaguePowerMap),
      }),
    [activeFantasyTeam.id, fantasyLeaguePowerMap, scoringFormat, teamLens],
  );
  const rookieWatchRows = useMemo(
    () => buildRookieWatchRows(scoutingBoard),
    [scoutingBoard],
  );
  const fantasyHeroRead = useMemo(
    () =>
      buildFantasyHeroRead({
        analysis: scoutRead,
        matchupReport: fantasyMatchupReport,
        report: activeTeamReport,
        scoringFormat,
        teamLens,
      }),
    [activeTeamReport, fantasyMatchupReport, scoutRead, scoringFormat, teamLens],
  );
  const fantasyActionQueue = useMemo(
    () =>
      buildFantasyActionQueue({
        matchupReport: fantasyMatchupReport,
        report: activeTeamReport,
      }),
    [activeTeamReport, fantasyMatchupReport],
  );

  useEffect(() => {
    setSeerQuestionAsked(false);
  }, [activeMatchup.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadNflDataset() {
      try {
        const response = await fetch("/api/nfl/seer", { cache: "no-store" });
        const payload = (await response.json()) as Partial<NflSeerDataset>;

        if (!response.ok) {
          throw new Error("Pro football data feed failed");
        }

        const nextDataset = mergeNflDataset(payload);

        if (cancelled) {
          return;
        }

        setNflDataset(nextDataset);
        setNflDataStatus(
          nextDataset.providerStatus.schedule === "live" ? "ready" : "fallback",
        );
      } catch {
        if (!cancelled) {
          setNflDataStatus("fallback");
        }
      }
    }

    void loadNflDataset();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const defaultSlate = nflDefaultSelectionFromMatchups(matchups, nflDataset.weekLabel);

    setNflPhase(defaultSlate.phase);
    setNflWeek(defaultSlate.week);
  }, [matchups, nflDataset.weekLabel]);

  useEffect(() => {
    const savedConnection = readSleeperSavedConnection();

    if (savedConnection) {
      setFantasyImport(savedConnection.importedLeague);
      setSleeperQuery(savedConnection.query);
      setSleeperLookupUserId(savedConnection.userId);
      setSleeperSelectedLeagueId(savedConnection.leagueId);
      setSleeperUseAutoWeek(savedConnection.useAutoWeek);
      setSleeperWeek(
        savedConnection.week ||
          String(savedConnection.importedLeague.sleeper?.week ?? "") ||
          weekFromDatasetLabel(seededNflDataset.weekLabel) ||
          "",
      );
      setSleeperLastRefreshedAt(savedConnection.refreshedAt);
      setSleeperImportStatus(
        savedConnection.importedLeague.sleeper?.status === "no-matchup"
          ? "no-matchup"
          : "imported",
      );
      setSleeperImportMessage(
        `${sleeperImportSuccessMessage(savedConnection.importedLeague)} Last refreshed ${formatDataUpdated(savedConnection.refreshedAt)}.`,
      );

      if (savedConnection.importedLeague.suggestedScoringFormat) {
        setScoringFormat(savedConnection.importedLeague.suggestedScoringFormat);
      }

      if ((savedConnection.importedLeague.settings?.taxiSlots ?? 0) > 0) {
        setTeamLens("dynasty");
      }

      setSleeperPendingRestoreRefresh(true);
    }

    setSleeperRestoreComplete(true);
  }, []);

  useEffect(() => {
    if (
      !sleeperPendingRestoreRefresh ||
      !sleeperRestoreComplete ||
      isSleeperImportLoading(sleeperImportStatus)
    ) {
      return;
    }

    setSleeperPendingRestoreRefresh(false);
    void requestSleeperRefresh();
  }, [sleeperImportStatus, sleeperPendingRestoreRefresh, sleeperRestoreComplete]);

  useEffect(() => {
    const connectedLeagueId = fantasyImport?.sleeper?.leagueId || sleeperSelectedLeagueId;

    if (
      !sleeperRestoreComplete ||
      !connectedLeagueId ||
      sleeperUseAutoWeek ||
      isSleeperImportLoading(sleeperImportStatus)
    ) {
      return;
    }

    const importedWeek = fantasyImport?.sleeper?.week
      ? String(fantasyImport.sleeper.week)
      : "";

    if (!sleeperWeek || sleeperWeek === importedWeek) {
      return;
    }

    const timer = window.setTimeout(() => {
      void requestSleeperRefresh({ useAutoWeek: false, week: sleeperWeek });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [
    fantasyImport?.sleeper?.leagueId,
    fantasyImport?.sleeper?.week,
    sleeperImportStatus,
    sleeperRestoreComplete,
    sleeperSelectedLeagueId,
    sleeperUseAutoWeek,
    sleeperWeek,
  ]);

  useEffect(() => {
    const selectionPool = visibleNflMatchups.length > 0 ? visibleNflMatchups : matchups;

    if (!selectionPool.some((matchup) => matchup.id === activeMatchupId)) {
      setActiveMatchupId(selectionPool[0]?.id ?? seededMatchups[0].id);
    }
  }, [activeMatchupId, matchups, visibleNflMatchups]);

  useEffect(() => {
    if (!fantasyPlayers.some((player) => player.id === leftPlayerId)) {
      setLeftPlayerId(defaultPlayerPair[0].id);
    }

    if (!fantasyPlayers.some((player) => player.id === rightPlayerId)) {
      setRightPlayerId(defaultPlayerPair[1].id);
    }
  }, [defaultPlayerPair, fantasyPlayers, leftPlayerId, rightPlayerId]);

  useEffect(() => {
    if (!fantasyImport?.teams.length) {
      return;
    }

    const suggestedTeam =
      fantasyImport.teams.find((team) => team.id === fantasyImport.suggestedTeamId) ??
      fantasyImport.teams[0];
    const suggestedOpponent =
      fantasyImport.teams.find(
        (team) => team.id === fantasyImport.suggestedOpponentTeamId,
      ) ??
      fantasyImport.teams.find((team) => team.id !== suggestedTeam.id) ??
      suggestedTeam;

    setActiveFantasyTeamId(suggestedTeam.id);
    setOpponentFantasyTeamId(
      suggestedOpponent.id,
    );
  }, [fantasyImport]);

  useEffect(() => {
    if (!fantasyTeams.some((team) => team.id === activeFantasyTeamId)) {
      setActiveFantasyTeamId(fantasyTeams[0]?.id ?? "seer-house");
    }

    if (
      !fantasyTeams.some((team) => team.id === opponentFantasyTeamId) ||
      (opponentFantasyTeamId === activeFantasyTeamId && fantasyTeams.length > 1)
    ) {
      setOpponentFantasyTeamId(
        fantasyTeams.find((team) => team.id !== activeFantasyTeamId)?.id ??
          fantasyTeams[0]?.id ??
          "rival-house",
      );
    }
  }, [activeFantasyTeamId, fantasyTeams, opponentFantasyTeamId]);

  function updateScenarioLever(key: keyof ScenarioLevers, value: number) {
    setScenarioLeversByMatchup((current) => ({
      ...current,
      [activeMatchup.id]: {
        ...defaultScenarioLevers(activeMatchup),
        ...(current[activeMatchup.id] ?? {}),
        [key]: value,
      },
    }));
  }

  function resetScenarioLevers() {
    setScenarioLeversByMatchup((current) => {
      const next = { ...current };
      delete next[activeMatchup.id];
      return next;
    });
  }

  function updateScoutingPosition(position: ScoutingPosition) {
    setScoutingPosition(position);
    setScoutRead(null);
    setScoutStatus("idle");
  }

  function updateScoutingDepth(depth: ScoutingDepth) {
    setScoutingDepth(depth);
    setScoutRead(null);
    setScoutStatus("idle");
  }

  function updateScoutingBoardMode(mode: ScoutingBoardMode) {
    setScoutingBoardMode(mode);
    setScoutRead(null);
    setScoutStatus("idle");
  }

  async function requestScoutingRead() {
    setScoutStatus("loading");

    try {
      const depthOption = scoutingDepthOptions.find(
        (option) => option.value === scoutingDepth,
      );
      const response = await fetch("/api/ai/nfl-scouting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          boardMode: scoutingBoardModeLabel(scoutingBoardMode),
          depth: depthOption?.label ?? "Top 10",
          positionLane: scoutingPositionLabel(scoutingPosition),
          scoringFormat,
          players: visibleScoutingRows.map((player, index) => ({
            name: player.name,
            team: player.team,
            position: player.position,
            opponent: player.opponent,
            projection: player.contextProjection.projection,
            floor: player.contextProjection.floor,
            ceiling: player.contextProjection.ceiling,
            baselineRank: player.nflRank,
            seerRank: index + 1,
            overallSeerRank: scoutingBoard.findIndex((row) => row.id === player.id) + 1,
            sourceRank: player.sourceRank,
            positionRank: player.positionRank,
            roleSecurity: player.roleSecurity,
            dynastyValue: player.dynastyValue,
            depthTier: player.depthTier,
            traits: player.traits,
          })),
        }),
      });
      const payload = (await response.json()) as {
        source?: string;
        analysis?: NflScoutingAnalysis;
      };

      if (!response.ok || !payload.analysis) {
        throw new Error("Scout read failed");
      }

      setScoutRead({
        ...payload.analysis,
        source: payload.source,
      });
      setScoutStatus("ready");
    } catch {
      setScoutStatus("error");
    }
  }

  function applyImportedFantasyLeague(
    importedLeague: ImportedFantasyLeague,
    message: string,
  ) {
    setFantasyImport(importedLeague);
    setSleeperImportMessage(message);
    setManualImportMessage(message);
    setScreenshotImportMessage(message);
  }

  function applyProviderBridgeImport(sourceText: string, label?: string) {
    setProviderBridgeStatus("loading");

    try {
      const bridgeImport = createFantasyProviderBridgeImport({
        providerLabel: label ? cleanProviderFileLabel(label) : undefined,
        season: nflDataset.season,
        text: sourceText,
        week: weekFromDatasetLabel(nflDataset.weekLabel),
      });

      setProviderBridgeImport(bridgeImport);
      setProviderBridgeStatus("ready");
      setProviderBridgeMessage(
        `${bridgeImport.providerLabel} loaded ${bridgeImport.projections.length} player source row${bridgeImport.projections.length === 1 ? "" : "s"}.`,
      );
      setScoutRead(null);
      setScoutStatus("idle");
    } catch (error) {
      setProviderBridgeStatus("error");
      setProviderBridgeMessage(
        error instanceof Error
          ? error.message
          : "Provider bridge could not read that CSV or JSON.",
      );
    }
  }

  function handleProviderBridgeFile(file: File | null | undefined) {
    if (!file) {
      return;
    }

    setProviderBridgeFileName(file.name);
    setProviderBridgeStatus("loading");
    setProviderBridgeMessage(`Reading ${file.name}...`);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setProviderBridgeStatus("error");
        setProviderBridgeMessage("That provider file could not be read.");
        return;
      }

      setProviderBridgeText(reader.result);
      applyProviderBridgeImport(reader.result, file.name);
    };
    reader.onerror = () => {
      setProviderBridgeStatus("error");
      setProviderBridgeMessage("That provider file could not be read.");
    };
    reader.readAsText(file);
  }

  function updateSleeperWeek(value: string) {
    const week = value.replace(/[^\d]/g, "").slice(0, 2);

    setSleeperWeek(week);
    setSleeperUseAutoWeek(week.length === 0);

    if (!week && (fantasyImport?.sleeper?.leagueId || sleeperSelectedLeagueId)) {
      void requestSleeperRefresh({ useAutoWeek: true, week: "" });
    }
  }

  function updateSleeperAutoWeek(useAutoWeek: boolean) {
    setSleeperUseAutoWeek(useAutoWeek);

    if (useAutoWeek && (fantasyImport?.sleeper?.leagueId || sleeperSelectedLeagueId)) {
      void requestSleeperRefresh({ useAutoWeek: true, week: "" });
    }
  }

  async function requestSleeperImport() {
    const query = sleeperQuery.trim();

    if (!query) {
      setSleeperImportStatus("error");
      setSleeperImportMessage("Drop in a Sleeper username, league id, or league link.");
      return;
    }

    setSleeperImportStatus("searching");
    setSleeperImportMessage("Searching Sleeper for that user or league...");
    setSleeperLeagueOptions([]);
    setSleeperSelectedLeagueId("");

    try {
      const response = await fetch(
        sleeperImportUrl({
          query,
          week: sleeperUseAutoWeek ? undefined : sleeperWeek,
        }),
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { error?: string };
      const leagueOptions = sanitizeSleeperLeagueOptionsResponse(payload);

      if (response.ok && leagueOptions) {
        setSleeperImportStatus("leagues-found");
        setSleeperLeagueOptions(leagueOptions.leagues);
        setSleeperLookupUserId(leagueOptions.userId);
        if (sleeperUseAutoWeek && typeof leagueOptions.week === "number") {
          setSleeperWeek(String(leagueOptions.week));
        }
        setSleeperImportMessage(
          leagueOptions.message ??
            `${leagueOptions.leagues.length} Sleeper leagues found. Pick the matchup to load.`,
        );
        return;
      }

      const importedLeague = sanitizeImportedFantasyLeague(payload);

      if (!response.ok || !importedLeague) {
        throw new Error(payload.error ?? "Sleeper import did not return usable teams.");
      }

      applySleeperImportedLeague(importedLeague, {
        leagueId: importedLeague.sleeper?.leagueId ?? "",
        persist: true,
        query,
        refreshedAt: new Date().toISOString(),
        useAutoWeek: sleeperUseAutoWeek,
        userId: importedLeague.sleeper?.userId ?? sleeperLookupUserId,
        week: sleeperUseAutoWeek ? "" : sleeperWeek,
      });
    } catch (error) {
      setSleeperImportStatus("error");
      setSleeperImportMessage(
        error instanceof Error
          ? error.message
          : "Sleeper import failed. Paste the rosters and we can still cook.",
      );
    }
  }

  async function requestSleeperLeagueImport(league: SleeperLeagueOption) {
    await loadSleeperLeague({
      leagueId: league.leagueId,
      leagueName: league.name,
      query: sleeperQuery.trim(),
      useAutoWeek: sleeperUseAutoWeek,
      userId: league.userId ?? sleeperLookupUserId,
      week: sleeperWeek,
    });
  }

  async function requestSleeperRefresh({
    useAutoWeek = sleeperUseAutoWeek,
    week = sleeperWeek,
  }: {
    useAutoWeek?: boolean;
    week?: string;
  } = {}) {
    const leagueId = fantasyImport?.sleeper?.leagueId || sleeperSelectedLeagueId;
    const userId = fantasyImport?.sleeper?.userId || sleeperLookupUserId;

    if (!leagueId) {
      await requestSleeperImport();
      return;
    }

    await loadSleeperLeague({
      leagueId,
      leagueName: fantasyImport?.sleeper?.leagueName || "Sleeper league",
      query: sleeperQuery.trim(),
      useAutoWeek,
      userId,
      week,
    });
  }

  async function loadSleeperLeague({
    leagueId,
    leagueName,
    query,
    useAutoWeek,
    userId,
    week,
  }: {
    leagueId: string;
    leagueName: string;
    query: string;
    useAutoWeek: boolean;
    userId?: string;
    week: string;
  }) {
    setSleeperSelectedLeagueId(leagueId);
    setSleeperImportStatus("loading-league");
    setSleeperImportMessage(
      `Loading ${leagueName} for ${useAutoWeek ? "current Sleeper week" : `Week ${week || "auto"}`}...`,
    );

    try {
      const response = await fetch(
        sleeperImportUrl({
          leagueId,
          userId,
          week: useAutoWeek ? undefined : week,
        }),
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { error?: string };
      const importedLeague = sanitizeImportedFantasyLeague(payload);

      if (!response.ok || !importedLeague) {
        throw new Error(payload.error ?? "Sleeper league did not return usable teams.");
      }

      applySleeperImportedLeague(importedLeague, {
        leagueId,
        persist: true,
        query,
        refreshedAt: new Date().toISOString(),
        useAutoWeek,
        userId,
        week: useAutoWeek ? "" : week,
      });
    } catch (error) {
      setSleeperImportStatus("error");
      setSleeperImportMessage(
        error instanceof Error
          ? error.message
          : "Sleeper league load failed. Try another week or paste rosters.",
      );
    }
  }

  function applySleeperImportedLeague(
    importedLeague: ImportedFantasyLeague,
    options: {
      leagueId?: string;
      persist?: boolean;
      query?: string;
      refreshedAt?: string;
      useAutoWeek?: boolean;
      userId?: string;
      week?: string;
    } = {},
  ) {
    const refreshedAt = options.refreshedAt ?? new Date().toISOString();

    applyImportedFantasyLeague(
      importedLeague,
      `${sleeperImportSuccessMessage(importedLeague)} Last refreshed ${formatDataUpdated(refreshedAt)}.`,
    );
    if (importedLeague.suggestedScoringFormat) {
      setScoringFormat(importedLeague.suggestedScoringFormat);
    }
    if ((importedLeague.settings?.taxiSlots ?? 0) > 0) {
      setTeamLens("dynasty");
    }
    setSleeperLeagueOptions([]);
    setSleeperSelectedLeagueId(importedLeague.sleeper?.leagueId ?? "");
    setSleeperLastRefreshedAt(refreshedAt);
    if (importedLeague.sleeper?.week) {
      setSleeperWeek(String(importedLeague.sleeper.week));
    }
    setSleeperImportStatus(
      importedLeague.sleeper?.status === "no-matchup" ? "no-matchup" : "imported",
    );
    if (options.persist) {
      writeSleeperSavedConnection({
        importedLeague,
        leagueId: options.leagueId || importedLeague.sleeper?.leagueId || "",
        query: options.query ?? sleeperQuery.trim(),
        refreshedAt,
        useAutoWeek: options.useAutoWeek ?? sleeperUseAutoWeek,
        userId: options.userId ?? importedLeague.sleeper?.userId ?? sleeperLookupUserId,
        week:
          options.week ??
          ((options.useAutoWeek ?? sleeperUseAutoWeek)
            ? ""
            : String(importedLeague.sleeper?.week ?? sleeperWeek)),
      });
    }
  }

  function applyManualRosterImport(source: "manual" | "screenshot" = "manual") {
    setManualImportStatus(source === "manual" ? "loading" : manualImportStatus);

    try {
      const importedLeague = createManualFantasyLeague({
        knownPlayers: baseFantasyPlayers,
        source,
        text: manualRosterText,
      });
      const sanitized = sanitizeImportedFantasyLeague(importedLeague);

      if (!sanitized) {
        throw new Error("No player names popped out. Try one player per line.");
      }

      applyImportedFantasyLeague(
        sanitized,
        `${sanitized.label} loaded with ${sanitized.teams.length} fantasy team${sanitized.teams.length === 1 ? "" : "s"}.`,
      );
      setManualImportStatus("ready");
    } catch (error) {
      setManualImportStatus("error");
      setManualImportMessage(
        error instanceof Error
          ? error.message
          : "Paste parser missed this one. Try My Team and Opponent headings.",
      );
    }
  }

  function handleScreenshotFile(file: File | null | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setScreenshotImportStatus("error");
      setScreenshotImportMessage("Use an image file for the roster screenshot.");
      return;
    }

    setScreenshotFileName(file.name);
    setScreenshotImportStatus("loading");
    setScreenshotImportMessage("Screenshot attached. Reading the image into the lab...");

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setScreenshotImportStatus("error");
        setScreenshotImportMessage("The screenshot could not be read.");
        return;
      }

      setScreenshotDataUrl(reader.result);
      setScreenshotImportStatus("ready");
      setScreenshotImportMessage(
        `${file.name} is attached. Run screenshot import or paste the visible roster text below.`,
      );
    };
    reader.onerror = () => {
      setScreenshotImportStatus("error");
      setScreenshotImportMessage("The screenshot could not be read.");
    };
    reader.readAsDataURL(file);
  }

  async function requestScreenshotRosterImport() {
    if (!screenshotDataUrl) {
      setScreenshotImportStatus("error");
      setScreenshotImportMessage("Attach a screenshot first.");
      return;
    }

    setScreenshotImportStatus("loading");
    setScreenshotImportMessage("Asking the vision reader to extract the rosters...");

    try {
      const response = await fetch("/api/ai/nfl-roster-screenshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageDataUrl: screenshotDataUrl }),
      });
      const payload = (await response.json()) as {
        error?: string;
        notes?: string[];
        rosterText?: string;
      };

      if (!response.ok || !payload.rosterText) {
        throw new Error(payload.error ?? "Screenshot import did not find roster text.");
      }

      setManualRosterText(payload.rosterText);

      const importedLeague = createManualFantasyLeague({
        knownPlayers: baseFantasyPlayers,
        source: "screenshot",
        text: payload.rosterText,
      });
      const sanitized = sanitizeImportedFantasyLeague(importedLeague);

      if (!sanitized) {
        throw new Error("The screenshot text came back, but no players matched.");
      }

      applyImportedFantasyLeague(
        sanitized,
        `${sanitized.label} loaded from ${screenshotFileName || "screenshot"}.`,
      );
      setScreenshotImportStatus("ready");
      setScreenshotImportMessage(
        payload.notes?.[0] ??
          `${screenshotFileName || "Screenshot"} was converted into roster text.`,
      );
    } catch (error) {
      setScreenshotImportStatus("error");
      setScreenshotImportMessage(
        error instanceof Error
          ? error.message
          : "Screenshot import failed. Paste the roster text and we can still compare.",
      );
    }
  }

  return (
    <main className="nfl-shell">
      <header className="nfl-topbar">
        <a className="nfl-brand" href="/">
          <img
            alt=""
            aria-hidden="true"
            className="nfl-brand-logo"
            src="/brand/matchseer-app-icon.svg"
          />
          <strong>MatchSeer</strong>
          <em>{isFantasyMode ? "Fantasy Seer" : "Pro Football Seer"}</em>
        </a>
        <nav aria-label="MatchSeer sport navigation">
          <a className={!isFantasyMode ? "active" : undefined} href="/profootball">
            Pro Football Seer
          </a>
          <a className={isFantasyMode ? "active" : undefined} href="/fantasyseer">
            Fantasy Seer
          </a>
          {isFantasyMode ? (
            <>
              <a
                className={fantasyView === "overview" ? "active" : undefined}
                href="#fantasy-seer"
                onClick={() => setFantasyView("overview")}
              >
                Best Move
              </a>
              <a
                className={fantasyView === "roster" ? "active" : undefined}
                href="#fantasy-rooms"
                onClick={() => setFantasyView("roster")}
              >
                Roster
              </a>
              <a
                className={fantasyView === "league" ? "active" : undefined}
                href="#fantasy-rooms"
                onClick={() => setFantasyView("league")}
              >
                League
              </a>
              <a
                className={fantasyView === "trades" ? "active" : undefined}
                href="#fantasy-rooms"
                onClick={() => setFantasyView("trades")}
              >
                Trades
              </a>
            </>
          ) : (
            <>
              <a href="#team-seer">Game Card</a>
              <a href="#scenario-lab">What-if Lab</a>
              <a href="#matchup-dna">Matchup DNA</a>
              <a href="#ask-seer">Ask the Seer</a>
            </>
          )}
        </nav>
      </header>

      {!isFantasyMode ? <ProFootballDisclaimer /> : null}

      {!isFantasyMode ? (
        <>
          <section className="nfl-hero" id="team-seer">
            <div className="nfl-matchup-rail" aria-label="Pro football matchup list">
              <div className="nfl-section-kicker">
                <Trophy size={17} />
                Team vs team
              </div>
              <h1>Pro Football Seer</h1>
              <p>
                Pro football matchup reads without official-league noise. One matchup
                card, plain-English lean, underdog path, and the few signals that can move the read.
              </p>
              <div className="nfl-slate-meta">
                <span>{slateLabel}</span>
                <span>{matchups.length} games</span>
              </div>
              {isSeededLabMode ? (
                <div className="nfl-slate-chip">
                  <Sparkles size={15} />
                  Lab slate
                </div>
              ) : null}
              <NflSlateControls
                group={nflSlateGroup}
                onGroupChange={setNflSlateGroup}
                onPhaseChange={setNflPhase}
                onWeekChange={setNflWeek}
                phase={nflPhase}
                week={nflWeek}
              />
              <div className="nfl-matchup-list">
                {visibleNflMatchups.length > 0 ? (
                  visibleNflMatchups.map((matchup) => (
                  <button
                    className={cx(
                      "nfl-matchup-button",
                      matchup.id === activeMatchup.id && "active",
                    )}
                    key={matchup.id}
                    onClick={() => setActiveMatchupId(matchup.id)}
                    type="button"
                  >
                    <span>{useSlotLabelsInSlate ? matchup.slot : matchup.week}</span>
                    <strong>
                      {matchup.away.code} at {matchup.home.code}
                    </strong>
                    <em>{matchup.projected}</em>
                  </button>
                  ))
                ) : (
                  <article className="nfl-empty-slate-card">
                    <strong>This room is between slates</strong>
                    <p>
                      Switch weeks or divisions, or use the active season room while
                      the next real slate, preseason notes, and schedule signals refresh.
                    </p>
                  </article>
                )}
              </div>
            </div>

            <article className="nfl-seer-card">
              <div className="nfl-card-topline">
                <span>{activeMatchup.slot}</span>
                <strong>{activeMatchup.venue}</strong>
              </div>
              <div className="nfl-game-context-pills">
                <span>{activeGameCard.leanStrengthLabel}</span>
                <span>{activeGameCard.gameTypeLabel}</span>
                <span>{activeGameCard.confidenceLabel}</span>
                {activeGameCard.isPreseason ? <span>Preseason model</span> : null}
              </div>

              <div className="nfl-game-stage" aria-label="Pro Football Seer hero matchup">
                <HeroTeamCard
                  role="Road"
                  team={activeMatchup.away}
                  toneColor={activeMatchupPalette.away}
                />
                <div className="nfl-stage-core">
                  <span>{activeMatchup.week}</span>
                  <strong>{activeGameCard.leanLabel}</strong>
                  <em>{activeGameCard.scorePathLabel}</em>
                </div>
                <HeroTeamCard
                  role="Home"
                  team={activeMatchup.home}
                  toneColor={activeMatchupPalette.home}
                />
              </div>

              <div className="nfl-hero-intel">
                <div className="nfl-seer-verdict">
                  <span>
                    <Sparkles size={16} />
                    MatchSeer Game Card
                  </span>
                  <strong>{activeGameCard.verdictHeadline}</strong>
                  <p>{activeGameCard.verdictSummary}</p>
                </div>
                <div className="nfl-signal-stack" aria-label="Seer signal summary">
                  <div>
                    <span>Projected score</span>
                    <strong>{activeScenario.projected}</strong>
                    <em>{activeGameCard.scorePathLabel}</em>
                  </div>
                  <div>
                    <span>Game script</span>
                    <strong>{activeScenario.pace}%</strong>
                    <em>
                      {activeGameCard.isPreseason
                        ? "rotation pace, not regular rhythm"
                        : "snap volume and catch-up pressure"}
                    </em>
                  </div>
                </div>
              </div>

              <div className="nfl-game-card-grid" aria-label="MatchSeer Game Card details">
                <article className="nfl-game-path-card favorite">
                  <span>Favorite edge</span>
                  <strong>{activeGameCard.favorite.code} path</strong>
                  <p>{activeGameCard.favoritePath}</p>
                </article>
                <article className="nfl-game-path-card">
                  <span>Underdog path</span>
                  <strong>{activeGameCard.underdog.code} path</strong>
                  <p>{activeGameCard.underdogPath}</p>
                </article>
                <article className="nfl-game-path-card">
                  <span>What flips it</span>
                  <strong>Levers to watch</strong>
                  <ul className="nfl-flip-list">
                    {activeGameCard.flipFactors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                  <div className="nfl-timeline-list">
                    {activeGameCard.timeline.map((item) => (
                      <p key={item.label}>
                        <strong>{item.label}</strong>
                        {item.detail}
                      </p>
                    ))}
                  </div>
                </article>
              </div>

              <div className="nfl-seer-receipts" aria-label="Metric label guide">
                {activeGameCard.metricNotes.map((note) => (
                  <div key={note.label}>
                    <span>{note.label}</span>
                    <strong>{note.value}</strong>
                    <em>{note.detail}</em>
                  </div>
                ))}
              </div>

              <div className="nfl-ask-seer" id="ask-seer">
                <div className="nfl-ask-seer-head">
                  <span>
                    <Sparkles size={17} />
                    Ask the Seer
                  </span>
                  <label className="nfl-voice-select">
                    <span>Ask voice</span>
                    <select
                      aria-label="Ask the Seer voice"
                      onChange={(event) =>
                        setNflVoiceId(event.target.value as SeerVoiceId)
                      }
                      value={nflVoiceId}
                    >
                      {nflVoiceOptions.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => setSeerQuestionAsked(true)}
                    type="button"
                  >
                    <Sparkles size={16} />
                    Ask the Seer
                  </button>
                </div>
                <div className="nfl-question-chips" aria-label="Ask the Seer presets">
                  {[
                    `Why ${activeGameCard.favorite.name}?`,
                    `How does ${activeGameCard.underdog.code} win?`,
                    "What flips it?",
                    "Explain the score path",
                    "Explain like a friend",
                    activeGameCard.isPreseason ? "Preseason risk?" : "",
                  ]
                    .filter((question): question is string => Boolean(question))
                    .map((question) => (
                      <button
                        key={question}
                        onClick={() => {
                          setSeerQuestion(question);
                          setSeerQuestionAsked(true);
                        }}
                        type="button"
                      >
                        {question}
                      </button>
                    ))}
                </div>
                <textarea
                  aria-label="Ask the Seer"
                  maxLength={150}
                  onChange={(event) => setSeerQuestion(event.target.value)}
                  placeholder="Can the underdog steal it?"
                  rows={2}
                  value={seerQuestion}
                />
                <p className="nfl-voice-note">
                  <strong>{nflVoice.shortName}:</strong> {nflVoice.onboardingLine}
                </p>
                {seerQuestionAsked ? (
                  <p className="nfl-seer-oracle-answer">{seerOracleRead}</p>
                ) : null}
              </div>

              <ProbabilityBar
                leftColor={activeMatchupPalette.away}
                leftLabel={activeMatchup.away.code}
                leftValue={activeScenario.awayWin}
                rightColor={activeMatchupPalette.home}
                rightLabel={activeMatchup.home.code}
                rightValue={activeScenario.homeWin}
              />

              <div className="nfl-edge-row">
                {activeMatchup.edges.map((edge) => (
                  <span key={edge}>{edge}</span>
                ))}
              </div>
            </article>
          </section>

          <ScenarioLab
            impact={activeScenario}
            levers={activeScenarioLevers}
            matchup={activeMatchup}
            onChange={updateScenarioLever}
            onReset={resetScenarioLevers}
          />

          <NflStandingsPanel
            group={nflSlateGroup}
            rows={nflStandings}
            selection={{ phase: nflPhase, week: nflWeek }}
          />

          <section className="nfl-grid-section game-only" id="matchup-dna">
            <div className="nfl-team-compare">
              <div className="nfl-section-kicker">
                <Swords size={17} />
                Matchup DNA
              </div>
              <TeamCompare matchup={activeMatchup} />
            </div>
          </section>
          <ProFootballFooterDisclaimer />
        </>
      ) : (
        <>
          <FantasyCommandCenter
            fantasyImport={fantasyImport}
            leagueMap={fantasyLeaguePowerMap}
            onOpponentTeamChange={setOpponentFantasyTeamId}
            onTeamChange={setActiveFantasyTeamId}
            onViewChange={setFantasyView}
            opponentTeamId={opponentFantasyTeam.id}
            sourceLanes={fantasySourceLanes}
            teamLens={teamLens}
          />

          <FantasyHero
            actions={fantasyActionQueue}
            contextStatus={fantasyContextLayer.status}
            fantasyImport={fantasyImport}
            matchupReport={fantasyMatchupReport}
            onAskSeer={requestScoutingRead}
            onScoringChange={setScoringFormat}
            onViewChange={setFantasyView}
            read={fantasyHeroRead}
            report={activeTeamReport}
            scoringFormat={scoringFormat}
            scoutStatus={scoutStatus}
            teamLens={teamLens}
          />

          <FantasyViewTabs
            current={fantasyView}
            leagueMap={fantasyLeaguePowerMap}
            matchupReport={fantasyMatchupReport}
            onChange={setFantasyView}
            report={activeTeamReport}
            rookieCount={rookieWatchRows.length}
            totalPlayers={scoutingBoard.length}
          />

          {fantasyView === "overview" ? (
            <FantasyOverview
              actions={fantasyActionQueue}
              matchupReport={fantasyMatchupReport}
              report={activeTeamReport}
              rows={scoutingBoard.slice(0, 8)}
              scoringFormat={scoringFormat}
              teamLens={teamLens}
            />
          ) : null}

          {fantasyView === "players" ? (
            <ScoutingBoard
              analysis={scoutRead}
              allRows={scoutingBoard}
              depth={scoutingDepth}
              mode={scoutingBoardMode}
              onDepthChange={updateScoutingDepth}
              onModeChange={updateScoutingBoardMode}
              onPositionChange={updateScoutingPosition}
              onRequest={requestScoutingRead}
              hasLiveOrImportedSourceRankings={hasLiveOrImportedSourceRankings}
              position={scoutingPosition}
              rosteredIds={rosteredScoutingPlayerIds}
              rows={visibleScoutingRows}
              scoringFormat={scoringFormat}
              status={scoutStatus}
              teamLens={teamLens}
              weakestPosition={activeTeamReport.weakestLane.position}
            />
          ) : null}

          {fantasyView === "roster" ? (
            <FantasyTeamLab
              activeReport={activeTeamReport}
              contextStatus={fantasyContextLayer.status}
              fantasyImport={fantasyImport}
              providerBridgeFileName={providerBridgeFileName}
              providerBridgeImport={providerBridgeImport}
              providerBridgeMessage={providerBridgeMessage}
              providerBridgeStatus={providerBridgeStatus}
              providerBridgeText={providerBridgeText}
              sourceLanes={fantasySourceLanes}
              manualImportMessage={manualImportMessage}
              manualImportStatus={manualImportStatus}
              manualRosterText={manualRosterText}
              matchupReport={fantasyMatchupReport}
              onManualImport={() => applyManualRosterImport("manual")}
              onLensChange={setTeamLens}
              onOpponentTeamChange={setOpponentFantasyTeamId}
              onProviderBridgeFile={handleProviderBridgeFile}
              onProviderBridgeImport={() => applyProviderBridgeImport(providerBridgeText)}
              onProviderBridgeTextChange={setProviderBridgeText}
              onScoringChange={setScoringFormat}
              onScreenshotFile={handleScreenshotFile}
              onScreenshotImport={requestScreenshotRosterImport}
              onSleeperImport={requestSleeperImport}
              onSleeperQueryChange={setSleeperQuery}
              onSleeperRefresh={() => requestSleeperRefresh()}
              onTeamChange={setActiveFantasyTeamId}
              onManualRosterTextChange={setManualRosterText}
              opponentTeamId={opponentFantasyTeam.id}
              scoringFormat={scoringFormat}
              screenshotFileName={screenshotFileName}
              screenshotImportMessage={screenshotImportMessage}
              screenshotImportStatus={screenshotImportStatus}
              sleeperImportMessage={sleeperImportMessage}
              sleeperImportStatus={sleeperImportStatus}
              sleeperLastRefreshedAt={sleeperLastRefreshedAt}
              sleeperLeagueOptions={sleeperLeagueOptions}
              sleeperSelectedLeagueId={sleeperSelectedLeagueId}
              sleeperQuery={sleeperQuery}
              sleeperUseAutoWeek={sleeperUseAutoWeek}
              sleeperWeek={sleeperWeek}
              onSleeperLeagueImport={requestSleeperLeagueImport}
              teamLens={teamLens}
              teams={fantasyTeams}
              onSleeperUseAutoWeekChange={updateSleeperAutoWeek}
              onSleeperWeekChange={updateSleeperWeek}
            />
          ) : null}

          {fantasyView === "league" ? (
            <FantasyLeaguePowerMapSection
              leagueMap={fantasyLeaguePowerMap}
              scoringFormat={scoringFormat}
              teamLens={teamLens}
            />
          ) : null}

          {fantasyView === "trades" ? (
            <FantasyTradeBuilderSection
              result={fantasyTradeBuilder}
              scoringFormat={scoringFormat}
              teamLens={teamLens}
            />
          ) : null}

          {fantasyView === "rookies" ? (
            <FantasyRookieBoard
              rows={rookieWatchRows}
              scoringFormat={scoringFormat}
            />
          ) : null}

          {fantasyView === "compare" ? (
            <FantasyPlayerCompareSection
              fantasyPlayers={fantasyPlayers}
              leftPlayer={leftScoutingPlayer}
              leftPlayerId={leftPlayerId}
              onLeftPlayerChange={setLeftPlayerId}
              onRightPlayerChange={setRightPlayerId}
              rightPlayer={rightScoutingPlayer}
              rightPlayerId={rightPlayerId}
              scoringFormat={scoringFormat}
              startLean={startLean}
            />
          ) : null}
          <FantasySeerFooterDisclaimer />
        </>
      )}
    </main>
  );
}

function NflDataRibbon({
  contextStatus,
  dataset,
  status,
}: {
  contextStatus: FantasyContextStatus;
  dataset: NflSeerDataset;
  status: NflDataStatus;
}) {
  const updatedAt =
    dataset.updatedAt === new Date(0).toISOString()
      ? "waiting"
      : formatDataUpdated(dataset.updatedAt);
  const fantasyProviders = dataset.providerStatus.fantasyProviders ?? [];
  const fantasyCoverage = dataset.providerStatus.fantasyCoverage;
  const providerWarning = fantasyProviders.find(
    (provider) =>
      provider.status === "error" ||
      provider.freshness === "stale" ||
      provider.status === "missing",
  );

  return (
    <section className="nfl-data-ribbon" aria-label="Pro football data status">
      <div>
        <span className={cx("nfl-live-dot", status === "ready" && "live")} />
        <strong>{dataSourceLabel(dataset.source, status)}</strong>
        <em>
          {dataset.season} · {dataset.weekLabel} · {updatedAt}
        </em>
      </div>
      <div className="nfl-data-pills">
        <span className={cx(dataset.providerStatus.schedule === "live" && "live")}>
          Schedule {dataset.providerStatus.schedule}
        </span>
        <span className={cx(dataset.providerStatus.fantasy === "live" && "live")}>
          Fantasy {dataset.providerStatus.fantasy}
        </span>
        <span className={cx(dataset.providerStatus.market === "live" && "live")}>
          Crowd {dataset.providerStatus.market}
        </span>
        <span className={cx(contextStatus.status === "live" && "live")}>
          Context {contextStatus.status}
        </span>
      </div>
      {dataset.providerStatus.notes.length > 0 ? (
        <p>{dataset.providerStatus.notes.slice(0, 2).join(" ")}</p>
      ) : null}
      {fantasyProviders.length > 0 ? (
        <div className="nfl-provider-grid" aria-label="Fantasy provider status">
          {fantasyProviders.map((provider) => (
            <article
              className={cx(
                "nfl-provider-strip",
                provider.status === "live" && "live",
                provider.status === "error" && "error",
                provider.freshness === "stale" && "stale",
              )}
              key={provider.id}
            >
              <div>
                <strong>{provider.label}</strong>
                <span>{provider.status}</span>
              </div>
              <p>{provider.message}</p>
              <em>
                {provider.count} rows · {provider.freshness}
                {provider.updatedAt ? ` · ${formatDataUpdated(provider.updatedAt)}` : ""}
              </em>
              <div className="nfl-provider-positions">
                {fantasyCoveragePositions.map((position) => (
                  <span key={position}>
                    {scoutingRankLabel(position)} {provider.positions[position] ?? 0}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {fantasyCoverage ? (
        <div className="nfl-source-coverage" aria-label="Fantasy source coverage">
          <div>
            <strong>Fantasy source coverage</strong>
            <em>
              {fantasyCoverage.totalPlayers} players ·{" "}
              {fantasyCoverage.totalProjections} projections ·{" "}
              {fantasyCoverage.totalRankings} rankings
            </em>
          </div>
          <div className="nfl-source-coverage-lanes">
            {fantasyCoveragePositions.map((position) => {
              const row = fantasyCoverage.positions[position];

              return (
                <span
                  className={cx(row.total > 0 && "live")}
                  key={position}
                  title={`${row.players} players, ${row.projections} projections, ${row.rankings} rankings`}
                >
                  {scoutingRankLabel(position)} {row.total}
                </span>
              );
            })}
          </div>
          {fantasyCoverage.missingPositions.length > 0 || providerWarning ? (
            <p>
              {providerWarning ? providerWarning.message : "Coverage is thin"}{" "}
              {fantasyCoverage.missingPositions.length > 0
                ? `Missing ${fantasyCoverage.missingPositions
                    .map(scoutingRankLabel)
                    .join(", ")} coverage.`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="nfl-context-receipt" aria-label="Fantasy context status">
        <div>
          <strong>Matchup context</strong>
          <em>
            {contextStatus.coveredTeams}/{contextStatus.totalTeams} teams covered ·{" "}
            {contextStatus.freshness}
          </em>
        </div>
        <p>
          {contextStatus.message}
          {contextStatus.warnings.length > 0
            ? ` ${contextStatus.warnings.slice(0, 1).join(" ")}`
            : ""}
        </p>
      </div>
    </section>
  );
}

function NflSlateControls({
  group,
  onGroupChange,
  onPhaseChange,
  onWeekChange,
  phase,
  week,
}: {
  group: NflSlateGroup;
  onGroupChange: (group: NflSlateGroup) => void;
  onPhaseChange: (phase: NflSeasonPhase) => void;
  onWeekChange: (week: number) => void;
  phase: NflSeasonPhase;
  week: number;
}) {
  return (
    <div className="nfl-slate-controls" aria-label="Pro football slate controls">
      <div className="nfl-phase-toggle" aria-label="Season phase">
        {(Object.keys(nflPhaseLabels) as NflSeasonPhase[]).map((option) => (
          <button
            aria-pressed={phase === option}
            className={cx(phase === option && "active")}
            key={option}
            onClick={() => onPhaseChange(option)}
            type="button"
          >
            {nflPhaseLabels[option]}
          </button>
        ))}
      </div>
      <div className="nfl-week-strip" aria-label="Pro football week">
        {nflWeeksByPhase[phase].map((option) => (
          <button
            aria-pressed={week === option}
            className={cx(week === option && "active")}
            key={option}
            onClick={() => onWeekChange(option)}
            type="button"
          >
            W{option}
          </button>
        ))}
      </div>
      <label className="nfl-group-select">
        <span>Group</span>
        <select
          onChange={(event) => onGroupChange(event.target.value as NflSlateGroup)}
          value={group}
        >
          {nflSlateGroups.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All pro football" : option}
            </option>
          ))}
        </select>
      </label>
      <p>
        {phase === "preseason"
          ? "Preseason reads weight QB depth, rotation hints, and roster-bubble chaos."
          : "Current week follows the live feed; future rooms stay ready for the next sync."}
      </p>
    </div>
  );
}

function NflStandingsPanel({
  group,
  rows,
  selection,
}: {
  group: NflSlateGroup;
  rows: NflStandingRow[];
  selection: NflSlateSelection;
}) {
  const title = group === "all" ? "Standings pulse" : `${group} pulse`;
  const visibleRows = rows.slice(0, 4);

  return (
    <section className="nfl-standings-panel" aria-label="Pro football standings">
      <div className="nfl-standings-head">
        <div>
          <div className="nfl-section-kicker">
            <Trophy size={17} />
            Slate table
          </div>
          <h2>{title}</h2>
          <p>
            {nflPhaseLabels[selection.phase]} Week {selection.week}. Top slate shapes,
            kept compact until the full table matters.
          </p>
        </div>
        <strong>{rows.length} teams tracked</strong>
      </div>
      <div className="nfl-standings-table">
        {visibleRows.map((row, index) => (
          <article className="nfl-standings-row" key={row.code}>
            <span>#{index + 1}</span>
            <div>
              <strong>{row.name}</strong>
              <em>
                {row.division} · {row.conference}
              </em>
            </div>
            <b>
              {row.wins}-{row.losses}
              {row.ties ? `-${row.ties}` : ""}
            </b>
            <small>
              PF {row.projectedFor} · PA {row.projectedAgainst}
            </small>
            <i>
              <span style={{ width: `${row.strength}%` }} />
            </i>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScenarioLab({
  impact,
  levers,
  matchup,
  onChange,
  onReset,
}: {
  impact: ScenarioImpact;
  levers: ScenarioLevers;
  matchup: NflMatchup;
  onChange: (key: keyof ScenarioLevers, value: number) => void;
  onReset: () => void;
}) {
  return (
    <section className="nfl-scenario-lab" id="scenario-lab">
      <div className="nfl-scenario-head">
        <div>
          <div className="nfl-section-kicker">
            <Gauge size={17} />
            What-if lab
          </div>
          <h2>Live scenario pressure</h2>
        </div>
        <button className="nfl-reset-button" onClick={onReset} type="button">
          <Sparkles size={16} />
          Reset read
        </button>
      </div>
      <div className="nfl-scenario-body">
        <div className="nfl-scenario-controls">
          <ScenarioControl
            icon={<Wind size={16} />}
            label="Wind stress"
            max={100}
            min={0}
            onChange={(value) => onChange("wind", value)}
            value={levers.wind}
            valueLabel={`${levers.wind}%`}
          />
          <ScenarioControl
            icon={<HeartPulse size={16} />}
            label="Health swing"
            max={20}
            min={-20}
            onChange={(value) => onChange("healthSwing", value)}
            value={levers.healthSwing}
            valueLabel={formatHealthSwing(matchup, levers.healthSwing)}
          />
          <ScenarioControl
            icon={<Timer size={16} />}
            label="Tempo"
            max={95}
            min={45}
            onChange={(value) => onChange("tempo", value)}
            value={levers.tempo}
            valueLabel={`${levers.tempo}%`}
          />
          <ScenarioControl
            icon={<Activity size={16} />}
            label="Home noise"
            max={100}
            min={0}
            onChange={(value) => onChange("homeNoise", value)}
            value={levers.homeNoise}
            valueLabel={`${levers.homeNoise}%`}
          />
        </div>
        <article className="nfl-scenario-read">
          <div className="nfl-card-topline">
            <span>Scenario lean</span>
            <strong>
              {impact.leanCode} {impact.leanProbability}%
            </strong>
          </div>
          <p>{impact.read}</p>
          <div className="nfl-scenario-score">
            <span>Projected</span>
            <strong>{impact.projected}</strong>
          </div>
          <div className="nfl-scenario-factors">
            {impact.factors.map((factor) => (
              <div key={factor.label}>
                <span>{factor.label}</span>
                <strong>{factor.value}</strong>
                <em>{factor.detail}</em>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function ScenarioControl({
  icon,
  label,
  max,
  min,
  onChange,
  value,
  valueLabel,
}: {
  icon: ReactNode;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
  valueLabel: string;
}) {
  return (
    <label className="nfl-scenario-control">
      <div>
        <span>
          {icon}
          <strong>{label}</strong>
        </span>
        <em>{valueLabel}</em>
      </div>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function ScoringToggle({
  value,
  onChange,
}: {
  value: ScoringFormat;
  onChange: (value: ScoringFormat) => void;
}) {
  return (
    <div className="nfl-format-toggle" aria-label="Fantasy scoring format">
      {(Object.keys(scoringLabels) as ScoringFormat[]).map((format) => (
        <button
          className={cx(value === format && "active")}
          key={format}
          onClick={() => onChange(format)}
          type="button"
        >
          {scoringLabels[format]}
        </button>
      ))}
    </div>
  );
}

function HeroTeamCard({
  role,
  team,
  toneColor,
}: {
  role: string;
  team: NflTeam;
  toneColor?: string;
}) {
  const accentColor = toneColor ?? team.color;
  const qbTone =
    team.qb >= 90 ? "Superstar QB" : team.qb >= 85 ? "Star QB" : "QB path";
  const trenchTone =
    team.trenches >= 88
      ? "Pocket armor"
      : team.trenches >= 83
        ? "Line holds"
        : "Pressure test";

  return (
    <div className="nfl-hero-team" style={{ borderColor: accentColor }}>
      <div className="nfl-hero-team-top">
        <span style={{ background: accentColor }}>{team.code}</span>
        <em>{role}</em>
      </div>
      <div className="nfl-hero-team-name">
        <strong>{team.name}</strong>
        <small>{team.city}</small>
      </div>
      <div className="nfl-hero-team-metrics">
        <span>
          <em>Off</em>
          <b>{team.offense}</b>
        </span>
        <span>
          <em>QB</em>
          <b>{team.qb}</b>
        </span>
        <span>
          <em>Def</em>
          <b>{team.defense}</b>
        </span>
      </div>
      <div className="nfl-hero-team-chips">
        <span>{qbTone}</span>
        <span>{trenchTone}</span>
      </div>
    </div>
  );
}

function TeamPill({ team, align = "left" }: { team: NflTeam; align?: "left" | "right" }) {
  return (
    <div className={cx("nfl-team-pill", align === "right" && "right")}>
      <span style={{ background: team.color }}>{team.code}</span>
      <div>
        <strong>{team.name}</strong>
        <em>{team.city}</em>
      </div>
    </div>
  );
}

function readableMatchupPalette(awayColor: string, homeColor: string) {
  const fallback = {
    away: "#8fb3d9",
    home: "#34f5a6",
  };
  const awayRgb = colorToRgb(awayColor);
  const homeRgb = colorToRgb(homeColor);

  if (!awayRgb || !homeRgb) {
    return { away: awayColor, home: homeColor };
  }

  const distance = Math.hypot(
    awayRgb[0] - homeRgb[0],
    awayRgb[1] - homeRgb[1],
    awayRgb[2] - homeRgb[2],
  );
  const awayLum = colorLuminance(awayRgb);
  const homeLum = colorLuminance(homeRgb);
  const bothDark = awayLum < 0.18 && homeLum < 0.18;

  if (distance < 88 || bothDark) {
    return fallback;
  }

  return { away: awayColor, home: homeColor };
}

function colorToRgb(color: string): [number, number, number] | null {
  const match = color.trim().match(/^#?([a-f\d]{6})$/i);

  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function colorLuminance([red, green, blue]: [number, number, number]) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function ProbabilityBar({
  leftColor,
  leftLabel,
  leftValue,
  rightColor,
  rightLabel,
  rightValue,
}: {
  leftColor: string;
  leftLabel: string;
  leftValue: number;
  rightColor: string;
  rightLabel: string;
  rightValue: number;
}) {
  return (
    <div className="nfl-probability">
      <div>
        <span>{leftLabel}</span>
        <strong>{leftValue}%</strong>
      </div>
      <div className="nfl-probability-track">
        <span style={{ width: `${leftValue}%`, background: leftColor }} />
        <span style={{ width: `${rightValue}%`, background: rightColor }} />
      </div>
      <div>
        <span>{rightLabel}</span>
        <strong>{rightValue}%</strong>
      </div>
    </div>
  );
}

function MarketBlendStrip({ matchup }: { matchup: NflMatchup }) {
  const sourceHome = matchup.sourceHomeWin ?? matchup.homeWin;
  const sourceAway = matchup.sourceAwayWin ?? matchup.awayWin;
  const marketPulse = matchup.marketPulse;
  const marketHome = marketPulse?.home ?? null;
  const marketAway = marketPulse?.away ?? null;

  return (
    <div className="nfl-market-blend">
      <div>
        <span>Source model</span>
        <strong>
          {matchup.home.code} {sourceHome}% · {matchup.away.code} {sourceAway}%
        </strong>
      </div>
      <div className={cx(marketPulse?.nudge.applied && "active")}>
        <span>Crowd signal</span>
        <strong>
          {marketPulse
            ? `${matchup.home.code} ${marketHome}% · ${matchup.away.code} ${marketAway}%`
            : "Waiting"}
        </strong>
      </div>
      <div>
        <span>Seer blend</span>
        <strong>
          {matchup.home.code} {matchup.homeWin}% · {matchup.away.code} {matchup.awayWin}%
        </strong>
      </div>
      <p>
        {marketPulse?.nudge.summary ??
          "The crowd lane is not live yet, so the Seer is running from schedule, roster, venue, and matchup priors."}
      </p>
    </div>
  );
}

function MiniMeter({
  icon,
  label,
  value,
  hot = false,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hot?: boolean;
}) {
  return (
    <div className="nfl-mini-meter">
      <div>
        {icon}
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <i>
        <span
          style={{
            width: `${value}%`,
            background: hot
              ? "linear-gradient(90deg, #f7c51d, #ff6b35)"
              : "linear-gradient(90deg, #8fb3d9, #34f5a6)",
          }}
        />
      </i>
    </div>
  );
}

function TeamCompare({ matchup }: { matchup: NflMatchup }) {
  const palette = readableMatchupPalette(matchup.away.color, matchup.home.color);
  const rows = [
    { label: "Offense", away: matchup.away.offense, home: matchup.home.offense },
    { label: "Defense", away: matchup.away.defense, home: matchup.home.defense },
    { label: "QB", away: matchup.away.qb, home: matchup.home.qb },
    { label: "Trenches", away: matchup.away.trenches, home: matchup.home.trenches },
    { label: "Coaching", away: matchup.away.coaching, home: matchup.home.coaching },
    { label: "Health", away: matchup.away.injuries, home: matchup.home.injuries },
  ]
    .map((row) => ({
      ...row,
      diff: Math.abs(row.away - row.home),
      leader:
        row.away === row.home
          ? "Even"
          : row.away > row.home
            ? matchup.away.code
            : matchup.home.code,
    }))
    .sort((left, right) => right.diff - left.diff)
    .slice(0, 4);

  return (
    <div className="nfl-compare-card compact">
      <div className="nfl-compare-head">
        <TeamPill team={matchup.away} />
        <TeamPill team={matchup.home} align="right" />
      </div>
      <div className="nfl-compare-rows">
        {rows.map((row) => (
          <div className="nfl-compare-row" key={row.label}>
            <strong>{row.away}</strong>
            <div>
              <span>{row.label}</span>
              <i>
                <b
                  className="away"
                  style={{ width: `${row.away}%`, background: palette.away }}
                />
                <b
                  className="home"
                  style={{ width: `${row.home}%`, background: palette.home }}
                />
              </i>
            </div>
            <strong>{row.home}</strong>
            <em>{row.diff === 0 ? "Even" : `${row.leader} +${row.diff}`}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function nflDefaultSelectionFromMatchups(
  matchups: NflMatchup[],
  weekLabel: string,
): NflSlateSelection {
  return (
    parseNflSlateSelection(matchups[0]?.week) ??
    parseNflSlateSelection(weekLabel) ?? {
      phase: "regular",
      week: 1,
    }
  );
}

function parseNflSlateSelection(value: string | null | undefined): NflSlateSelection | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  const phase: NflSeasonPhase = normalized.includes("preseason")
    ? "preseason"
    : "regular";
  const weekMatch = normalized.match(/week\s*(\d{1,2})/);
  const week = weekMatch ? Number(weekMatch[1]) : null;

  if (!week || !Number.isFinite(week)) {
    return null;
  }

  return {
    phase,
    week,
  };
}

function isPreseasonMatchup(matchup: NflMatchup) {
  return parseNflSlateSelection(matchup.week)?.phase === "preseason";
}

function withSeededNflSlateRooms(matchups: NflMatchup[]) {
  const baseMatchups = matchups.length > 0 ? matchups : seededMatchups;
  const seenIds = new Set(baseMatchups.map((matchup) => matchup.id));
  const seenSlateKeys = new Set(
    baseMatchups
      .map((matchup) => parseNflSlateSelection(matchup.week))
      .filter((selection): selection is NflSlateSelection => Boolean(selection))
      .map((selection) => `${selection.phase}:${selection.week}`),
  );
  const preseasonRooms = seededPreseasonMatchups.filter((matchup) => {
    const selection = parseNflSlateSelection(matchup.week);

    if (!selection) {
      return false;
    }

    return (
      !seenIds.has(matchup.id) &&
      !seenSlateKeys.has(`${selection.phase}:${selection.week}`)
    );
  });

  return [...baseMatchups, ...preseasonRooms];
}

function matchupMatchesSlate(matchup: NflMatchup, selection: NflSlateSelection) {
  const matchupSelection = parseNflSlateSelection(matchup.week);

  if (!matchupSelection) {
    return selection.phase === "regular" && selection.week === 1;
  }

  return (
    matchupSelection.phase === selection.phase && matchupSelection.week === selection.week
  );
}

function matchupMatchesGroup(matchup: NflMatchup, group: NflSlateGroup) {
  if (group === "all") {
    return true;
  }

  return (
    teamMatchesNflGroup(matchup.away, group) ||
    teamMatchesNflGroup(matchup.home, group)
  );
}

function teamMatchesNflGroup(team: NflTeam, group: NflSlateGroup) {
  if (group === "all") {
    return true;
  }

  const division = nflTeamDivisions[team.code];

  if (!division) {
    return false;
  }

  if (group === "AFC" || group === "NFC") {
    return division.startsWith(group);
  }

  return division === group;
}

function buildNflStandings(matchups: NflMatchup[], group: NflSlateGroup) {
  const rows = new Map<string, NflStandingRow>();

  for (const matchup of matchups) {
    const score = parseProjectedScore(matchup.projected);
    const awayWon = matchup.awayWin > matchup.homeWin;
    const tied = matchup.awayWin === matchup.homeWin;

    updateNflStanding(rows, matchup.away, group, {
      forPoints: score.away,
      againstPoints: score.home,
      result: tied ? "tie" : awayWon ? "win" : "loss",
      strength: matchup.awayWin,
    });
    updateNflStanding(rows, matchup.home, group, {
      forPoints: score.home,
      againstPoints: score.away,
      result: tied ? "tie" : awayWon ? "loss" : "win",
      strength: matchup.homeWin,
    });
  }

  return Array.from(rows.values()).sort(
    (left, right) =>
      right.wins - left.wins ||
      left.losses - right.losses ||
      right.strength - left.strength ||
      right.projectedFor - left.projectedFor,
  );
}

function updateNflStanding(
  rows: Map<string, NflStandingRow>,
  team: NflTeam,
  group: NflSlateGroup,
  update: {
    againstPoints: number;
    forPoints: number;
    result: "win" | "loss" | "tie";
    strength: number;
  },
) {
  if (!teamMatchesNflGroup(team, group)) {
    return;
  }

  const division = nflTeamDivisions[team.code];

  if (!division) {
    return;
  }

  const current =
    rows.get(team.code) ??
    ({
      code: team.code,
      conference: division.startsWith("AFC") ? "AFC" : "NFC",
      division,
      losses: 0,
      name: `${team.city} ${team.name}`,
      projectedAgainst: 0,
      projectedFor: 0,
      strength: 0,
      ties: 0,
      wins: 0,
    } satisfies NflStandingRow);

  current.projectedAgainst += update.againstPoints;
  current.projectedFor += update.forPoints;
  current.strength = Math.max(current.strength, update.strength);

  if (update.result === "win") {
    current.wins += 1;
  } else if (update.result === "loss") {
    current.losses += 1;
  } else {
    current.ties += 1;
  }

  rows.set(team.code, current);
}

function parseProjectedScore(projected: string) {
  const scores = projected.match(/(\d{1,2})\s*-\s*(\d{1,2})/);

  if (!scores) {
    return { away: 21, home: 20 };
  }

  return {
    away: Number(scores[1]),
    home: Number(scores[2]),
  };
}

function FantasyHero({
  actions,
  contextStatus,
  fantasyImport,
  matchupReport,
  onAskSeer,
  onScoringChange,
  onViewChange,
  read,
  report,
  scoringFormat,
  scoutStatus,
  teamLens,
}: {
  actions: FantasyActionItem[];
  contextStatus: FantasyContextStatus;
  fantasyImport: ImportedFantasyLeague | null;
  matchupReport: FantasyMatchupReport;
  onAskSeer: () => void;
  onScoringChange: (format: ScoringFormat) => void;
  onViewChange: (view: FantasyView) => void;
  read: NflScoutingAnalysis;
  report: FantasyTeamReport;
  scoringFormat: ScoringFormat;
  scoutStatus: ScoutStatus;
  teamLens: FantasyTeamLens;
}) {
  const opponentReport =
    matchupReport.left.team.id === report.team.id
      ? matchupReport.right
      : matchupReport.left;
  const sourceLabel = fantasyImport
    ? fantasyImport.sleeper?.leagueName ?? fantasyImport.label
    : "Sample roster";
  const weeklyCoach = buildFantasyWeeklyCoach({
    matchupReport,
    report,
    scoringFormat,
    teamLens,
  });
  const closeAction =
    actions.find((action) => action.kind === "watch") ?? actions[1];
  const marketAction =
    actions.find((action) => action.kind === "market") ??
    actions.find((action) => action.kind === "swap") ??
    actions[2];

  return (
    <section className="nfl-fantasy-hero" id="fantasy-seer">
      <div className="nfl-fantasy-command">
        <div className="nfl-section-kicker">
          <BrainCircuit size={17} />
          Fantasy football experiments
        </div>
        <h1>Fantasy Seer</h1>
        <p>
          Weekly fantasy decisions across all your teams, cleaned up. Best move first,
          close calls second, trade ideas third, and the deep math tucked into the rooms.
        </p>
        <div className="nfl-fantasy-hero-actions">
          <button onClick={() => onViewChange("roster")} type="button">
            <RefreshCw size={16} />
            Connect roster
          </button>
          <button className="secondary" onClick={() => onViewChange("trades")} type="button">
            <LineChart size={16} />
            Build trade
          </button>
          <button
            className="secondary"
            disabled={scoutStatus === "loading"}
            onClick={onAskSeer}
            type="button"
          >
            <Sparkles size={16} />
            {scoutStatus === "loading" ? "Reading" : "Ask Fantasy Seer"}
          </button>
        </div>
        <ScoringToggle value={scoringFormat} onChange={onScoringChange} />
        <div className="nfl-fantasy-hero-pills">
          <span>{scoringLabels[scoringFormat]}</span>
          <span>{teamLensLabels[teamLens]}</span>
          <span>{contextStatus.status} context</span>
          <span>{sourceLabel}</span>
        </div>
        <FantasySeerSafetyNote />
      </div>

      <article className="nfl-fantasy-command-card">
        <div className="nfl-card-topline">
          <span>{teamLensLabels[teamLens]} board</span>
          <strong>{sourceLabel}</strong>
        </div>

        <FantasyBestMovePanel
          matchupReport={matchupReport}
          onViewChange={onViewChange}
          report={report}
          weeklyCoach={weeklyCoach}
        />

        <div className="nfl-fantasy-decision-lanes" aria-label="Key fantasy decisions">
          <FantasyHeroDecisionCard action={closeAction} eyebrow="Close call" />
          <FantasyHeroDecisionCard action={marketAction} eyebrow="Trade / waiver idea" />
        </div>

        <div className="nfl-prekick-note">
          <Timer size={16} />
          <span>
            Re-check before kickoff: {closeAction?.risk ?? "confirm injuries, role, weather, and opponent defense before lineup lock."}
          </span>
        </div>

        <div className="nfl-roster-map" aria-label="Roster map">
          <div className="nfl-roster-map-head">
            <span>Roster map</span>
            <strong>{weeklyCoach.pressure.label}</strong>
            <em>{weeklyCoach.pressure.summary}</em>
          </div>
          <div className="nfl-roster-map-grid">
            {weeklyCoach.rosterMap.map((item) => (
              <article className={cx("nfl-roster-map-card", item.tone)} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.band}</strong>
                <em>{item.detail}</em>
              </article>
            ))}
          </div>
        </div>

        <div className="nfl-fantasy-scoreboard">
          <div>
            <span>{report.team.manager}</span>
            <strong>{report.team.name}</strong>
            <em>{report.projection.toFixed(1)} projected pts</em>
          </div>
          <div className="nfl-fantasy-scoreboard-core">
            <span>Matchup</span>
            <strong>{matchupReport.edgeLabel}</strong>
            <em>
              {matchupReport.confidence}% read · {matchupReport.chaos}% variance
            </em>
          </div>
          <div>
            <span>Opponent</span>
            <strong>{opponentReport.team.name}</strong>
            <em>{opponentReport.projection.toFixed(1)} projected pts</em>
          </div>
        </div>

        <details className="nfl-model-lab-drawer">
          <summary>
            <span>
              <Sparkles size={16} />
              Receipts / Model Lab
            </span>
            <em>Open the deeper math</em>
          </summary>
          <div className="nfl-fantasy-read-card nfl-model-receipts">
            <strong>{read.headline}</strong>
            <p>{read.summary}</p>
            <div className="nfl-ai-factor-list">
              {[...weeklyCoach.receipts, ...read.factors].slice(0, 5).map((factor) => (
                <span key={factor}>{factor}</span>
              ))}
            </div>
            <em>{read.watchlist}</em>
            <small className="nfl-fantasy-card-disclaimer">{read.disclaimer}</small>
          </div>
        </details>
      </article>
    </section>
  );
}

function FantasyCommandCenter({
  fantasyImport,
  leagueMap,
  opponentTeamId,
  onOpponentTeamChange,
  onTeamChange,
  onViewChange,
  sourceLanes,
  teamLens,
}: {
  fantasyImport: ImportedFantasyLeague | null;
  leagueMap: FantasyLeaguePowerMap;
  opponentTeamId: string;
  onOpponentTeamChange: (teamId: string) => void;
  onTeamChange: (teamId: string) => void;
  onViewChange: (view: FantasyView) => void;
  sourceLanes: FantasySourceLane[];
  teamLens: FantasyTeamLens;
}) {
  const active = leagueMap.active;
  const opponentOptions = leagueMap.teams.filter(
    (team) => team.report.team.id !== active.report.team.id,
  );
  const selectedOpponent =
    opponentOptions.find((team) => team.report.team.id === opponentTeamId) ??
    opponentOptions[0] ??
    null;
  const selectedOpponentId = selectedOpponent?.report.team.id ?? active.report.team.id;
  const leagueLabel =
    fantasyImport?.sleeper?.leagueName ?? fantasyImport?.label ?? "Sample league room";
  const leagueMeta = [
    fantasyImport?.season ? `Season ${fantasyImport.season}` : null,
    fantasyImport?.week ? `Week ${fantasyImport.week}` : null,
    `${leagueMap.teamCount} teams`,
    fantasyImport?.settings?.formatLabel ?? teamLensLabels[teamLens],
  ].filter(Boolean);
  const activePressure = fantasyPrimaryPressure(active.report);
  const opponentTradeRead = selectedOpponent
    ? fantasyPortfolioOpponentTradeRead(selectedOpponent, active)
    : null;
  const liveSourceCount = sourceLanes.filter((lane) => lane.status === "live").length;

  function handleTeamChange(teamId: string) {
    onTeamChange(teamId);

    if (teamId === selectedOpponentId) {
      const nextOpponent =
        leagueMap.teams.find((team) => team.report.team.id !== teamId)?.report.team.id ??
        teamId;

      onOpponentTeamChange(nextOpponent);
    }
  }

  function handleOpponentChange(teamId: string) {
    onOpponentTeamChange(teamId);
  }

  return (
    <section className="nfl-fantasy-command-center" aria-label="Fantasy Command Center">
      <div className="nfl-fantasy-command-center-top">
        <div>
          <div className="nfl-section-kicker">
            <UsersRound size={17} />
            Fantasy Command Center
          </div>
          <h1>{leagueLabel}</h1>
          <p>
            One league, one team, one decision room at a time. Your roster gets
            lineup advice; every other roster becomes a compare and trade target.
          </p>
        </div>
        <div className="nfl-fantasy-command-center-controls">
          <label>
            <span>My team</span>
            <select
              onChange={(event) => handleTeamChange(event.target.value)}
              value={active.report.team.id}
            >
              {leagueMap.teams.map((team) => (
                <option key={team.report.team.id} value={team.report.team.id}>
                  {team.report.team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Compare with</span>
            <select
              disabled={opponentOptions.length === 0}
              onChange={(event) => handleOpponentChange(event.target.value)}
              value={selectedOpponentId}
            >
              {opponentOptions.length > 0 ? (
                opponentOptions.map((team) => (
                  <option key={team.report.team.id} value={team.report.team.id}>
                    {team.report.team.name}
                  </option>
                ))
              ) : (
                <option value={active.report.team.id}>Add another team</option>
              )}
            </select>
          </label>
        </div>
      </div>

      <div className="nfl-fantasy-command-center-body">
        <article className="nfl-fantasy-selected-team-card">
          <span className="nfl-team-portfolio-mark" aria-hidden="true">
            {fantasyPlayerInitials(active.report.team.name)}
          </span>
          <div className="nfl-fantasy-selected-team-main">
            <span>My roster · {active.report.team.manager}</span>
            <strong>{active.report.team.name}</strong>
            <em>
              {leagueMap.rankLabel} · {leagueMeta.join(" · ")}
            </em>
          </div>
          <div className="nfl-fantasy-selected-team-metrics">
            <span>
              Projection
              <strong>{active.report.projection.toFixed(1)}</strong>
            </span>
            <span>
              Fix next
              <strong>{scoutingRankLabel(active.weakestPosition.position)}</strong>
            </span>
            <span>
              Trust
              <strong>{fantasyTrustBand(active.report.score)}</strong>
            </span>
          </div>
          <p>{activePressure.summary}</p>
        </article>

        <article className="nfl-fantasy-selected-team-card compare">
          <span className="nfl-team-portfolio-mark" aria-hidden="true">
            {selectedOpponent
              ? fantasyPlayerInitials(selectedOpponent.report.team.name)
              : "VS"}
          </span>
          <div className="nfl-fantasy-selected-team-main">
            <span>Selected compare target</span>
            <strong>{selectedOpponent?.report.team.name ?? "Add another team"}</strong>
            <em>
              {selectedOpponent
                ? `Rank #${selectedOpponent.rank} · weak at ${scoutingRankLabel(
                    selectedOpponent.weakestPosition.position,
                  )}`
                : "Connect a league to compare strength"}
            </em>
          </div>
          <div className="nfl-fantasy-selected-team-metrics">
            <span>
              Projection
              <strong>{selectedOpponent?.report.projection.toFixed(1) ?? "--"}</strong>
            </span>
            <span>
              Weak spot
              <strong>
                {selectedOpponent
                  ? scoutingRankLabel(selectedOpponent.weakestPosition.position)
                  : "TBD"}
              </strong>
            </span>
            <span>
              Trade target
              <strong>{opponentTradeRead?.targetLabel ?? leagueMap.easiestUpgrade}</strong>
            </span>
          </div>
          <div className="nfl-fantasy-trade-lane-preview">
            <b>Trade lane</b>
            <strong>{opponentTradeRead?.targetLabel ?? leagueMap.easiestUpgrade}</strong>
            <p>
              {opponentTradeRead?.summary ??
                "Once another roster is connected, this turns into a target, offer lane, and walk-away check."}
            </p>
          </div>
        </article>
      </div>

      <div className="nfl-fantasy-command-center-actions" aria-label="Fantasy room shortcuts">
        <button onClick={() => onViewChange("overview")} type="button">
          <Sparkles size={16} />
          Best Move
        </button>
        <button className="secondary" onClick={() => onViewChange("league")} type="button">
          <Trophy size={16} />
          League Compare
        </button>
        <button className="secondary" onClick={() => onViewChange("trades")} type="button">
          <LineChart size={16} />
          Trade Builder
        </button>
        <button className="secondary" onClick={() => onViewChange("roster")} type="button">
          <RefreshCw size={16} />
          Connect / refresh
        </button>
      </div>

      <FantasySourceTruthStrip
        liveSourceCount={liveSourceCount}
        sourceLanes={sourceLanes}
      />
    </section>
  );
}

function FantasySourceTruthStrip({
  liveSourceCount,
  sourceLanes,
}: {
  liveSourceCount: number;
  sourceLanes: FantasySourceLane[];
}) {
  return (
    <div className="nfl-fantasy-source-truth" aria-label="Fantasy source truth">
      <div>
        <ShieldCheck size={16} />
        <span>Source truth</span>
        <strong>
          {liveSourceCount}/{sourceLanes.length} live
        </strong>
        <em>model nudges stay capped</em>
      </div>
      <div className="nfl-fantasy-source-truth-grid">
        {sourceLanes.map((lane) => (
          <span
            className={cx(
              "nfl-fantasy-source-pill",
              lane.status,
              lane.freshness === "stale" && "stale",
            )}
            key={lane.id}
            title={lane.message}
          >
            {sourceLaneIcon(lane.kind)}
            <b>{lane.label}</b>
            <em>
              {sourceLaneStatusCopy(lane)} · {fantasySourceLaneTotalRows(lane)} rows
            </em>
          </span>
        ))}
      </div>
    </div>
  );
}

function fantasySourceLaneTotalRows(lane: FantasySourceLane) {
  return Object.values(lane.rows).reduce((total, count) => total + count, 0);
}

function FantasyTeamPortfolio({
  fantasyImport,
  leagueMap,
  opponentTeamId,
  onOpponentTeamChange,
  onTeamChange,
  onViewChange,
  teamLens,
}: {
  fantasyImport: ImportedFantasyLeague | null;
  leagueMap: FantasyLeaguePowerMap;
  opponentTeamId: string;
  onOpponentTeamChange: (teamId: string) => void;
  onTeamChange: (teamId: string) => void;
  onViewChange: (view: FantasyView) => void;
  teamLens: FantasyTeamLens;
}) {
  const activeId = leagueMap.active.report.team.id;
  const leagueLabel =
    fantasyImport?.sleeper?.leagueName ?? fantasyImport?.label ?? "Sample league room";
  const leagueMeta = [
    fantasyImport?.season ? `Season ${fantasyImport.season}` : null,
    fantasyImport?.week ? `Week ${fantasyImport.week}` : null,
    `${leagueMap.teamCount} teams`,
    fantasyImport?.settings?.formatLabel ?? teamLensLabels[teamLens],
  ].filter(Boolean);
  const opponentOptions = leagueMap.teams.filter(
    (team) => team.report.team.id !== activeId,
  );
  const opponentTeams = leagueMap.teams.filter(
    (team) => team.report.team.id !== activeId,
  );
  const selectedOpponentId =
    opponentOptions.find((team) => team.report.team.id === opponentTeamId)?.report.team.id ??
    opponentOptions[0]?.report.team.id ??
    activeId;

  function handleManageTeam(teamId: string) {
    onTeamChange(teamId);

    if (teamId === opponentTeamId) {
      const nextOpponent =
        leagueMap.teams.find((team) => team.report.team.id !== teamId)?.report.team.id ??
        teamId;

      onOpponentTeamChange(nextOpponent);
    }
  }

  function handleOpponentCompare(teamId: string) {
    onOpponentTeamChange(teamId);
    onViewChange("compare");
  }

  function handleOpponentTrades(teamId: string) {
    onOpponentTeamChange(teamId);
    onViewChange("trades");
  }

  const activePressure = fantasyPrimaryPressure(leagueMap.active.report);

  return (
    <section className="nfl-team-portfolio" aria-label="Fantasy team portfolio">
      <div className="nfl-team-portfolio-head">
        <div>
          <div className="nfl-section-kicker">
            <UsersRound size={17} />
            Team portfolio
          </div>
          <h2>One league room at a time</h2>
          <p>
            Your roster gets lineup actions. Other teams become league reads: compare them,
            find their weak spots, and look for trade targets without turning the whole page
            into one massive wall of rosters.
          </p>
        </div>
        <div className="nfl-team-portfolio-controls">
          <label>
            <span>Compare against</span>
            <select
              disabled={opponentOptions.length === 0}
              onChange={(event) => onOpponentTeamChange(event.target.value)}
              value={selectedOpponentId}
            >
              {opponentOptions.length > 0 ? (
                opponentOptions.map((team) => (
                  <option key={team.report.team.id} value={team.report.team.id}>
                    {team.report.team.name}
                  </option>
                ))
              ) : (
                <option value={activeId}>Add another team</option>
              )}
            </select>
          </label>
          <div>
            <button onClick={() => onViewChange("roster")} type="button">
              <ClipboardList size={16} />
              Roster room
            </button>
            <button className="secondary" onClick={() => onViewChange("players")} type="button">
              <Search size={16} />
              Deep research
            </button>
          </div>
        </div>
      </div>

      <div className="nfl-team-league-stack">
        <article className="nfl-team-league-room">
          <div className="nfl-team-league-head">
            <div>
              <span>Active league</span>
              <strong>{leagueLabel}</strong>
              <em>{leagueMeta.join(" · ")}</em>
            </div>
            <b>{leagueMap.rankLabel}</b>
          </div>

          <div className="nfl-team-portfolio-subhead">
            <span>My roster</span>
            <em>Lineup actions live here.</em>
          </div>

          <div className="nfl-team-portfolio-grid mine">
            <article className="nfl-team-portfolio-card active is-mine">
              <span className="nfl-team-portfolio-mark" aria-hidden="true">
                {fantasyPlayerInitials(leagueMap.active.report.team.name)}
              </span>
              <div className="nfl-team-portfolio-main">
                <span>{leagueMap.active.report.team.manager}</span>
                <strong>{leagueMap.active.report.team.name}</strong>
                <em>
                  {leagueMap.active.rank === 1 ? "Top roster" : `Rank #${leagueMap.active.rank}`} ·{" "}
                  {teamLensLabels[teamLens]}
                </em>
              </div>
              <div
                className="nfl-team-portfolio-metrics"
                aria-label={`${leagueMap.active.report.team.name} snapshot`}
              >
                <span>
                  Projection
                  <strong>{leagueMap.active.report.projection.toFixed(1)}</strong>
                </span>
                <span>
                  Trust
                  <strong>{fantasyTrustBand(leagueMap.active.report.score)}</strong>
                </span>
                <span>
                  Fix next
                  <strong>{scoutingRankLabel(leagueMap.active.weakestPosition.position)}</strong>
                </span>
              </div>
              <p>{activePressure.summary}</p>
              <div className="nfl-team-portfolio-actions">
                <button onClick={() => handleManageTeam(leagueMap.active.report.team.id)} type="button">
                  <ClipboardList size={15} />
                  Manage roster
                </button>
                <button className="secondary" onClick={() => onViewChange("compare")} type="button">
                  <Swords size={15} />
                  Compare league
                </button>
              </div>
            </article>
          </div>

          <div className="nfl-team-portfolio-subhead">
            <span>League opponents</span>
            <em>Compare strength, identify trade lanes, then pick the next conversation.</em>
          </div>

          <div className="nfl-team-portfolio-grid opponents">
            {opponentTeams.map((team) => {
              const tradeRead = fantasyPortfolioOpponentTradeRead(team, leagueMap.active);
              const isSelectedOpponent = team.report.team.id === selectedOpponentId;

              return (
                <article
                  className={cx(
                    "nfl-team-portfolio-card",
                    "is-opponent",
                    isSelectedOpponent && "selected-opponent",
                  )}
                  key={team.report.team.id}
                >
                  <span className="nfl-team-portfolio-mark" aria-hidden="true">
                    {fantasyPlayerInitials(team.report.team.name)}
                  </span>
                  <div className="nfl-team-portfolio-main">
                    <span>{team.report.team.manager}</span>
                    <strong>{team.report.team.name}</strong>
                    <em>
                      Rank #{team.rank} · {teamLensLabels[teamLens]}
                    </em>
                  </div>
                  <div
                    className="nfl-team-portfolio-metrics"
                    aria-label={`${team.report.team.name} league snapshot`}
                  >
                    <span>
                      Projection
                      <strong>{team.report.projection.toFixed(1)}</strong>
                    </span>
                    <span>
                      Weak spot
                      <strong>{scoutingRankLabel(team.weakestPosition.position)}</strong>
                    </span>
                    <span>
                      Target
                      <strong>{tradeRead.targetLabel}</strong>
                    </span>
                  </div>
                  <p>{tradeRead.summary}</p>
                  <div className="nfl-team-portfolio-actions">
                    <button onClick={() => handleOpponentCompare(team.report.team.id)} type="button">
                      <Swords size={15} />
                      Compare
                    </button>
                    <button
                      className="secondary"
                      onClick={() => handleOpponentTrades(team.report.team.id)}
                      type="button"
                    >
                      <Sparkles size={15} />
                      Trade lane
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
      </div>
    </section>
  );
}

function fantasyPortfolioOpponentTradeRead(
  team: FantasyLeaguePowerTeam,
  active: FantasyLeaguePowerTeam,
) {
  const targetLane = active.weakestPosition.position;
  const opponentPlayers = [...team.report.players, ...team.report.benchPlayers];
  const activePlayers = [...active.report.benchPlayers, ...active.report.players];
  const target =
    opponentPlayers
      .filter((player) => normalizeScoutingPosition(player.position) === targetLane)
      .sort(
        (left, right) =>
          right.contextProjection.projection - left.contextProjection.projection,
      )[0] ??
    [...opponentPlayers].sort(
      (left, right) =>
        right.contextProjection.projection - left.contextProjection.projection,
    )[0];
  const offer =
    activePlayers
      .filter(
        (player) =>
          normalizeScoutingPosition(player.position) === team.weakestPosition.position,
      )
      .sort(
        (left, right) =>
          left.contextProjection.projection - right.contextProjection.projection,
      )[0] ?? active.report.benchPlayers[0];
  const targetLabel = target
    ? `${scoutingRankLabel(normalizeScoutingPosition(target.position))} ${target.name}`
    : `${scoutingRankLabel(targetLane)} help`;
  const offerLabel = offer
    ? `${offer.name} or similar ${scoutingRankLabel(normalizeScoutingPosition(offer.position))} depth`
    : `${scoutingRankLabel(team.weakestPosition.position)} depth`;

  return {
    targetLabel,
    summary: `${team.report.team.name} is thinner at ${scoutingRankLabel(
      team.weakestPosition.position,
    )}. If you chase ${target?.name ?? scoutingRankLabel(targetLane)}, start with ${offerLabel} and avoid touching your weekly core.`,
  };
}

function FantasyPlayerArtwork({
  className,
  playerName,
  position,
}: {
  className?: string;
  playerName?: string;
  position?: string;
}) {
  const normalizedPosition = position ? normalizeScoutingPosition(position) : undefined;
  const positionLabel = normalizedPosition ? scoutingRankLabel(normalizedPosition) : "Flex";
  const initials = playerName
    ? fantasyPlayerInitials(playerName)
    : positionLabel.slice(0, 2).toUpperCase();
  const poseClass = normalizedPosition
    ? `pos-${normalizedPosition.toLowerCase()}`
    : "pos-flex";

  return (
    <span className={cx("nfl-generic-player-art", poseClass, className)} aria-hidden="true">
      <span className="nfl-generic-player-field" />
      <span className="nfl-generic-player-ring" />
      <span className="nfl-generic-player-initials">{initials}</span>
      <span className="nfl-generic-player-position">{positionLabel}</span>
      <span className="nfl-generic-player-role" />
    </span>
  );
}

function FantasyBestMovePanel({
  matchupReport,
  onViewChange,
  report,
  weeklyCoach,
}: {
  matchupReport: FantasyMatchupReport;
  onViewChange: (view: FantasyView) => void;
  report: FantasyTeamReport;
  weeklyCoach: FantasyWeeklyCoachRead;
}) {
  const bestMoveRows = [
    {
      label: "Why",
      value: weeklyCoach.bestMove.why,
    },
    {
      label: "What could change it",
      value: weeklyCoach.bestMove.fallback,
    },
    {
      label: "Risk level",
      value: weeklyCoach.bestMove.risk,
    },
  ];
  const featuredPlayer = weeklyCoach.bestMove.playerName
    ? [...report.players, ...report.benchPlayers].find(
        (player) => player.name === weeklyCoach.bestMove.playerName,
      )
    : report.players[0] ?? report.benchPlayers[0];

  return (
    <section className="nfl-best-move-hero" aria-label="Your best fantasy move">
      <div className="nfl-best-move-main">
        <span>
          <ShieldCheck size={17} />
          Your best move
        </span>
        <div className="nfl-best-move-visual-row">
          <FantasyPlayerArtwork
            className="hero"
            playerName={featuredPlayer?.name ?? weeklyCoach.bestMove.playerName ?? report.team.name}
            position={featuredPlayer?.position ?? report.strongestLane.position}
          />
          <em>Role lens - projection, range, and matchup context.</em>
        </div>
        <h2>{weeklyCoach.bestMove.call}</h2>
        <p>{weeklyCoach.bestMove.why}</p>
        <div className="nfl-best-move-actions">
          <button onClick={() => onViewChange("overview")} type="button">
            See next moves
          </button>
          <button onClick={() => onViewChange("compare")} type="button">
            View receipts
          </button>
        </div>
      </div>
      <div className="nfl-best-move-side">
        <div className="nfl-best-move-status">
          <strong>{weeklyCoach.bestMove.state}</strong>
          <em>{weeklyCoach.bestMove.confidence} confidence</em>
        </div>
        <div className="nfl-best-move-scorecards">
          <span>
            <b>Edge</b>
            {weeklyCoach.bestMove.edge}
          </span>
          <span>
            <b>Projected</b>
            {report.projection.toFixed(1)} pts
          </span>
          <span>
            <b>Matchup</b>
            {matchupReport.edgeLabel}
          </span>
        </div>
        <div className="nfl-best-move-plain-rows">
          {bestMoveRows.map((row) => (
            <span key={row.label}>
              <b>{row.label}</b>
              {row.value}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FantasyHeroDecisionCard({
  action,
  eyebrow,
}: {
  action?: FantasyActionItem;
  eyebrow: string;
}) {
  const icon = action ? fantasyActionIcon(action.kind) : <Sparkles size={18} />;
  const rows = action
    ? fantasyActionReceiptRows(action).filter((row) => row.label !== "What I would do")
    : [];

  return (
    <article className={cx("nfl-hero-decision-card", action?.kind, action?.strength)}>
      <div className="nfl-hero-decision-icon">{icon}</div>
      <div>
        <span>{eyebrow}</span>
        <strong>
          {action
            ? `${action.state}: ${action.playerName ?? action.label}`
            : "No urgent move"}
        </strong>
        <p>{action?.detail ?? "The lineup has breathing room. Hold the current plan unless news changes."}</p>
        {action ? (
          <div className="nfl-mini-reason-grid">
            {rows.map((row) => (
              <span key={row.label}>
                <b>{row.label}</b>
                {row.value}
              </span>
            ))}
          </div>
        ) : null}
        <em>
          {action
            ? `${action.confidence} confidence · ${action.meta}`
            : "No pressure flag"}
        </em>
      </div>
    </article>
  );
}


function fantasyActionReceiptRows(action: FantasyActionItem) {
  return [
    {
      label: "What I would do",
      value: `${action.state}: ${action.detail}`,
    },
    {
      label: "Why",
      value: action.why,
    },
    {
      label: "What could change it",
      value: action.fallback,
    },
    {
      label: "Risk level",
      value: action.risk,
    },
    {
      label: "Source vs Seer",
      value: action.edge,
    },
  ];
}

function ProFootballDisclaimer() {
  return (
    <aside className="nfl-disclaimer" aria-label="Pro Football Seer disclaimer">
      <ShieldCheck size={17} />
      <span>{proFootballShortDisclaimer}</span>
    </aside>
  );
}

function ProFootballFooterDisclaimer() {
  return (
    <section className="nfl-fantasy-footer-note" aria-label="Pro Football Seer disclaimer">
      <div>
        <ShieldCheck size={18} />
        <strong>Independent playground, not official league gospel.</strong>
      </div>
      <p>{proFootballFullDisclaimer}</p>
    </section>
  );
}

function FantasySeerSafetyNote() {
  return (
    <aside className="nfl-fantasy-safety-note" aria-label="Fantasy Seer note">
      <ShieldCheck size={17} />
      <p>{fantasySeerShortDisclaimer}</p>
    </aside>
  );
}

function FantasySeerFooterDisclaimer() {
  return (
    <section className="nfl-fantasy-footer-note" aria-label="Fantasy Seer disclaimer">
      <div>
        <ShieldCheck size={18} />
        <strong>Weird little algorithm playground, not gospel.</strong>
      </div>
      <p>{fantasySeerFullDisclaimer}</p>
    </section>
  );
}

function FantasyViewTabs({
  current,
  leagueMap,
  matchupReport,
  onChange,
  report,
  rookieCount,
  totalPlayers,
}: {
  current: FantasyView;
  leagueMap: FantasyLeaguePowerMap;
  matchupReport: FantasyMatchupReport;
  onChange: (view: FantasyView) => void;
  report: FantasyTeamReport;
  rookieCount: number;
  totalPlayers: number;
}) {
  const tabs: Array<{
    id: FantasyView;
    label: string;
    meta: string;
    icon: ReactNode;
  }> = [
    {
      id: "overview",
      label: "Best Move",
      meta: "next step",
      icon: <Sparkles size={17} />,
    },
    {
      id: "roster",
      label: "My Roster",
      meta: `${report.players.length} starters`,
      icon: <UsersRound size={17} />,
    },
    {
      id: "league",
      label: "League Compare",
      meta: leagueMap.rankLabel,
      icon: <Trophy size={17} />,
    },
    {
      id: "players",
      label: "Player Research",
      meta: `${totalPlayers} pool`,
      icon: <Search size={17} />,
    },
    {
      id: "rookies",
      label: "Rookies",
      meta: `${rookieCount} watch`,
      icon: <Zap size={17} />,
    },
    {
      id: "trades",
      label: "Trade Builder",
      meta: "offers",
      icon: <LineChart size={17} />,
    },
    {
      id: "compare",
      label: "Receipts",
      meta: matchupReport.edgeLabel,
      icon: <Gauge size={17} />,
    },
  ];

  return (
    <nav className="nfl-fantasy-tabs" id="fantasy-rooms" aria-label="Fantasy decision rooms">
      {tabs.map((tab) => (
        <button
          aria-pressed={current === tab.id}
          className={cx(current === tab.id && "active")}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.icon}
          <span>{tab.label}</span>
          <em>{tab.meta}</em>
        </button>
      ))}
    </nav>
  );
}

function FantasyOverview({
  actions,
  matchupReport,
  report,
  rows,
  scoringFormat,
  teamLens,
}: {
  actions: FantasyActionItem[];
  matchupReport: FantasyMatchupReport;
  report: FantasyTeamReport;
  rows: ScoutingRow[];
  scoringFormat: ScoringFormat;
  teamLens: FantasyTeamLens;
}) {
  const weeklyCoach = buildFantasyWeeklyCoach({
    matchupReport,
    report,
    scoringFormat,
    teamLens,
  });
  const closeCalls =
    report.closeCalls.length > 0
      ? report.closeCalls.map((call) => call.summary)
      : ["No urgent swap pressure. The recommended lineup has breathing room."];

  return (
    <section className="nfl-fantasy-overview" id="fantasy-overview">
      <FantasyActionQueue actions={actions} />

      <article className="nfl-fantasy-focus-panel">
        <div className="nfl-section-kicker">
          <Sparkles size={17} />
          This week at a glance
        </div>
        <h2>{report.team.name} command read</h2>
        <p>{teamAdviceSummary(report, teamLens)}</p>
        <div className="nfl-fantasy-kpi-grid">
          <div>
            <span>Projection</span>
            <strong>{report.projection.toFixed(1)}</strong>
            <em>{formatFantasyDelta(report.lineupSeerDelta)} vs source</em>
          </div>
          <div>
            <span>Range</span>
            <strong>
              {report.floor.toFixed(1)}-{report.ceiling.toFixed(1)}
            </strong>
            <em>{scoringLabels[scoringFormat]}</em>
          </div>
          <div>
            <span>Matchup</span>
            <strong>{matchupReport.edgeLabel}</strong>
            <em>{matchupReport.winLean}% lean</em>
          </div>
          <div>
            <span>Pressure point</span>
            <strong>{weeklyCoach.pressure.label}</strong>
            <em>{report.strongestLane.label} carries</em>
          </div>
        </div>
        <div className="nfl-fantasy-action-list">
          <span>Lineup pressure</span>
          {report.startSitReceipts.slice(0, 4).map((receipt) => (
            <p key={`${receipt.label}-${receipt.player.id}`}>
              <strong>{receipt.label}</strong> {receipt.summary}
            </p>
          ))}
        </div>
      </article>

      <article className="nfl-fantasy-focus-panel">
        <div className="nfl-section-kicker">
          <Search size={17} />
          Top player pulse
        </div>
        <h2>Clean board</h2>
        <p>
          A quieter shortlist from the full player room. Open Players when you want
          the deeper ranking board by position.
        </p>
        <div className="nfl-fantasy-spotlight-list">
          {rows.slice(0, 6).map((player, index) => (
            <FantasySpotlightRow
              index={index}
              key={player.id}
              player={player}
              scoringFormat={scoringFormat}
            />
          ))}
        </div>
        <AdviceList title="Close calls" items={closeCalls} />
      </article>
    </section>
  );
}

function FantasyActionQueue({ actions }: { actions: FantasyActionItem[] }) {
  return (
    <section className="nfl-fantasy-action-queue" aria-label="Fantasy action queue">
      <div className="nfl-fantasy-action-head">
        <div>
          <div className="nfl-section-kicker">
            <ClipboardList size={17} />
            Fantasy action queue
          </div>
          <h2>Action queue</h2>
        </div>
        <span>best 4 moves</span>
      </div>
      <div className="nfl-fantasy-action-grid">
        {actions.slice(0, 4).map((action) => (
          <article
            className={cx("nfl-action-card", action.kind, action.strength)}
            key={`${action.kind}-${action.title}-${action.playerName ?? action.label}`}
          >
            <div className="nfl-action-icon">{fantasyActionIcon(action.kind)}</div>
            <div>
              <span>{action.title}</span>
              <strong>{action.playerName ?? action.label}</strong>
              <p>
                <b>{action.state}:</b> {action.detail}
              </p>
              <div className="nfl-action-receipts">
                {fantasyActionReceiptRows(action).map((row) => (
                  <span key={row.label}>
                    <b>{row.label}</b>
                    {row.value}
                  </span>
                ))}
              </div>
              <em>{action.confidence} confidence · {action.meta}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function fantasyActionIcon(kind: FantasyActionKind) {
  if (kind === "start") {
    return <ShieldCheck size={18} />;
  }

  if (kind === "watch") {
    return <Timer size={18} />;
  }

  if (kind === "swap") {
    return <RefreshCw size={18} />;
  }

  return <LineChart size={18} />;
}

function FantasySpotlightRow({
  index,
  player,
  scoringFormat,
}: {
  index: number;
  player: ScoutingRow;
  scoringFormat: ScoringFormat;
}) {
  const position = normalizeScoutingPosition(player.position);

  return (
    <article className="nfl-fantasy-spotlight-row">
      <div className="nfl-rank-stack">
        <span>#{index + 1}</span>
        <em>{scoutingRankLabel(position)}</em>
      </div>
      <div className="nfl-player-id">
        <FantasyPlayerArtwork
          className="compact"
          playerName={player.name}
          position={player.position}
        />
        <div>
          <strong>{player.name}</strong>
          <em>
            {player.position} · {player.opponent}
          </em>
        </div>
      </div>
      <div>
        <span>{scoringLabels[scoringFormat]}</span>
        <strong>{player.contextProjection.projection.toFixed(1)}</strong>
      </div>
    </article>
  );
}

function FantasyRookieBoard({
  rows,
  scoringFormat,
}: {
  rows: ScoutingRow[];
  scoringFormat: ScoringFormat;
}) {
  return (
    <section className="nfl-fantasy-rookies" id="fantasy-rookies">
      <div className="nfl-scouting-head">
        <div>
          <div className="nfl-section-kicker">
            <Trophy size={17} />
            Rookie and dynasty watch
          </div>
          <h2>Future value room</h2>
          <p>
            A calmer place for rookies, breakouts, taxi stashes, and dynasty-friendly
            players. When true rookie flags arrive, this room will use them first.
          </p>
        </div>
        <strong className="nfl-fantasy-room-badge">{rows.length} watchlist</strong>
      </div>
      <div className="nfl-rookie-list">
        {rows.map((player, index) => {
          const position = normalizeScoutingPosition(player.position);

          return (
            <article className="nfl-rookie-row" key={player.id}>
              <div className="nfl-rank-stack">
                <span>#{index + 1}</span>
                <em>{scoutingRankLabel(position)}</em>
              </div>
              <div className="nfl-player-id">
                <FantasyPlayerArtwork
          className="compact"
          playerName={player.name}
          position={player.position}
        />
                <div>
                  <strong>{player.name}</strong>
                  <em>
                    {player.position} ·{" "}
                    {player.depthTier ? formatDepthTier(player.depthTier) : "Watchlist"}
                  </em>
                </div>
              </div>
              <div className="nfl-rookie-metrics">
                <span>
                  <em>Proj</em>
                  <strong>{player.contextProjection.projection.toFixed(1)}</strong>
                </span>
                <span>
                  <em>Dynasty</em>
                  <strong>{player.dynastyValue ?? player.health}</strong>
                </span>
                <span>
                  <em>{scoringLabels[scoringFormat]}</em>
                  <strong>{formatRankDelta(player.rankDelta)}</strong>
                </span>
              </div>
              <div className="nfl-trait-list">
                {fantasySignalTags(player).slice(0, 4).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FantasyLeaguePowerMapSection({
  leagueMap,
  scoringFormat,
  teamLens,
}: {
  leagueMap: FantasyLeaguePowerMap;
  scoringFormat: ScoringFormat;
  teamLens: FantasyTeamLens;
}) {
  const active = leagueMap.active;
  const topTeams = leagueMap.teams.slice(0, Math.min(leagueMap.teams.length, 6));

  return (
    <section className="nfl-league-power-map" id="league-power-map">
      <div className="nfl-league-power-hero">
        <div>
          <div className="nfl-section-kicker">
            <Trophy size={17} />
            League power map
          </div>
          <h2>{active.report.team.name} vs the room</h2>
          <p>{leagueMap.recommendation}</p>
        </div>
        <div className="nfl-league-rank-card">
          <span>{leagueMap.rankLabel}</span>
          <strong>{active.score}</strong>
          <em>
            {fantasyPowerTierLabels[active.tier]} · {scoringLabels[scoringFormat]}
          </em>
        </div>
      </div>

      <div className="nfl-league-metric-grid">
        <article>
          <span>Starter strength</span>
          <strong>{active.starterScore}</strong>
          <em>{active.report.projection.toFixed(1)} projected points</em>
        </article>
        <article>
          <span>Bench depth</span>
          <strong>{active.benchScore}</strong>
          <em>{active.report.benchPlayers.length} bench options</em>
        </article>
        <article>
          <span>Dynasty value</span>
          <strong>{active.dynastyScore}</strong>
          <em>{teamLensLabels[teamLens]} lens</em>
        </article>
        <article>
          <span>Risk control</span>
          <strong>{active.riskScore}</strong>
          <em>{active.volatility}% weekly volatility</em>
        </article>
      </div>

      <div className="nfl-league-summary-grid">
        <article>
          <span>Strongest lane</span>
          <strong>{scoutingRankLabel(active.strongestPosition.position)}</strong>
          <p>{active.strongestPosition.summary}</p>
        </article>
        <article>
          <span>Weakest lane</span>
          <strong>{scoutingRankLabel(active.weakestPosition.position)}</strong>
          <p>{active.matchupWeakness}</p>
        </article>
        <article>
          <span>Easiest upgrade</span>
          <strong>{leagueMap.easiestUpgrade}</strong>
          <p>{active.easiestUpgrade}</p>
        </article>
      </div>

      <FantasyPositionRankStrip team={active} />

      <div className="nfl-league-matchup-grid">
        <article>
          <span>Good matchup</span>
          <strong>{leagueMap.bestMatchup.report.team.name}</strong>
          <p>
            Your roster lines up well here because their weakest lane is{" "}
            {leagueMap.bestMatchup.weakestPosition
              ? scoutingRankLabel(leagueMap.bestMatchup.weakestPosition.position)
              : "depth"}.
          </p>
        </article>
        <article className="warning">
          <span>Tough matchup</span>
          <strong>{leagueMap.badMatchup.report.team.name}</strong>
          <p>
            This is the team to plan for carefully: their strongest lane is{" "}
            {scoutingRankLabel(leagueMap.badMatchup.strongestPosition.position)}.
          </p>
        </article>
      </div>

      <FantasyTradePartnerPanel partners={leagueMap.tradePartners} />

      <FantasyMoveTargetFinder targets={leagueMap.moveTargets} />

      <div className="nfl-league-table" aria-label="Fantasy league team strength">
        {topTeams.map((team) => (
          <article
            className={cx(
              "nfl-league-row",
              team.report.team.id === active.report.team.id && "active",
            )}
            key={team.report.team.id}
          >
            <div className="nfl-league-rank">
              <span>#{team.rank}</span>
              <em>{team.score}</em>
            </div>
            <div className="nfl-league-team">
              <strong>{team.report.team.name}</strong>
              <span>
                {fantasyPowerTierLabels[team.tier]} · {team.report.team.manager}
              </span>
            </div>
            <div className="nfl-league-meter">
              <i>
                <b style={{ width: `${team.score}%` }} />
              </i>
              <em>
                {team.report.projection.toFixed(1)} starter pts ·{" "}
                {team.benchScore} bench
              </em>
            </div>
            <div className="nfl-league-lanes">
              <span>{scoutingRankLabel(team.strongestPosition.position)} edge</span>
              <span>{scoutingRankLabel(team.weakestPosition.position)} need</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FantasyPositionRankStrip({ team }: { team: FantasyLeaguePowerTeam }) {
  return (
    <div className="nfl-league-position-ranks" aria-label="Position ranks">
      {team.positionRanks.map((rank) => (
        <article key={rank.position}>
          <span>{scoutingRankLabel(rank.position)}</span>
          <strong>
            #{rank.rank}
            <small>/{rank.teamCount}</small>
          </strong>
          <em>
            {rank.projection.toFixed(1)} pts
            {rank.rank === 1
              ? " · league best"
              : ` · ${formatFantasyDelta(rank.projection - rank.leaderProjection)} vs best`}
          </em>
        </article>
      ))}
    </div>
  );
}

function FantasyTradePartnerPanel({
  partners,
}: {
  partners: FantasyPowerTradePartner[];
}) {
  return (
    <section className="nfl-league-trade-partners" aria-label="Trade partner matches">
      <div className="nfl-target-finder-head">
        <div>
          <div className="nfl-section-kicker">
            <UsersRound size={17} />
            Trade partner map
          </div>
          <h3>Managers worth texting first</h3>
        </div>
        <span>{partners.length} fits</span>
      </div>
      <div className="nfl-league-partner-grid">
        {partners.map((partner) => (
          <article key={partner.teamId}>
            <div>
              <span>{partner.manager ?? "Manager"}</span>
              <strong>{partner.teamName}</strong>
            </div>
            <em>
              Ask {scoutingRankLabel(partner.askFor)} · Offer from{" "}
              {scoutingRankLabel(partner.offerFrom)}
            </em>
            <p>{partner.reason}</p>
            <b>Fit {partner.fitScore > 0 ? `+${partner.fitScore}` : partner.fitScore}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function FantasyMoveTargetFinder({ targets }: { targets: FantasyMoveTarget[] }) {
  return (
    <section className="nfl-target-finder" aria-label="Fantasy waiver and trade targets">
      <div className="nfl-target-finder-head">
        <div>
          <div className="nfl-section-kicker">
            <LineChart size={17} />
            Waiver + trade finder
          </div>
          <h3>Specific next moves</h3>
        </div>
        <span>{targets.length} ideas</span>
      </div>
      <div className="nfl-target-grid">
        {targets.map((target) => (
          <article
            className={cx("nfl-target-card", target.kind, target.risk.replace(" ", "-"))}
            key={`${target.kind}-${target.playerName}-${target.position}`}
          >
            <div className="nfl-target-card-top">
              <span>{target.title}</span>
              <em>{target.risk}</em>
            </div>
            <strong>{target.playerName}</strong>
            <small>
              {scoutingRankLabel(target.position)} · {target.teamLabel}
            </small>
            <p>{target.reason}</p>
            <div className="nfl-target-action">
              <b>{target.action}</b>
              <span>{target.value}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FantasyTradeBuilderSection({
  result,
  scoringFormat,
  teamLens,
}: {
  result: FantasyTradeBuilderResult;
  scoringFormat: ScoringFormat;
  teamLens: FantasyTeamLens;
}) {
  return (
    <section className="nfl-trade-builder" id="trade-builder">
      <div className="nfl-trade-builder-hero">
        <div>
          <div className="nfl-section-kicker">
            <LineChart size={17} />
            Trade Package Builder
          </div>
          <h2>Offer with a walk-away line</h2>
          <p>{result.summary}</p>
        </div>
        <div className="nfl-trade-lane-card">
          <span>Shop from</span>
          <strong>{scoutingRankLabel(result.surplusPosition)}</strong>
          <em>
            Need {scoutingRankLabel(result.needPosition)} · {scoringLabels[scoringFormat]} ·{" "}
            {teamLensLabels[teamLens]}
          </em>
        </div>
      </div>

      <div className="nfl-trade-guardrail">
        <div>
          <span>Do not include</span>
          <strong>
            {result.doNotInclude.length > 0
              ? result.doNotInclude.map((player) => player.name).join(", ")
              : "No locked core yet"}
          </strong>
        </div>
        <p>
          These are the names the builder protects first. If a counteroffer asks for
          one of them, make them add real value or walk away.
        </p>
      </div>

      {result.packages.length > 0 ? (
        <div className="nfl-trade-package-grid">
          {result.packages.map((tradePackage) => (
            <article
              className={cx("nfl-trade-package-card", tradePackage.tier)}
              key={`${tradePackage.tier}-${tradePackage.target.id}`}
            >
              <div className="nfl-trade-package-top">
                <span>{tradePackage.title}</span>
                <em>{tradePackage.fairnessScore}% fair</em>
              </div>

              <div className="nfl-trade-flow">
                <div>
                  <span>You get</span>
                  <TradePlayerInline player={tradePackage.target} />
                </div>
                <ChevronRight size={18} />
                <div>
                  <span>You offer</span>
                  {tradePackage.offerPlayers.map((player) => (
                    <TradePlayerInline key={player.id} player={player} />
                  ))}
                </div>
              </div>

              <div className="nfl-trade-value-row">
                <span>
                  Receive <strong>{tradePackage.receiveValue.toFixed(1)}</strong>
                </span>
                <span>
                  Offer <strong>{tradePackage.offerValue.toFixed(1)}</strong>
                </span>
                <span className={cx(tradePackage.valueGap > 0 && "warning")}>
                  Gap <strong>{formatFantasyDelta(tradePackage.valueGap)}</strong>
                </span>
              </div>

              <div className="nfl-trade-explainer">
                <p>
                  <strong>Why this helps:</strong> {tradePackage.whyItHelpsMe}
                </p>
                <p>
                  <strong>Why they might accept:</strong>{" "}
                  {tradePackage.whyTheyMightAccept}
                </p>
                <p>
                  <strong>Risk:</strong> {tradePackage.risk}
                </p>
              </div>

              <TradeImpactPreviewCard impact={tradePackage.impact} />

              <div className="nfl-trade-walkaway">
                <span>Walk-away line</span>
                <strong>{tradePackage.walkAwayLine}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <article className="nfl-trade-empty-card">
          <strong>No clean package yet</strong>
          <p>
            Import a deeper league or wait for fresh projections. The builder is
            refusing to invent a trade just to sound busy.
          </p>
        </article>
      )}
    </section>
  );
}

function TradeImpactPreviewCard({ impact }: { impact: FantasyTradeImpactPreview }) {
  const myStarterDelta = formatFantasyDelta(impact.myTeam.starterProjectionDelta);
  const myBenchDelta = formatFantasyDelta(impact.myTeam.benchDepthDelta);
  const myDynastyDelta = formatFantasyDelta(impact.myTeam.dynastyValueDelta);
  const theirStarterDelta = formatFantasyDelta(impact.partnerTeam.starterProjectionDelta);

  return (
    <div className="nfl-trade-impact-card">
      <div className="nfl-trade-impact-head">
        <span>Trade impact</span>
        <strong>{impact.myTeam.teamName}</strong>
      </div>
      <div className="nfl-trade-impact-grid">
        <div>
          <span>My starters</span>
          <strong>{myStarterDelta}</strong>
        </div>
        <div>
          <span>My bench</span>
          <strong>{myBenchDelta}</strong>
        </div>
        <div>
          <span>Dynasty</span>
          <strong>{myDynastyDelta}</strong>
        </div>
        <div>
          <span>Their starters</span>
          <strong>{theirStarterDelta}</strong>
        </div>
      </div>
      <div className="nfl-trade-impact-lanes">
        <span>
          Need lane{" "}
          <strong>
            {scoutingRankLabel(impact.myTeam.weakestPositionBefore)} →{" "}
            {scoutingRankLabel(impact.myTeam.weakestPositionAfter)}
          </strong>
        </span>
        <span>
          Their need{" "}
          <strong>
            {scoutingRankLabel(impact.partnerTeam.weakestPositionBefore)} →{" "}
            {scoutingRankLabel(impact.partnerTeam.weakestPositionAfter)}
          </strong>
        </span>
      </div>
      <div className="nfl-trade-impact-copy">
        <p>{impact.verdict}</p>
        <p>{impact.overpayWarning}</p>
        <p>{impact.counterOffer}</p>
        <p>{impact.regretCheck}</p>
      </div>
    </div>
  );
}

function TradePlayerInline({ player }: { player: FantasyTradePlayer }) {
  return (
    <div className="nfl-trade-player-inline">
      <strong>{player.name}</strong>
      <span>
        {scoutingRankLabel(normalizeScoutingPosition(player.position))} ·{" "}
        {player.nflTeam ?? "Pro football"} · {player.projection.toFixed(1)} proj
      </span>
    </div>
  );
}

function fantasyPlayerReceiptRoomRows({
  leftPlayer,
  rightPlayer,
  scoringFormat,
  startLean,
}: {
  leftPlayer: FantasyPlayer;
  rightPlayer: FantasyPlayer;
  scoringFormat: ScoringFormat;
  startLean: ReturnType<typeof compareFantasyPlayers>;
}) {
  const leftProjection = fantasyProjectionForDisplay(leftPlayer, scoringFormat);
  const rightProjection = fantasyProjectionForDisplay(rightPlayer, scoringFormat);
  const winner = startLean.id === leftPlayer.id ? leftPlayer : rightPlayer;
  const winnerProjection =
    winner.id === leftPlayer.id ? leftProjection : rightProjection;

  return [
    {
      label: "Projection source",
      value: scoringLabels[scoringFormat],
      detail:
        "The outside/source number starts the conversation, then the Seer adjusts it instead of replacing it.",
    },
    {
      label: "Matchup context",
      value: `${leftPlayer.opponent} vs ${rightPlayer.opponent}`,
      detail:
        "Opponent strength, game script, and position fit decide whether the projection deserves a small lift or haircut.",
    },
    {
      label: "Role/security",
      value: `${fantasyPlayerRoleBand(leftPlayer)} / ${fantasyPlayerRoleBand(rightPlayer)}`,
      detail:
        "Stable touches matter more than a flashy ceiling when two players are close.",
    },
    {
      label: "Health and weather",
      value: `${leftPlayer.health}% / ${rightPlayer.health}%`,
      detail:
        "Late injury news, wind, snow, and messy conditions can turn a good idea into a pre-kickoff re-check.",
    },
    {
      label: "Opponent defense",
      value: `${leftPlayer.matchup} / ${rightPlayer.matchup}`,
      detail:
        "Higher is friendlier for fantasy. Lower means the player needs volume or touchdowns to bail out the week.",
    },
    {
      label: "Variance",
      value: `${leftPlayer.chaos}% / ${rightPlayer.chaos}%`,
      detail: `The lean is ${startLean.name} at ${winnerProjection.projection.toFixed(1)} projected points, but chaos controls how wide the range gets.`,
    },
  ];
}

function FantasyPlayerCompareSection({
  fantasyPlayers,
  leftPlayer,
  leftPlayerId,
  onLeftPlayerChange,
  onRightPlayerChange,
  rightPlayer,
  rightPlayerId,
  scoringFormat,
  startLean,
}: {
  fantasyPlayers: FantasyPlayer[];
  leftPlayer: FantasyPlayer;
  leftPlayerId: string;
  onLeftPlayerChange: (id: string) => void;
  onRightPlayerChange: (id: string) => void;
  rightPlayer: FantasyPlayer;
  rightPlayerId: string;
  scoringFormat: ScoringFormat;
  startLean: ReturnType<typeof compareFantasyPlayers>;
}) {
  return (
    <section className="nfl-player-compare" id="player-compare">
      <div className="nfl-player-compare-head">
        <div>
          <div className="nfl-section-kicker">
            <UsersRound size={17} />
            Receipts room
          </div>
          <h2>Why the model is saying this</h2>
        </div>
        <strong>{startLean.name}</strong>
      </div>
      <div className="nfl-receipts-room-grid" aria-label="Fantasy model receipts">
        {fantasyPlayerReceiptRoomRows({
          leftPlayer,
          rightPlayer,
          scoringFormat,
          startLean,
        }).map((row) => (
          <article key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <p>{row.detail}</p>
          </article>
        ))}
      </div>
      <div className="nfl-player-selectors">
        <select
          value={leftPlayerId}
          onChange={(event) => onLeftPlayerChange(event.target.value)}
        >
          {fantasyPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <ChevronRight size={18} />
        <select
          value={rightPlayerId}
          onChange={(event) => onRightPlayerChange(event.target.value)}
        >
          {fantasyPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </div>
      <div className="nfl-player-duel">
        <FantasyDuelPlayer
          player={leftPlayer}
          scoringFormat={scoringFormat}
          winner={startLean.id === leftPlayer.id}
        />
        <div className="nfl-duel-verdict">
          <Sparkles size={20} />
          <span>Start lean</span>
          <strong>{startLean.name}</strong>
          <p>{startLean.verdict}</p>
        </div>
        <FantasyDuelPlayer
          player={rightPlayer}
          scoringFormat={scoringFormat}
          winner={startLean.id === rightPlayer.id}
        />
      </div>
    </section>
  );
}

function FantasyCard({
  player,
  scoringFormat,
}: {
  player: FantasyPlayer;
  scoringFormat: ScoringFormat;
}) {
  const fantasy = fantasyProjectionForDisplay(player, scoringFormat);
  const adviceRows = fantasyPlayerAdviceRows(player, fantasy);

  return (
    <article className="nfl-fantasy-card">
      <div className="nfl-player-id">
        <FantasyPlayerArtwork playerName={player.name} position={player.position} />
        <div>
          <strong>{player.name}</strong>
          <em>
            {player.position} · {player.team} · {player.opponent}
          </em>
          <small>{fantasyPlayerRoleBand(player)}</small>
        </div>
      </div>
      <div className="nfl-fantasy-score">
        <span>{scoringLabels[scoringFormat]}</span>
        <strong>{fantasy.projection.toFixed(1)}</strong>
      </div>
      <div className="nfl-fantasy-range">
        <span>Floor {fantasy.floor.toFixed(1)}</span>
        <span>Ceiling {fantasy.ceiling.toFixed(1)}</span>
      </div>
      <div className="nfl-fantasy-tags">
        {fantasySignalTags(player).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <ProjectionReceipt player={player} projection={fantasy} />
      <div className="nfl-player-advice-grid">
        {adviceRows.map((row) => (
          <span key={row.label}>
            <b>{row.label}</b>
            {row.value}
          </span>
        ))}
      </div>
    </article>
  );
}

function fantasyPlayerAdviceRows(
  player: FantasyPlayer,
  projection: FantasyProjection,
) {
  const receipt = fantasyProjectionReceipt(player, projection, true);
  const firstReason = receipt.reasons[0] ?? player.read;

  return [
    {
      label: "What I would do",
      value: fantasyPlayerActionAdvice(player, projection),
    },
    {
      label: "Why",
      value: firstReason,
    },
    {
      label: "What could change it",
      value: fantasyPlayerChangeTrigger(player),
    },
    {
      label: "Risk level",
      value: fantasyPlayerRiskForCard(player),
    },
    {
      label: "Source vs Seer",
      value: `${receipt.sourceLabel} ${receipt.sourceProjection.toFixed(1)} -> ${receipt.finalLabel} ${receipt.finalProjection.toFixed(1)} (${formatFantasyDelta(receipt.delta)})`,
    },
  ];
}

function fantasyPlayerInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "MS";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function fantasyPlayerRoleBand(player: FantasyPlayer) {
  const role = player.roleSecurity ?? Math.round((player.health + player.matchup) / 2);

  if (role >= 82) {
    return "Locked role";
  }

  if (role >= 72) {
    return "Stable role";
  }

  if (role >= 62) {
    return "Role watch";
  }

  return "News dependent";
}

function fantasyPlayerActionAdvice(
  player: FantasyPlayer,
  projection: FantasyProjection,
) {
  const rankLabel = scoutingRankLabel(normalizeScoutingPosition(player.position));

  if (projection.projection >= 18) {
    return `Start as a strong ${rankLabel} option unless late news breaks against the role.`;
  }

  if (projection.projection >= 12) {
    return `Start or flex if your alternatives do not have clearer volume.`;
  }

  if (projection.projection >= 8) {
    return `Use as depth only; fine as cover, not a priority start.`;
  }

  return "Bench for now unless the role report changes before kickoff.";
}

function fantasyPlayerChangeTrigger(player: FantasyPlayer) {
  if (player.health < 72) {
    return "A clean injury report or inactive surprise is the thing to re-check.";
  }

  if ((player.roleSecurity ?? player.health) < 68) {
    return "Usage news matters most: snaps, route rate, carries, or red-zone role.";
  }

  if (player.matchup < 66) {
    return "The defense is the drag. Volume or touchdown role needs to offset it.";
  }

  if (player.chaos >= 66) {
    return "Early touch split and game script can swing this profile quickly.";
  }

  return "Only meaningful role, injury, or weather news should move this much.";
}

function fantasyPlayerRiskForCard(player: FantasyPlayer) {
  const role = player.roleSecurity ?? player.health;

  if (player.health < 70) {
    return "High: health needs the final check.";
  }

  if (role < 66) {
    return "Medium-high: role is not fully locked.";
  }

  if (player.chaos >= 68) {
    return "Medium: good ceiling, wider range.";
  }

  if (player.matchup < 64) {
    return "Medium: matchup is doing real resistance.";
  }

  return "Normal: trust the read unless news changes.";
}

function ProjectionReceipt({
  compact = false,
  player,
  projection,
}: {
  compact?: boolean;
  player: FantasyPlayer;
  projection: FantasyProjection;
}) {
  const receipt = fantasyProjectionReceipt(player, projection, compact);

  return (
    <div className={cx("nfl-projection-receipt", compact && "compact")}>
      <div className="nfl-receipt-scoreline">
        <span>
          <em>{receipt.sourceLabel}</em>
          <strong>{receipt.sourceProjection.toFixed(1)}</strong>
        </span>
        <span>
          <em>Seer shift</em>
          <strong className={cx(receipt.delta > 0 && "plus", receipt.delta < 0 && "minus")}>
            {formatFantasyDelta(receipt.delta)}
          </strong>
        </span>
        <span>
          <em>{receipt.finalLabel}</em>
          <strong>{receipt.finalProjection.toFixed(1)}</strong>
        </span>
      </div>
      {!compact ? <small>{receipt.summary}</small> : null}
      {receipt.reasons.length > 0 ? (
        <div className="nfl-receipt-reasons">
          {receipt.reasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isScoutingRow(player: FantasyPlayer): player is ScoutingRow {
  const maybeRow = player as Partial<ScoutingRow>;

  return (
    typeof maybeRow.contextProjection?.projection === "number" &&
    typeof maybeRow.context?.projectionNudge === "number"
  );
}

function fantasyProjectionForDisplay(
  player: FantasyPlayer,
  scoringFormat: ScoringFormat,
): FantasyProjection {
  return isScoutingRow(player) ? player.contextProjection : fantasyProjection(player, scoringFormat);
}

function fantasyProjectionReceipt(
  player: FantasyPlayer,
  projection: FantasyProjection,
  compact: boolean,
) {
  const sourceProjection = fantasyReceiptSourceProjection(player, projection);
  const blendProjection = fantasyReceiptBlendProjection(player, sourceProjection);
  const finalProjection = round1(
    isScoutingRow(player) ? player.contextProjection.projection : projection.projection,
  );
  const delta = round1(finalProjection - sourceProjection);
  const reasons = fantasyReceiptReasons(player, compact ? 2 : 4);
  const moveCopy =
    delta === 0
      ? "kept it at the source number"
      : `${delta > 0 ? "bumped it up" : "moved it down"} by ${Math.abs(delta).toFixed(1)}`;
  const reasonCopy = reasons[0] ? ` Main reason: ${reasons[0]}.` : "";
  const blendCopy =
    Math.abs(blendProjection - sourceProjection) >= 0.1
      ? ` Blended baseline is ${blendProjection.toFixed(1)}.`
      : "";

  return {
    delta,
    finalLabel: isScoutingRow(player) ? "Final read" : "Model",
    finalProjection,
    reasons,
    sourceLabel: fantasyReceiptSourceLabel(player),
    sourceProjection,
    summary: `Source starts at ${sourceProjection.toFixed(1)}.${blendCopy} We ${moveCopy}.${reasonCopy}`,
  };
}

function fantasyReceiptSourceProjection(
  player: FantasyPlayer,
  projection: FantasyProjection,
) {
  if (isScoutingRow(player)) {
    return fantasySourceProjection(player);
  }

  if (typeof player.sourceProjection === "number") {
    return round1(player.sourceProjection);
  }

  return round1(projection.projection - projectionDelta(player));
}

function fantasyReceiptBlendProjection(player: FantasyPlayer, sourceProjection: number) {
  if (typeof player.sourceBlendProjection === "number") {
    return round1(player.sourceBlendProjection);
  }

  return sourceProjection;
}

function fantasyReceiptSourceLabel(player: FantasyPlayer) {
  if (player.projectionSource) {
    return "Source";
  }

  return typeof player.sourceProjection === "number" ? "Source" : "Model seed";
}

function fantasyReceiptReasons(player: FantasyPlayer, limit: number) {
  const reasons: string[] = [];

  if (isScoutingRow(player)) {
    reasons.push(
      ...player.context.adjustments
        .filter((adjustment) => Math.abs(adjustment.delta) >= 0.1)
        .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
        .map((adjustment) => fantasyContextReceiptReason(adjustment)),
    );
  } else if (player.seerAdjustmentDetails?.length) {
    reasons.push(
      ...player.seerAdjustmentDetails
        .filter((adjustment) => Math.abs(adjustment.delta) >= 0.1)
        .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
        .map(
          (adjustment) =>
            `${titleCaseWords(adjustment.label)} ${formatFantasyDelta(adjustment.delta)}`,
        ),
    );
  } else if (player.seerAdjustments?.length) {
    reasons.push(...player.seerAdjustments);
  }

  if (
    player.sourceTrustLabel &&
    typeof player.sourceProjectionWeight === "number" &&
    player.sourceProjectionWeight < 0.95
  ) {
    reasons.push(player.sourceTrustLabel);
  }

  if (player.crowdSignalLabel && player.crowdSignalDelta) {
    reasons.push(`${player.crowdSignalLabel} ${formatFantasyDelta(player.crowdSignalDelta)}`);
  }

  reasons.push(...fantasyFallbackReceiptReasons(player));

  return uniqueStrings(reasons)
    .filter((reason) => reason.trim().length > 0)
    .slice(0, limit);
}

function fantasyContextReceiptReason(adjustment: FantasyContextAdjustment) {
  return `${adjustment.label} ${formatFantasyDelta(adjustment.delta)}: ${adjustment.summary}`;
}

function fantasyFallbackReceiptReasons(player: FantasyPlayer) {
  const reasons = [
    player.matchup >= 78
      ? "Matchup helps: this opponent is friendly for the position"
      : player.matchup <= 66
        ? "Matchup warning: tough opponent for the position"
        : "Matchup is neutral: no major defense swing",
    player.health <= 70
      ? "Health watch: there is less margin for surprise news"
      : player.health >= 86
        ? "Health looks clean"
        : "Health looks playable",
    player.chaos >= 64
      ? "Volatility warning: wider boom-bust range"
      : player.chaos <= 42
        ? "Stable profile: fewer scary swings"
        : "Normal weekly variance",
    player.roleSecurity && player.roleSecurity >= 78
      ? "Role is safe: usage looks secure"
      : player.targetShare >= 22 || player.carryShare >= 24
        ? "Volume helps: touches or targets are doing the work"
        : "Role watch: usage could change",
  ];

  return reasons;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function titleCaseWords(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function fantasySignalTags(player: FantasyPlayer) {
  const tags = [
    typeof player.positionRank === "number"
      ? `${player.position} #${player.positionRank}`
      : null,
    typeof player.sourceRank === "number" ? `Board #${player.sourceRank}` : null,
    typeof player.roleSecurity === "number" ? `Role ${player.roleSecurity}` : null,
    typeof player.dynastyValue === "number"
      ? `Dynasty ${player.dynastyValue}`
      : null,
    player.depthTier ? formatDepthTier(player.depthTier) : null,
  ];

  if (player.position === "RB") {
    tags.push(`${player.carryShare}% carry`);
  } else if (player.position === "WR" || player.position === "TE") {
    tags.push(`${player.baseline.receptions.toFixed(1)} rec`);
  } else if (player.position === "QB") {
    tags.push(`${player.carryShare}% rush`);
  } else {
    tags.push(`${player.touchdownPulse}% swing`);
  }

  return tags.filter((tag): tag is string => Boolean(tag)).slice(0, 5);
}

function formatDepthTier(tier: string) {
  return tier
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function FantasyDuelPlayer({
  player,
  scoringFormat,
  winner,
}: {
  player: FantasyPlayer;
  scoringFormat: ScoringFormat;
  winner: boolean;
}) {
  const fantasy = fantasyProjectionForDisplay(player, scoringFormat);

  return (
    <article className={cx("nfl-duel-player", winner && "winner")}>
      <div className="nfl-player-id">
        <FantasyPlayerArtwork
          className="compact"
          playerName={player.name}
          position={player.position}
        />
        <div>
          <strong>{player.name}</strong>
          <em>
            {player.position} · {player.opponent}
          </em>
        </div>
      </div>
      <ProjectionReceipt player={player} projection={fantasy} />
      <MiniMeter
        icon={<LineChart size={16} />}
        label={`${scoringLabels[scoringFormat]} projection`}
        value={clampMeter(Math.round(fantasy.projection * 3))}
      />
      <MiniMeter
        icon={<ShieldCheck size={16} />}
        label="Floor"
        value={clampMeter(Math.round(fantasy.floor * 4))}
      />
      <MiniMeter
        icon={<Zap size={16} />}
        label="Ceiling"
        value={clampMeter(Math.round(fantasy.ceiling * 2.2))}
        hot
      />
      <MiniMeter icon={<HeartPulse size={16} />} label="Health" value={player.health} />
      <MiniMeter icon={<Timer size={16} />} label="Volatility" value={player.chaos} hot />
    </article>
  );
}

function ScoutingBoard({
  analysis,
  allRows,
  depth,
  hasLiveOrImportedSourceRankings,
  mode,
  onDepthChange,
  onModeChange,
  onPositionChange,
  onRequest,
  position,
  rosteredIds,
  rows,
  scoringFormat,
  status,
  teamLens,
  weakestPosition,
}: {
  analysis: NflScoutingAnalysis | null;
  allRows: ScoutingRow[];
  depth: ScoutingDepth;
  hasLiveOrImportedSourceRankings: boolean;
  mode: ScoutingBoardMode;
  onDepthChange: (depth: ScoutingDepth) => void;
  onModeChange: (mode: ScoutingBoardMode) => void;
  onPositionChange: (position: ScoutingPosition) => void;
  onRequest: () => void;
  position: ScoutingPosition;
  rosteredIds: Set<string>;
  rows: ScoutingRow[];
  scoringFormat: ScoringFormat;
  status: ScoutStatus;
  teamLens: FantasyTeamLens;
  weakestPosition: ScoutingPlayerPosition;
}) {
  const depthOption =
    scoutingDepthOptions.find((option) => option.value === depth) ??
    scoutingDepthOptions[0];
  const modeOption = scoutingBoardModeOptions.find((option) => option.value === mode);
  const deepResearchRows = buildDeepResearchRows({
    rosteredIds,
    rows: allRows,
    teamLens,
    weakestPosition,
  });
  const laneTotal =
    position === "ALL"
      ? scoutingRowsForMode(allRows, mode, rosteredIds, weakestPosition).length
      : scoutingRowsForMode(allRows, mode, rosteredIds, weakestPosition).filter(
          (row) => normalizeScoutingPosition(row.position) === position,
        ).length;

  return (
    <section className="nfl-scouting-board" id="scouting-board">
      <div className="nfl-scouting-head">
        <div>
          <div className="nfl-section-kicker">
            <Search size={17} />
            Player scouting
          </div>
          <h2>{modeOption?.label ?? "Player"} board</h2>
          <p>
            {scoutingBoardModeCopy(mode, hasLiveOrImportedSourceRankings)}
          </p>
          <div className="nfl-board-mode-note">
            <strong>{scoutingBoardModeUtility(mode)}</strong>
            <span>{scoutingBoardModeDetail(mode)}</span>
          </div>
        </div>
        <div className="nfl-scouting-actions">
          <span className="nfl-scouting-summary">
            Showing {rows.length} of {laneTotal} · {modeOption?.summary ?? depthOption.summary}
          </span>
          <strong>{scoringLabels[scoringFormat]}</strong>
          <button
            disabled={status === "loading"}
            onClick={onRequest}
            type="button"
          >
            <Sparkles size={16} />
            {status === "loading" ? "Reading..." : "Ask AI Scout"}
          </button>
        </div>
      </div>
      <div className="nfl-scouting-tools" aria-label="Scouting board controls">
        <div className="nfl-scouting-mode" aria-label="Board mode">
          {scoutingBoardModeOptions.map((option) => {
            const count = scoutingRowsForMode(
              allRows,
              option.value,
              rosteredIds,
              weakestPosition,
            ).length;

            return (
              <button
                aria-pressed={mode === option.value}
                className={cx(mode === option.value && "active")}
                key={option.value}
                onClick={() => onModeChange(option.value)}
                type="button"
              >
                <span>{option.label}</span>
                <em>{count}</em>
              </button>
            );
          })}
        </div>
        <div className="nfl-scouting-filter-bar" aria-label="Position filters">
          {scoutingPositionOptions.map((option) => {
            const count =
              option.value === "ALL"
                ? laneTotal
                : scoutingRowsForMode(allRows, mode, rosteredIds, weakestPosition).filter(
                    (row) => normalizeScoutingPosition(row.position) === option.value,
                  ).length;

            return (
              <button
                aria-pressed={position === option.value}
                className={cx(position === option.value && "active")}
                key={option.value}
                onClick={() => onPositionChange(option.value)}
                type="button"
              >
                <span>{option.label}</span>
                <em>{count}</em>
              </button>
            );
          })}
        </div>
        <div className="nfl-scouting-depth" aria-label="Board depth">
          {scoutingDepthOptions.map((option) => (
            <button
              aria-pressed={depth === option.value}
              className={cx(depth === option.value && "active")}
              key={option.value}
              onClick={() => onDepthChange(option.value)}
              type="button"
            >
              <span>{option.label}</span>
              <em>{option.summary}</em>
            </button>
          ))}
        </div>
      </div>
      {analysis || status === "error" ? (
        <article className={cx("nfl-ai-scout-read", status === "error" && "error")}>
          {analysis ? (
            <>
              <div>
                <span>{analysis.source === "openai" ? "AI Scout" : "Smart fallback"}</span>
                <strong>{analysis.headline}</strong>
              </div>
              <p>{analysis.summary}</p>
              <div className="nfl-ai-factor-list">
                {analysis.factors.map((factor) => (
                  <span key={factor}>{factor}</span>
                ))}
              </div>
              <em>{analysis.watchlist}</em>
            </>
          ) : (
            <>
              <div>
                <span>Scout read</span>
                <strong>The signal slipped</strong>
              </div>
              <p>Try the AI Scout again in a moment. The board below is still live.</p>
            </>
          )}
        </article>
      ) : null}
      <DeepResearchPanel
        rows={deepResearchRows}
        scoringFormat={scoringFormat}
        teamLens={teamLens}
        weakestPosition={weakestPosition}
      />
      {rows.length ? (
        <div className="nfl-scouting-list">
          {rows.map((player, index) => (
            <article className="nfl-scout-row" key={player.id}>
              <div className="nfl-rank-stack">
                <span>#{index + 1}</span>
                <em>{scoutingBoardModeLabel(mode)}</em>
              </div>
              <div className="nfl-scout-player">
                <div className="nfl-player-id">
                  <FantasyPlayerArtwork
                    className="compact"
                    playerName={player.name}
                    position={player.position}
                  />
                  <div>
                    <strong>{player.name}</strong>
                    <em>
                      {player.position} · {player.team} · {player.opponent}
                    </em>
                  </div>
                </div>
                <div className="nfl-trait-list">
                  {fantasySignalTags(player).slice(0, 3).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  {player.traits.map((trait) => (
                    <span key={trait}>{trait}</span>
                  ))}
                </div>
                <ProjectionReceipt
                  compact
                  player={player}
                  projection={player.contextProjection}
                />
              </div>
              <div className="nfl-scout-metric">
                <span>Projection</span>
                <strong>{player.contextProjection.projection.toFixed(1)}</strong>
              </div>
              <div className="nfl-scout-metric">
                <span>Range</span>
                <strong>
                  {player.contextProjection.floor.toFixed(1)}-
                  {player.contextProjection.ceiling.toFixed(1)}
                </strong>
              </div>
              <div className="nfl-rank-delta">
                <span>Baseline #{player.nflRank}</span>
                <strong>{formatRankDelta(player.rankDelta)}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <article className="nfl-scouting-empty">
          <Search size={18} />
          <div>
            <strong>No {scoutingBoardModeLabel(mode).toLowerCase()} rows loaded yet</strong>
            <p>
              {mode === "available"
                ? "Connect a league with a wider player pool or import provider projections to reveal unrostered options."
                : "Add them through a projection feed, Sleeper import, roster paste, or screenshot upload and this board will fill itself."}
            </p>
          </div>
        </article>
      )}
    </section>
  );
}

function DeepResearchPanel({
  rows,
  scoringFormat,
  teamLens,
  weakestPosition,
}: {
  rows: FantasyDeepResearchRow[];
  scoringFormat: ScoringFormat;
  teamLens: FantasyTeamLens;
  weakestPosition: ScoutingPlayerPosition;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <article className="nfl-deep-research-panel">
      <div className="nfl-deep-research-head">
        <div>
          <div className="nfl-section-kicker">
            <Search size={17} />
            Deep player research
          </div>
          <h3>Stashes, waivers, and weird-league value</h3>
          <p>
            Built for deep leagues and dynasty benches. The Seer looks past the obvious names and
            asks who can actually help your weakest {scoutingRankLabel(weakestPosition)} lane.
          </p>
        </div>
        <span>
          {scoringLabels[scoringFormat]} · {teamLensLabels[teamLens]}
        </span>
      </div>
      <div className="nfl-deep-research-grid">
        {rows.map((row) => (
          <article className="nfl-deep-research-card" key={row.player.id}>
            <div className="nfl-player-id">
              <FantasyPlayerArtwork
                className="compact research-avatar"
                playerName={row.player.name}
                position={row.player.position}
              />
              <div>
                <strong>{row.player.name}</strong>
                <em>
                  {normalizeScoutingPosition(row.player.position)} · {row.player.team} · {row.player.opponent}
                </em>
              </div>
            </div>
            <strong>{row.action}</strong>
            <p>{row.reason}</p>
            <div className="nfl-deep-research-metrics">
              <span>
                Projection
                <strong>{row.player.contextProjection.projection.toFixed(1)}</strong>
              </span>
              <span>
                Ceiling
                <strong>{row.player.contextProjection.ceiling.toFixed(1)}</strong>
              </span>
              <span>
                Role
                <strong>{row.fit}</strong>
              </span>
            </div>
            <em>{row.risk}</em>
            <div className="nfl-deep-research-tags">
              {row.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </article>
  );
}

function FantasyTeamLab({
  activeReport,
  contextStatus,
  fantasyImport,
  providerBridgeFileName,
  providerBridgeImport,
  providerBridgeMessage,
  providerBridgeStatus,
  providerBridgeText,
  manualImportMessage,
  manualImportStatus,
  manualRosterText,
  matchupReport,
  onManualImport,
  onLensChange,
  onManualRosterTextChange,
  onOpponentTeamChange,
  onProviderBridgeFile,
  onProviderBridgeImport,
  onProviderBridgeTextChange,
  onScoringChange,
  onScreenshotFile,
  onScreenshotImport,
  onSleeperImport,
  onSleeperLeagueImport,
  onSleeperQueryChange,
  onSleeperRefresh,
  onSleeperUseAutoWeekChange,
  onSleeperWeekChange,
  onTeamChange,
  opponentTeamId,
  scoringFormat,
  screenshotFileName,
  screenshotImportMessage,
  screenshotImportStatus,
  sleeperImportMessage,
  sleeperImportStatus,
  sleeperLastRefreshedAt,
  sleeperLeagueOptions,
  sleeperSelectedLeagueId,
  sleeperQuery,
  sleeperUseAutoWeek,
  sleeperWeek,
  sourceLanes,
  teamLens,
  teams,
}: {
  activeReport: FantasyTeamReport;
  contextStatus: FantasyContextStatus;
  fantasyImport: ImportedFantasyLeague | null;
  providerBridgeFileName: string;
  providerBridgeImport: FantasyProviderBridgeImport | null;
  providerBridgeMessage: string;
  providerBridgeStatus: FantasyImportStatus;
  providerBridgeText: string;
  manualImportMessage: string;
  manualImportStatus: FantasyImportStatus;
  manualRosterText: string;
  matchupReport: FantasyMatchupReport;
  onManualImport: () => void;
  onLensChange: (lens: FantasyTeamLens) => void;
  onManualRosterTextChange: (value: string) => void;
  onOpponentTeamChange: (teamId: string) => void;
  onProviderBridgeFile: (file: File | null | undefined) => void;
  onProviderBridgeImport: () => void;
  onProviderBridgeTextChange: (value: string) => void;
  onScoringChange: (format: ScoringFormat) => void;
  onScreenshotFile: (file: File | null | undefined) => void;
  onScreenshotImport: () => void;
  onSleeperImport: () => void;
  onSleeperLeagueImport: (league: SleeperLeagueOption) => void;
  onSleeperQueryChange: (value: string) => void;
  onSleeperRefresh: () => void;
  onSleeperUseAutoWeekChange: (useAutoWeek: boolean) => void;
  onSleeperWeekChange: (week: string) => void;
  onTeamChange: (teamId: string) => void;
  opponentTeamId: string;
  scoringFormat: ScoringFormat;
  screenshotFileName: string;
  screenshotImportMessage: string;
  screenshotImportStatus: FantasyImportStatus;
  sleeperImportMessage: string;
  sleeperImportStatus: SleeperImportStatus;
  sleeperLastRefreshedAt: string;
  sleeperLeagueOptions: SleeperLeagueOption[];
  sleeperSelectedLeagueId: string;
  sleeperQuery: string;
  sleeperUseAutoWeek: boolean;
  sleeperWeek: string;
  sourceLanes: FantasySourceLane[];
  teamLens: FantasyTeamLens;
  teams: FantasyTeam[];
}) {
  return (
    <section className="nfl-fantasy-team-lab" id="fantasy-team-lab">
      <div className="nfl-fantasy-team-head">
        <div>
          <div className="nfl-section-kicker">
            <Trophy size={17} />
            Fantasy team lab
          </div>
          <h2>My roster room</h2>
          <p>
            Set the roster once, then use this room for the practical stuff: lineup
            weak spots, matchup pressure, and clean trade paths.
          </p>
        </div>
        <div className="nfl-fantasy-team-controls">
          <ScoringToggle value={scoringFormat} onChange={onScoringChange} />
          <div className="nfl-lens-toggle" aria-label="Fantasy roster lens">
            {(Object.keys(teamLensLabels) as FantasyTeamLens[]).map((lens) => (
              <button
                className={cx(teamLens === lens && "active")}
                key={lens}
                onClick={() => onLensChange(lens)}
                type="button"
              >
                {teamLensLabels[lens]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="nfl-fantasy-setup-details">
        <summary>
          <span>Roster setup and sources</span>
          <em>Sleeper, paste, screenshot, projections</em>
        </summary>

        <FantasyImportPanel
        fantasyImport={fantasyImport}
        providerBridgeFileName={providerBridgeFileName}
        providerBridgeImport={providerBridgeImport}
        providerBridgeMessage={providerBridgeMessage}
        providerBridgeStatus={providerBridgeStatus}
        providerBridgeText={providerBridgeText}
        manualImportMessage={manualImportMessage}
        manualImportStatus={manualImportStatus}
        manualRosterText={manualRosterText}
        onManualImport={onManualImport}
        onManualRosterTextChange={onManualRosterTextChange}
        onProviderBridgeFile={onProviderBridgeFile}
        onProviderBridgeImport={onProviderBridgeImport}
        onProviderBridgeTextChange={onProviderBridgeTextChange}
        onScreenshotFile={onScreenshotFile}
        onScreenshotImport={onScreenshotImport}
        onSleeperImport={onSleeperImport}
        onSleeperLeagueImport={onSleeperLeagueImport}
        onSleeperQueryChange={onSleeperQueryChange}
        onSleeperRefresh={onSleeperRefresh}
        onSleeperUseAutoWeekChange={onSleeperUseAutoWeekChange}
        onSleeperWeekChange={onSleeperWeekChange}
        screenshotFileName={screenshotFileName}
        screenshotImportMessage={screenshotImportMessage}
        screenshotImportStatus={screenshotImportStatus}
        sleeperImportMessage={sleeperImportMessage}
        sleeperImportStatus={sleeperImportStatus}
        sleeperLastRefreshedAt={sleeperLastRefreshedAt}
        sleeperLeagueOptions={sleeperLeagueOptions}
        sleeperSelectedLeagueId={sleeperSelectedLeagueId}
        sleeperQuery={sleeperQuery}
        sleeperUseAutoWeek={sleeperUseAutoWeek}
        sleeperWeek={sleeperWeek}
      />
      </details>

      <div className="nfl-team-lab-selectors">
        <label>
          <span>My team</span>
          <select
            onChange={(event) => onTeamChange(event.target.value)}
            value={activeReport.team.id}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <ChevronRight size={18} />
        <label>
          <span>Opponent</span>
          <select
            onChange={(event) => onOpponentTeamChange(event.target.value)}
            value={opponentTeamId}
          >
            {teams.map((team) => (
              <option
                disabled={team.id === activeReport.team.id && teams.length > 1}
                key={team.id}
                value={team.id}
              >
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FantasyDecisionEnginePanel
        contextStatus={contextStatus}
        matchupReport={matchupReport}
        report={activeReport}
        scoringFormat={scoringFormat}
        teamLens={teamLens}
      />

      <BeatOpponentCard plan={matchupReport.beatPlan} />

      <div className="nfl-team-lab-grid">
        <article className="nfl-team-report-card">
          <div className="nfl-team-report-top">
            <div>
              <span>{activeReport.team.manager}</span>
              <strong>{activeReport.team.name}</strong>
              <em>{activeReport.team.identity}</em>
            </div>
            <b>{fantasyTrustBand(activeReport.score)}</b>
          </div>
          <div className="nfl-team-score-strip">
            <div>
              <span>Projection</span>
              <strong>{activeReport.projection.toFixed(1)}</strong>
            </div>
            <div>
              <span>Floor</span>
              <strong>{activeReport.floor.toFixed(1)}</strong>
            </div>
            <div>
              <span>Ceiling</span>
              <strong>{activeReport.ceiling.toFixed(1)}</strong>
            </div>
          </div>
          <div className="nfl-team-meter-grid">
            <MiniMeter icon={<Gauge size={16} />} label="Balance" value={activeReport.balance} />
            <MiniMeter icon={<UsersRound size={16} />} label="Depth" value={activeReport.depth} />
            <MiniMeter icon={<Timer size={16} />} label="Risk" value={activeReport.risk} hot />
            <MiniMeter icon={<Sparkles size={16} />} label="Dynasty core" value={activeReport.dynastyCore} />
          </div>
          <div className="nfl-roster-stack">
            {activeReport.players.map((player) => (
              <div key={player.id}>
                <div className="nfl-player-id">
                  <FantasyPlayerArtwork
          className="compact"
          playerName={player.name}
          position={player.position}
        />
                  <div>
                    <strong>{player.name}</strong>
                    <em>
                      {player.position} · {player.opponent}
                    </em>
                    <ProjectionReceipt
                      player={player}
                      projection={player.contextProjection}
                      compact
                    />
                  </div>
                </div>
                <strong>{player.contextProjection.projection.toFixed(1)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="nfl-team-advice-card">
          <div className="nfl-card-topline">
            <span>Coach note</span>
            <strong>{teamLensLabels[teamLens]}</strong>
          </div>
          <p>{teamAdviceSummary(activeReport, teamLens)}</p>
          <div className="nfl-lane-snapshot">
            <span>Strong: {activeReport.strongestLane.label}</span>
            <span>Need: {activeReport.weakestLane.label}</span>
          </div>
          <AdviceList title="Strengths" items={activeReport.strengths} />
          <AdviceList title="Weak spots" items={activeReport.weaknesses} />
          <AdviceList title="Moves to consider" items={activeReport.moves} />
          <AdviceList title="Bench upgrades" items={activeReport.benchUpgrades} />
          <AdviceList title="Trade paths" items={activeReport.tradeIdeas} />
        </article>
      </div>

      <article className="nfl-fantasy-matchup-card">
        <div className="nfl-fantasy-matchup-head">
          <div>
            <span>Fantasy matchup</span>
            <strong>
              {matchupReport.left.team.name} vs {matchupReport.right.team.name}
            </strong>
          </div>
          <b>
            {matchupReport.edgeLabel} · {matchupReport.confidence}% read
          </b>
        </div>
        <div className="nfl-matchup-score-grid">
          <FantasyTeamMiniReport report={matchupReport.left} />
          <div className="nfl-matchup-verdict">
            <Sparkles size={20} />
            <span>
              Win lean {matchupReport.winLean}% · variance {matchupReport.chaos}%
            </span>
            <strong>{matchupReport.edgeTeam.name}</strong>
            <p>{matchupReport.recommendation}</p>
          </div>
          <FantasyTeamMiniReport report={matchupReport.right} />
        </div>
        <div className="nfl-position-edge-grid">
          {matchupReport.positionEdges.map((edge) => (
            <div className={cx(edge === matchupReport.strongestEdge && "hot")} key={edge.position}>
              <span>{scoutingRankLabel(edge.position)}</span>
              <strong>{edge.summary}</strong>
              <em>
                {edge.leftProjection.toFixed(1)} vs {edge.rightProjection.toFixed(1)}
              </em>
            </div>
          ))}
        </div>
        <div className="nfl-swing-list">
          {matchupReport.swingFactors.map((factor) => (
            <span key={factor}>{factor}</span>
          ))}
        </div>
      </article>
    </section>
  );
}

function BeatOpponentCard({ plan }: { plan: FantasyMatchupWeaknessPlan }) {
  const benchTitle =
    plan.benchLever.type === "bench"
      ? plan.benchLever.playerName ?? `Bench ${plan.benchLever.position}`
      : `Cover ${plan.benchLever.position}`;
  const tradeTitle =
    plan.tradePath.type === "trade"
      ? `Target ${plan.tradePath.targetName}`
      : `${plan.tradePath.position} waiver path`;

  return (
    <article className="nfl-beat-opponent-card">
      <div className="nfl-beat-head">
        <div>
          <span>
            <Swords size={16} />
            Beat this opponent
          </span>
          <strong>
            Attack {plan.opponentWeakPosition}, protect {plan.myWeakPosition}
          </strong>
        </div>
        <b>{plan.tradePath.type === "trade" ? "Trade path" : "Waiver path"}</b>
      </div>

      <div className="nfl-beat-grid">
        <div className="hot">
          <span>{plan.attackLane.title}</span>
          <strong>+{plan.attackLane.edge.toFixed(1)}</strong>
          <p>{plan.attackLane.summary}</p>
        </div>
        <div>
          <span>{plan.dangerLane.title}</span>
          <strong>{plan.dangerLane.gap.toFixed(1)} gap</strong>
          <p>{plan.dangerLane.summary}</p>
        </div>
        <div>
          <span>Bench lever</span>
          <strong>{benchTitle}</strong>
          <p>{plan.benchLever.summary}</p>
        </div>
        <div>
          <span>{tradeTitle}</span>
          <strong>{plan.tradePath.type === "trade" ? "Offer fit" : "Patch mode"}</strong>
          <p>{plan.tradePath.summary}</p>
        </div>
      </div>

      <div className="nfl-beat-checklist">
        {plan.swingChecklist.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </article>
  );
}

function FantasyDecisionEnginePanel({
  contextStatus,
  matchupReport,
  report,
  scoringFormat,
  teamLens,
}: {
  contextStatus: FantasyContextStatus;
  matchupReport: FantasyMatchupReport;
  report: FantasyTeamReport;
  scoringFormat: ScoringFormat;
  teamLens: FantasyTeamLens;
}) {
  const closeCallItems =
    report.closeCalls.length > 0
      ? report.closeCalls.map((call) => call.summary)
      : ["No urgent swap pressure. The recommended lineup has breathing room."];
  const benchItems =
    report.benchAlternatives.length > 0
      ? report.benchAlternatives.map((alternative) => alternative.summary)
      : ["Bench pressure is quiet; import a deeper roster for more swap reads."];

  return (
    <article className="nfl-decision-engine-card">
      <div className="nfl-decision-head">
        <div>
          <span>Decision Engine v1</span>
          <strong>Best lineup for {report.team.name}</strong>
          <em>
            {scoringLabels[scoringFormat]} · {teamLensLabels[teamLens]} ·{" "}
            {matchupReport.edgeLabel} · context {contextStatus.status}
          </em>
        </div>
        <div className="nfl-source-vs-seer">
          <span>Source projection {report.lineupSourceProjection.toFixed(1)}</span>
          <strong>Adjusted projection {report.projection.toFixed(1)}</strong>
          <em>{formatFantasyDelta(report.lineupSeerDelta)}</em>
        </div>
      </div>

      <div className="nfl-decision-summary">
        <div>
          <span>Confidence</span>
          <strong>{matchupReport.confidence}%</strong>
        </div>
        <div>
          <span>Variance</span>
          <strong>{matchupReport.chaos}%</strong>
        </div>
        <div>
          <span>Context</span>
          <strong>
            {contextStatus.coveredTeams}/{contextStatus.totalTeams}
          </strong>
        </div>
        <div>
          <span>Strong spot</span>
          <strong>{report.strongestLane.label}</strong>
        </div>
        <div>
          <span>Needs help</span>
          <strong>{report.weakestLane.label}</strong>
        </div>
      </div>

      <div className="nfl-lineup-grid" aria-label="Recommended fantasy lineup">
        {report.lineup.map((slot) => (
          <article
            className={cx("nfl-lineup-slot", !slot.player && "missing")}
            key={slot.id}
          >
            <div>
              <span>{slot.label}</span>
              <strong>{slot.player?.name ?? `Need ${slot.label}`}</strong>
              <em>
                {slot.player
                  ? `${slot.player.position} · ${slot.player.team} · ${slot.player.opponent}`
                  : "No eligible player found"}
              </em>
            </div>
            {slot.player ? (
              <ProjectionReceipt
                compact
                player={slot.player}
                projection={slot.player.contextProjection}
              />
            ) : (
              <div className="nfl-lineup-receipt">
                <span>Source {slot.sourceProjection.toFixed(1)}</span>
                <strong>Adjusted {slot.seerProjection.toFixed(1)}</strong>
                <em>{formatFantasyDelta(slot.delta)}</em>
              </div>
            )}
            {slot.context ? (
              <div className="nfl-context-chips">
                {slot.context.chips.slice(0, 4).map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            ) : null}
            <p>{slot.receipt}</p>
            {slot.adjustmentReceipts.length > 0 ? (
              <div className="nfl-adjustment-receipts">
                {slot.adjustmentReceipts.slice(0, 5).map((adjustment) => (
                  <span className={cx(adjustment.delta > 0 && "plus")} key={adjustment.kind}>
                    {adjustment.label} {formatFantasyDelta(adjustment.delta)}
                  </span>
                ))}
              </div>
            ) : null}
            {slot.tags.length > 0 ? (
              <div className="nfl-lineup-tags">
                {slot.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="nfl-startsit-grid">
        <div className="nfl-startsit-list">
          <span>Start/sit receipts</span>
          {report.startSitReceipts.slice(0, 5).map((receipt) => (
            <p key={`${receipt.label}-${receipt.player.id}`}>
              <strong>{receipt.label}</strong>{" "}
              <small>
                Source {receipt.sourceProjection.toFixed(1)} · Adjusted{" "}
                {receipt.seerProjection.toFixed(1)} · {formatFantasyDelta(receipt.delta)}
              </small>{" "}
              {receipt.summary}
            </p>
          ))}
        </div>
        <AdviceList title="Close calls" items={closeCallItems} />
        <AdviceList title="Bench pressure" items={benchItems} />
      </div>
      {contextStatus.warnings.length > 0 ? (
        <p className="nfl-context-warning">{contextStatus.warnings.join(" ")}</p>
      ) : null}
    </article>
  );
}

function FantasySourcesControlCenter({ lanes }: { lanes: FantasySourceLane[] }) {
  const liveLanes = lanes.filter((lane) => lane.status === "live").length;
  const totalRows = sum(
    lanes.map((lane) =>
      Object.values(lane.rows).reduce((laneTotal, count) => laneTotal + count, 0),
    ),
  );

  return (
    <section className="nfl-source-control-center" aria-label="Fantasy source control center">
      <div className="nfl-source-control-head">
        <div>
          <div className="nfl-section-kicker">
            <ShieldCheck size={17} />
            Source control
          </div>
          <h3>Fantasy Sources Control Center</h3>
          <p>
            {liveLanes}/{lanes.length} sources live · {totalRows} source rows · Model
            nudges stay capped.
          </p>
        </div>
        <strong>fun-first forecast</strong>
      </div>
      <div className="nfl-source-lane-grid">
        {lanes.map((lane) => (
          <article
            className={cx(
              "nfl-source-lane-card",
              lane.status === "live" && "live",
              lane.status === "error" && "error",
              lane.freshness === "stale" && "stale",
            )}
            key={lane.id}
          >
            <div className="nfl-source-lane-top">
              <span>{sourceLaneIcon(lane.kind)}</span>
              <div>
                <strong>{lane.label}</strong>
                <em>{lane.providerName}</em>
              </div>
              <b>{sourceLaneStatusCopy(lane)}</b>
            </div>
            <p>{lane.message}</p>
            <div className="nfl-source-row-pills">
              {fantasySourceLaneRowParts(lane.rows).map((part) => (
                <span key={part}>{part}</span>
              ))}
            </div>
            <div className="nfl-source-position-strip">
              {fantasyCoveragePositions.map((position) => (
                <span
                  className={cx((lane.positions[position] ?? 0) > 0 && "live")}
                  key={position}
                >
                  {scoutingRankLabel(position)} {lane.positions[position] ?? 0}
                </span>
              ))}
            </div>
            <div className="nfl-source-trust-meter">
              <div>
                <span>Trust weight</span>
                <strong>{lane.trustWeight}%</strong>
              </div>
              <i>
                <b style={{ width: `${lane.trustWeight}%` }} />
              </i>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function sourceLaneIcon(kind: FantasySourceLaneKind) {
  if (kind === "roster") {
    return <UsersRound size={17} />;
  }

  if (kind === "projection") {
    return <LineChart size={17} />;
  }

  if (kind === "ranking") {
    return <Trophy size={17} />;
  }

  if (kind === "context") {
    return <Gauge size={17} />;
  }

  return <Activity size={17} />;
}

function sourceLaneStatusCopy(lane: FantasySourceLane) {
  if (lane.status === "live") {
    return lane.freshness === "stale" ? "stale" : "live";
  }

  if (lane.status === "error") {
    return "needs check";
  }

  return "fallback";
}

function fantasySourceLaneRowParts(rows: FantasySourceRows) {
  return [
    rows.roster > 0 ? `${rows.roster} roster` : "",
    rows.projections > 0 ? `${rows.projections} proj` : "",
    rows.rankings > 0 ? `${rows.rankings} rank` : "",
    rows.context > 0 ? `${rows.context} context` : "",
    rows.crowd > 0 ? `${rows.crowd} crowd` : "",
  ].filter(Boolean);
}

function isSleeperImportLoading(status: SleeperImportStatus) {
  return status === "searching" || status === "loading-league";
}

function FantasyImportPanel({
  fantasyImport,
  providerBridgeFileName,
  providerBridgeImport,
  providerBridgeMessage,
  providerBridgeStatus,
  providerBridgeText,
  manualImportMessage,
  manualImportStatus,
  manualRosterText,
  onManualImport,
  onManualRosterTextChange,
  onProviderBridgeFile,
  onProviderBridgeImport,
  onProviderBridgeTextChange,
  onScreenshotFile,
  onScreenshotImport,
  onSleeperImport,
  onSleeperLeagueImport,
  onSleeperQueryChange,
  onSleeperRefresh,
  onSleeperUseAutoWeekChange,
  onSleeperWeekChange,
  screenshotFileName,
  screenshotImportMessage,
  screenshotImportStatus,
  sleeperImportMessage,
  sleeperImportStatus,
  sleeperLastRefreshedAt,
  sleeperLeagueOptions,
  sleeperSelectedLeagueId,
  sleeperQuery,
  sleeperUseAutoWeek,
  sleeperWeek,
}: {
  fantasyImport: ImportedFantasyLeague | null;
  providerBridgeFileName: string;
  providerBridgeImport: FantasyProviderBridgeImport | null;
  providerBridgeMessage: string;
  providerBridgeStatus: FantasyImportStatus;
  providerBridgeText: string;
  manualImportMessage: string;
  manualImportStatus: FantasyImportStatus;
  manualRosterText: string;
  onManualImport: () => void;
  onManualRosterTextChange: (value: string) => void;
  onProviderBridgeFile: (file: File | null | undefined) => void;
  onProviderBridgeImport: () => void;
  onProviderBridgeTextChange: (value: string) => void;
  onScreenshotFile: (file: File | null | undefined) => void;
  onScreenshotImport: () => void;
  onSleeperImport: () => void;
  onSleeperLeagueImport: (league: SleeperLeagueOption) => void;
  onSleeperQueryChange: (value: string) => void;
  onSleeperRefresh: () => void;
  onSleeperUseAutoWeekChange: (useAutoWeek: boolean) => void;
  onSleeperWeekChange: (week: string) => void;
  screenshotFileName: string;
  screenshotImportMessage: string;
  screenshotImportStatus: FantasyImportStatus;
  sleeperImportMessage: string;
  sleeperImportStatus: SleeperImportStatus;
  sleeperLastRefreshedAt: string;
  sleeperLeagueOptions: SleeperLeagueOption[];
  sleeperSelectedLeagueId: string;
  sleeperQuery: string;
  sleeperUseAutoWeek: boolean;
  sleeperWeek: string;
}) {
  const importLabel = fantasyImport
    ? `${fantasyImport.label} · ${fantasyImport.teams.length} team${fantasyImport.teams.length === 1 ? "" : "s"}`
    : "Sample lab rosters";
  const providerLabel = providerBridgeImport
    ? `${providerBridgeImport.providerLabel} · ${providerBridgeImport.projections.length} rows`
    : "Seeded projection spine";

  return (
    <div className="nfl-fantasy-import-panel">
      <div className="nfl-import-panel-head">
        <div>
          <span>League connection</span>
          <strong>{importLabel}</strong>
          <small>Projection source: {providerLabel}</small>
        </div>
        <em>{providerBridgeImport ? "provider bridge" : fantasyImport?.source ?? "demo"}</em>
      </div>

      <div className="nfl-import-grid">
        <article className="nfl-import-card wide provider">
          <div>
            <LineChart size={18} />
            <strong>Projection file</strong>
          </div>
          <label className="nfl-file-drop">
            <LineChart size={16} />
            <span>{providerBridgeFileName || "CSV or JSON"}</span>
            <input
              accept=".csv,.json,application/json,text/csv,text/plain"
              onChange={(event) => onProviderBridgeFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <textarea
            onChange={(event) => onProviderBridgeTextChange(event.target.value)}
            spellCheck={false}
            value={providerBridgeText}
          />
          <button
            disabled={providerBridgeStatus === "loading"}
            onClick={onProviderBridgeImport}
            type="button"
          >
            <LineChart size={16} />
            {providerBridgeStatus === "loading" ? "Loading" : "Load projections"}
          </button>
          <p className={cx("nfl-import-status", providerBridgeStatus)}>
            {providerBridgeMessage}
          </p>
        </article>

        <article className="nfl-import-card">
          <div>
            <RefreshCw size={18} />
            <strong>Sleeper</strong>
          </div>
          <div className="nfl-sleeper-row">
            <input
              onChange={(event) => onSleeperQueryChange(event.target.value)}
              placeholder="username, user id, league id, or link"
              value={sleeperQuery}
            />
            <input
              aria-label="Sleeper week"
              inputMode="numeric"
              max="22"
              min="1"
              onChange={(event) => onSleeperWeekChange(event.target.value)}
              placeholder={sleeperUseAutoWeek ? "Auto" : "Week"}
              type="number"
              disabled={sleeperUseAutoWeek}
              value={sleeperWeek}
            />
          </div>
          <label className="nfl-sleeper-auto">
            <input
              checked={sleeperUseAutoWeek}
              onChange={(event) => onSleeperUseAutoWeekChange(event.target.checked)}
              type="checkbox"
            />
            <span>Auto current Sleeper week</span>
          </label>
          <div className="nfl-sleeper-actions">
            <button
              disabled={isSleeperImportLoading(sleeperImportStatus)}
              onClick={onSleeperImport}
              type="button"
            >
              <RefreshCw size={16} />
              {sleeperImportStatus === "searching" ? "Searching" : "Find leagues"}
            </button>
            {fantasyImport?.sleeper ? (
              <button
                className="secondary"
                disabled={isSleeperImportLoading(sleeperImportStatus)}
                onClick={onSleeperRefresh}
                type="button"
              >
                <RefreshCw size={16} />
                {sleeperImportStatus === "loading-league" ? "Refreshing" : "Refresh"}
              </button>
            ) : null}
          </div>
          <p className={cx("nfl-import-status", sleeperImportStatus)}>
            {sleeperImportMessage}
          </p>
          {sleeperLeagueOptions.length > 0 ? (
            <div className="nfl-sleeper-league-list" aria-label="Sleeper leagues">
              {sleeperLeagueOptions.map((league) => (
                <button
                  className={cx(
                    league.leagueId === sleeperSelectedLeagueId && "active",
                    league.isBestGuess && "best",
                  )}
                  disabled={sleeperImportStatus === "loading-league"}
                  key={league.leagueId}
                  onClick={() => onSleeperLeagueImport(league)}
                  type="button"
                >
                  <strong>{league.name}</strong>
                  <span>
                    {league.season ?? "season"} · {league.status ?? "league"}
                    {league.rosterCount ? ` · ${league.rosterCount} rosters` : ""}
                  </span>
                  <em>{league.isBestGuess ? "best guess" : "select"}</em>
                </button>
              ))}
            </div>
          ) : null}
          {fantasyImport?.sleeper ? (
            <div className="nfl-sleeper-receipt">
              <span>{fantasyImport.sleeper.leagueName}</span>
              <strong>
                Week {fantasyImport.sleeper.week ?? "?"} ·{" "}
                {fantasyImport.sleeper.matchupId
                  ? `matchup ${fantasyImport.sleeper.matchupId}`
                  : "no matchup"}
              </strong>
              <em>
                {fantasyImport.sleeper.rosterCount} rosters ·{" "}
                {fantasyImport.sleeper.status.replace(/-/g, " ")}
              </em>
              {sleeperLastRefreshedAt ? (
                <small>Last refreshed {formatDataUpdated(sleeperLastRefreshedAt)}</small>
              ) : null}
              {fantasyImport.settings ? (
                <div className="nfl-sleeper-settings">
                  <span>{fantasyImport.settings.formatLabel}</span>
                  <span>{fantasyImport.settings.lineupSlotCount} starters</span>
                  <span>{fantasyImport.settings.benchSlots} bench</span>
                  {fantasyImport.settings.taxiSlots > 0 ? (
                    <span>{fantasyImport.settings.taxiSlots} taxi</span>
                  ) : null}
                  {fantasyImport.settings.reserveSlots > 0 ? (
                    <span>{fantasyImport.settings.reserveSlots} IR</span>
                  ) : null}
                  {fantasyImport.settings.superflexSlots > 0 ? (
                    <span>{fantasyImport.settings.superflexSlots} superflex</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>

        <article className="nfl-import-card wide">
          <div>
            <ClipboardList size={18} />
            <strong>Paste rosters</strong>
          </div>
          <textarea
            onChange={(event) => onManualRosterTextChange(event.target.value)}
            spellCheck={false}
            value={manualRosterText}
          />
          <button
            disabled={manualImportStatus === "loading"}
            onClick={onManualImport}
            type="button"
          >
            <ClipboardList size={16} />
            Parse rosters
          </button>
          <p className={cx("nfl-import-status", manualImportStatus)}>
            {manualImportMessage}
          </p>
        </article>

        <article className="nfl-import-card">
          <div>
            <FileImage size={18} />
            <strong>Roster screenshot</strong>
          </div>
          <label className="nfl-file-drop">
            <FileImage size={16} />
            <span>{screenshotFileName || "Choose image"}</span>
            <input
              accept="image/*"
              onChange={(event) => onScreenshotFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          <button
            disabled={screenshotImportStatus === "loading" || !screenshotFileName}
            onClick={onScreenshotImport}
            type="button"
          >
            <FileImage size={16} />
            {screenshotImportStatus === "loading" ? "Reading" : "Import"}
          </button>
          <p className={cx("nfl-import-status", screenshotImportStatus)}>
            {screenshotImportMessage}
          </p>
        </article>
      </div>
    </div>
  );
}

function AdviceList({ items, title }: { items: string[]; title: string }) {
  const visibleItems =
    items.length > 0 ? items : ["No glaring leak here; keep monitoring roles and health."];

  return (
    <div className="nfl-advice-list">
      <span>{title}</span>
      {visibleItems.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

function FantasyTeamMiniReport({ report }: { report: FantasyTeamReport }) {
  return (
    <div className="nfl-team-mini-report">
      <span>{report.team.manager}</span>
      <strong>{report.team.name}</strong>
      <div>
        <em>{report.projection.toFixed(1)} proj</em>
        <em>{report.ceiling.toFixed(1)} ceiling</em>
        <em>Need {report.weakestLane.label}</em>
      </div>
      <i>
        <b style={{ width: `${report.score}%` }} />
      </i>
    </div>
  );
}

function fantasyTradeTeamsFromLeagueMap(
  leagueMap: FantasyLeaguePowerMap,
): FantasyTradeTeam[] {
  return leagueMap.teams.map((team) => {
    const starterIds = new Set(team.report.players.map((player) => player.id));
    const playersById = new Map<string, ScoutingRow>();

    [...team.report.players, ...team.report.benchPlayers].forEach((player) => {
      playersById.set(player.id, player);
    });

    return {
      id: team.report.team.id,
      manager: team.report.team.manager,
      name: team.report.team.name,
      players: Array.from(playersById.values()).map((player) =>
        fantasyTradePlayerFromScoutingRow(player, starterIds.has(player.id)),
      ),
    };
  });
}

function fantasyTradePlayerFromScoutingRow(
  player: ScoutingRow,
  starter: boolean,
): FantasyTradePlayer {
  return {
    ceiling: player.contextProjection.ceiling,
    dynastyValue: player.dynastyValue,
    floor: player.contextProjection.floor,
    id: player.id,
    name: player.name,
    nflTeam: player.team,
    position: normalizeScoutingPosition(player.position) as FantasyTradePosition,
    projection: player.contextProjection.projection,
    risk: player.chaos,
    roleSecurity: player.roleSecurity ?? player.health,
    starter,
  };
}

function buildFantasyTeams(players: FantasyPlayer[]): FantasyTeam[] {
  const rankedPlayers = [...players].sort(
    (left, right) => left.seerRank - right.seerRank || left.nflRank - right.nflRank,
  );
  const homeRoster = rankedPlayers
    .filter((_, index) => index % 2 === 0)
    .map((player) => player.id);
  const awayRoster = rankedPlayers
    .filter((_, index) => index % 2 === 1)
    .map((player) => player.id);

  return [
    {
      id: "seer-house",
      name: "My Team",
      manager: "My squad",
      rosterIds:
        homeRoster.length > 0
          ? homeRoster
          : rankedPlayers.slice(0, 1).map((player) => player.id),
      starterIds:
        homeRoster.length > 0
          ? homeRoster
          : rankedPlayers.slice(0, 1).map((player) => player.id),
      benchIds: [],
      identity: "Floor plus flash, built to survive weird game scripts.",
      source: "seeded",
    },
    {
      id: "rival-house",
      name: "Opponent",
      manager: "Opponent",
      rosterIds:
        awayRoster.length > 0
          ? awayRoster
          : rankedPlayers.slice(0, 1).map((player) => player.id),
      starterIds:
        awayRoster.length > 0
          ? awayRoster
          : rankedPlayers.slice(0, 1).map((player) => player.id),
      benchIds: [],
      identity: "Ceiling hunter with a little more weekly wobble.",
      source: "seeded",
    },
  ];
}

function fantasyLineupSlotsForTeam(team: FantasyTeam): FantasyLineupSlotDefinition[] {
  const importedSlots =
    team.lineupSlots
      ?.map((slot) => fantasyImportedLineupSlot(slot))
      .filter((slot): slot is FantasyLineupSlotDefinition => slot !== null) ?? [];

  return importedSlots.length > 0 ? importedSlots : fantasyLineupSlots;
}

function fantasyImportedLineupSlot(
  slot: ImportedFantasyLineupSlot,
): FantasyLineupSlotDefinition | null {
  const positions = slot.positions
    .map((position) => normalizeScoutingPosition(position))
    .filter(
      (position, index, values) =>
        fantasyCoveragePositions.includes(position) && values.indexOf(position) === index,
    );

  if (!slot.id || !slot.label || positions.length === 0) {
    return null;
  }

  return {
    id: slot.id,
    label: slot.label,
    positions,
  };
}

function analyzeFantasyTeam({
  allPlayers,
  contextByTeam,
  lens,
  scoringFormat,
  team,
}: {
  allPlayers: FantasyPlayer[];
  contextByTeam: Record<string, NflFantasyTeamContext>;
  lens: FantasyTeamLens;
  scoringFormat: ScoringFormat;
  team: FantasyTeam;
}): FantasyTeamReport {
  const board = buildScoutingBoard(allPlayers, scoringFormat, contextByTeam);
  const rosterIdSet = new Set(team.rosterIds);
  const fullRoster = board.filter((player) => rosterIdSet.has(player.id));
  const rosterPool =
    fullRoster.length > 0 ? fullRoster : board.slice(0, Math.min(12, board.length));
  const decision = buildFantasyLineupDecision({
    lens,
    lineupSlots: fantasyLineupSlotsForTeam(team),
    roster: rosterPool,
    scoringFormat,
  });
  const roster =
    decision.starters.length > 0
      ? decision.starters
      : rosterPool.length > 0
        ? rosterPool
        : board.slice(0, 1);
  const benchPlayers = decision.benchPlayers;
  const lanes = fantasyRosterLanes(decision.lineup);
  const projection = round1(
    sum(roster.map((player) => player.contextProjection.projection)),
  );
  const floor = round1(sum(roster.map((player) => player.contextProjection.floor)));
  const ceiling = round1(
    sum(roster.map((player) => player.contextProjection.ceiling)),
  );
  const balance = teamBalance(roster);
  const depth = teamDepth(fullRoster.length > 0 ? fullRoster : roster);
  const risk = teamRisk(roster);
  const dynastyCore = teamDynastyCore(fullRoster.length > 0 ? fullRoster : roster);
  const score = clampMeter(
    Math.round(
      projection * 2.25 +
        floor * 1.05 +
        ceiling * 0.42 +
        balance * 0.16 +
        depth * 0.16 +
        (lens === "dynasty" ? dynastyCore * 0.28 : (100 - risk) * 0.2),
    ),
  );

  return {
    team,
    players: roster,
    benchPlayers,
    lineup: decision.lineup,
    lineupSourceProjection: decision.sourceProjection,
    lineupSeerDelta: decision.seerDelta,
    startSitReceipts: decision.startSitReceipts,
    benchAlternatives: decision.benchAlternatives,
    closeCalls: decision.closeCalls,
    strongestLane: lanes.strongest,
    weakestLane: lanes.weakest,
    projection,
    floor,
    ceiling,
    score,
    balance,
    depth,
    risk,
    dynastyCore,
    strengths: fantasyStrengths(roster, scoringFormat, lens),
    weaknesses: fantasyWeaknesses(roster, scoringFormat, lens, balance, depth, risk),
    moves: fantasyMoves(roster, scoringFormat, lens),
    benchUpgrades: fantasyBenchUpgrades(roster, benchPlayers),
    tradeIdeas: fantasyTradeIdeas({
      allPlayers: board,
      lens,
      roster: rosterPool.length > 0 ? rosterPool : roster,
      scoringFormat,
    }),
  };
}

function buildFantasyLineupDecision({
  lens,
  lineupSlots,
  roster,
  scoringFormat,
}: {
  lens: FantasyTeamLens;
  lineupSlots: FantasyLineupSlotDefinition[];
  roster: ScoutingRow[];
  scoringFormat: ScoringFormat;
}) {
  const usedIds = new Set<string>();
  const lineup = lineupSlots.map((slot) => {
    const player =
      roster
        .filter(
          (candidate) =>
            !usedIds.has(candidate.id) && fantasyPlayerFitsSlot(candidate, slot),
        )
        .sort(
          (left, right) =>
            fantasyLineupFitScore(right, slot, scoringFormat, lens) -
            fantasyLineupFitScore(left, slot, scoringFormat, lens),
        )[0] ?? null;

    if (player) {
      usedIds.add(player.id);
    }

    return fantasyLineupSlotPick(slot, player, scoringFormat);
  });
  const starters = lineup
    .map((slot) => slot.player)
    .filter((player): player is ScoutingRow => Boolean(player));
  const benchPlayers = roster.filter((player) => !usedIds.has(player.id));
  const sourceProjection = round1(
    sum(lineup.map((slot) => slot.sourceProjection)),
  );
  const seerProjection = round1(sum(lineup.map((slot) => slot.seerProjection)));
  const benchAlternatives = fantasyBenchAlternatives(
    lineup,
    benchPlayers,
    lineupSlots,
    scoringFormat,
    lens,
  );
  const closeCalls = fantasyCloseCalls(
    lineup,
    benchPlayers,
    lineupSlots,
    scoringFormat,
    lens,
  );
  const startSitReceipts = fantasyDecisionReceipts(
    lineup,
    benchAlternatives,
    scoringFormat,
  );

  return {
    benchAlternatives,
    benchPlayers,
    closeCalls,
    lineup,
    seerDelta: round1(seerProjection - sourceProjection),
    sourceProjection,
    startSitReceipts,
    starters,
  };
}

function fantasyLineupSlotPick(
  slot: FantasyLineupSlotDefinition,
  player: ScoutingRow | null,
  scoringFormat: ScoringFormat,
): FantasyLineupSlotPick {
  if (!player) {
    return {
      adjustmentReceipts: [],
      context: null,
      contextDelta: 0,
      delta: 0,
      id: slot.id,
      label: slot.label,
      player: null,
      receipt: `No eligible ${slot.label} is on this roster yet.`,
      seerProjection: 0,
      sourceProjection: 0,
      tags: slot.positions.map(scoutingRankLabel),
    };
  }

  const sourceProjection = fantasySourceProjection(player);
  const seerProjection = round1(player.contextProjection.projection);
  const delta = round1(seerProjection - sourceProjection);
  const tags = fantasyDecisionTags(player, scoringFormat).slice(0, 4);
  const tagCopy = tags.slice(0, 2).join(" and ").toLowerCase();
  const adjustmentReceipts = player.context.adjustments
    .filter((adjustment) => Math.abs(adjustment.delta) >= 0.1)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  return {
    adjustmentReceipts,
    context: player.context,
    contextDelta: player.context.projectionNudge,
    delta,
    id: slot.id,
    label: slot.label,
    player,
    receipt: `Start ${player.name} at ${slot.label}. The case is ${tagCopy || "a balanced profile"}. ${contextReceiptLine(player.context)}`,
    seerProjection,
    sourceProjection,
    tags,
  };
}

function fantasyPlayerFitsSlot(
  player: ScoutingRow,
  slot: FantasyLineupSlotDefinition,
) {
  return slot.positions.includes(normalizeScoutingPosition(player.position));
}

function fantasyLineupFitScore(
  player: ScoutingRow,
  slot: FantasyLineupSlotDefinition,
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
) {
  const position = normalizeScoutingPosition(player.position);
  const pprBoost =
    scoringFormat === "standard"
      ? 0
      : (player.baseline.receptions + player.targetShare / 16) *
        (scoringFormat === "fullPpr" ? 0.7 : 0.38);
  const roleBoost = (player.roleSecurity ?? player.health) * 0.05;
  const dynastyBoost =
    lens === "dynasty"
      ? (player.dynastyValue ?? player.health) * 0.035 +
        (player.roleSecurity ?? player.health) * 0.02
      : 0;
  const flexPenalty = slot.id === "FLEX" && position === "TE" ? 0.25 : 0;

  return (
    player.contextProjection.projection * 1.5 +
    player.contextProjection.floor * 0.62 +
    player.contextProjection.ceiling * 0.24 +
    player.matchup * 0.055 +
    player.health * 0.04 -
    player.chaos * 0.05 +
    pprBoost +
    roleBoost +
    dynastyBoost -
    flexPenalty +
    player.context.projectionNudge * 1.15
  );
}

function fantasyBenchAlternatives(
  lineup: FantasyLineupSlotPick[],
  benchPlayers: ScoutingRow[],
  lineupSlots: FantasyLineupSlotDefinition[],
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
): FantasyBenchAlternative[] {
  return benchPlayers
    .flatMap((benchPlayer) => {
      const eligibleSlots = lineup
        .filter(
          (slot) =>
            slot.player &&
            lineupSlots
              .find((definition) => definition.id === slot.id)
              ?.positions.includes(normalizeScoutingPosition(benchPlayer.position)),
        )
        .sort(
          (left, right) =>
            (left.player?.contextProjection.projection ?? 0) -
              (right.player?.contextProjection.projection ?? 0) ||
            fantasyLineupFitScore(
              benchPlayer,
              slotDefinition(left.id, lineupSlots),
              scoringFormat,
              lens,
            ) -
              fantasyLineupFitScore(
                benchPlayer,
                slotDefinition(right.id, lineupSlots),
                scoringFormat,
                lens,
              ),
        );
      const targetSlot = eligibleSlots[0];

      if (!targetSlot?.player) {
        return [];
      }

      const lift = round1(
        benchPlayer.contextProjection.projection -
          targetSlot.player.contextProjection.projection,
      );
      const summary =
        lift > 0
          ? `Move ${benchPlayer.name} ahead of ${targetSlot.player.name} at ${targetSlot.label}; he projects ${Math.abs(lift).toFixed(1)} better.`
          : `${benchPlayer.name} is the closest ${targetSlot.label} alternative, ${Math.abs(lift).toFixed(1)} points behind ${targetSlot.player.name}.`;

      return [
        {
          lift,
          player: benchPlayer,
          slotLabel: targetSlot.label,
          summary,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.lift - left.lift ||
        right.player.contextProjection.floor - left.player.contextProjection.floor,
    )
    .slice(0, 3);
}

function fantasyCloseCalls(
  lineup: FantasyLineupSlotPick[],
  benchPlayers: ScoutingRow[],
  lineupSlots: FantasyLineupSlotDefinition[],
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
): FantasyCloseCall[] {
  return fantasyBenchAlternatives(lineup, benchPlayers, lineupSlots, scoringFormat, lens)
    .filter((alternative) => Math.abs(alternative.lift) <= 2.2 || alternative.lift > 0)
    .flatMap((alternative) => {
      const targetSlot = lineup.find((slot) => slot.label === alternative.slotLabel);

      if (!targetSlot?.player) {
        return [];
      }

      const gap = round1(
        targetSlot.player.contextProjection.projection -
          alternative.player.contextProjection.projection,
      );
      const summary =
        gap <= 0
          ? `Start ${alternative.player.name} over ${targetSlot.player.name} at ${alternative.slotLabel}.`
          : `Keep ${targetSlot.player.name} at ${alternative.slotLabel}, but ${alternative.player.name} is close enough to revisit if news changes.`;

      return [
        {
          challenger: alternative.player,
          gap,
          slotLabel: alternative.slotLabel,
          starter: targetSlot.player,
          summary,
        },
      ];
    })
    .slice(0, 3);
}

function fantasyDecisionReceipts(
  lineup: FantasyLineupSlotPick[],
  benchAlternatives: FantasyBenchAlternative[],
  scoringFormat: ScoringFormat,
): FantasyDecisionReceipt[] {
  const startReceipts = lineup
    .filter((slot) => slot.player)
    .map((slot) => {
      const player = slot.player as ScoutingRow;

      return {
        delta: slot.delta,
        label: `Start ${slot.label}`,
        player,
        adjustmentReceipts: slot.adjustmentReceipts,
        seerProjection: slot.seerProjection,
        sourceProjection: slot.sourceProjection,
        summary: startSitSummary(player, slot.label, scoringFormat),
        tags: slot.tags,
      };
    });
  const benchReceipts = benchAlternatives.slice(0, 2).map((alternative) => {
    const player = alternative.player;
    const sourceProjection = fantasySourceProjection(player);
    const seerProjection = round1(player.contextProjection.projection);

    return {
      adjustmentReceipts: player.context.adjustments,
      delta: round1(seerProjection - sourceProjection),
      label: `Watch ${alternative.slotLabel}`,
      player,
      seerProjection,
      sourceProjection,
      summary: alternative.summary,
      tags: fantasyDecisionTags(player, scoringFormat).slice(0, 3),
    };
  });

  return [...startReceipts, ...benchReceipts];
}

function startSitSummary(
  player: ScoutingRow,
  slotLabel: string,
  scoringFormat: ScoringFormat,
) {
  const sourceProjection = fantasySourceProjection(player);
  const contextProjection = round1(player.contextProjection.projection);
  const projectionMove = round1(contextProjection - sourceProjection);
  const projectionCopy =
    projectionMove === 0
      ? "right in line with the source"
      : `${Math.abs(projectionMove).toFixed(1)} ${projectionMove > 0 ? "above" : "below"} the source`;
  const position = normalizeScoutingPosition(player.position);
  const opponentRead =
    player.context.defenseVsPosition <= 68
      ? "the opponent matchup is helping"
      : player.context.defenseVsPosition >= 78
        ? "the opponent matchup is the main concern"
        : "the matchup is not pushing hard either way";
  const volumeRead =
    scoringFormat !== "standard" &&
    (position === "WR" || position === "TE") &&
    player.baseline.receptions >= 5
      ? "his catch volume matters in this scoring"
      : player.carryShare >= 24
        ? "his touch share gives you a stable base"
        : player.touchdownPulse >= 78
          ? "his touchdown path is real but swingy"
          : "his role is steady enough to trust";

  return `Start ${player.name} at ${slotLabel}. He projects at ${contextProjection.toFixed(1)}, ${projectionCopy}, because ${volumeRead} and ${opponentRead}.`;
}

function fantasyDecisionTags(player: ScoutingRow, scoringFormat: ScoringFormat) {
  const tags = [
    player.context.defenseVsPosition <= 68
      ? "Matchup boost"
    : player.context.defenseVsPosition >= 78
        ? "Tough defense"
        : "Neutral matchup",
    player.context.weather.toLowerCase().includes("wind") ||
    player.context.weather.toLowerCase().includes("snow")
      ? "Weather watch"
      : player.context.roof === "Dome"
        ? "Clean track"
        : "Open-air read",
    player.health >= 82
      ? "Clean health"
      : player.health <= 68
        ? "Health watch"
        : "Playable health",
    player.chaos >= 62 ? "Volatility" : "Stable range",
    scoringFormat !== "standard" &&
    (player.position === "WR" || player.position === "TE") &&
    player.baseline.receptions >= 5
      ? "PPR volume"
      : player.carryShare >= 24
        ? "Touch share"
        : player.roleSecurity && player.roleSecurity >= 78
          ? "Role secure"
          : "Role watch",
  ];

  if (player.seerAdjustments?.length) {
    tags.push(player.seerAdjustments[0]);
  }

  return tags;
}

function fantasySourceProjection(player: ScoutingRow) {
  if (typeof player.sourceProjection === "number") {
    return round1(player.sourceProjection);
  }

  return round1(player.fantasy.projection - projectionDelta(player));
}

function slotDefinition(
  slotId: FantasyLineupSlotId,
  lineupSlots: FantasyLineupSlotDefinition[] = fantasyLineupSlots,
) {
  return (
    lineupSlots.find((definition) => definition.id === slotId) ??
    lineupSlots[0] ??
    fantasyLineupSlots[0]
  );
}

function fantasyRosterLanes(lineup: FantasyLineupSlotPick[]) {
  const lanes = fantasyCoveragePositions.map((position) => {
    const players = lineup
      .map((slot) => slot.player)
      .filter(
        (player): player is ScoutingRow =>
          player !== null && normalizeScoutingPosition(player.position) === position,
      );
    const value = round1(
      sum(players.map((player) => player.contextProjection.projection)),
    );
    const label = `${scoutingRankLabel(position)}${position === "RB" || position === "WR" ? " room" : ""}`;
    const summary =
      players.length > 0
        ? `${label} carries ${value.toFixed(1)} lineup points.`
        : `${label} is currently empty.`;

    return { label, position, summary, value };
  });
  const strongest =
    [...lanes].sort((left, right) => right.value - left.value)[0] ?? lanes[0];
  const weakest =
    [...lanes].sort((left, right) => left.value - right.value)[0] ?? lanes[0];

  return { strongest, weakest };
}

function compareFantasyTeams({
  allPlayers,
  contextByTeam,
  left,
  lens,
  right,
  scoringFormat,
}: {
  allPlayers: FantasyPlayer[];
  contextByTeam: Record<string, NflFantasyTeamContext>;
  left: FantasyTeam;
  lens: FantasyTeamLens;
  right: FantasyTeam;
  scoringFormat: ScoringFormat;
}): FantasyMatchupReport {
  const leftReport = analyzeFantasyTeam({
    allPlayers,
    contextByTeam,
    lens,
    scoringFormat,
    team: left,
  });
  const rightReport = analyzeFantasyTeam({
    allPlayers,
    contextByTeam,
    lens,
    scoringFormat,
    team: right,
  });
  const projectionGap = round1(leftReport.projection - rightReport.projection);
  const edgeTeam = projectionGap >= 0 ? leftReport.team : rightReport.team;
  const trailingReport = projectionGap >= 0 ? rightReport : leftReport;
  const edgeMagnitude = Math.abs(projectionGap);
  const edgeLabel =
    edgeMagnitude < 2
      ? "True toss-up"
      : `${edgeTeam.name} +${edgeMagnitude.toFixed(1)}`;
  const positionEdges = fantasyPositionEdges(leftReport, rightReport);
  const beatPlan = buildFantasyMatchupWeaknessPlan({
    lens,
    myBench: fantasyPlanPlayers(leftReport.benchPlayers),
    myPlayers: fantasyPlanPlayers(leftReport.players),
    myTeamName: leftReport.team.name,
    opponentPlayers: fantasyPlanPlayers(rightReport.players),
    opponentTeamName: rightReport.team.name,
    positionEdges: fantasyMatchupPlanPositions(leftReport, rightReport, positionEdges),
  });
  const strongestEdge =
    [...positionEdges].sort((leftEdge, rightEdge) => rightEdge.gap - leftEdge.gap)[0] ??
    positionEdges[0];
  const chaos = clampMeter(
    Math.round(
      (leftReport.risk + rightReport.risk) / 2 +
        Math.abs(leftReport.ceiling - rightReport.ceiling) * 0.22 -
        edgeMagnitude * 0.35,
    ),
  );
  const confidence = clampMeter(
    Math.round(
      52 +
        edgeMagnitude * 2.7 +
        Math.abs(leftReport.floor - rightReport.floor) * 0.42 -
        chaos * 0.11,
    ),
  );
  const winLean = clampMeter(
    Math.round(
      50 +
        Math.min(
          42,
          edgeMagnitude * 3.1 + Math.abs(leftReport.score - rightReport.score) * 0.12,
        ),
    ),
  );

  return {
    left: leftReport,
    right: rightReport,
    edgeTeam,
    edgeLabel,
    projectionGap,
    winLean,
    confidence,
    chaos,
    positionEdges,
    beatPlan,
    strongestEdge,
    swingFactors: fantasySwingFactors(leftReport, rightReport),
    recommendation:
      edgeMagnitude < 2
        ? "This is close enough that one lineup choice can decide it. Break ties with safer roles, not bigger names."
        : `${edgeTeam.name} has the cleaner path right now. The other side can close the gap by fixing ${trailingReport.weakestLane.label} and choosing the steadier play in close calls.`,
  };
}

function buildFantasyLeaguePowerMap({
  activeTeamId,
  allPlayers,
  contextByTeam,
  lens,
  scoringFormat,
  teams,
}: {
  activeTeamId: string;
  allPlayers: FantasyPlayer[];
  contextByTeam: Record<string, NflFantasyTeamContext>;
  lens: FantasyTeamLens;
  scoringFormat: ScoringFormat;
  teams: FantasyTeam[];
}): FantasyLeaguePowerMap {
  const reports = teams.map((team) =>
    analyzeFantasyTeam({
      allPlayers,
      contextByTeam,
      lens,
      scoringFormat,
      team,
    }),
  );
  const positionAverages = fantasyLeaguePositionAverages(reports);
  const powerMap = rankFantasyLeaguePower({
    activeTeamId,
    lens,
    teams: reports.map(fantasyPowerTeamInputFromReport),
  });
  const powerTeamsById = new Map(
    powerMap.teams.map((team) => [team.id, team]),
  );
  const rankedTeams = reports
    .map((report) =>
      buildFantasyLeaguePowerTeam(
        report,
        positionAverages,
        lens,
        powerTeamsById.get(report.team.id),
      ),
    )
    .sort(
      (left, right) =>
        right.score - left.score || right.report.projection - left.report.projection,
    )
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
  const active =
    rankedTeams.find((team) => team.report.team.id === activeTeamId) ??
    rankedTeams[0] ??
    buildFantasyLeaguePowerTeam(
      analyzeFantasyTeam({
        allPlayers,
        contextByTeam,
        lens,
        scoringFormat,
        team: teams[0],
      }),
      positionAverages,
      lens,
      undefined,
    );
  const opponents = rankedTeams.filter(
    (team) => team.report.team.id !== active.report.team.id,
  );
  const bestMatchup =
    [...opponents].sort(
      (left, right) =>
        fantasyLeagueMatchupFitScore(active.report, right.report) -
        fantasyLeagueMatchupFitScore(active.report, left.report),
    )[0] ?? active;
  const badMatchup =
    [...opponents].sort(
      (left, right) =>
        fantasyLeagueMatchupFitScore(active.report, left.report) -
        fantasyLeagueMatchupFitScore(active.report, right.report),
    )[0] ?? active;
  const moveTargets = buildFantasyMoveTargets({
    active,
    allPlayers,
    contextByTeam,
    lens,
    rankedTeams,
    scoringFormat,
    teams,
  });

  return {
    active,
    badMatchup,
    bestMatchup,
    easiestUpgrade: `${scoutingRankLabel(active.weakestPosition.position)} help`,
    moveTargets,
    rankLabel: `#${active.rank} of ${rankedTeams.length}`,
    recommendation: fantasyLeaguePowerRecommendation({
      active,
      badMatchup,
      bestMatchup,
      lens,
      teamCount: rankedTeams.length,
    }),
    teamCount: rankedTeams.length,
    teams: rankedTeams,
    tradePartners: powerMap.tradePartners,
  };
}

function fantasyPowerTeamInputFromReport(
  report: FantasyTeamReport,
): FantasyPowerTeamInput {
  const starterIds = new Set(report.players.map((player) => player.id));
  const playersById = new Map<string, ScoutingRow>();

  [...report.players, ...report.benchPlayers].forEach((player) => {
    playersById.set(player.id, player);
  });

  return {
    id: report.team.id,
    manager: report.team.manager,
    name: report.team.name,
    players: Array.from(playersById.values()).map((player) => ({
      ceiling: player.contextProjection.ceiling,
      dynastyValue: player.dynastyValue,
      floor: player.contextProjection.floor,
      id: player.id,
      name: player.name,
      position: normalizeScoutingPosition(player.position),
      projection: player.contextProjection.projection,
      risk: player.chaos,
      roleSecurity: player.roleSecurity ?? player.health,
      starter: starterIds.has(player.id),
    })),
  };
}

function buildFantasyMoveTargets({
  active,
  allPlayers,
  contextByTeam,
  lens,
  rankedTeams,
  scoringFormat,
  teams,
}: {
  active: FantasyLeaguePowerTeam;
  allPlayers: FantasyPlayer[];
  contextByTeam: Record<string, NflFantasyTeamContext>;
  lens: FantasyTeamLens;
  rankedTeams: FantasyLeaguePowerTeam[];
  scoringFormat: ScoringFormat;
  teams: FantasyTeam[];
}): FantasyMoveTarget[] {
  return [
    buildWaiverMoveTarget({
      active,
      allPlayers,
      contextByTeam,
      lens,
      scoringFormat,
      teams,
    }),
    buildTradeMoveTarget({ active, lens, rankedTeams, scoringFormat }),
    buildDropMoveTarget({ active, lens, scoringFormat }),
  ];
}

function buildWaiverMoveTarget({
  active,
  allPlayers,
  contextByTeam,
  lens,
  scoringFormat,
  teams,
}: {
  active: FantasyLeaguePowerTeam;
  allPlayers: FantasyPlayer[];
  contextByTeam: Record<string, NflFantasyTeamContext>;
  lens: FantasyTeamLens;
  scoringFormat: ScoringFormat;
  teams: FantasyTeam[];
}): FantasyMoveTarget {
  const board = buildScoutingBoard(allPlayers, scoringFormat, contextByTeam);
  const rosteredIds = new Set(teams.flatMap((team) => team.rosterIds));
  const position = active.weakestPosition.position;
  const freeAgents = board.filter((player) => !rosteredIds.has(player.id));
  const candidates = freeAgents.length > 0 ? freeAgents : active.report.benchPlayers;
  const target =
    [...candidates].sort(
      (left, right) =>
        fantasyMoveCandidateScore(right, position, lens, "waiver") -
        fantasyMoveCandidateScore(left, position, lens, "waiver"),
    )[0] ?? active.report.players[0];

  if (!target) {
    return fallbackFantasyMoveTarget("waiver", position);
  }

  const isTrueFreeAgent = freeAgents.some((player) => player.id === target.id);

  return {
    action: isTrueFreeAgent ? "Add or watch" : "Watch list",
    kind: "waiver",
    playerName: target.name,
    position: normalizeScoutingPosition(target.position),
    reason: fantasyMoveReason({
      lens,
      player: target,
      scoringFormat,
      weakestPosition: position,
    }),
    risk: fantasyMoveRisk(target, lens),
    teamLabel: isTrueFreeAgent ? `${target.team} · unrostered` : `${target.team} · internal watch`,
    title: isTrueFreeAgent ? "Waiver target" : "Waiver scan",
    value: `${target.contextProjection.projection.toFixed(1)} proj · ${target.contextProjection.floor.toFixed(1)} floor`,
  };
}

function buildTradeMoveTarget({
  active,
  lens,
  rankedTeams,
  scoringFormat,
}: {
  active: FantasyLeaguePowerTeam;
  lens: FantasyTeamLens;
  rankedTeams: FantasyLeaguePowerTeam[];
  scoringFormat: ScoringFormat;
}): FantasyMoveTarget {
  const position = active.weakestPosition.position;
  const activeRosterIds = new Set(active.report.team.rosterIds);
  const tradePool = rankedTeams
    .filter((team) => team.report.team.id !== active.report.team.id)
    .flatMap((team) =>
      [...team.report.players, ...team.report.benchPlayers].map((player) => ({
        player,
        team,
      })),
    )
    .filter(({ player }) => !activeRosterIds.has(player.id));
  const directPositionTargets = tradePool.filter(
    ({ player }) => normalizeScoutingPosition(player.position) === position,
  );
  const candidates =
    directPositionTargets.length > 0
      ? directPositionTargets
      : tradePool.filter(({ player }) => player.contextProjection.projection >= 7);
  const target =
    [...candidates].sort(
      (left, right) =>
        fantasyMoveCandidateScore(right.player, position, lens, "trade") -
        fantasyMoveCandidateScore(left.player, position, lens, "trade"),
    )[0] ?? tradePool[0];

  if (!target) {
    return fallbackFantasyMoveTarget("trade", position);
  }

  return {
    action: "Trade ask",
    kind: "trade",
    playerName: target.player.name,
    position: normalizeScoutingPosition(target.player.position),
    reason: fantasyMoveReason({
      lens,
      player: target.player,
      scoringFormat,
      weakestPosition: position,
    }),
    risk: fantasyMoveRisk(target.player, lens),
    teamLabel: `${target.team.report.team.name} · ${target.player.team}`,
    title: "Trade target",
    value: `${target.player.contextProjection.projection.toFixed(1)} proj · role ${
      target.player.roleSecurity ?? target.player.health
    }`,
  };
}

function buildDropMoveTarget({
  active,
  lens,
  scoringFormat,
}: {
  active: FantasyLeaguePowerTeam;
  lens: FantasyTeamLens;
  scoringFormat: ScoringFormat;
}): FantasyMoveTarget {
  const position = active.weakestPosition.position;
  const candidatePool =
    active.report.benchPlayers.length > 0
      ? active.report.benchPlayers
      : active.report.players.slice(-3);
  const target =
    [...candidatePool].sort(
      (left, right) =>
        fantasyDropCandidateScore(right, lens) - fantasyDropCandidateScore(left, lens),
    )[0] ?? active.report.players[active.report.players.length - 1];

  if (!target) {
    return fallbackFantasyMoveTarget("drop", position);
  }

  return {
    action: "Drop candidate",
    kind: "drop",
    playerName: target.name,
    position: normalizeScoutingPosition(target.position),
    reason:
      lens === "dynasty" && (target.dynastyValue ?? target.health) >= 72
        ? `${target.name} is not an auto-drop in dynasty, but he is the first bench name to re-check if you need room.`
        : `${target.name} is the easiest roster spot to question because the projection is modest and the role is not carrying enough weekly value.`,
    risk: fantasyMoveRisk(target, lens),
    teamLabel: `${target.team} · ${scoringLabels[scoringFormat]}`,
    title: "Drop candidate",
    value: `${target.contextProjection.projection.toFixed(1)} proj · ${target.chaos}% volatility`,
  };
}

function fallbackFantasyMoveTarget(
  kind: FantasyMoveTargetKind,
  position: ScoutingPlayerPosition,
): FantasyMoveTarget {
  const title =
    kind === "waiver"
      ? "Waiver scan"
      : kind === "trade"
        ? "Trade target"
        : "Drop candidate";

  return {
    action: "No clean move",
    kind,
    playerName: "No obvious player yet",
    position,
    reason:
      "The current league import does not expose a clean player target here. Re-check after rosters, waivers, or projections refresh.",
    risk: "avoid",
    teamLabel: "Waiting for better data",
    title,
    value: `${scoutingRankLabel(position)} need`,
  };
}

function fantasyMoveCandidateScore(
  player: ScoutingRow,
  weakestPosition: ScoutingPlayerPosition,
  lens: FantasyTeamLens,
  kind: "waiver" | "trade",
) {
  const position = normalizeScoutingPosition(player.position);
  const positionBoost = position === weakestPosition ? 9 : 0;
  const dynastyBoost =
    lens === "dynasty" ? (player.dynastyValue ?? player.health) * 0.12 : 0;
  const tradeCostPenalty =
    kind === "trade" && player.contextProjection.projection >= 18 ? 2.4 : 0;

  return (
    player.contextProjection.projection * 1.4 +
    player.contextProjection.floor * 0.58 +
    player.contextProjection.ceiling * 0.2 +
    (player.roleSecurity ?? player.health) * 0.08 +
    player.matchup * 0.035 -
    player.chaos * 0.045 +
    positionBoost +
    dynastyBoost -
    tradeCostPenalty
  );
}

function fantasyDropCandidateScore(player: ScoutingRow, lens: FantasyTeamLens) {
  const dynastyProtection =
    lens === "dynasty" ? (player.dynastyValue ?? player.health) * 0.18 : 0;
  const roleProtection = (player.roleSecurity ?? player.health) * 0.12;

  return (
    100 -
    player.contextProjection.projection * 4.1 -
    player.contextProjection.floor * 1.7 -
    roleProtection -
    dynastyProtection +
    player.chaos * 0.26 +
    (100 - player.health) * 0.16
  );
}

function fantasyMoveRisk(player: ScoutingRow, lens: FantasyTeamLens): FantasyMoveRisk {
  const dynastyValue = player.dynastyValue ?? player.health;
  const roleSecurity = player.roleSecurity ?? player.health;
  const ceilingGap = player.contextProjection.ceiling - player.contextProjection.projection;

  if (lens === "dynasty" && dynastyValue >= 78 && player.contextProjection.projection < 10) {
    return "stash";
  }

  if (player.health <= 62 || roleSecurity <= 58) {
    return "avoid";
  }

  if (ceilingGap >= 8 || player.chaos >= 62) {
    return "upside swing";
  }

  return "safe floor";
}

function fantasyMoveReason({
  lens,
  player,
  scoringFormat,
  weakestPosition,
}: {
  lens: FantasyTeamLens;
  player: ScoutingRow;
  scoringFormat: ScoringFormat;
  weakestPosition: ScoutingPlayerPosition;
}) {
  const position = normalizeScoutingPosition(player.position);
  const positionCopy =
    position === weakestPosition
      ? `He directly patches your ${scoutingRankLabel(weakestPosition)} lane.`
      : `He does not match the weakest lane perfectly, but the value is useful.`;
  const scoringCopy =
    scoringFormat !== "standard" &&
    (position === "WR" || position === "TE" || position === "RB") &&
    player.baseline.receptions >= 4
      ? "The catch volume matters in this scoring format."
      : player.carryShare >= 22
        ? "The touch share gives you a clearer weekly role."
        : "The profile is more about matchup and role stability than pure volume.";
  const dynastyCopy =
    lens === "dynasty" && (player.dynastyValue ?? player.health) >= 74
      ? " Dynasty value makes him easier to hold if the first week is quiet."
      : "";

  return `${positionCopy} ${scoringCopy}${dynastyCopy}`;
}

function buildFantasyLeaguePowerTeam(
  report: FantasyTeamReport,
  positionAverages: Record<FantasyPosition, number>,
  lens: FantasyTeamLens,
  powerTeam?: FantasyPowerRankedTeam,
): FantasyLeaguePowerTeam {
  const positionEdges = fantasyLeaguePositionEdges(report, positionAverages);
  const strongestPosition =
    [...positionEdges].sort(
      (left, right) =>
        right.leftProjection - right.rightProjection -
        (left.leftProjection - left.rightProjection),
    )[0] ?? positionEdges[0];
  const weakestPosition =
    [...positionEdges].sort(
      (left, right) =>
        left.leftProjection - left.rightProjection -
        (right.leftProjection - right.rightProjection),
    )[0] ?? positionEdges[0];
  const starterScore = powerTeam?.starterScore ?? clampMeter(
    Math.round(
      average(report.players.map((player) => player.contextProjection.projection)) * 5.4 +
        report.floor * 0.05,
    ),
  );
  const benchScore = powerTeam?.benchScore ?? fantasyLeagueBenchScore(report);
  const dynastyScore = powerTeam?.dynastyScore ?? report.dynastyCore;
  const volatility = report.risk;
  const riskScore = powerTeam?.riskScore ?? clampMeter(100 - volatility);
  const injurySensitivity = fantasyLeagueInjurySensitivity(report);
  const score = powerTeam?.score ?? clampMeter(
    Math.round(
      report.score * 0.38 +
        starterScore * 0.24 +
        benchScore * 0.14 +
        report.balance * 0.08 +
        (100 - volatility) * 0.07 +
        (100 - injurySensitivity) * 0.05 +
        (lens === "dynasty" ? dynastyScore * 0.16 : report.depth * 0.1),
    ),
  );

  return {
    benchScore,
    dynastyScore,
    easiestUpgrade: fantasyLeagueUpgradeCopy(report, weakestPosition),
    injurySensitivity,
    matchupWeakness: fantasyLeagueWeaknessCopy(report, weakestPosition),
    positionRanks:
      powerTeam?.positionRanks ?? fantasyFallbackPositionRanks(report, positionEdges),
    rank: 0,
    recommendation: fantasyLeagueTeamRecommendation(report, weakestPosition, lens),
    report,
    riskScore,
    score,
    starterScore,
    strongestPosition,
    tier: powerTeam?.tier ?? "playoffHunt",
    volatility,
    weakestPosition,
  };
}

function fantasyFallbackPositionRanks(
  report: FantasyTeamReport,
  positionEdges: FantasyPositionEdge[],
): FantasyPowerPositionRank[] {
  return positionEdges.map((edge) => ({
    leaderProjection: Math.max(edge.leftProjection, edge.rightProjection),
    position: edge.position,
    projection: fantasyTeamPositionProjection(report, edge.position),
    rank: edge.leftProjection >= edge.rightProjection ? 1 : 2,
    teamCount: 2,
  }));
}

function fantasyLeaguePositionAverages(
  reports: FantasyTeamReport[],
): Record<FantasyPosition, number> {
  return fantasyCoveragePositions.reduce<Record<FantasyPosition, number>>(
    (averages, position) => {
      averages[position] = round1(
        average(reports.map((report) => fantasyTeamPositionProjection(report, position))),
      );

      return averages;
    },
    {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      K: 0,
      DST: 0,
    },
  );
}

function fantasyLeaguePositionEdges(
  report: FantasyTeamReport,
  positionAverages: Record<FantasyPosition, number>,
): FantasyPositionEdge[] {
  return fantasyCoveragePositions.map((position) => {
    const leftProjection = fantasyTeamPositionProjection(report, position);
    const rightProjection = positionAverages[position] ?? 0;
    const rawGap = round1(leftProjection - rightProjection);
    const gap = Math.abs(rawGap);

    return {
      edgeTeamName: rawGap >= 0 ? report.team.name : "League average",
      gap,
      leftProjection,
      position,
      rightProjection,
      summary:
        Math.abs(rawGap) < 0.4
          ? "Near league average"
          : rawGap > 0
            ? `+${gap.toFixed(1)} vs league`
            : `${gap.toFixed(1)} under league`,
    };
  });
}

function fantasyTeamPositionProjection(
  report: FantasyTeamReport,
  position: FantasyPosition,
) {
  return round1(
    sum(
      report.players
        .filter((player) => normalizeScoutingPosition(player.position) === position)
        .map((player) => player.contextProjection.projection),
    ),
  );
}

function fantasyLeagueBenchScore(report: FantasyTeamReport) {
  const benchProjection = average(
    report.benchPlayers
      .slice(0, 6)
      .map((player) => player.contextProjection.projection),
  );
  const playableBench = report.benchPlayers.filter(
    (player) => player.contextProjection.projection >= 7.5,
  ).length;

  return clampMeter(Math.round(benchProjection * 5.2 + playableBench * 5));
}

function fantasyLeagueInjurySensitivity(report: FantasyTeamReport) {
  const starterHealth = average(report.players.map((player) => player.health));
  const roleSecurity = average(
    report.players.map((player) => player.roleSecurity ?? player.health),
  );

  return clampMeter(
    Math.round((100 - starterHealth) * 0.62 + report.risk * 0.24 + (100 - roleSecurity) * 0.3),
  );
}

function fantasyLeagueMatchupFitScore(
  active: FantasyTeamReport,
  opponent: FantasyTeamReport,
) {
  const positionEdge = fantasyPositionEdges(active, opponent).reduce(
    (total, edge) =>
      total +
      (edge.edgeTeamName === active.team.name ? edge.gap : -edge.gap) *
        (edge.position === "QB" ? 0.9 : edge.position === "K" || edge.position === "DST" ? 0.45 : 1),
    0,
  );

  return (
    active.projection -
    opponent.projection +
    (active.floor - opponent.floor) * 0.32 +
    (opponent.risk - active.risk) * 0.08 +
    positionEdge * 0.74
  );
}

function fantasyLeagueUpgradeCopy(
  report: FantasyTeamReport,
  weakestPosition: FantasyPositionEdge,
) {
  const position = scoutingRankLabel(weakestPosition.position);
  const benchHelp = report.benchPlayers.find(
    (player) => normalizeScoutingPosition(player.position) === weakestPosition.position,
  );

  if (benchHelp && benchHelp.contextProjection.projection >= 7) {
    return `Your easiest internal check is ${benchHelp.name}; if news improves, he can patch ${position}.`;
  }

  if (weakestPosition.position === "K" || weakestPosition.position === "DST") {
    return `Stream ${position} by matchup before chasing a bigger trade.`;
  }

  return `Look for a steadier ${position} with role security. You do not need a star; you need usable weekly points.`;
}

function fantasyLeagueWeaknessCopy(
  report: FantasyTeamReport,
  weakestPosition: FantasyPositionEdge,
) {
  const position = scoutingRankLabel(weakestPosition.position);
  const weakestPlayer = report.players
    .filter((player) => normalizeScoutingPosition(player.position) === weakestPosition.position)
    .sort((left, right) => left.contextProjection.projection - right.contextProjection.projection)[0];

  if (weakestPlayer) {
    return `${position} is the lane to watch. ${weakestPlayer.name} is carrying ${weakestPlayer.contextProjection.projection.toFixed(1)} projected points, so one small role dip can hurt.`;
  }

  return `${position} is thin compared with the league. Add a playable option before the next tight matchup.`;
}

function fantasyLeagueTeamRecommendation(
  report: FantasyTeamReport,
  weakestPosition: FantasyPositionEdge,
  lens: FantasyTeamLens,
) {
  const position = scoutingRankLabel(weakestPosition.position);

  if (lens === "dynasty" && report.dynastyCore < 64) {
    return `Do not spend future value to solve everything at once. Start by adding a younger ${position} with a real role.`;
  }

  if (report.risk >= 62) {
    return `Your ceiling is fine, but the room is swingy. Fix ${position} with floor, not another boom-bust player.`;
  }

  return `This roster is workable. The cleanest move is a small ${position} upgrade that protects your weekly floor.`;
}

function fantasyLeaguePowerRecommendation({
  active,
  badMatchup,
  bestMatchup,
  lens,
  teamCount,
}: {
  active: FantasyLeaguePowerTeam;
  badMatchup: FantasyLeaguePowerTeam;
  bestMatchup: FantasyLeaguePowerTeam;
  lens: FantasyTeamLens;
  teamCount: number;
}) {
  if (active.rank <= 3) {
    return `${active.report.team.name} profiles like a contender. Do not force a big trade; protect ${scoutingRankLabel(active.weakestPosition.position)} and plan carefully for ${badMatchup.report.team.name}.`;
  }

  if (active.rank > Math.ceil(teamCount / 2) && lens === "dynasty") {
    return `${active.report.team.name} needs a dynasty-friendly reset: keep the core, patch ${scoutingRankLabel(active.weakestPosition.position)}, and target managers like ${bestMatchup.report.team.name} where your strengths travel.`;
  }

  return `${active.report.team.name} is in the chase tier. You match up best with ${bestMatchup.report.team.name}; the dangerous room is ${badMatchup.report.team.name}, so fix ${scoutingRankLabel(active.weakestPosition.position)} before that week.`;
}

function fantasyPositionEdges(
  leftReport: FantasyTeamReport,
  rightReport: FantasyTeamReport,
): FantasyPositionEdge[] {
  return fantasyCoveragePositions.map((position) => {
    const leftProjection = round1(
      sum(
        leftReport.players
          .filter((player) => normalizeScoutingPosition(player.position) === position)
          .map((player) => player.contextProjection.projection),
      ),
    );
    const rightProjection = round1(
      sum(
        rightReport.players
          .filter((player) => normalizeScoutingPosition(player.position) === position)
          .map((player) => player.contextProjection.projection),
      ),
    );
    const rawGap = round1(leftProjection - rightProjection);
    const edgeTeamName = rawGap >= 0 ? leftReport.team.name : rightReport.team.name;
    const gap = Math.abs(rawGap);
    const summary =
      gap < 0.5 ? "Even" : `${edgeTeamName} +${gap.toFixed(1)}`;

    return {
      edgeTeamName,
      gap,
      leftProjection,
      position,
      rightProjection,
      summary,
    };
  });
}

function fantasyMatchupPlanPositions(
  leftReport: FantasyTeamReport,
  rightReport: FantasyTeamReport,
  positionEdges: FantasyPositionEdge[],
): FantasyMatchupPlanPosition[] {
  return positionEdges.map((edge) => ({
    myDepth: fantasyPositionDepth(leftReport, edge.position),
    myProjection: edge.leftProjection,
    myRisk: fantasyPositionRisk(leftReport, edge.position),
    myRoleSecurity: fantasyPositionRoleSecurity(leftReport, edge.position),
    opponentDepth: fantasyPositionDepth(rightReport, edge.position),
    opponentProjection: edge.rightProjection,
    opponentRisk: fantasyPositionRisk(rightReport, edge.position),
    opponentRoleSecurity: fantasyPositionRoleSecurity(rightReport, edge.position),
    position: edge.position,
  }));
}

function fantasyPlanPlayers(players: ScoutingRow[]): FantasyMatchupPlanPlayer[] {
  return players.map((player) => ({
    ceiling: player.contextProjection.ceiling,
    dynastyValue: player.dynastyValue,
    floor: player.contextProjection.floor,
    name: player.name,
    position: normalizeScoutingPosition(player.position),
    projection: player.contextProjection.projection,
    risk: player.chaos,
    roleSecurity: player.roleSecurity ?? player.health,
  }));
}

function fantasyPositionPlayers(report: FantasyTeamReport, position: FantasyPosition) {
  return report.players.filter(
    (player) => normalizeScoutingPosition(player.position) === position,
  );
}

function fantasyPositionDepth(report: FantasyTeamReport, position: FantasyPosition) {
  return fantasyPositionPlayers(report, position).length;
}

function fantasyPositionRisk(report: FantasyTeamReport, position: FantasyPosition) {
  const players = fantasyPositionPlayers(report, position);

  return players.length > 0 ? average(players.map((player) => player.chaos)) : report.risk;
}

function fantasyPositionRoleSecurity(
  report: FantasyTeamReport,
  position: FantasyPosition,
) {
  const players = fantasyPositionPlayers(report, position);

  return players.length > 0
    ? average(players.map((player) => player.roleSecurity ?? player.health))
    : 72;
}

function fantasyStrengths(
  roster: ScoutingRow[],
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
) {
  const top = roster[0];
  const receivingFloor = average(
    roster.map((player) => player.baseline.receptions + player.targetShare / 12),
  );
  const rushingControl = average(roster.map((player) => player.carryShare));
  const health = average(roster.map((player) => player.health));
  const roleSecurity = average(
    roster.map((player) => player.roleSecurity ?? player.health),
  );

  return [
    `${top.name} is the lineup anchor at ${top.contextProjection.projection.toFixed(1)} context-adjusted points.`,
    receivingFloor >= 6 && scoringFormat !== "standard"
      ? "Your catch volume gives you a useful PPR safety net."
      : rushingControl >= 22
        ? "Your touch volume gives this roster a sturdy weekly base."
        : "Your top players have enough ceiling to keep you live in a tight matchup.",
    lens === "dynasty" && teamDynastyCore(roster) >= 74
      ? "The dynasty core has enough long-term value and role security to build around."
      : roleSecurity >= 78
        ? "Roles look steady, which makes your weekly decisions easier."
      : "The roster has a clear shape, which makes the next move easier to spot.",
  ];
}

function fantasyWeaknesses(
  roster: ScoutingRow[],
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
  balance: number,
  depth: number,
  risk: number,
) {
  const positionCounts = countPositions(roster);
  const weakSpots: string[] = [];

  if (!positionCounts.WR && scoringFormat !== "standard") {
    weakSpots.push("In PPR, you need more reliable target volume from WR or TE.");
  }

  if (!positionCounts.RB) {
    weakSpots.push("RB depth is thin, so one injury or committee change can hurt quickly.");
  }

  if (balance < 62) {
    weakSpots.push("The roster leans too hard into one position group.");
  }

  if (depth < 62) {
    weakSpots.push("The bench needs one more player you can actually start in a normal week.");
  }

  if (risk > 58) {
    weakSpots.push("There is a lot of weekly volatility, so protect your floor in close calls.");
  }

  if (average(roster.map((player) => player.roleSecurity ?? 72)) < 68) {
    weakSpots.push("A few roles are shaky, so check late news before locking the lineup.");
  }

  if (lens === "dynasty" && teamDynastyCore(roster) < 62) {
    weakSpots.push("For dynasty, add a younger player with a stable role before chasing pure upside.");
  }

  return weakSpots.slice(0, 3);
}

function fantasyMoves(
  roster: ScoutingRow[],
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
) {
  const positionCounts = countPositions(roster);
  const moves: string[] = [];
  const highChaos = [...roster].sort((left, right) => right.chaos - left.chaos)[0];
  const bestFloor = [...roster].sort(
    (left, right) => right.contextProjection.floor - left.contextProjection.floor,
  )[0];

  if ((positionCounts.QB ?? 0) > 1) {
    moves.push("If another manager needs a QB, use that surplus to ask for WR or RB depth.");
  }

  if (scoringFormat !== "standard") {
    moves.push("Prioritize target earners. A quiet 7-catch player fixes more than people think.");
  } else {
    moves.push("In standard scoring, prioritize touchdown roles and early-down work first.");
  }

  if (highChaos.chaos > 55) {
    moves.push(`When you start ${highChaos.name}, balance him with a steadier floor play elsewhere.`);
  } else {
    moves.push(`${bestFloor.name} is the kind of stabilizer you want in tight matchups.`);
  }

  if (lens === "dynasty") {
    moves.push("In dynasty, only trade away role growth if the return fixes more than one problem.");
  }

  return moves.slice(0, 4);
}

function fantasyBenchUpgrades(starters: ScoutingRow[], benchPlayers: ScoutingRow[]) {
  if (benchPlayers.length === 0) {
    return ["Import the full roster to get real bench swap advice."];
  }

  const weakestStarter = [...starters].sort(
    (left, right) => left.contextProjection.projection - right.contextProjection.projection,
  )[0];
  const bestBench = [...benchPlayers].sort(
    (left, right) => right.contextProjection.projection - left.contextProjection.projection,
  )[0];
  const samePositionBench = benchPlayers
    .filter((player) => player.position === weakestStarter.position)
    .sort((left, right) => right.contextProjection.floor - left.contextProjection.floor)[0];
  const ideas: string[] = [];

  if (bestBench.contextProjection.projection > weakestStarter.contextProjection.projection + 1.5) {
    ideas.push(
      `${bestBench.name} should be in the lineup over ${weakestStarter.name} if the news holds.`,
    );
  } else {
    ideas.push(
      `${bestBench.name} is the first bench name to review, but the starters still project better.`,
    );
  }

  if (
    samePositionBench &&
    samePositionBench.id !== bestBench.id &&
    samePositionBench.contextProjection.floor > weakestStarter.contextProjection.floor
  ) {
    ideas.push(
      `${samePositionBench.name} is the safer ${samePositionBench.position} option if you want less volatility.`,
    );
  }

  return ideas.slice(0, 2);
}

function fantasyTradeIdeas({
  allPlayers,
  lens,
  roster,
  scoringFormat,
}: {
  allPlayers: ScoutingRow[];
  lens: FantasyTeamLens;
  roster: ScoutingRow[];
  scoringFormat: ScoringFormat;
}) {
  const rosterIds = new Set(roster.map((player) => player.id));
  const needs = rosterNeeds(roster, scoringFormat, lens);
  const candidates = allPlayers
    .filter((player) => !rosterIds.has(player.id))
    .sort(
      (left, right) =>
        tradeFitScore(right, needs, lens, scoringFormat) -
        tradeFitScore(left, needs, lens, scoringFormat),
    )
    .slice(0, 2);

  if (candidates.length === 0) {
    return ["Hold the core for now. The next improvement is bench flexibility, not a splashy trade."];
  }

  return candidates.map((player) => {
    const reason =
      lens === "dynasty" && (player.dynastyValue ?? 0) >= 78
        ? "dynasty value"
        : player.position === "WR" && scoringFormat !== "standard"
        ? "target volume"
        : player.position === "RB"
          ? "touch stability"
          : player.position === "QB"
            ? "weekly ceiling"
            : "lineup flexibility";

    return `Ask about ${player.name} if the price is reasonable. The fit is ${reason}, which matches your current need.`;
  });
}

function teamAdviceSummary(report: FantasyTeamReport, lens: FantasyTeamLens) {
  const grade = fantasyTrustBand(report.score);
  const pressure = fantasyPrimaryPressure(report);

  if (lens === "dynasty") {
    return `${report.team.name} looks ${grade.toLowerCase()} with a ${report.dynastyCore}% dynasty core. The smart move is adding durable role growth while protecting this week's usable starters.`;
  }

  return `${report.team.name} looks ${grade.toLowerCase()} this week. The cleanest path is simple: protect the floor, keep one real ceiling play, and watch ${pressure.label.toLowerCase()} before kickoff.`;
}

function fantasySwingFactors(
  leftReport: FantasyTeamReport,
  rightReport: FantasyTeamReport,
) {
  const factors = [
    Math.abs(leftReport.ceiling - rightReport.ceiling) >= 4
      ? `${leftReport.ceiling > rightReport.ceiling ? leftReport.team.name : rightReport.team.name} has the better ceiling if the matchup gets weird.`
      : "Ceiling is close, so floor choices matter more.",
    Math.abs(leftReport.risk - rightReport.risk) >= 8
      ? `${leftReport.risk > rightReport.risk ? leftReport.team.name : rightReport.team.name} has the shakier weekly profile.`
      : "Risk profile is fairly even.",
    Math.abs(leftReport.depth - rightReport.depth) >= 8
      ? `${leftReport.depth > rightReport.depth ? leftReport.team.name : rightReport.team.name} has the deeper bench.`
      : "Depth is close enough that one waiver-style move can matter.",
  ];

  return factors;
}

function rosterNeeds(
  roster: ScoutingRow[],
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
) {
  const counts = countPositions(roster);
  const needs = new Set<string>();

  if (!counts.RB) {
    needs.add("RB");
  }

  if (!counts.WR || (scoringFormat !== "standard" && counts.WR < 2)) {
    needs.add("WR");
  }

  if (lens === "dynasty") {
    needs.add("core");
  }

  if (teamRisk(roster) > 58) {
    needs.add("floor");
  }

  return needs;
}

function tradeFitScore(
  player: ScoutingRow,
  needs: Set<string>,
  lens: FantasyTeamLens,
  scoringFormat: ScoringFormat,
) {
  let score = player.score;

  if (needs.has(player.position)) {
    score += 18;
  }

  if (needs.has("floor")) {
    score += player.contextProjection.floor * 1.2 - player.chaos * 0.2;
  }

  if (needs.has("core") || lens === "dynasty") {
    score +=
      (player.dynastyValue ?? player.health) * 0.24 +
      (player.roleSecurity ?? 72) * 0.12 +
      (100 - player.nflRank) * 0.06;
  }

  if (scoringFormat !== "standard") {
    score += player.baseline.receptions * 1.4 + player.targetShare * 0.08;
  }

  return score;
}

function teamBalance(roster: ScoutingRow[]) {
  const counts = countPositions(roster);
  const uniquePositions = Object.keys(counts).length;
  const hasSkillSpread = Number(Boolean(counts.RB)) + Number(Boolean(counts.WR));

  return clampMeter(44 + uniquePositions * 12 + hasSkillSpread * 10);
}

function teamDepth(roster: ScoutingRow[]) {
  const playable = roster.filter(
    (player) =>
      player.contextProjection.projection >= 12 || (player.roleSecurity ?? 0) >= 74,
  ).length;
  const roleSecurity = average(
    roster.map((player) => player.roleSecurity ?? player.health),
  );

  return clampMeter(34 + Math.min(roster.length, 18) * 4 + playable * 5 + roleSecurity * 0.18);
}

function teamRisk(roster: ScoutingRow[]) {
  const chaos = average(roster.map((player) => player.chaos));
  const healthDrag = 100 - average(roster.map((player) => player.health));
  const roleDrag = 100 - average(roster.map((player) => player.roleSecurity ?? 74));
  const touchdownDependence = average(
    roster.map((player) => player.touchdownPulse - player.targetShare / 2),
  );

  return clampMeter(
    Math.round(
      chaos * 0.46 + healthDrag * 0.24 + roleDrag * 0.18 + touchdownDependence * 0.12,
    ),
  );
}

function teamDynastyCore(roster: ScoutingRow[]) {
  return clampMeter(
    Math.round(
      average(
        roster.map(
          (player) =>
            (player.dynastyValue ?? player.health) * 0.5 +
            (player.roleSecurity ?? player.health) * 0.2 +
            player.health * 0.12 +
            (100 - player.nflRank) * 0.1 +
            (100 - player.chaos) * 0.08,
        ),
      ),
    ),
  );
}

function countPositions(roster: ScoutingRow[]) {
  return roster.reduce<Record<string, number>>((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;

    return counts;
  }, {});
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

function compareFantasyPlayers(
  left: FantasyPlayer,
  right: FantasyPlayer,
  scoringFormat: ScoringFormat,
) {
  const leftScore = fantasyScore(
    left,
    scoringFormat,
    fantasyProjectionForDisplay(left, scoringFormat),
    isScoutingRow(left) ? left.context : undefined,
  );
  const rightScore = fantasyScore(
    right,
    scoringFormat,
    fantasyProjectionForDisplay(right, scoringFormat),
    isScoutingRow(right) ? right.context : undefined,
  );
  const winner = leftScore >= rightScore ? left : right;
  const loser = winner.id === left.id ? right : left;
  const margin = Math.abs(leftScore - rightScore);

  return {
    id: winner.id,
    name: winner.name,
    verdict:
      margin < 5
        ? `Start ${winner.name} if you need a lean, but this is close. Check injury and weather news before locking it.`
        : `Start ${winner.name}. He has the better mix of floor, ceiling, and matchup stability than ${loser.name}.`,
  };
}

function filterScoutingRows({
  depth,
  mode,
  position,
  rosteredIds,
  rows,
  weakestPosition,
}: {
  depth: ScoutingDepth;
  mode: ScoutingBoardMode;
  position: ScoutingPosition;
  rosteredIds: Set<string>;
  rows: ScoutingRow[];
  weakestPosition: ScoutingPlayerPosition;
}) {
  const depthOption =
    scoutingDepthOptions.find((option) => option.value === depth) ??
    scoutingDepthOptions[0];
  const modeRows = scoutingRowsForMode(rows, mode, rosteredIds, weakestPosition);
  const laneRows =
    position === "ALL"
      ? modeRows
      : modeRows.filter(
          (row) => normalizeScoutingPosition(row.position) === position,
        );

  return laneRows.slice(0, depthOption.limit);
}

function scoutingRowsForMode(
  rows: ScoutingRow[],
  mode: ScoutingBoardMode,
  rosteredIds: Set<string>,
  weakestPosition: ScoutingPlayerPosition,
) {
  const availableRows =
    rosteredIds.size > 0 ? rows.filter((row) => !rosteredIds.has(row.id)) : rows;

  if (mode === "available") {
    return availableRows;
  }

  if (mode === "topPicks") {
    return [...availableRows].sort(
      (left, right) =>
        fantasyPickupScore(right, weakestPosition) -
          fantasyPickupScore(left, weakestPosition) ||
        right.contextProjection.floor - left.contextProjection.floor,
    );
  }

  if (mode === "ultraDeep") {
    const deepRows = availableRows.filter((player) => fantasyUltraDeepCandidate(player));
    const candidates = deepRows.length > 0 ? deepRows : availableRows;

    return [...candidates].sort(
      (left, right) =>
        fantasyUltraDeepScore(right, weakestPosition) -
          fantasyUltraDeepScore(left, weakestPosition) ||
        (right.dynastyValue ?? right.health) - (left.dynastyValue ?? left.health),
    );
  }

  return rows;
}

function fantasyPickupScore(
  player: ScoutingRow,
  weakestPosition: ScoutingPlayerPosition,
) {
  const position = normalizeScoutingPosition(player.position);
  const needBoost = position === weakestPosition ? 5.5 : 0;

  return (
    player.contextProjection.projection * 1.45 +
    player.contextProjection.floor * 0.64 +
    player.contextProjection.ceiling * 0.22 +
    (player.roleSecurity ?? player.health) * 0.08 +
    player.matchup * 0.045 -
    player.chaos * 0.055 +
    needBoost
  );
}

function fantasyUltraDeepCandidate(player: ScoutingRow) {
  const upsideGap =
    player.contextProjection.ceiling - player.contextProjection.projection;

  return (
    player.depthTier === "stash" ||
    player.depthTier === "streamer" ||
    player.depthTier === "rotation" ||
    (player.dynastyValue ?? 0) >= 68 ||
    upsideGap >= 7 ||
    player.roleSecurity === undefined ||
    player.contextProjection.projection <= 9
  );
}

function fantasyUltraDeepScore(
  player: ScoutingRow,
  weakestPosition: ScoutingPlayerPosition,
) {
  const position = normalizeScoutingPosition(player.position);
  const upsideGap =
    player.contextProjection.ceiling - player.contextProjection.projection;
  const needBoost = position === weakestPosition ? 3 : 0;

  return (
    (player.dynastyValue ?? player.health) * 0.34 +
    upsideGap * 1.2 +
    player.contextProjection.projection * 0.45 +
    (player.roleSecurity ?? 62) * 0.08 -
    player.chaos * 0.03 +
    needBoost
  );
}

function buildDeepResearchRows({
  rosteredIds,
  rows,
  teamLens,
  weakestPosition,
}: {
  rosteredIds: Set<string>;
  rows: ScoutingRow[];
  teamLens: FantasyTeamLens;
  weakestPosition: ScoutingPlayerPosition;
}): FantasyDeepResearchRow[] {
  const availableRows =
    rosteredIds.size > 0 ? rows.filter((row) => !rosteredIds.has(row.id)) : rows;
  const deepPool = availableRows.filter(
    (player) =>
      fantasyUltraDeepCandidate(player) ||
      normalizeScoutingPosition(player.position) === weakestPosition,
  );
  const candidates = deepPool.length >= 4 ? deepPool : availableRows;

  return [...candidates]
    .map((player) => {
      const available = rosteredIds.size === 0 || !rosteredIds.has(player.id);
      const score = fantasyDeepResearchScore({
        available,
        player,
        teamLens,
        weakestPosition,
      });

      return {
        action: fantasyDeepResearchAction({
          available,
          player,
          teamLens,
          weakestPosition,
        }),
        available,
        fit: fantasyDeepResearchFit(player),
        player,
        reason: fantasyDeepResearchReason({
          player,
          teamLens,
          weakestPosition,
        }),
        risk: fantasyDeepResearchRisk(player),
        score,
        tags: fantasyDeepResearchTags({
          available,
          player,
          teamLens,
          weakestPosition,
        }),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

function fantasyDeepResearchScore({
  available,
  player,
  teamLens,
  weakestPosition,
}: {
  available: boolean;
  player: ScoutingRow;
  teamLens: FantasyTeamLens;
  weakestPosition: ScoutingPlayerPosition;
}) {
  const position = normalizeScoutingPosition(player.position);
  const upsideGap =
    player.contextProjection.ceiling - player.contextProjection.projection;
  const dynastyValue = player.dynastyValue ?? player.health;
  const roleSecurity = player.roleSecurity ?? player.health;
  const needBoost = position === weakestPosition ? 7 : 0;
  const availabilityBoost = available ? 11 : -6;
  const dynastyBoost =
    teamLens === "dynasty" ? dynastyValue * 0.32 : dynastyValue * 0.12;

  return (
    player.contextProjection.projection * 1.05 +
    player.contextProjection.floor * 0.38 +
    upsideGap * 1.28 +
    roleSecurity * 0.1 +
    dynastyBoost +
    needBoost +
    availabilityBoost -
    player.chaos * 0.04
  );
}

function fantasyDeepResearchAction({
  available,
  player,
  teamLens,
  weakestPosition,
}: {
  available: boolean;
  player: ScoutingRow;
  teamLens: FantasyTeamLens;
  weakestPosition: ScoutingPlayerPosition;
}) {
  const position = normalizeScoutingPosition(player.position);
  const dynastyValue = player.dynastyValue ?? player.health;
  const projection = player.contextProjection.projection;

  if (!available) {
    return "Trade-watch only";
  }

  if (position === weakestPosition && projection >= 9) {
    return `Shortlist as ${scoutingRankLabel(position)} help`;
  }

  if (teamLens === "dynasty" && dynastyValue >= 74) {
    return "Dynasty stash watch";
  }

  if (projection >= 12) {
    return "Waiver shortlist";
  }

  if (fantasyUltraDeepCandidate(player)) {
    return "Deep bench stash";
  }

  return "Watchlist only";
}

function fantasyDeepResearchReason({
  player,
  teamLens,
  weakestPosition,
}: {
  player: ScoutingRow;
  teamLens: FantasyTeamLens;
  weakestPosition: ScoutingPlayerPosition;
}) {
  const position = normalizeScoutingPosition(player.position);
  const upsideGap =
    player.contextProjection.ceiling - player.contextProjection.projection;
  const roleSecurity = player.roleSecurity ?? player.health;

  if (position === weakestPosition) {
    return `Your roster needs ${scoutingRankLabel(position)} help, and this profile has enough role or matchup signal to be worth a closer look.`;
  }

  if (teamLens === "dynasty" && (player.dynastyValue ?? 0) >= 74) {
    return "The weekly number is not the whole story. Future value, role growth, and bench patience make this worth tracking.";
  }

  if (upsideGap >= 7) {
    return "The ceiling is meaningfully higher than the median projection, which is exactly where deep benches can create value.";
  }

  if (roleSecurity >= 76) {
    return "The role looks steady enough that this is more than a random name at the bottom of a list.";
  }

  return "This is a small-edge player: useful when injuries, bye weeks, or late news open the door.";
}

function fantasyDeepResearchRisk(player: ScoutingRow) {
  const roleSecurity = player.roleSecurity ?? player.health;

  if (player.health < 70) {
    return "Risk: health needs a clean news check before you spend a real roster spot.";
  }

  if (roleSecurity < 66) {
    return "Risk: role is still fragile, so this is a watchlist move before it is a lineup move.";
  }

  if (player.chaos >= 68) {
    return "Risk: wide weekly range. Good stash, but do not force him into a tight lineup.";
  }

  return "Risk: normal deep-league uncertainty. Price matters more than hype.";
}

function fantasyDeepResearchFit(player: ScoutingRow) {
  const roleSecurity = player.roleSecurity ?? player.health;

  if (roleSecurity >= 82) {
    return "Stable";
  }

  if ((player.dynastyValue ?? 0) >= 76) {
    return "Future";
  }

  if (player.contextProjection.ceiling - player.contextProjection.projection >= 7) {
    return "Upside";
  }

  if (player.contextProjection.projection >= 11) {
    return "Playable";
  }

  return "Stash";
}

function fantasyDeepResearchTags({
  available,
  player,
  teamLens,
  weakestPosition,
}: {
  available: boolean;
  player: ScoutingRow;
  teamLens: FantasyTeamLens;
  weakestPosition: ScoutingPlayerPosition;
}) {
  const position = normalizeScoutingPosition(player.position);
  const tags = [
    available ? "Available pool" : "Rostered elsewhere",
    position === weakestPosition ? `${scoutingRankLabel(position)} need` : null,
    teamLens === "dynasty" ? `Dynasty ${player.dynastyValue ?? player.health}` : null,
    player.depthTier ? formatDepthTier(player.depthTier) : null,
    `${fantasyDeepResearchFit(player)} fit`,
  ];

  return tags.filter((tag): tag is string => Boolean(tag)).slice(0, 4);
}

function buildFantasyWeeklyCoach({
  matchupReport,
  report,
  scoringFormat,
  teamLens,
}: {
  matchupReport: FantasyMatchupReport;
  report: FantasyTeamReport;
  scoringFormat: ScoringFormat;
  teamLens: FantasyTeamLens;
}): FantasyWeeklyCoachRead {
  const pressure = fantasyPrimaryPressure(report);
  const action = buildFantasyActionQueue({ matchupReport, report })[0];
  const bestMove: FantasyCoachMove = {
    call: action
      ? `${action.state}: ${action.playerName ?? action.label}`
      : `Start from ${report.strongestLane.label}`,
    confidence: action?.confidence ?? fantasyBandFromPercent(matchupReport.confidence),
    edge: action?.edge ?? `${report.projection.toFixed(1)} projected points`,
    fallback: action?.fallback ?? "Reconnect the roster before making a close call.",
    playerName: action?.playerName,
    risk: action?.risk ?? pressure.summary,
    state: action?.state ?? "Start now",
    tone: action?.kind ?? "start",
    why: action?.why ?? report.strongestLane.summary,
  };

  return {
    bestMove,
    pressure,
    receipts: [
      `${scoringLabels[scoringFormat]} · ${teamLensLabels[teamLens]} settings are active.`,
      `Team range: ${report.floor.toFixed(1)}-${report.ceiling.toFixed(1)} points.`,
      `Source vs Seer: ${formatFantasyDelta(report.lineupSeerDelta)} after context.`,
      `Pressure watch: ${pressure.summary}`,
    ],
    rosterMap: buildFantasyRosterMap(report),
  };
}

function fantasyPrimaryPressure(report: FantasyTeamReport): FantasyPressureLane {
  const weakest = report.weakestLane;
  const closeCall = report.closeCalls[0];
  const benchLift = report.benchAlternatives.find((alternative) => alternative.lift >= 0);

  if (closeCall) {
    return {
      label: "Lineup coin flip",
      positionLabel: closeCall.slotLabel,
      priority: "Re-check before kickoff",
      summary: closeCall.summary,
    };
  }

  if (benchLift) {
    return {
      label: "Bench pressure",
      positionLabel: benchLift.slotLabel,
      priority: "Conditional start",
      summary: benchLift.summary,
    };
  }

  if (report.risk >= 64) {
    return {
      label: "Volatility control",
      positionLabel: "Lineup",
      priority: "Risk alert",
      summary:
        "The lineup has enough weekly variance that role news matters more than chasing upside.",
    };
  }

  if (report.depth < 64) {
    return {
      label: "Bench depth",
      positionLabel: "Bench",
      priority: "Waiver/trade idea",
      summary:
        "Your starters can compete, but the bench needs one more playable role before bye weeks or injuries bite.",
    };
  }

  if (weakest.position === "K" || weakest.position === "DST") {
    return {
      label: "Streamable spot",
      positionLabel: weakest.position,
      priority: "Do not overpay",
      summary:
        "Kicker and defense can be streamed. Treat this as a small weekly tune-up, not the main roster problem.",
    };
  }

  return {
    label: weakest.label,
    positionLabel: scoutingRankLabel(weakest.position),
    priority: "Waiver/trade idea",
    summary: weakest.summary,
  };
}

function buildFantasyRosterMap(report: FantasyTeamReport): FantasyRosterMapItem[] {
  const positionCards: Array<{ label: string; position: FantasyPosition }> = [
    { label: "QB", position: "QB" },
    { label: "RB", position: "RB" },
    { label: "WR", position: "WR" },
    { label: "TE", position: "TE" },
    { label: "K", position: "K" },
    { label: "DST", position: "DST" },
  ];
  const cards = positionCards.map(({ label, position }) => {
    const value = fantasyTeamPositionProjection(report, position);
    const band = fantasyPositionBand(position, value);

    return {
      band,
      detail:
        position === "K" || position === "DST"
          ? `${value.toFixed(1)} pts · stream weekly`
          : `${value.toFixed(1)} projected pts`,
      label,
      tone: fantasyBandTone(band),
    };
  });
  const flexPool = report.players
    .filter((player) => ["RB", "WR", "TE"].includes(normalizeScoutingPosition(player.position)))
    .sort(
      (left, right) =>
        right.contextProjection.projection - left.contextProjection.projection,
    );
  const flexValue = round1(average(flexPool.slice(2, 5).map((player) => player.contextProjection.projection)));
  const flexBand =
    report.closeCalls.length > 0
      ? "Competitive"
      : flexValue >= 14
        ? "Strong"
        : flexValue >= 9
          ? "Competitive"
          : "Needs work";
  const benchBand = fantasyTrustBand(report.depth);

  return [
    ...cards.slice(0, 4),
    {
      band: flexBand,
      detail:
        report.closeCalls.length > 0
          ? "Close call needs one news check"
          : `${flexValue.toFixed(1)} flexible pts`,
      label: "FLEX",
      tone: fantasyBandTone(flexBand),
    },
    ...cards.slice(4),
    {
      band: benchBand,
      detail: `${report.benchPlayers.length} bench players · ${report.depth}% depth`,
      label: "Bench",
      tone: fantasyBandTone(benchBand),
    },
  ];
}

function fantasyPositionBand(position: FantasyPosition, value: number) {
  const benchmarks: Record<FantasyPosition, [number, number, number]> = {
    QB: [24, 19, 15],
    RB: [32, 24, 16],
    WR: [36, 26, 18],
    TE: [17, 12, 8],
    K: [10, 8, 6],
    DST: [10, 8, 6],
  };
  const [elite, strong, competitive] = benchmarks[position];

  if (value >= elite) {
    return "Elite";
  }

  if (value >= strong) {
    return "Strong";
  }

  if (value >= competitive) {
    return "Competitive";
  }

  return "Needs work";
}

function fantasyTrustBand(value: number) {
  if (value >= 86) {
    return "Elite";
  }

  if (value >= 74) {
    return "Strong";
  }

  if (value >= 58) {
    return "Competitive";
  }

  return "Needs work";
}

function fantasyBandTone(band: string): FantasyRosterMapItem["tone"] {
  if (band === "Elite" || band === "Strong") {
    return "strong";
  }

  if (band === "Competitive") {
    return "steady";
  }

  return "watch";
}

function fantasyBandFromPercent(value: number) {
  if (value >= 72) {
    return "High";
  }

  if (value >= 62) {
    return "Medium-high";
  }

  if (value >= 52) {
    return "Medium";
  }

  return "Low";
}

function fantasyDecisionConfidence(player: ScoutingRow, modelConfidence: number) {
  const roleSecurity = player.roleSecurity ?? player.health;
  const adjusted = clampMeter(
    Math.round(modelConfidence - Math.max(0, 72 - player.health) * 0.18 - Math.max(0, 68 - roleSecurity) * 0.16 - Math.max(0, player.chaos - 62) * 0.14),
  );

  return fantasyBandFromPercent(adjusted);
}

function fantasyReceiptWhy(receipt: FantasyDecisionReceipt) {
  return (
    receipt.adjustmentReceipts[0]?.summary ??
    receipt.tags[0] ??
    "The adjusted projection and role profile both support the call."
  );
}

function fantasyPlayerRiskText(player: ScoutingRow) {
  const roleSecurity = player.roleSecurity ?? player.health;

  if (player.health < 70) {
    return "Health is the first check before kickoff.";
  }

  if (roleSecurity < 66) {
    return "Role is not fully locked, so watch beat reports and inactive news.";
  }

  if (player.chaos >= 68) {
    return "High-variance profile. Great for ceiling, shakier for floor.";
  }

  if (player.context.weather.includes("snow") || player.context.weather.includes("wind")) {
    return "Weather can trim efficiency, especially on deeper plays and kicks.";
  }

  return "Normal weekly risk. Do not over-manage it unless news changes.";
}

function buildFantasyHeroRead({
  analysis,
  matchupReport,
  report,
  scoringFormat,
  teamLens,
}: {
  analysis: NflScoutingAnalysis | null;
  matchupReport: FantasyMatchupReport;
  report: FantasyTeamReport;
  scoringFormat: ScoringFormat;
  teamLens: FantasyTeamLens;
}): NflScoutingAnalysis {
  if (analysis) {
    return analysis;
  }

  const strongestEdge = matchupReport.strongestEdge;
  const pressure = fantasyPrimaryPressure(report);
  const watchlist =
    report.closeCalls[0]?.summary ??
    report.benchAlternatives[0]?.summary ??
    "Watch late injury news, weather movement, and role updates before lineup lock.";

  return {
    headline: `${report.team.name}: start from the steady roles, then watch ${pressure.label}.`,
    summary: `${scoringLabels[scoringFormat]} · ${teamLensLabels[teamLens]}. ${matchupReport.recommendation}`,
    factors: [
      `Trust the strength: ${report.strongestLane.summary}`,
      `Fix first: ${pressure.summary}`,
      strongestEdge
        ? `Matchup edge: ${scoutingRankLabel(strongestEdge.position)} is ${strongestEdge.summary}.`
        : "Matchup edges are still settling.",
    ],
    watchlist,
    disclaimer: fantasySeerShortDisclaimer,
    source: "seer",
  };
}

function buildFantasyActionQueue({
  matchupReport,
  report,
}: {
  matchupReport: FantasyMatchupReport;
  report: FantasyTeamReport;
}): FantasyActionItem[] {
  const pressure = fantasyPrimaryPressure(report);
  const topStart =
    [...report.startSitReceipts]
      .filter((receipt) => receipt.label.startsWith("Start "))
      .sort((left, right) => right.seerProjection - left.seerProjection)[0] ??
    report.startSitReceipts[0];
  const closeCall = report.closeCalls[0];
  const topStartCloseCall =
    topStart && closeCall && fantasyDecisionSlotLabel(topStart.label) === closeCall.slotLabel
      ? closeCall
      : null;
  const benchSwap =
    report.benchAlternatives.find((alternative) => alternative.lift >= 0) ??
    report.benchAlternatives[0];
  const marketIdea =
    report.tradeIdeas[0] ??
    report.benchUpgrades[0] ??
    report.moves[0] ??
    `Use waivers or a small trade to patch ${report.weakestLane.label}.`;
  const actions: FantasyActionItem[] = [];

  actions.push(
    topStart
      ? {
          detail: topStart.summary,
          confidence: fantasyDecisionConfidence(topStart.player, matchupReport.confidence),
          edge: `${topStart.seerProjection.toFixed(1)} pts · ${formatFantasyDelta(
            topStart.delta,
          )} vs source`,
          fallback: topStartCloseCall
            ? `If late news changes the ${topStartCloseCall.slotLabel} room, re-check ${topStartCloseCall.starter.name} vs ${topStartCloseCall.challenger.name}.`
            : `Keep ${topStart.player.name} in unless injury, weather, or role news changes the workload.`,
          kind: "start",
          label: topStart.label,
          meta: `${topStart.seerProjection.toFixed(1)} pts · ${formatFantasyDelta(
            topStart.delta,
          )} vs source`,
          playerName: topStart.player.name,
          risk: fantasyPlayerRiskText(topStart.player),
          state:
            topStart.player.health < 74 || topStart.player.chaos > 64
              ? "Conditional start"
              : "Start now",
          strength: "high",
          title: "Start with confidence",
          why: fantasyReceiptWhy(topStart),
        }
      : {
          detail: report.strongestLane.summary,
          confidence: fantasyBandFromPercent(matchupReport.confidence),
          edge: `${report.projection.toFixed(1)} projected team points`,
          fallback: "If your imported roster is incomplete, connect Sleeper before locking this in.",
          kind: "start",
          label: report.strongestLane.label,
          meta: `${report.projection.toFixed(1)} projected team points`,
          risk: "No single player is forcing a start/sit change yet.",
          state: "Start now",
          strength: "high",
          title: "Start with confidence",
          why: "The strongest lane is carrying the weekly floor.",
        },
  );

  actions.push(
    closeCall
      ? {
          detail: closeCall.summary,
          confidence: "Medium",
          edge: `${Math.abs(closeCall.gap).toFixed(1)} pts apart`,
          fallback: `If news is neutral, keep the safer role and do not chase a tiny projection gap.`,
          kind: "watch",
          label: `${closeCall.slotLabel}: ${fantasyCloseCallLeader(closeCall).name} vs ${fantasyCloseCallTrailer(closeCall).name}`,
          meta: `${Math.abs(closeCall.gap).toFixed(1)} pts apart`,
          playerName: fantasyCloseCallLeader(closeCall).name,
          risk: "This is close enough that one injury note or weather shift can flip the call.",
          state:
            Math.abs(closeCall.gap) < 1.2 ? "True coin flip" : "Conditional start",
          strength: "medium",
          title: "Re-check before kickoff",
          why: `${closeCall.starter.name} and ${closeCall.challenger.name} are close in the ${closeCall.slotLabel} slot.`,
        }
      : {
          detail: `${pressure.label} is the pressure point. Re-check injury reports, weather, and role notes before lineup lock.`,
          confidence: fantasyBandFromPercent(matchupReport.confidence),
          edge: `${matchupReport.confidence}% confidence · ${matchupReport.chaos}% variance`,
          fallback: "No news is good news here: keep the recommended lineup if roles hold.",
          kind: "watch",
          label: "News watch",
          meta: `${matchupReport.confidence}% confidence · ${matchupReport.chaos}% variance`,
          risk: pressure.summary,
          state: matchupReport.chaos >= 64 ? "Risk alert" : "Conditional start",
          strength: "medium",
          title: "Re-check before kickoff",
          why: "This is the spot most likely to move after practice reports and active/inactive news.",
        },
  );

  actions.push(
    benchSwap
      ? {
          detail: benchSwap.summary,
          confidence: benchSwap.lift >= 1.5 ? "Medium-high" : "Medium",
          edge:
            benchSwap.lift >= 0
              ? `+${benchSwap.lift.toFixed(1)} if news holds`
              : `${Math.abs(benchSwap.lift).toFixed(1)} behind starter`,
          fallback:
            benchSwap.lift >= 0
              ? "Only make the swap if the role news confirms the extra work."
              : "Keep the starter unless the bench player gets a confirmed workload bump.",
          kind: "swap",
          label: benchSwap.slotLabel,
          meta:
            benchSwap.lift >= 0
              ? `+${benchSwap.lift.toFixed(1)} if news holds`
              : `${Math.abs(benchSwap.lift).toFixed(1)} behind starter`,
          playerName: benchSwap.player.name,
          risk: fantasyPlayerRiskText(benchSwap.player),
          state: benchSwap.lift >= 0 ? "Conditional move" : "Risk alert",
          strength: benchSwap.lift >= 0 ? "high" : "medium",
          title: benchSwap.lift >= 0 ? "Move only if news holds" : "Bench watch",
          why: benchSwap.summary,
        }
      : {
          detail:
            "No bench player is forcing a move right now. Hold the starters unless late role or injury news changes the room.",
          confidence: "Medium",
          edge: "No clear bench lift",
          fallback: "Use waivers for depth instead of forcing a same-roster swap.",
          kind: "swap",
          label: "Bench watch",
          meta: "Hold current lineup",
          risk: "A forced swap can lower your floor when the bench does not have a real role edge.",
          state: "Conditional move",
          strength: "low",
          title: "Bench watch",
          why: "The current starters are not being challenged by the bench yet.",
        },
  );

  actions.push({
    detail: marketIdea,
    confidence: "Medium",
    edge: pressure.priority,
    fallback: "Do not overpay for a name. Solve the position need with the cheapest credible role.",
    kind: "market",
    label: pressure.label,
    meta: `Patch priority: ${pressure.label}`,
    risk: "Trade ideas are only useful if they improve the weekly lineup without draining your bench.",
    state: "Waiver/trade idea",
    strength: "low",
    title: "Trade/waiver idea",
    why: pressure.summary,
  });

  return actions;
}

function fantasyDecisionSlotLabel(label: string) {
  return label.replace(/^Start\s+/i, "").trim();
}

function fantasyCloseCallLeader(closeCall: FantasyCloseCall) {
  return closeCall.gap <= 0 ? closeCall.challenger : closeCall.starter;
}

function fantasyCloseCallTrailer(closeCall: FantasyCloseCall) {
  return closeCall.gap <= 0 ? closeCall.starter : closeCall.challenger;
}

function buildRookieWatchRows(rows: ScoutingRow[]) {
  const taggedRows = rows.filter((player) => {
    const searchableText = [
      player.depthTier,
      ...player.traits,
      ...(player.seerAdjustments ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return /rookie|first-year|breakout|prospect|taxi|stash|dynasty/.test(
      searchableText,
    );
  });
  const watchPool =
    taggedRows.length > 0
      ? taggedRows
      : rows.filter((player) => (player.dynastyValue ?? player.health) >= 74);

  return [...watchPool]
    .sort((left, right) => rookieWatchScore(right) - rookieWatchScore(left))
    .slice(0, 24);
}

function rookieWatchScore(player: ScoutingRow) {
  return (
    player.contextProjection.projection * 1.25 +
    (player.dynastyValue ?? player.health) * 0.68 +
    (player.roleSecurity ?? player.health) * 0.18 +
    (100 - player.nflRank) * 0.1 -
    player.chaos * 0.08
  );
}

function countScoutingPositions(rows: ScoutingRow[]) {
  return rows.reduce(
    (counts, row) => {
      const position = normalizeScoutingPosition(row.position);
      counts[position] += 1;
      return counts;
    },
    {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      K: 0,
      DST: 0,
    } satisfies Record<ScoutingPlayerPosition, number>,
  );
}

function normalizeScoutingPosition(position: string): ScoutingPlayerPosition {
  const normalized = position.toUpperCase();

  if (normalized === "DEF" || normalized === "D") {
    return "DST";
  }

  if (
    normalized === "QB" ||
    normalized === "RB" ||
    normalized === "WR" ||
    normalized === "TE" ||
    normalized === "K" ||
    normalized === "DST"
  ) {
    return normalized;
  }

  return "WR";
}

function scoutingPositionLabel(position: ScoutingPosition) {
  return (
    scoutingPositionOptions.find((option) => option.value === position)?.label ??
    position
  );
}

function scoutingBoardModeLabel(mode: ScoutingBoardMode) {
  return (
    scoutingBoardModeOptions.find((option) => option.value === mode)?.label ??
    "Board"
  );
}

function scoutingBoardModeCopy(
  mode: ScoutingBoardMode,
  hasLiveOrImportedSourceRankings: boolean,
) {
  if (mode === "available") {
    return "In-season waiver view: unrostered options first when a Sleeper, paste, or screenshot league is connected.";
  }

  if (mode === "topPicks") {
    return "Best immediate adds first, weighted by projection, floor, role security, matchup, and your weakest roster lane.";
  }

  if (mode === "ultraDeep") {
    return "Deep-league and dynasty stash view: lower-rostered profiles with upside, future value, or streaming paths.";
  }

  return hasLiveOrImportedSourceRankings
    ? "Full player universe. Useful before drafts, for trade context, and for seeing where source rank disagrees with the Seer."
    : "Full player universe. In season, Available and Top pickups are usually the higher-utility rooms.";
}

function scoutingBoardModeUtility(mode: ScoutingBoardMode) {
  if (mode === "available") {
    return "Use this for waivers after rosters are loaded.";
  }

  if (mode === "topPicks") {
    return "Use this when you want the next add, not a draft board.";
  }

  if (mode === "ultraDeep") {
    return "Use this for dynasty benches, stashes, and weird deep leagues.";
  }

  return "Use this mostly for draft prep or player universe context.";
}

function scoutingBoardModeDetail(mode: ScoutingBoardMode) {
  if (mode === "available") {
    return "It removes rostered players and keeps the best playable pool in front.";
  }

  if (mode === "topPicks") {
    return "It tilts toward your weakest lane, floor, role security, and matchup.";
  }

  if (mode === "ultraDeep") {
    return "It favors young upside, hidden roles, and players who can matter later.";
  }

  return "Once your league is live, jump to Available or Top pickups for weekly action.";
}

function scoutingRankLabel(position: ScoutingPosition) {
  if (position === "ALL") {
    return "Rank";
  }

  return position === "DST" ? "Def" : position;
}

function buildFantasyContextLayer({
  dataset,
  matchups,
  players,
}: {
  dataset: NflSeerDataset;
  matchups: NflMatchup[];
  players: FantasyPlayer[];
}): FantasyContextLayer {
  const byTeam = matchups.reduce<Record<string, NflFantasyTeamContext>>(
    (contexts, matchup) => {
      contexts[matchup.home.code] = matchupTeamContext({
        matchup,
        opponent: matchup.away,
        side: "home",
        team: matchup.home,
        updatedAt: dataset.updatedAt,
        status: dataset.providerStatus.schedule === "live" ? "live" : "fallback",
      });
      contexts[matchup.away.code] = matchupTeamContext({
        matchup,
        opponent: matchup.home,
        side: "away",
        team: matchup.away,
        updatedAt: dataset.updatedAt,
        status: dataset.providerStatus.schedule === "live" ? "live" : "fallback",
      });
      return contexts;
    },
    {},
  );
  const playerTeams = [
    ...new Set(
      players
        .map((player) => normalizeTeamCode(player.team))
        .filter((team) => team !== "FA"),
    ),
  ];
  const coveredTeams = playerTeams.filter((team) => byTeam[team]).length;
  const totalTeams = Math.max(1, playerTeams.length);
  const freshness = contextFreshness(dataset.updatedAt);
  const uncovered = Math.max(0, totalTeams - coveredTeams);
  const status: FantasyContextStatusValue =
    dataset.providerStatus.schedule === "live" && uncovered === 0
      ? "live"
      : coveredTeams > 0
        ? "partial"
        : "fallback";

  return {
    byTeam,
    status: {
      coveredTeams,
      freshness,
      message:
        status === "live"
          ? "Game context is live across loaded fantasy teams."
          : status === "partial"
            ? "Game context is live for part of the fantasy pool; uncovered teams use role and matchup fallback."
            : "Game context is using seeded matchup fallback until the slate feed covers these teams.",
      status,
      totalTeams,
      warnings:
        uncovered > 0
          ? [`${uncovered} fantasy team${uncovered === 1 ? "" : "s"} need live opponent context.`]
          : [],
    },
  };
}

function matchupTeamContext({
  matchup,
  opponent,
  side,
  status,
  team,
  updatedAt,
}: {
  matchup: NflMatchup;
  opponent: NflTeam;
  side: "away" | "home";
  status: FantasyContextStatusValue;
  team: NflTeam;
  updatedAt: string;
}): NflFantasyTeamContext {
  const roof = roofRead(matchup.venue, matchup.weather);

  return {
    freshness: contextFreshness(updatedAt),
    message: `${team.code} context comes from ${matchup.week}: ${matchup.weather}, ${matchup.venue}.`,
    opponent: `${side === "home" ? "vs" : "at"} ${opponent.code}`,
    opponentCode: opponent.code,
    opponentCoaching: opponent.coaching,
    opponentDefense: opponent.defense,
    opponentOffense: opponent.offense,
    opponentTrenches: opponent.trenches,
    opponentWin: side === "home" ? matchup.awayWin : matchup.homeWin,
    pace: matchup.pace,
    roof,
    source: status === "live" ? "schedule feed" : "seeded matchup rail",
    status,
    surface: surfaceRead(matchup.venue, matchup.weather, roof),
    team: team.code,
    teamHealth: team.injuries,
    teamOffense: team.offense,
    teamWin: side === "home" ? matchup.homeWin : matchup.awayWin,
    venue: matchup.venue,
    weather: matchup.weather,
  };
}

function fantasyPlayerContext(
  player: FantasyPlayer,
  contextByTeam: Record<string, NflFantasyTeamContext>,
  fantasy: FantasyProjection,
): FantasyPlayerContext {
  const position = normalizeScoutingPosition(player.position);
  const teamContext = contextByTeam[normalizeTeamCode(player.team)];
  const roleSignal = playerRoleSignal(player);
  const touchSignal = playerTouchSignal(player, position);
  const redZoneSignal = player.touchdownPulse;
  const fallbackDefense = clampMeter(142 - player.matchup);
  const context =
    teamContext ??
    fallbackTeamContext({
      fallbackDefense,
      player,
    });
  const defenseVsPosition = defenseVsFantasyPosition(context, position, fallbackDefense);
  const adjustments = fantasyContextAdjustments({
    context,
    defenseVsPosition,
    fantasy,
    player,
    position,
    redZoneSignal,
    roleSignal,
    touchSignal,
  });
  const existingKinds = existingAdjustmentKinds(player);
  const projectionNudge = round1(
    clampValue(
      sum(
        adjustments
          .filter((adjustment) => !existingKinds.has(adjustment.kind))
          .map((adjustment) => adjustment.delta),
      ),
      -1.8,
      1.8,
    ),
  );
  const totalDelta = round1(sum(adjustments.map((adjustment) => adjustment.delta)));
  const chips = [
    `${context.opponentCode} vs ${scoutingRankLabel(position)} ${Math.round(defenseVsPosition)}`,
    context.weather,
    `${context.roof} · ${context.surface}`,
    `Pace ${Math.round(context.pace)}`,
    `Role ${Math.round(roleSignal)}`,
  ];

  return {
    adjustments,
    chips,
    defenseVsPosition,
    freshness: context.freshness,
    gameScript: context.teamWin - context.opponentWin,
    message: context.message,
    opponent: context.opponent,
    opponentCode: context.opponentCode,
    opponentDefense: context.opponentDefense,
    pace: context.pace,
    projectionNudge,
    redZoneSignal,
    roleSignal,
    roof: context.roof,
    source: context.source,
    status: context.status,
    surface: context.surface,
    teamHealth: context.teamHealth,
    totalDelta,
    touchSignal,
    venue: context.venue,
    weather: context.weather,
  };
}

function fallbackTeamContext({
  fallbackDefense,
  player,
}: {
  fallbackDefense: number;
  player: FantasyPlayer;
}): NflFantasyTeamContext {
  return {
    freshness: "unknown",
    message: `${player.name} is using player-role fallback until the schedule context covers ${player.team}.`,
    opponent: player.opponent,
    opponentCode: cleanOpponentCode(player.opponent),
    opponentCoaching: fallbackDefense,
    opponentDefense: fallbackDefense,
    opponentOffense: 72,
    opponentTrenches: fallbackDefense,
    opponentWin: 50,
    pace: 66,
    roof: "Unknown roof",
    source: "fantasy fallback",
    status: "fallback",
    surface: "Unknown surface",
    team: normalizeTeamCode(player.team),
    teamHealth: player.health,
    teamOffense: 72,
    teamWin: 50,
    venue: "Context fallback",
    weather: "Weather TBD",
  };
}

function fantasyContextAdjustments({
  context,
  defenseVsPosition,
  fantasy,
  player,
  position,
  redZoneSignal,
  roleSignal,
  touchSignal,
}: {
  context: NflFantasyTeamContext;
  defenseVsPosition: number;
  fantasy: FantasyProjection;
  player: FantasyPlayer;
  position: ScoutingPlayerPosition;
  redZoneSignal: number;
  roleSignal: number;
  touchSignal: number;
}): FantasyContextAdjustment[] {
  const matchupDelta = round1(clampValue((72 - defenseVsPosition) / 19, -1.15, 1.15));
  const weatherDelta = fantasyWeatherDelta(context.weather, context.roof, position);
  const paceDelta = round1(clampValue((context.pace - 66) / 28, -0.75, 0.75));
  const roleDelta = round1(
    clampValue(
      (roleSignal - 76) / 44 +
        (player.health - 82) / 48 +
        (touchSignal - 42) / 72 +
        (redZoneSignal - 60) / 90,
      -1.05,
      1.05,
    ),
  );
  const volatilityDelta = round1(clampValue(-(player.chaos - 50) / 40, -0.95, 0.95));

  const adjustments: FantasyContextAdjustment[] = [
    {
      delta: matchupDelta,
      kind: "matchup",
      label: `Defense vs ${scoutingRankLabel(position)}`,
      summary:
        matchupDelta >= 0
          ? "The opponent has been friendlier than average for this position."
          : "The opponent is tougher than average for this position.",
    },
    {
      delta: weatherDelta,
      kind: "weather",
      label: "Weather",
      summary:
        weatherDelta >= 0
          ? "Conditions help the projection."
          : "Conditions make the projection a little less comfortable.",
    },
    {
      delta: paceDelta,
      kind: "pace",
      label: "Pace",
      summary:
        paceDelta >= 0
          ? "Game environment adds play volume."
          : "Game environment is a little slower.",
    },
    {
      delta: roleDelta,
      kind: "role",
      label: "Role / health",
      summary:
        roleDelta >= 0
          ? "Usage and health support the start."
          : "Role or health makes this less automatic.",
    },
    {
      delta: volatilityDelta,
      kind: "volatility",
      label: "Volatility",
      summary:
        volatilityDelta >= 0
          ? "Range is stable enough for lineup trust."
          : "Volatility makes this more of a swing play.",
    },
  ];

  return adjustments.filter((adjustment) => adjustment.delta !== 0);
}

function applyFantasyContextProjection(
  fantasy: FantasyProjection,
  context: FantasyPlayerContext,
): FantasyProjection {
  const projection = round1(Math.max(0, fantasy.projection + context.projectionNudge));
  const floor = round1(
    Math.max(
      0,
      fantasy.floor +
        context.projectionNudge * 0.55 +
        Math.min(0, context.projectionNudge) * 0.25,
    ),
  );
  const ceiling = round1(
    Math.max(
      projection,
      fantasy.ceiling +
        context.projectionNudge * 0.75 +
        Math.max(0, context.pace - 70) * 0.03,
    ),
  );

  return { ceiling, floor, projection };
}

function defenseVsFantasyPosition(
  context: NflFantasyTeamContext,
  position: ScoutingPlayerPosition,
  fallbackDefense: number,
) {
  if (context.status === "fallback") {
    return fallbackDefense;
  }

  if (position === "QB") {
    return clampMeter(
      Math.round(
        context.opponentDefense * 0.58 +
          context.opponentTrenches * 0.2 +
          context.opponentCoaching * 0.22,
      ),
    );
  }

  if (position === "RB") {
    return clampMeter(
      Math.round(
        context.opponentDefense * 0.38 +
          context.opponentTrenches * 0.46 +
          context.opponentCoaching * 0.16,
      ),
    );
  }

  if (position === "WR") {
    return clampMeter(
      Math.round(
        context.opponentDefense * 0.62 +
          context.opponentTrenches * 0.1 +
          context.opponentCoaching * 0.28,
      ),
    );
  }

  if (position === "TE") {
    return clampMeter(
      Math.round(
        context.opponentDefense * 0.52 +
          context.opponentTrenches * 0.18 +
          context.opponentCoaching * 0.3,
      ),
    );
  }

  if (position === "K") {
    return clampMeter(
      Math.round(
        context.opponentDefense * 0.45 +
          context.opponentTrenches * 0.1 +
          (context.weather.toLowerCase().includes("wind") ? 88 : 62) * 0.45,
      ),
    );
  }

  return clampMeter(
    Math.round(context.opponentOffense * 0.62 + context.opponentWin * 0.38),
  );
}

function fantasyWeatherDelta(
  weather: string,
  roof: string,
  position: ScoutingPlayerPosition,
) {
  const normalized = weather.toLowerCase();
  const badAir =
    normalized.includes("wind") ||
    normalized.includes("snow") ||
    normalized.includes("rain") ||
    normalized.includes("storm");
  const cleanTrack =
    roof === "Dome" ||
    normalized.includes("clear") ||
    normalized.includes("clean");

  if (badAir) {
    if (position === "RB" || position === "DST") {
      return 0.25;
    }

    return position === "K" ? -0.8 : -0.55;
  }

  if (cleanTrack) {
    return position === "QB" || position === "WR" || position === "TE" ? 0.35 : 0.12;
  }

  return 0;
}

function existingAdjustmentKinds(player: FantasyPlayer) {
  return new Set(
    (player.seerAdjustmentDetails ?? []).map((adjustment) =>
      adjustmentKindFromLabel(adjustment.label),
    ),
  );
}

function adjustmentKindFromLabel(label: string): FantasyContextAdjustmentKind {
  const normalized = label.toLowerCase();

  if (
    normalized.includes("defense") ||
    normalized.includes("matchup") ||
    normalized.includes("script")
  ) {
    return "matchup";
  }

  if (normalized.includes("weather") || normalized.includes("track")) {
    return "weather";
  }

  if (normalized.includes("pace")) {
    return "pace";
  }

  if (
    normalized.includes("role") ||
    normalized.includes("health") ||
    normalized.includes("team health")
  ) {
    return "role";
  }

  return "volatility";
}

function contextReceiptLine(context: FantasyPlayerContext) {
  const strongest = [...context.adjustments]
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 2);

  if (strongest.length === 0) {
    return "No major matchup, weather, or role adjustment here.";
  }

  return `Main context notes: ${strongest
    .map(
      (adjustment) =>
        `${adjustment.label.toLowerCase()} ${formatFantasyDelta(adjustment.delta)}`,
    )
    .join(", ")}.`;
}

function playerRoleSignal(player: FantasyPlayer) {
  return clampMeter(
    Math.round(
      (player.roleSecurity ?? player.health) * 0.5 +
        player.health * 0.28 +
        player.targetShare * 0.08 +
        player.carryShare * 0.08 +
        player.touchdownPulse * 0.06,
    ),
  );
}

function playerTouchSignal(player: FantasyPlayer, position: ScoutingPlayerPosition) {
  if (position === "QB") {
    return clampMeter(player.carryShare * 1.9 + player.touchdownPulse * 0.48);
  }

  if (position === "RB") {
    return clampMeter(player.carryShare * 1.05 + player.targetShare * 0.8);
  }

  if (position === "WR" || position === "TE") {
    return clampMeter(player.targetShare * 1.9 + player.baseline.receptions * 4);
  }

  return player.touchdownPulse;
}

function roofRead(venue: string, weather: string) {
  const value = `${venue} ${weather}`.toLowerCase();

  if (
    value.includes("dome") ||
    value.includes("ford field") ||
    value.includes("sofi") ||
    value.includes("allegiant") ||
    value.includes("state farm") ||
    value.includes("at&t") ||
    value.includes("lucas oil") ||
    value.includes("superdome") ||
    value.includes("nrg") ||
    value.includes("u.s. bank") ||
    value.includes("mercedes-benz")
  ) {
    return "Dome";
  }

  return "Open roof";
}

function surfaceRead(venue: string, weather: string, roof: string) {
  const value = `${venue} ${weather}`.toLowerCase();

  if (roof === "Dome" || value.includes("clean") || value.includes("clear")) {
    return "Fast track";
  }

  if (value.includes("snow") || value.includes("rain") || value.includes("storm")) {
    return "Heavy field";
  }

  return "Outdoor field";
}

function contextFreshness(updatedAt: string): FantasyContextFreshness {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime()) || updatedAt === new Date(0).toISOString()) {
    return "unknown";
  }

  const ageHours = Math.max(0, (Date.now() - date.getTime()) / 36e5);

  return ageHours <= 72 ? "fresh" : "stale";
}

function cleanOpponentCode(opponent: string) {
  const code = opponent.toUpperCase().match(/\b[A-Z]{2,3}\b/)?.[0];

  return code ?? "NFL";
}

function normalizeTeamCode(team: string) {
  const normalized = team.toUpperCase();

  return normalized.length > 0 ? normalized : "FA";
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildScoutingBoard(
  players: FantasyPlayer[],
  scoringFormat: ScoringFormat,
  contextByTeam: Record<string, NflFantasyTeamContext> = {},
) {
  return players
    .map((player) => {
      const fantasy = fantasyProjection(player, scoringFormat);
      const context = fantasyPlayerContext(player, contextByTeam, fantasy);
      const contextProjection = applyFantasyContextProjection(fantasy, context);
      return {
        ...player,
        fantasy,
        context,
        contextProjection,
        rankDelta: player.nflRank - player.seerRank,
        score: fantasyScore(player, scoringFormat, contextProjection, context),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function fantasyScore(
  player: FantasyPlayer,
  scoringFormat: ScoringFormat,
  fantasy = fantasyProjection(player, scoringFormat),
  context?: FantasyPlayerContext,
) {
  const contextBoost = context ? context.projectionNudge * 1.8 : 0;

  return (
    fantasy.projection * 3.2 +
    fantasy.floor * 1.8 +
    fantasy.ceiling * 1.1 +
    player.matchup * 0.18 +
    player.health * 0.14 -
    player.chaos * 0.18 +
    contextBoost
  );
}

function fantasyProjection(
  player: FantasyPlayer,
  scoringFormat: ScoringFormat,
): FantasyProjection {
  if (typeof player.seerProjection === "number") {
    const projection = round1(player.seerProjection);
    const floor =
      projection * (0.62 + player.health / 360) -
      player.chaos / 34 -
      Math.max(0, -projectionDelta(player)) * 0.18;
    const ceiling =
      projection * (1.13 + player.touchdownPulse / 320) +
      player.chaos / 28 +
      Math.max(0, projectionDelta(player)) * 0.22;

    return {
      projection,
      floor: round1(Math.max(0, floor)),
      ceiling: round1(Math.max(projection, ceiling)),
    };
  }

  const ppr = receptionPoints[scoringFormat];
  const passing =
    (player.baseline.passYards ?? 0) / 25 +
    (player.baseline.passTd ?? 0) * 4 -
    (player.baseline.interceptions ?? 0) * 2;
  const rushing = player.baseline.rushYards / 10 + player.baseline.rushTd * 6;
  const receiving =
    player.baseline.receivingYards / 10 +
    player.baseline.receivingTd * 6 +
    player.baseline.receptions * ppr;
  const roleBonus =
    player.targetShare * 0.025 + player.carryShare * 0.016 + player.touchdownPulse * 0.018;
  const matchupBonus = (player.matchup - 70) / 16;
  const stability = (player.health - player.chaos) / 120;
  const projection = passing + rushing + receiving + roleBonus + matchupBonus + stability;
  const floor = projection * (0.6 + player.health / 320) - player.chaos / 28;
  const ceiling =
    projection * (1.16 + player.touchdownPulse / 280) + player.chaos / 22;

  return {
    projection: round1(projection),
    floor: round1(Math.max(0, floor)),
    ceiling: round1(Math.max(projection, ceiling)),
  };
}

function projectionDelta(player: FantasyPlayer) {
  if (typeof player.seerDelta === "number") {
    return player.seerDelta;
  }

  if (typeof player.sourceProjection === "number" && typeof player.seerProjection === "number") {
    return player.seerProjection - player.sourceProjection;
  }

  return 0;
}

function defaultScenarioLevers(matchup: NflMatchup): ScenarioLevers {
  return {
    wind: weatherDrag(matchup),
    healthSwing: Math.round((matchup.home.injuries - matchup.away.injuries) / 2),
    tempo: matchup.pace,
    homeNoise: homeNoiseBaseline(matchup),
  };
}

function buildScenarioImpact(
  matchup: NflMatchup,
  levers: ScenarioLevers,
): ScenarioImpact {
  const preseason = isPreseasonMatchup(matchup);
  const baseline = defaultScenarioLevers(matchup);
  const windDelta = levers.wind - baseline.wind;
  const healthDelta = levers.healthSwing - baseline.healthSwing;
  const tempoDelta = levers.tempo - baseline.tempo;
  const homeNoiseDelta = levers.homeNoise - baseline.homeNoise;
  const awayWeatherProfile =
    matchup.away.trenches * 0.46 + matchup.away.qb * 0.34 + matchup.away.offense * 0.2;
  const homeWeatherProfile =
    matchup.home.trenches * 0.46 + matchup.home.qb * 0.34 + matchup.home.offense * 0.2;
  const weatherLeanToAway =
    ((awayWeatherProfile - homeWeatherProfile) / 10) * (windDelta / 18);
  const healthLeanToHome = healthDelta * 0.46;
  const noiseLeanToHome = homeNoiseDelta * 0.09;
  const tempoLeanToHome =
    ((matchup.home.offense - matchup.away.offense) / 10) * (tempoDelta / 18);
  const homeShift =
    healthLeanToHome + noiseLeanToHome + tempoLeanToHome - weatherLeanToAway;
  const homeWin = clampProbability(Math.round(matchup.homeWin + homeShift));
  const awayWin = 100 - homeWin;
  const rawConfidence = clampMeter(
    Math.round(
      matchup.confidence +
        Math.abs(homeWin - matchup.homeWin) * 1.2 -
        Math.abs(windDelta) * 0.05 -
        Math.abs(tempoDelta) * 0.04,
    ),
  );
  const confidence = preseason ? clampMeter(rawConfidence - 8) : rawConfidence;
  const rawChaos = clampMeter(
    Math.round(
      matchup.chaos +
        Math.abs(windDelta) * 0.18 +
        Math.abs(healthDelta) * 0.5 +
        Math.max(0, levers.tempo - baseline.tempo) * 0.12 +
        Math.max(0, 64 - levers.tempo) * 0.08,
    ),
  );
  const chaos = preseason ? clampMeter(rawChaos + 9) : rawChaos;
  const projected = projectScenarioScore(matchup, homeWin, levers, baseline);
  const leanCode = homeWin >= awayWin ? matchup.home.code : matchup.away.code;
  const leanProbability = Math.max(homeWin, awayWin);

  return {
    awayWin,
    homeWin,
    projected,
    confidence,
    chaos,
    pace: clampMeter(levers.tempo),
    weatherDrag: clampMeter(levers.wind),
    leanCode,
    leanProbability,
    read: scenarioRead({
      awayWin,
      baseline,
      homeWin,
      levers,
      matchup,
      projected,
    }),
    factors: scenarioFactors(matchup, levers, baseline),
  };
}

function projectScenarioScore(
  matchup: NflMatchup,
  homeWin: number,
  levers: ScenarioLevers,
  baseline: ScenarioLevers,
) {
  const baseTotal = projectedTotal(matchup.projected);
  const tempoDelta = levers.tempo - baseline.tempo;
  const windDelta = levers.wind - baseline.wind;
  const healthPressure = Math.abs(levers.healthSwing - baseline.healthSwing);
  const total = Math.max(
    31,
    Math.min(
      68,
      baseTotal +
        tempoDelta * 0.22 -
        Math.max(0, windDelta) * 0.1 +
        Math.min(0, windDelta) * 0.04 -
        healthPressure * 0.05,
    ),
  );
  const homeMargin = (homeWin - 50) / 2.7;
  let homeScore = Math.round(total / 2 + homeMargin / 2);
  let awayScore = Math.round(total - homeScore);

  if (homeWin > 50 && homeScore <= awayScore) {
    homeScore = awayScore + 1;
  }

  if (homeWin < 50 && awayScore <= homeScore) {
    awayScore = homeScore + 1;
  }

  if (homeScore >= awayScore) {
    return `${matchup.home.code} ${homeScore}-${awayScore}`;
  }

  return `${matchup.away.code} ${awayScore}-${homeScore}`;
}

function scenarioRead({
  awayWin,
  baseline,
  homeWin,
  levers,
  matchup,
  projected,
}: {
  awayWin: number;
  baseline: ScenarioLevers;
  homeWin: number;
  levers: ScenarioLevers;
  matchup: NflMatchup;
  projected: string;
}) {
  const leader = homeWin >= awayWin ? matchup.home : matchup.away;
  const leanProbability = Math.max(homeWin, awayWin);
  const gap = Math.abs(homeWin - awayWin);
  const drivers = [
    {
      name: "wind",
      delta: Math.abs(levers.wind - baseline.wind),
      copy:
        levers.wind > baseline.wind
          ? "weather starts dragging the pretty stuff into the mud"
          : "the passing lanes clean up",
    },
    {
      name: "health",
      delta: Math.abs(levers.healthSwing - baseline.healthSwing) * 2,
      copy:
        levers.healthSwing > baseline.healthSwing
          ? `${matchup.home.code} gets the cleaner availability lane`
          : `${matchup.away.code} gets the cleaner availability lane`,
    },
    {
      name: "tempo",
      delta: Math.abs(levers.tempo - baseline.tempo),
      copy:
        levers.tempo > baseline.tempo
          ? "extra snaps raise the ceiling"
          : "the clock starts taking air out of the shootout",
    },
    {
      name: "home noise",
      delta: Math.abs(levers.homeNoise - baseline.homeNoise),
      copy:
        levers.homeNoise > baseline.homeNoise
          ? `${matchup.home.code} gets more help from the building`
          : `${matchup.away.code} can hear itself think`,
    },
  ].sort((a, b) => b.delta - a.delta);
  const driver = drivers[0];

  if (driver.delta < 4) {
    return matchup.read;
  }

  if (gap <= 6) {
    return `This stays in the coin-flip fog: ${projected}, with ${driver.copy}. The Seer is leaning, not shouting.`;
  }

  return `${leader.code} owns the ${leanProbability}% lane after ${driver.copy}. ${projected} is the scratchpad score.`;
}

function buildNflGameCardRead(
  matchup: NflMatchup,
  scenario: ScenarioImpact,
): NflGameCardRead {
  const isPreseason = isPreseasonMatchup(matchup);
  const favorite = scenario.homeWin >= scenario.awayWin ? matchup.home : matchup.away;
  const underdog = favorite.code === matchup.home.code ? matchup.away : matchup.home;
  const probabilityGap = Math.abs(scenario.homeWin - scenario.awayWin);
  const scoreMargin = projectedScoreMargin(scenario.projected);
  const favoriteTrait = topNflTrait(favorite);
  const underdogTrait = topNflTrait(underdog);
  const favoriteDefensiveEdge =
    favorite.defense + favorite.trenches >= underdog.defense + underdog.trenches;
  const weatherProfile =
    favorite.trenches * 0.46 + favorite.qb * 0.34 + favorite.offense * 0.2;
  const underdogWeatherProfile =
    underdog.trenches * 0.46 + underdog.qb * 0.34 + underdog.offense * 0.2;
  const leanStrengthLabel =
    probabilityGap >= 18
      ? "Clear lean, still football"
      : probabilityGap >= 10
        ? "Useful lean"
        : "Thin edge";
  const confidenceLabel =
    scenario.confidence >= 72
      ? "High-trust read"
      : scenario.confidence >= 58
        ? "Stable read"
        : "Light signal";
  const gameTypeLabel = isPreseason
    ? "Preseason volatility"
    : scoreMargin <= 2
      ? "One-score swing game"
      : scenario.weatherDrag >= 62
        ? "Weather squeeze"
        : scenario.pace >= 70
          ? "Pace-up ceiling"
          : "Controlled script";
  const scorePathLabel = isPreseason
    ? `${scenario.projected} rotation read`
    : `${scenario.projected} win read`;
  const verdictHeadline = `${favorite.name} are the lean, not a lock.`;
  const verdictSummary = isPreseason
    ? `${favorite.code} has the cleaner ${scenario.leanProbability}% path, but preseason is a usage puzzle: QB depth, starter rest, special teams, and roster-bubble snaps can move the room fast.`
    : `${favorite.code} has the cleaner ${scenario.leanProbability}% path because the strongest lanes line up first. ${underdog.code} stays live if it drags the game into hidden possessions and red-zone pressure.`;
  const favoritePath = favoriteDefensiveEdge
    ? isPreseason
      ? `${favorite.code} gets there by pairing the ${favoriteTrait.label.toLowerCase()} with the sturdier depth profile. This is less about stars and more about whose second unit keeps drives alive.`
      : `${favorite.code} gets there by pairing the ${favoriteTrait.label.toLowerCase()} with enough defensive resistance to keep the game on script. The read is not blowout energy; it is cleaner possession math.`
    : isPreseason
      ? `${favorite.code} gets the lean because the ${favoriteTrait.label.toLowerCase()} is the best available preseason lane. If the rotation plan holds, the score path stays manageable.`
      : `${favorite.code} gets the lean because the ${favoriteTrait.label.toLowerCase()} is the best single lane on the card. If that holds, the projected score stays in their preferred shape.`;
  const underdogPath =
    isPreseason
      ? `${underdog.code} flips it if the depth chart gets the better late-game reps: backup QB rhythm, special teams field position, and one roster-bubble touchdown.`
      : scenario.chaos >= 64
        ? `${underdog.code} is live if the game gets noisy: short fields, one coverage bust, or a late two-minute drive. Their ${underdogTrait.label.toLowerCase()} has to turn variance into points.`
        : `${underdog.code} needs patience more than fireworks. Keep the score within one drive, win red-zone snaps, and force ${favorite.code} to finish long fields instead of gifting rhythm.`;
  const flipFactors = [
    isPreseason
      ? "Starter usage: one surprise series can change the whole read."
      : scenario.weatherDrag >= 56
        ? "Weather drag: throws, kicks, and ball security matter more than usual."
        : "Clean possessions: turnovers matter more than the weather lane.",
    isPreseason
      ? "QB depth: backup timing matters more than the usual starter rating."
      : Math.abs(matchup.home.trenches - matchup.away.trenches) <= 4
        ? "Pressure timing: the line battle is close enough to swing drives."
        : "Trench leverage: one side can change the play menu if it shows up early.",
    isPreseason
      ? "Roster-bubble urgency: fourth-quarter reps can be louder than the first quarter."
      : scenario.pace >= 70
        ? "Tempo control: extra snaps raise both ceiling and mistake risk."
        : "Tempo squeeze: fewer drives make each red-zone trip heavier.",
    isPreseason
      ? "Special teams: field position and kicking reps are real preseason levers."
      : weatherProfile >= underdogWeatherProfile
        ? `${favorite.code} handles the rough-stuff profile a little cleaner.`
        : `${underdog.code} has a real path if the field conditions get awkward.`,
  ];
  const timeline = [
    {
      label: isPreseason ? "Starter hint" : "Opening script",
      detail: isPreseason
        ? "If starters sit early, downgrade the normal roster-strength read."
        : `${favorite.code} wants the first clean scoring chance so the lean does not become a coin flip by halftime.`,
    },
    {
      label: isPreseason ? "Depth window" : "Middle quarters",
      detail: isPreseason
        ? `${underdog.code} needs the second unit to win timing and field position.`
        : `${underdog.code} needs a drive extender: third down, penalty leverage, or a field-position steal.`,
    },
    {
      label: isPreseason ? "Bubble finish" : "Closing lane",
      detail:
        isPreseason
          ? "The final quarter is where one job-winning drive can flip the card."
          : probabilityGap <= 10
            ? "If this is within one score late, the model trims confidence and chaos gets louder."
            : `${favorite.code} can end the argument by avoiding the hidden-possession mistake.`,
    },
  ];

  return {
    confidenceLabel,
    favorite,
    favoritePath,
    flipFactors,
    gameTypeLabel,
    isPreseason,
    leanLabel: `${favorite.code} ${scenario.leanProbability}%`,
    leanStrengthLabel,
    metricNotes: [
      {
        detail:
          favorite.qb >= underdog.qb
            ? `${favorite.code} has the cleaner QB lane.`
            : `${underdog.code} owns the QB lane, keeping the upset door open.`,
        label: isPreseason ? "QB depth" : "QB edge",
        value: `${Math.abs(favorite.qb - underdog.qb)}`,
      },
      {
        detail:
          favorite.defense + favorite.trenches >= underdog.defense + underdog.trenches
            ? `${favorite.code} has the sturdier resistance profile.`
            : `${underdog.code} can stress the line/defense math.`,
        label: "Def + trenches",
        value: `${Math.abs(
          favorite.defense + favorite.trenches - underdog.defense - underdog.trenches,
        )}`,
      },
      {
        detail: isPreseason
          ? "Venue matters less than rotation and special teams."
          : `${matchup.venue} plus ${matchup.weather.toLowerCase()} shapes the style.`,
        label: "Venue/weather",
        value: `${scenario.weatherDrag}%`,
      },
      {
        detail: isPreseason
          ? "Preseason reads are easier to flip late."
          : "Turnovers, tempo spikes, and weird-game pressure.",
        label: "Chaos",
        value: `${scenario.chaos}%`,
      },
      {
        detail: isPreseason
          ? "Confidence is capped because rotations are not fully knowable."
          : "How much the inputs agree with each other.",
        label: "Confidence",
        value: `${scenario.confidence}%`,
      },
    ],
    scorePathLabel,
    timeline,
    underdog,
    underdogPath,
    verdictHeadline,
    verdictSummary,
  };
}

function topNflTrait(team: NflTeam) {
  return [
    { label: "QB lane", value: team.qb },
    { label: "offensive shape", value: team.offense },
    { label: "defensive floor", value: team.defense },
    { label: "line play", value: team.trenches },
    { label: "coaching edge", value: team.coaching },
  ].sort((left, right) => right.value - left.value)[0];
}

function projectedScoreMargin(projected: string) {
  const scores = projected.match(/\b(\d+)-(\d+)\b/);

  if (!scores) {
    return 1;
  }

  return Math.abs(Number(scores[1]) - Number(scores[2]));
}

function buildNflSeerOracleRead({
  matchup,
  question,
  scenario,
  voice,
}: {
  matchup: NflMatchup;
  question: string;
  scenario: ScenarioImpact;
  voice: SeerVoiceProfile;
}) {
  const cleanQuestion = question.trim().replace(/\s+/g, " ");
  const favorite = scenario.homeWin >= scenario.awayWin ? matchup.home : matchup.away;
  const underdog = favorite.code === matchup.home.code ? matchup.away : matchup.home;
  const gap = Math.abs(scenario.homeWin - scenario.awayWin);
  const qbGap = Math.abs(matchup.home.qb - matchup.away.qb);
  const trenchGap = Math.abs(matchup.home.trenches - matchup.away.trenches);
  const weatherTeam =
    matchup.away.trenches + matchup.away.qb >= matchup.home.trenches + matchup.home.qb
      ? matchup.away
      : matchup.home;
  const promptLead = cleanQuestion
    ? `${cleanQuestion} ${voice.shortName} says:`
    : `${voice.shortName} says:`;
  const angle: NflOracleAngle =
    gap <= 6
      ? "close"
      : scenario.weatherDrag >= 62
        ? "weather"
        : qbGap >= trenchGap && qbGap >= 5
          ? "quarterback"
          : trenchGap >= 5
            ? "trenches"
            : "clean";
  const context: NflOracleContext = {
    angle,
    favorite,
    gap,
    lead: promptLead,
    matchup,
    scenario,
    underdog,
    weatherTeam,
  };

  return formatNflVoiceRead(voice.id, context);
}

function formatNflVoiceRead(voiceId: SeerVoiceId, context: NflOracleContext) {
  const { angle, favorite, lead, matchup, scenario, underdog, weatherTeam } = context;

  if (voiceId === "nfl-big-bro") {
    if (angle === "close") {
      return `${lead} Do not overthink it: ${matchup.away.code} and ${matchup.home.code} are close enough that one late escape changes the whole night. I trust ${favorite.code} by a hair, but ${underdog.code} can absolutely make this uncomfortable.`;
    }

    if (angle === "weather") {
      return `${lead} This is where toughness matters. ${favorite.code} has the cleaner ${scenario.leanProbability}% path, and ${weatherTeam.code} handles the bad-air stuff better. ${underdog.code} needs short fields and one red-zone punch.`;
    }

    return `${lead} I am riding with ${favorite.code} because the cleaner path is there. ${underdog.code} needs to turn this into a messy possession game, but the ${scenario.projected} script still starts with ${favorite.code}.`;
  }

  if (voiceId === "nfl-gridiron-professor") {
    if (angle === "quarterback") {
      return `${lead} The quarterback leverage is doing the lecture here. ${favorite.code} has the tidier creation lane, so ${underdog.code} must win pressure timing instead of trying to match highlight for highlight.`;
    }

    if (angle === "trenches") {
      return `${lead} The trench math is not subtle. ${favorite.code} owns the sturdier script, while ${underdog.code} needs early disruption before the game settles into its preferred shape.`;
    }

    return `${lead} The model is basically circling hidden possessions, not magic dust. ${favorite.code} is the cleaner side at ${scenario.leanProbability}%, but the margin stays thin enough for one leverage snap to matter.`;
  }

  if (voiceId === "nfl-booth-analyst") {
    if (angle === "close") {
      return `${lead} This is a thin-margin game. ${favorite.code} gets the lean because the path is slightly cleaner, but ${underdog.code} stays live if it wins third down and keeps the late script tight.`;
    }

    if (angle === "weather") {
      return `${lead} Weather is the swing factor. ${favorite.code} has the edge, but the key is whether ${weatherTeam.code}'s bad-weather profile controls tempo and keeps the score path near ${scenario.projected}.`;
    }

    return `${lead} The hinge is control. ${favorite.code} has the better route to the projected ${scenario.projected} finish, while ${underdog.code} needs a turnover or field-position swing to flip the script.`;
  }

  if (voiceId === "classic-seer") {
    if (angle === "close") {
      return `${lead} ${matchup.away.code} and ${matchup.home.code} are close enough that one third-down escape can tilt the room. The lean is ${favorite.code} ${scenario.leanProbability}%, but ${underdog.code} is very much alive if the QB duel gets weird late.`;
    }

    if (angle === "weather") {
      return `${lead} ${favorite.code} has the ${scenario.leanProbability}% path, with ${weatherTeam.code} carrying the better bad-air profile. If ${underdog.code} wants the upset, it needs short fields and a red-zone steal.`;
    }
  }

  if (angle === "close") {
    return `${lead} This one is close-close. I lean ${favorite.code}, but not with a megaphone. If ${underdog.code} gets the late ball with room to breathe, the whole read starts sweating.`;
  }

  if (angle === "weather") {
    return `${lead} The weather is doing main-character stuff. ${favorite.code} still has the cleaner path, but ${weatherTeam.code}'s bad-air profile is why this does not feel like a normal spreadsheet game.`;
  }

  if (angle === "quarterback") {
    return `${lead} The QB lane is the difference for me. ${favorite.code} can create cleaner answers, while ${underdog.code} needs pressure and awkward downs to make the night sideways.`;
  }

  if (angle === "trenches") {
    return `${lead} This starts up front. ${favorite.code} has the steadier trench script, and ${underdog.code} needs the first real punch before the game gets comfortable.`;
  }

  return `${lead} ${favorite.code} is the cleaner side, but I am not yelling about it. The score path says ${scenario.projected}, and ${underdog.code} can open the upset door by winning the hidden possessions.`;
}

function scenarioFactors(
  matchup: NflMatchup,
  levers: ScenarioLevers,
  baseline: ScenarioLevers,
): ScenarioFactor[] {
  const windDelta = levers.wind - baseline.wind;
  const healthDelta = levers.healthSwing - baseline.healthSwing;
  const tempoDelta = levers.tempo - baseline.tempo;
  const noiseDelta = levers.homeNoise - baseline.homeNoise;
  const awayWeatherProfile =
    matchup.away.trenches * 0.46 + matchup.away.qb * 0.34 + matchup.away.offense * 0.2;
  const homeWeatherProfile =
    matchup.home.trenches * 0.46 + matchup.home.qb * 0.34 + matchup.home.offense * 0.2;
  const weatherTeam =
    awayWeatherProfile >= homeWeatherProfile ? matchup.away.code : matchup.home.code;

  return [
    {
      label: "Wind",
      value: `${levers.wind}%`,
      detail:
        Math.abs(windDelta) < 8
          ? "Weather stays near the original read."
          : windDelta > 0
            ? `${weatherTeam} gets the steadier bad-air profile.`
            : "Cleaner air gives the passing menu back.",
    },
    {
      label: "Health",
      value: formatHealthSwing(matchup, levers.healthSwing),
      detail:
        Math.abs(healthDelta) < 3
          ? "No major injury swing."
          : levers.healthSwing > baseline.healthSwing
            ? `${matchup.home.code} gets the cleaner availability lane.`
            : `${matchup.away.code} gets the cleaner availability lane.`,
    },
    {
      label: "Tempo",
      value: `${levers.tempo}%`,
      detail:
        Math.abs(tempoDelta) < 7
          ? "Script speed holds steady."
          : tempoDelta > 0
            ? "More snaps lift total and volatility."
            : "Clock burn trims the ceiling.",
    },
    {
      label: "Noise",
      value: `${levers.homeNoise}%`,
      detail:
        Math.abs(noiseDelta) < 8
          ? "Venue pressure stays baked in."
          : noiseDelta > 0
            ? `${matchup.home.code} gets more pre-snap friction.`
            : `${matchup.away.code} gets a cleaner operation.`,
    },
  ];
}

function formatHealthSwing(matchup: NflMatchup, value: number) {
  if (value > 0) {
    return `${matchup.home.code} +${value}`;
  }

  if (value < 0) {
    return `${matchup.away.code} +${Math.abs(value)}`;
  }

  return "Even";
}

function withFantasyProviderBridgeDataset(
  dataset: NflSeerDataset,
  providerBridgeImport: FantasyProviderBridgeImport | null,
): NflSeerDataset {
  if (!providerBridgeImport) {
    return dataset;
  }

  const provider = fantasyProviderStatusFromBridge(providerBridgeImport);
  const coverage = mergeFantasyCoverageStatus(
    dataset.providerStatus.fantasyCoverage,
    fantasyCoverageFromSourceProjections(providerBridgeImport.projections),
  );
  const existingProviders = dataset.providerStatus.fantasyProviders ?? [];
  const notes = [
    `${providerBridgeImport.providerLabel} source rows are loaded in this browser session.`,
    ...dataset.providerStatus.notes,
  ].filter((note, index, allNotes) => allNotes.indexOf(note) === index);

  return {
    ...dataset,
    providerStatus: {
      ...dataset.providerStatus,
      fantasy: "live",
      fantasyCoverage: coverage,
      fantasyProviders: [
        provider,
        ...existingProviders.filter((existing) => existing.id !== provider.id),
      ],
      notes,
    },
  };
}

function fantasyProviderStatusFromBridge(
  providerBridgeImport: FantasyProviderBridgeImport,
): NflFantasyProviderStatus {
  return {
    count: providerBridgeImport.projections.length,
    freshness: fantasyFreshnessFromUpdatedAt(providerBridgeImport.updatedAt),
    id: "provider-bridge-upload",
    kind: providerBridgeImport.projections.some(
      (projection) => typeof projection.projection === "number",
    )
      ? "projections"
      : "rankings",
    label: providerBridgeImport.providerLabel,
    message: `${providerBridgeImport.notes.join(" ")} Browser upload, ready for Sleeper/NFL/feed adapters later.`,
    positions: fantasyPositionCountsFromSourceProjections(providerBridgeImport.projections),
    source: "browser upload",
    status: "live",
    updatedAt: providerBridgeImport.updatedAt,
  };
}

function fantasyCoverageFromSourceProjections(
  projections: FantasySourceProjection[],
): NflFantasyCoverageStatus {
  const positions = emptyFantasyCoveragePositions();

  projections.forEach((projection) => {
    const position = normalizeScoutingPosition(projection.position);
    positions[position].players += 1;

    if (typeof projection.projection === "number") {
      positions[position].projections += 1;
    }

    if (
      typeof projection.sourceRank === "number" ||
      typeof projection.positionRank === "number"
    ) {
      positions[position].rankings += 1;
    }
  });

  fantasyCoveragePositions.forEach((position) => {
    const row = positions[position];
    row.total = row.players + row.projections + row.rankings;
  });

  return {
    missingPositions: fantasyCoveragePositions.filter(
      (position) => positions[position].total === 0,
    ),
    positions,
    totalPlayers: projections.length,
    totalProjections: projections.filter(
      (projection) => typeof projection.projection === "number",
    ).length,
    totalRankings: projections.filter(
      (projection) =>
        typeof projection.sourceRank === "number" ||
        typeof projection.positionRank === "number",
    ).length,
  };
}

function mergeFantasyCoverageStatus(
  existingCoverage: NflFantasyCoverageStatus | undefined,
  bridgeCoverage: NflFantasyCoverageStatus,
): NflFantasyCoverageStatus {
  const baseCoverage =
    existingCoverage ??
    ({
      missingPositions: fantasyCoveragePositions,
      positions: emptyFantasyCoveragePositions(),
      totalPlayers: 0,
      totalProjections: 0,
      totalRankings: 0,
    } satisfies NflFantasyCoverageStatus);
  const positions = emptyFantasyCoveragePositions();

  fantasyCoveragePositions.forEach((position) => {
    positions[position] = {
      players:
        baseCoverage.positions[position].players +
        bridgeCoverage.positions[position].players,
      projections:
        baseCoverage.positions[position].projections +
        bridgeCoverage.positions[position].projections,
      rankings:
        baseCoverage.positions[position].rankings +
        bridgeCoverage.positions[position].rankings,
      total:
        baseCoverage.positions[position].total +
        bridgeCoverage.positions[position].total,
    };
  });

  return {
    missingPositions: fantasyCoveragePositions.filter(
      (position) => positions[position].total === 0,
    ),
    positions,
    totalPlayers: baseCoverage.totalPlayers + bridgeCoverage.totalPlayers,
    totalProjections:
      baseCoverage.totalProjections + bridgeCoverage.totalProjections,
    totalRankings: baseCoverage.totalRankings + bridgeCoverage.totalRankings,
  };
}

function emptyFantasyCoveragePositions(): NflFantasyCoverageStatus["positions"] {
  return fantasyCoveragePositions.reduce<NflFantasyCoverageStatus["positions"]>(
    (positions, position) => {
      positions[position] = {
        players: 0,
        projections: 0,
        rankings: 0,
        total: 0,
      };
      return positions;
    },
    {} as NflFantasyCoverageStatus["positions"],
  );
}

function fantasyPositionCountsFromSourceProjections(
  projections: FantasySourceProjection[],
): FantasyPositionCounts {
  return projections.reduce(
    (counts, projection) => {
      counts[normalizeScoutingPosition(projection.position)] += 1;
      return counts;
    },
    {
      DST: 0,
      K: 0,
      QB: 0,
      RB: 0,
      TE: 0,
      WR: 0,
    } satisfies FantasyPositionCounts,
  );
}

function fantasyFreshnessFromUpdatedAt(
  updatedAt: string | null | undefined,
): FantasyProviderFreshness {
  const timestamp = Date.parse(updatedAt ?? "");

  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }

  const ageMs = Date.now() - timestamp;

  return ageMs <= 1000 * 60 * 60 * 24 * 7 ? "fresh" : "stale";
}

function fantasyProjectionContextsFromMatchups(
  matchups: NflMatchup[],
): FantasyProjectionMatchupContext[] {
  return matchups.flatMap((matchup) => [
    {
      crowdNudge: fantasyCrowdNudgeForSide(matchup, "home"),
      crowdSignal: fantasyCrowdSignalForSide(matchup, "home"),
      opponent: `vs ${matchup.away.code}`,
      opponentDefense: matchup.away.defense,
      opponentWin: matchup.awayWin,
      pace: matchup.pace,
      team: matchup.home.code,
      teamHealth: matchup.home.injuries,
      teamOffense: matchup.home.offense,
      teamWin: matchup.homeWin,
      venue: matchup.venue,
      weather: matchup.weather,
    },
    {
      crowdNudge: fantasyCrowdNudgeForSide(matchup, "away"),
      crowdSignal: fantasyCrowdSignalForSide(matchup, "away"),
      opponent: `at ${matchup.home.code}`,
      opponentDefense: matchup.home.defense,
      opponentWin: matchup.homeWin,
      pace: matchup.pace,
      team: matchup.away.code,
      teamHealth: matchup.away.injuries,
      teamOffense: matchup.away.offense,
      teamWin: matchup.awayWin,
      venue: matchup.venue,
      weather: matchup.weather,
    },
  ]);
}

function fantasyCrowdNudgeForSide(matchup: NflMatchup, side: "home" | "away") {
  const nudge = matchup.marketPulse?.nudge;

  if (!nudge?.applied) {
    return 0;
  }

  const pointDelta = side === "home" ? nudge.homeDelta : nudge.awayDelta;

  return round1(clampValue(pointDelta * 0.06, -0.3, 0.3));
}

function fantasyCrowdSignalForSide(matchup: NflMatchup, side: "home" | "away") {
  if (!matchup.marketPulse?.nudge.applied) {
    return undefined;
  }

  const team = side === "home" ? matchup.home.code : matchup.away.code;

  return `Crowd read nudged ${team} within the tiny cap`;
}

function cleanProviderFileLabel(fileName: string) {
  return fileName.replace(/\.(csv|json|txt)$/i, "").replace(/[-_]+/g, " ").trim();
}

function sleeperImportUrl({
  leagueId,
  query,
  userId,
  week,
}: {
  leagueId?: string;
  query?: string;
  userId?: string;
  week?: string;
}) {
  const params = new URLSearchParams();

  if (leagueId) {
    params.set("leagueId", leagueId);
  }

  if (query) {
    params.set("q", query);
  }

  if (userId) {
    params.set("userId", userId);
  }

  if (week) {
    params.set("week", week);
  }

  return `/api/nfl/fantasy/sleeper?${params}`;
}

function readSleeperSavedConnection(): SleeperSavedConnection | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawConnection = window.localStorage.getItem(sleeperStorageKey);

    if (!rawConnection) {
      return null;
    }

    return sanitizeSleeperSavedConnection(JSON.parse(rawConnection));
  } catch {
    return null;
  }
}

function writeSleeperSavedConnection(connection: SleeperSavedConnection) {
  if (typeof window === "undefined" || !connection.leagueId) {
    return;
  }

  try {
    window.localStorage.setItem(sleeperStorageKey, JSON.stringify(connection));
  } catch {
    // Browser storage can be unavailable in private sessions; Sleeper still works.
  }
}

function sanitizeSleeperSavedConnection(
  value: unknown,
): SleeperSavedConnection | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const saved = value as Partial<SleeperSavedConnection>;
  const importedLeague = sanitizeImportedFantasyLeague(saved.importedLeague);

  if (!importedLeague?.sleeper) {
    return null;
  }

  const leagueId =
    typeof saved.leagueId === "string" && saved.leagueId.trim()
      ? saved.leagueId.trim()
      : importedLeague.sleeper.leagueId;

  if (!leagueId) {
    return null;
  }

  return {
    importedLeague,
    leagueId,
    query: typeof saved.query === "string" ? saved.query : "",
    refreshedAt:
      typeof saved.refreshedAt === "string" && saved.refreshedAt
        ? saved.refreshedAt
        : new Date().toISOString(),
    useAutoWeek: saved.useAutoWeek !== false,
    userId:
      typeof saved.userId === "string"
        ? saved.userId
        : importedLeague.sleeper.userId ?? "",
    week: typeof saved.week === "string" ? saved.week : "",
  };
}

function sanitizeSleeperLeagueOptionsResponse(
  value: unknown,
): SleeperLeagueOptionsResponse | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const payload = value as Partial<SleeperLeagueOptionsResponse>;

  if (payload.mode !== "league-options" || !Array.isArray(payload.leagues)) {
    return null;
  }

  const leagues = payload.leagues
    .map((league) => sanitizeSleeperLeagueOption(league))
    .filter((league): league is SleeperLeagueOption => league !== null);

  if (leagues.length === 0) {
    return null;
  }

  return {
    leagues,
    message: typeof payload.message === "string" ? payload.message : undefined,
    mode: "league-options",
    season: typeof payload.season === "string" ? payload.season : "",
    userId: typeof payload.userId === "string" ? payload.userId : "",
    username: typeof payload.username === "string" ? payload.username : undefined,
    week: typeof payload.week === "number" ? payload.week : undefined,
  };
}

function sanitizeSleeperLeagueOption(value: unknown): SleeperLeagueOption | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const option = value as Partial<SleeperLeagueOption>;

  if (typeof option.leagueId !== "string" || typeof option.name !== "string") {
    return null;
  }

  return {
    isBestGuess: option.isBestGuess === true,
    leagueId: option.leagueId,
    name: option.name,
    rosterCount: typeof option.rosterCount === "number" ? option.rosterCount : undefined,
    season: typeof option.season === "string" ? option.season : undefined,
    status: typeof option.status === "string" ? option.status : undefined,
    userId: typeof option.userId === "string" ? option.userId : undefined,
  };
}

function sleeperImportSuccessMessage(importedLeague: ImportedFantasyLeague) {
  const receipt = importedLeague.sleeper;

  if (!receipt) {
    return `${importedLeague.label} loaded with ${importedLeague.teams.length} fantasy team${importedLeague.teams.length === 1 ? "" : "s"}.`;
  }

  const matchupCopy =
    receipt.status === "matched"
      ? `matchup ${receipt.matchupId}`
      : receipt.status === "no-matchup"
        ? "no matchup found"
        : "no user roster matched";
  const settingsCopy = importedLeague.settings
    ? ` · ${importedLeague.settings.formatLabel}, ${importedLeague.settings.lineupSlotCount} starters`
    : "";

  return `${receipt.leagueName} loaded · season ${receipt.season ?? importedLeague.season ?? "?"} · week ${receipt.week ?? importedLeague.week ?? "?"} · ${importedLeague.teams.length} teams · ${matchupCopy} · ${receipt.rosterCount} rosters${settingsCopy}.`;
}

function weekFromDatasetLabel(weekLabel: string) {
  return weekLabel.match(/\d+/)?.[0];
}

function buildFantasySourceLanes({
  contextStatus,
  dataset,
  fantasyImport,
  matchups,
  players,
  providerBridgeImport,
}: {
  contextStatus: FantasyContextStatus;
  dataset: NflSeerDataset;
  fantasyImport: ImportedFantasyLeague | null;
  matchups: NflMatchup[];
  players: FantasyPlayer[];
  providerBridgeImport: FantasyProviderBridgeImport | null;
}): FantasySourceLane[] {
  const rosterRows = fantasyImport
    ? fantasyImport.teams.reduce((total, team) => total + team.rosterIds.length, 0)
    : players.length;
  const projectionRows =
    providerBridgeImport?.projections.filter(
      (projection) => typeof projection.projection === "number",
    ).length ?? 0;
  const rankingRows =
    providerBridgeImport?.projections.filter(
      (projection) =>
        typeof projection.sourceRank === "number" ||
        typeof projection.positionRank === "number",
    ).length ?? 0;
  const projectionFreshness = providerBridgeImport
    ? fantasyFreshnessFromUpdatedAt(providerBridgeImport.updatedAt)
    : "unknown";
  const crowdRows = matchups.filter((matchup) => matchup.marketPulse?.nudge.applied).length;
  const crowdFreshness = fantasyFreshnessFromUpdatedAt(newestMarketPulseCapturedAt(matchups));
  const contextStatusValue =
    contextStatus.status === "fallback" ? "fallback" : "live";

  return [
    {
      freshness: fantasyImport ? "fresh" : "unknown",
      id: "source-roster",
      kind: "roster",
      label: "Roster source",
      message: fantasyImport
        ? "Imported teams drive team analysis, lineup checks, and comparisons."
        : "Sample rosters are carrying the lab until a league or roster lands.",
      positions: fantasyPositionCountsFromPlayers(
        fantasyImport?.players.length ? fantasyImport.players : players,
      ),
      providerName: fantasyImport?.label ?? "Sample lab rosters",
      rows: { ...emptyFantasySourceRows(), roster: rosterRows },
      source: fantasyImport?.source ?? "sample",
      status: fantasyImport ? "live" : "fallback",
      trustWeight: fantasyRosterTrust(fantasyImport),
    },
    {
      freshness: projectionFreshness,
      id: "source-projection",
      kind: "projection",
      label: "Projection source",
      message: providerBridgeImport
        ? "Provider points set the source projection before context adjusts it."
        : "Seeded projection spine stays active until a provider sheet is loaded.",
      positions: providerBridgeImport
        ? fantasyPositionCountsFromSourceProjections(
            providerBridgeImport.projections.filter(
              (projection) => typeof projection.projection === "number",
            ),
          )
        : fantasyPositionCountsFromPlayers(players),
      providerName: providerBridgeImport?.providerLabel ?? "MatchSeer seed",
      rows: { ...emptyFantasySourceRows(), projections: projectionRows },
      source: providerBridgeImport ? "browser upload" : "seeded spine",
      status: providerBridgeImport ? "live" : "fallback",
      trustWeight: fantasyProjectionTrust(providerBridgeImport, projectionFreshness),
    },
    {
      freshness: projectionFreshness,
      id: "source-ranking",
      kind: "ranking",
      label: "Ranking source",
      message: providerBridgeImport
        ? "Ranks and position ranks guide board order without overpowering points."
        : "Board order uses placeholder ranks until a ranking source arrives.",
      positions: providerBridgeImport
        ? fantasyPositionCountsFromSourceProjections(
            providerBridgeImport.projections.filter(
              (projection) =>
                typeof projection.sourceRank === "number" ||
                typeof projection.positionRank === "number",
            ),
          )
        : fantasyPositionCountsFromPlayers(players),
      providerName: providerBridgeImport?.providerLabel ?? "MatchSeer seed",
      rows: { ...emptyFantasySourceRows(), rankings: rankingRows },
      source: providerBridgeImport ? "browser upload" : "seeded spine",
      status: rankingRows > 0 ? "live" : "fallback",
      trustWeight: fantasyRankingTrust(rankingRows, projectionFreshness),
    },
    {
      freshness: contextStatus.freshness,
      id: "source-context",
      kind: "context",
      label: "Game context",
      message: contextStatus.message,
      positions: contextPositionCounts(contextStatus.coveredTeams),
      providerName: "Pro football matchup layer",
      rows: { ...emptyFantasySourceRows(), context: contextStatus.coveredTeams },
      source: "schedule, venue, weather, defense",
      status: contextStatusValue,
      trustWeight: fantasyContextTrust(contextStatus),
    },
    {
      freshness: crowdFreshness,
      id: "source-crowd",
      kind: "crowd",
      label: "Crowd read",
      message:
        crowdRows > 0
          ? "Fan consensus can move fantasy by a tiny capped breeze."
          : "Crowd read is waiting, so fantasy stays on source and game context.",
      positions: contextPositionCounts(crowdRows),
      providerName: dataset.providerStatus.market === "live" ? "Market pulse" : "Waiting",
      rows: { ...emptyFantasySourceRows(), crowd: crowdRows },
      source: "fan consensus pulse",
      status: dataset.providerStatus.market === "live" && crowdRows > 0 ? "live" : "fallback",
      trustWeight: fantasyCrowdTrust(crowdRows),
    },
  ];
}

function emptyFantasySourceRows(): FantasySourceRows {
  return {
    context: 0,
    crowd: 0,
    projections: 0,
    rankings: 0,
    roster: 0,
  };
}

function fantasyPositionCountsFromPlayers(players: FantasyPlayer[]): FantasyPositionCounts {
  return players.reduce(
    (counts, player) => {
      counts[normalizeScoutingPosition(player.position)] += 1;
      return counts;
    },
    {
      DST: 0,
      K: 0,
      QB: 0,
      RB: 0,
      TE: 0,
      WR: 0,
    } satisfies FantasyPositionCounts,
  );
}

function contextPositionCounts(count: number): FantasyPositionCounts {
  return fantasyCoveragePositions.reduce(
    (counts, position) => {
      counts[position] = count > 0 ? count : 0;
      return counts;
    },
    {
      DST: 0,
      K: 0,
      QB: 0,
      RB: 0,
      TE: 0,
      WR: 0,
    } satisfies FantasyPositionCounts,
  );
}

function fantasyRosterTrust(fantasyImport: ImportedFantasyLeague | null) {
  if (!fantasyImport) {
    return 48;
  }

  if (fantasyImport.source === "sleeper") {
    return 84;
  }

  if (fantasyImport.source === "screenshot") {
    return 68;
  }

  return 74;
}

function fantasyProjectionTrust(
  providerBridgeImport: FantasyProviderBridgeImport | null,
  freshness: FantasyProviderFreshness,
) {
  if (!providerBridgeImport) {
    return 55;
  }

  return freshness === "stale" ? 68 : freshness === "unknown" ? 76 : 86;
}

function fantasyRankingTrust(rowCount: number, freshness: FantasyProviderFreshness) {
  if (rowCount === 0) {
    return 44;
  }

  return freshness === "stale" ? 58 : 72;
}

function fantasyContextTrust(contextStatus: FantasyContextStatus) {
  if (contextStatus.status === "live") {
    return 76;
  }

  if (contextStatus.status === "partial") {
    return 62;
  }

  return 45;
}

function fantasyCrowdTrust(crowdRows: number) {
  return crowdRows > 0 ? 8 : 0;
}

function newestMarketPulseCapturedAt(matchups: NflMatchup[]) {
  return matchups
    .map((matchup) => matchup.marketPulse?.capturedAt)
    .filter((capturedAt): capturedAt is string => Boolean(capturedAt))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function mergeNflDataset(payload: Partial<NflSeerDataset>): NflSeerDataset {
  const incomingMatchups = Array.isArray(payload.matchups)
    ? payload.matchups.filter(isNflMatchup)
    : [];
  const incomingFantasyPlayers = Array.isArray(payload.fantasyPlayers)
    ? payload.fantasyPlayers.filter(isFantasyPlayer)
    : [];
  const matchups =
    incomingMatchups.length > 0 ? incomingMatchups : seededNflDataset.matchups;
  const fantasyPlayers =
    incomingFantasyPlayers.length > 0
      ? incomingFantasyPlayers
      : seededNflDataset.fantasyPlayers;
  const providerStatus = payload.providerStatus ?? seededNflDataset.providerStatus;
  const fantasyProviders = sanitizeFantasyProviders(
    providerStatus.fantasyProviders,
  );
  const fantasyCoverage = sanitizeFantasyCoverage(providerStatus.fantasyCoverage);
  const hasLiveFantasyProvider = fantasyProviders.some(
    (provider) => provider.status === "live",
  );

  return {
    source: isNflDatasetSource(payload.source)
      ? payload.source
      : incomingMatchups.length > 0
        ? "configured-feed"
        : "seeded-fallback",
    season: typeof payload.season === "string" ? payload.season : seededNflDataset.season,
    weekLabel:
      typeof payload.weekLabel === "string"
        ? payload.weekLabel
        : seededNflDataset.weekLabel,
    updatedAt:
      typeof payload.updatedAt === "string"
        ? payload.updatedAt
        : new Date().toISOString(),
    matchups,
    fantasyPlayers,
    providerStatus: {
      schedule: providerStatus.schedule === "live" ? "live" : "fallback",
      fantasy:
        providerStatus.fantasy === "live" &&
        (incomingFantasyPlayers.length > 0 || hasLiveFantasyProvider)
          ? "live"
          : "fallback",
      market:
        providerStatus.market === "live" &&
        incomingMatchups.some((matchup) => matchup.marketPulse)
          ? "live"
          : "fallback",
      notes:
        Array.isArray(providerStatus.notes) && providerStatus.notes.length > 0
          ? providerStatus.notes.filter((note) => typeof note === "string")
          : incomingFantasyPlayers.length > 0
            ? []
            : ["Fantasy board is still using the seeded preseason rail."],
      fantasyCoverage,
      fantasyProviders,
    },
  };
}

function sanitizeFantasyProviders(value: unknown): NflFantasyProviderStatus[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const provider = item as Partial<NflFantasyProviderStatus>;

    if (
      typeof provider.id !== "string" ||
      typeof provider.label !== "string" ||
      !isFantasyProviderKind(provider.kind) ||
      !isFantasyProviderStatusValue(provider.status) ||
      !isFantasyProviderFreshness(provider.freshness) ||
      typeof provider.message !== "string"
    ) {
      return [];
    }

    return [
      {
        count: numberFromUnknown(provider.count),
        freshness: provider.freshness,
        id: provider.id,
        kind: provider.kind,
        label: provider.label,
        message: provider.message,
        positions: sanitizeFantasyPositionCounts(provider.positions),
        source: typeof provider.source === "string" ? provider.source : null,
        status: provider.status,
        updatedAt:
          typeof provider.updatedAt === "string" ? provider.updatedAt : null,
      },
    ];
  });
}

function sanitizeFantasyCoverage(
  value: unknown,
): NflFantasyCoverageStatus | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const coverage = value as Partial<NflFantasyCoverageStatus>;
  const positionsRecord =
    typeof coverage.positions === "object" && coverage.positions !== null
      ? (coverage.positions as Partial<NflFantasyCoverageStatus["positions"]>)
      : {};
  const positions = fantasyCoveragePositions.reduce<
    NflFantasyCoverageStatus["positions"]
  >(
    (nextPositions, position) => {
      const row = positionsRecord[position];
      const safeRow =
        typeof row === "object" && row !== null
          ? row
          : { players: 0, projections: 0, rankings: 0, total: 0 };

      nextPositions[position] = {
        players: numberFromUnknown(safeRow.players),
        projections: numberFromUnknown(safeRow.projections),
        rankings: numberFromUnknown(safeRow.rankings),
        total: numberFromUnknown(safeRow.total),
      };

      if (nextPositions[position].total === 0) {
        nextPositions[position].total =
          nextPositions[position].players +
          nextPositions[position].projections +
          nextPositions[position].rankings;
      }

      return nextPositions;
    },
    {} as NflFantasyCoverageStatus["positions"],
  );
  const missingPositions = Array.isArray(coverage.missingPositions)
    ? coverage.missingPositions.filter(isFantasyPosition)
    : fantasyCoveragePositions.filter((position) => positions[position].total === 0);

  return {
    missingPositions,
    positions,
    totalPlayers: numberFromUnknown(coverage.totalPlayers),
    totalProjections: numberFromUnknown(coverage.totalProjections),
    totalRankings: numberFromUnknown(coverage.totalRankings),
  };
}

function sanitizeFantasyPositionCounts(value: unknown): FantasyPositionCounts {
  const record =
    typeof value === "object" && value !== null
      ? (value as Partial<FantasyPositionCounts>)
      : {};

  return fantasyCoveragePositions.reduce(
    (counts, position) => {
      counts[position] = numberFromUnknown(record[position]);
      return counts;
    },
    {
      DST: 0,
      K: 0,
      QB: 0,
      RB: 0,
      TE: 0,
      WR: 0,
    } satisfies FantasyPositionCounts,
  );
}

function isFantasyProviderKind(value: unknown): value is FantasyProviderKind {
  return (
    value === "sleeper" ||
    value === "players" ||
    value === "projections" ||
    value === "rankings"
  );
}

function isFantasyProviderStatusValue(
  value: unknown,
): value is FantasyProviderStatusValue {
  return (
    value === "live" ||
    value === "fallback" ||
    value === "missing" ||
    value === "error"
  );
}

function isFantasyProviderFreshness(
  value: unknown,
): value is FantasyProviderFreshness {
  return value === "fresh" || value === "stale" || value === "unknown";
}

function isFantasyPosition(value: unknown): value is FantasyPosition {
  return (
    value === "QB" ||
    value === "RB" ||
    value === "WR" ||
    value === "TE" ||
    value === "K" ||
    value === "DST"
  );
}

function numberFromUnknown(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

function isNflMatchup(value: unknown): value is NflMatchup {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const matchup = value as Partial<NflMatchup>;

  return (
    typeof matchup.id === "string" &&
    typeof matchup.week === "string" &&
    typeof matchup.slot === "string" &&
    typeof matchup.venue === "string" &&
    typeof matchup.weather === "string" &&
    isNflTeam(matchup.home) &&
    isNflTeam(matchup.away) &&
    typeof matchup.homeWin === "number" &&
    typeof matchup.awayWin === "number" &&
    typeof matchup.projected === "string" &&
    typeof matchup.confidence === "number" &&
    typeof matchup.chaos === "number" &&
    typeof matchup.pace === "number" &&
    typeof matchup.read === "string" &&
    Array.isArray(matchup.edges) &&
    (matchup.marketPulse == null || isNflMarketPulse(matchup.marketPulse))
  );
}

function isNflMarketPulse(value: unknown): value is NflMarketPulse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const pulse = value as Partial<NflMarketPulse>;
  const nudge = pulse.nudge as Partial<NflMarketPulse["nudge"]> | undefined;

  return (
    pulse.source === "polymarket" &&
    (typeof pulse.capturedAt === "string" || pulse.capturedAt === null) &&
    typeof pulse.home === "number" &&
    typeof pulse.away === "number" &&
    typeof pulse.liquidityScore === "number" &&
    (pulse.leader === "home" || pulse.leader === "away") &&
    (pulse.alignment === "aligned" || pulse.alignment === "split") &&
    (typeof pulse.marketSlug === "string" || pulse.marketSlug === null) &&
    (typeof pulse.question === "string" || pulse.question === null) &&
    typeof nudge === "object" &&
    nudge !== null &&
    typeof nudge.applied === "boolean" &&
    typeof nudge.homeDelta === "number" &&
    typeof nudge.awayDelta === "number" &&
    typeof nudge.cap === "number" &&
    typeof nudge.summary === "string"
  );
}

function isNflTeam(value: unknown): value is NflTeam {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const team = value as Partial<NflTeam>;

  return (
    typeof team.code === "string" &&
    typeof team.name === "string" &&
    typeof team.city === "string" &&
    typeof team.color === "string" &&
    typeof team.offense === "number" &&
    typeof team.defense === "number" &&
    typeof team.qb === "number" &&
    typeof team.trenches === "number" &&
    typeof team.coaching === "number" &&
    typeof team.injuries === "number"
  );
}

function isFantasyPlayer(value: unknown): value is FantasyPlayer {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const player = value as Partial<FantasyPlayer>;
  const baseline = player.baseline as Partial<FantasyPlayer["baseline"]> | undefined;

  return (
    typeof player.id === "string" &&
    typeof player.name === "string" &&
    typeof player.team === "string" &&
    typeof player.position === "string" &&
    typeof player.opponent === "string" &&
    typeof player.color === "string" &&
    typeof baseline === "object" &&
    baseline !== null &&
    typeof baseline.rushYards === "number" &&
    typeof baseline.rushTd === "number" &&
    typeof baseline.receivingYards === "number" &&
    typeof baseline.receivingTd === "number" &&
    typeof baseline.receptions === "number" &&
    typeof player.targetShare === "number" &&
    typeof player.carryShare === "number" &&
    typeof player.touchdownPulse === "number" &&
    typeof player.matchup === "number" &&
    typeof player.health === "number" &&
    typeof player.chaos === "number" &&
    typeof player.nflRank === "number" &&
    typeof player.seerRank === "number" &&
    Array.isArray(player.traits) &&
    typeof player.read === "string"
  );
}

function isNflDatasetSource(value: unknown): value is NflSeerDataset["source"] {
  return (
    value === "espn-scoreboard" ||
    value === "configured-feed" ||
    value === "seeded-fallback"
  );
}

function dataSourceLabel(source: NflSeerDataset["source"], status: NflDataStatus) {
  if (status === "loading") {
    return "Syncing pro football data";
  }

  if (source === "espn-scoreboard") {
    return "Pro football slate live";
  }

  if (source === "configured-feed") {
    return "Pro football feed live";
  }

  return "Seeded lab mode";
}

function formatDataUpdated(value: string) {
  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) {
    return "freshness unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/New_York",
  }).format(updatedAt);
}

function homeNoiseBaseline(matchup: NflMatchup) {
  if (matchup.venue.includes("Arrowhead")) {
    return 78;
  }

  if (matchup.venue.includes("Highmark")) {
    return 68;
  }

  if (matchup.venue.includes("Lincoln")) {
    return 64;
  }

  return 58;
}

function projectedTotal(projected: string) {
  const scores = projected.match(/(\d+)-(\d+)/);

  if (!scores) {
    return 47;
  }

  return Number(scores[1]) + Number(scores[2]);
}

function weatherDrag(matchup: NflMatchup) {
  return matchup.weather.toLowerCase().includes("wind") ? 68 : 24;
}

function clampProbability(value: number) {
  return Math.max(25, Math.min(75, value));
}

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatRankDelta(delta: number) {
  if (delta > 0) {
    return `+${delta} vs base`;
  }

  if (delta < 0) {
    return `${delta} vs base`;
  }

  return "even";
}

function formatFantasyDelta(delta: number) {
  const rounded = round1(delta);

  if (rounded > 0) {
    return `(+${rounded.toFixed(1)})`;
  }

  if (rounded < 0) {
    return `(${rounded.toFixed(1)})`;
  }

  return "(even)";
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}
