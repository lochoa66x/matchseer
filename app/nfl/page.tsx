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
  createSeededFantasyPlayerPool,
  createManualFantasyLeague,
  mergeFantasyPlayerPools,
  sanitizeImportedFantasyLeague,
  type ImportedFantasyLeague,
  type ImportedFantasyTeam,
  type NflFantasyPlayer,
} from "../../lib/nfl-fantasy-import";

type ScoringFormat = "standard" | "halfPpr" | "fullPpr";
type FantasyTeamLens = "redraft" | "dynasty";
type ScoutingPosition = "ALL" | "QB" | "RB" | "WR" | "TE" | "K" | "DST";
type ScoutingPlayerPosition = Exclude<ScoutingPosition, "ALL">;
type ScoutingDepth = "top10" | "top25" | "deep";
type FantasyProviderStatusValue = "live" | "fallback" | "missing" | "error";
type FantasyProviderFreshness = "fresh" | "stale" | "unknown";
type FantasyProviderKind = "sleeper" | "players" | "projections" | "rankings";
type FantasyPosition = ScoutingPlayerPosition;
type FantasyPositionCounts = Record<FantasyPosition, number>;
type FantasyLineupSlotId =
  | "QB"
  | "RB1"
  | "RB2"
  | "WR1"
  | "WR2"
  | "TE"
  | "FLEX"
  | "K"
  | "DEF";

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
  strongestEdge: FantasyPositionEdge;
  swingFactors: string[];
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
  { value: "top10", label: "Top 10", limit: 10, summary: "starter lane" },
  { value: "top25", label: "Top 25", limit: 25, summary: "full roster" },
  { value: "deep", label: "Dynasty deep", limit: 80, summary: "ultra-deep shelf" },
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
  standard: "Touchdowns and yardage carry the lantern.",
  halfPpr: "Volume matters, but touchdowns still get teeth.",
  fullPpr: "Targets glow brighter; reception magnets rise.",
};

const teamLensLabels: Record<FantasyTeamLens, string> = {
  redraft: "Season-now",
  dynasty: "Dynasty",
};

const receptionPoints: Record<ScoringFormat, number> = {
  standard: 0,
  halfPpr: 0.5,
  fullPpr: 1,
};

const nflIndependenceDisclaimer =
  "Not affiliated with or endorsed by the NFL, NFLPA, or any team. For entertainment and analysis only.";

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

const seededMatchups: NflMatchup[] = [
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

const seededFantasyPlayers: FantasyPlayer[] = createSeededFantasyPlayerPool();

const seededPlayerPair = [seededFantasyPlayers[0], seededFantasyPlayers[1]] as const;

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
    notes: ["Using seeded lab data until the NFL feed responds."],
  },
};

export default function NflPage() {
  const [nflDataset, setNflDataset] = useState<NflSeerDataset>(seededNflDataset);
  const [nflDataStatus, setNflDataStatus] = useState<NflDataStatus>("loading");
  const [activeMatchupId, setActiveMatchupId] = useState(seededMatchups[0].id);
  const [leftPlayerId, setLeftPlayerId] = useState(seededPlayerPair[0].id);
  const [rightPlayerId, setRightPlayerId] = useState(seededPlayerPair[1].id);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>("fullPpr");
  const [teamLens, setTeamLens] = useState<FantasyTeamLens>("redraft");
  const [activeFantasyTeamId, setActiveFantasyTeamId] = useState("seer-house");
  const [opponentFantasyTeamId, setOpponentFantasyTeamId] = useState("rival-house");
  const [fantasyImport, setFantasyImport] = useState<ImportedFantasyLeague | null>(null);
  const [sleeperQuery, setSleeperQuery] = useState("");
  const [sleeperImportStatus, setSleeperImportStatus] =
    useState<FantasyImportStatus>("idle");
  const [sleeperImportMessage, setSleeperImportMessage] = useState(
    "Sleeper can load public league rosters by username, league id, or league link.",
  );
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
  const [scoutStatus, setScoutStatus] = useState<ScoutStatus>("idle");
  const [scoutRead, setScoutRead] = useState<NflScoutingAnalysis | null>(null);
  const [scenarioLeversByMatchup, setScenarioLeversByMatchup] = useState<
    Record<string, ScenarioLevers>
  >({});
  const matchups = nflDataset.matchups.length > 0 ? nflDataset.matchups : seededMatchups;
  const baseFantasyPlayers =
    nflDataset.fantasyPlayers.length > 0
      ? nflDataset.fantasyPlayers
      : seededFantasyPlayers;
  const fantasyPlayers = useMemo(
    () =>
      fantasyImport
        ? mergeFantasyPlayerPools(baseFantasyPlayers, fantasyImport.players)
        : baseFantasyPlayers,
    [baseFantasyPlayers, fantasyImport],
  );
  const fantasyContextLayer = useMemo(
    () =>
      buildFantasyContextLayer({
        dataset: nflDataset,
        matchups,
        players: fantasyPlayers,
      }),
    [fantasyPlayers, matchups, nflDataset],
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
    matchups.find((matchup) => matchup.id === activeMatchupId) ?? matchups[0];
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
  const leftPlayer =
    fantasyPlayers.find((player) => player.id === leftPlayerId) ??
    defaultPlayerPair[0];
  const rightPlayer =
    fantasyPlayers.find((player) => player.id === rightPlayerId) ??
    defaultPlayerPair[1];
  const startLean = useMemo(
    () => compareFantasyPlayers(leftPlayer, rightPlayer, scoringFormat),
    [leftPlayer, rightPlayer, scoringFormat],
  );
  const scoutingBoard = useMemo(
    () => buildScoutingBoard(fantasyPlayers, scoringFormat, fantasyContextLayer.byTeam),
    [fantasyContextLayer.byTeam, fantasyPlayers, scoringFormat],
  );
  const visibleScoutingRows = useMemo(
    () => filterScoutingRows(scoutingBoard, scoutingPosition, scoutingDepth),
    [scoutingBoard, scoutingDepth, scoutingPosition],
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

  useEffect(() => {
    let cancelled = false;

    async function loadNflDataset() {
      try {
        const response = await fetch("/api/nfl/seer", { cache: "no-store" });
        const payload = (await response.json()) as Partial<NflSeerDataset>;

        if (!response.ok) {
          throw new Error("NFL data feed failed");
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
    if (!matchups.some((matchup) => matchup.id === activeMatchupId)) {
      setActiveMatchupId(matchups[0]?.id ?? seededMatchups[0].id);
    }
  }, [activeMatchupId, matchups]);

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

    setActiveFantasyTeamId(fantasyImport.teams[0].id);
    setOpponentFantasyTeamId(
      fantasyImport.teams.find((team) => team.id !== fantasyImport.teams[0].id)?.id ??
        fantasyImport.teams[0].id,
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

  async function requestSleeperImport() {
    const query = sleeperQuery.trim();

    if (!query) {
      setSleeperImportStatus("error");
      setSleeperImportMessage("Drop in a Sleeper username, league id, or league link.");
      return;
    }

    setSleeperImportStatus("loading");
    setSleeperImportMessage("Calling Sleeper and shaping those rosters...");

    try {
      const response = await fetch(
        `/api/nfl/fantasy/sleeper?${new URLSearchParams({ q: query })}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { error?: string };
      const importedLeague = sanitizeImportedFantasyLeague(payload);

      if (!response.ok || !importedLeague) {
        throw new Error(payload.error ?? "Sleeper import did not return usable teams.");
      }

      applyImportedFantasyLeague(
        importedLeague,
        `${importedLeague.label} loaded with ${importedLeague.teams.length} fantasy team${importedLeague.teams.length === 1 ? "" : "s"}.`,
      );
      setSleeperImportStatus("ready");
    } catch (error) {
      setSleeperImportStatus("error");
      setSleeperImportMessage(
        error instanceof Error
          ? error.message
          : "Sleeper import failed. Paste the rosters and we can still cook.",
      );
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
          <em>NFL Lab</em>
        </a>
        <nav aria-label="NFL navigation">
          <a href="#team-seer">Team Seer</a>
          <a href="#scenario-lab">What-if Lab</a>
          <a href="#fantasy-seer">Fantasy Seer</a>
          <a href="#fantasy-team-lab">Team Lab</a>
          <a href="#player-compare">Player vs player</a>
        </nav>
      </header>

      <div className="nfl-disclaimer" role="note">
        <ShieldCheck size={17} />
        <span>{nflIndependenceDisclaimer}</span>
      </div>

      <NflDataRibbon
        contextStatus={fantasyContextLayer.status}
        dataset={nflDataset}
        status={nflDataStatus}
      />

      <section className="nfl-hero" id="team-seer">
        <div className="nfl-matchup-rail" aria-label="NFL matchup list">
          <div className="nfl-section-kicker">
            <Trophy size={17} />
            Team vs team
          </div>
          <h1>Gridiron Seer</h1>
          <p>
            Same Seer brain, new field: team pulse, game script, fantasy pressure,
            and chaos without pretending the future is a spreadsheet.
          </p>
          <div className="nfl-matchup-list">
            {matchups.map((matchup) => (
              <button
                className={cx(
                  "nfl-matchup-button",
                  matchup.id === activeMatchup.id && "active",
                )}
                key={matchup.id}
                onClick={() => setActiveMatchupId(matchup.id)}
                type="button"
              >
                <span>{matchup.week}</span>
                <strong>
                  {matchup.away.code} at {matchup.home.code}
                </strong>
                <em>{matchup.projected}</em>
              </button>
            ))}
          </div>
        </div>

        <article className="nfl-seer-card">
          <div className="nfl-card-topline">
            <span>{activeMatchup.slot}</span>
            <strong>{activeMatchup.venue}</strong>
          </div>
          <div className="nfl-teams">
            <TeamPill team={activeMatchup.away} />
            <span>at</span>
            <TeamPill team={activeMatchup.home} align="right" />
          </div>
          <div className="nfl-projection-strip">
            <div>
              <span>Seer lean</span>
              <strong>
                {activeScenario.leanCode} {activeScenario.leanProbability}%
              </strong>
            </div>
            <div>
              <span>Projected</span>
              <strong>{activeScenario.projected}</strong>
            </div>
            <div>
              <span>Game script</span>
              <strong>{activeScenario.pace}% pace</strong>
            </div>
          </div>
          <p className="nfl-seer-read">{activeScenario.read}</p>
          <ProbabilityBar
            leftColor={activeMatchup.away.color}
            leftLabel={activeMatchup.away.code}
            leftValue={activeScenario.awayWin}
            rightColor={activeMatchup.home.color}
            rightLabel={activeMatchup.home.code}
            rightValue={activeScenario.homeWin}
          />
          <MarketBlendStrip matchup={activeMatchup} />
          <div className="nfl-meter-grid">
            <MiniMeter icon={<Gauge size={16} />} label="Confidence" value={activeScenario.confidence} />
            <MiniMeter icon={<Activity size={16} />} label="Chaos" value={activeScenario.chaos} hot />
            <MiniMeter icon={<Wind size={16} />} label="Weather drag" value={activeScenario.weatherDrag} />
          </div>
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

      <section className="nfl-grid-section">
        <div className="nfl-team-compare">
          <div className="nfl-section-kicker">
            <Swords size={17} />
            Matchup tissue
          </div>
          <TeamCompare matchup={activeMatchup} />
        </div>

        <div className="nfl-fantasy-panel" id="fantasy-seer">
          <div className="nfl-section-kicker">
            <BrainCircuit size={17} />
            Fantasy Seer
          </div>
          <div className="nfl-fantasy-head">
            <div>
              <h2>Start/sit pulse</h2>
              <p>{scoringCopy[scoringFormat]}</p>
            </div>
            <ScoringToggle value={scoringFormat} onChange={setScoringFormat} />
          </div>
          <div className="nfl-fantasy-list">
            {scoutingBoard.slice(0, 12).map((player) => (
              <FantasyCard
                key={player.id}
                player={player}
                scoringFormat={scoringFormat}
              />
            ))}
          </div>
        </div>
      </section>

      <ScoutingBoard
        analysis={scoutRead}
        allRows={scoutingBoard}
        depth={scoutingDepth}
        onDepthChange={updateScoutingDepth}
        onPositionChange={updateScoutingPosition}
        onRequest={requestScoutingRead}
        position={scoutingPosition}
        rows={visibleScoutingRows}
        scoringFormat={scoringFormat}
        status={scoutStatus}
      />

      <FantasyTeamLab
        activeReport={activeTeamReport}
        contextStatus={fantasyContextLayer.status}
        fantasyImport={fantasyImport}
        manualImportMessage={manualImportMessage}
        manualImportStatus={manualImportStatus}
        manualRosterText={manualRosterText}
        matchupReport={fantasyMatchupReport}
        onManualImport={() => applyManualRosterImport("manual")}
        onLensChange={setTeamLens}
        onOpponentTeamChange={setOpponentFantasyTeamId}
        onScoringChange={setScoringFormat}
        onScreenshotFile={handleScreenshotFile}
        onScreenshotImport={requestScreenshotRosterImport}
        onSleeperImport={requestSleeperImport}
        onSleeperQueryChange={setSleeperQuery}
        onTeamChange={setActiveFantasyTeamId}
        onManualRosterTextChange={setManualRosterText}
        opponentTeamId={opponentFantasyTeam.id}
        scoringFormat={scoringFormat}
        screenshotFileName={screenshotFileName}
        screenshotImportMessage={screenshotImportMessage}
        screenshotImportStatus={screenshotImportStatus}
        sleeperImportMessage={sleeperImportMessage}
        sleeperImportStatus={sleeperImportStatus}
        sleeperQuery={sleeperQuery}
        teamLens={teamLens}
        teams={fantasyTeams}
      />

      <section className="nfl-player-compare" id="player-compare">
        <div className="nfl-player-compare-head">
          <div>
            <div className="nfl-section-kicker">
              <UsersRound size={17} />
              Player vs player
            </div>
            <h2>Who gets the nod?</h2>
          </div>
          <strong>{startLean.name}</strong>
        </div>
        <div className="nfl-player-selectors">
          <select value={leftPlayerId} onChange={(event) => setLeftPlayerId(event.target.value)}>
            {fantasyPlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <ChevronRight size={18} />
          <select value={rightPlayerId} onChange={(event) => setRightPlayerId(event.target.value)}>
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
            <span>Seer nod</span>
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
    <section className="nfl-data-ribbon" aria-label="NFL data status">
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
                    .join(", ")} lanes.`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="nfl-context-receipt" aria-label="Fantasy context status">
        <div>
          <strong>Matchup context</strong>
          <em>
            {contextStatus.coveredTeams}/{contextStatus.totalTeams} team lanes ·{" "}
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
  const rows = [
    ["Offense", matchup.away.offense, matchup.home.offense],
    ["Defense", matchup.away.defense, matchup.home.defense],
    ["QB", matchup.away.qb, matchup.home.qb],
    ["Trenches", matchup.away.trenches, matchup.home.trenches],
    ["Coaching", matchup.away.coaching, matchup.home.coaching],
    ["Health", matchup.away.injuries, matchup.home.injuries],
  ] as const;

  return (
    <div className="nfl-compare-card">
      <div className="nfl-compare-head">
        <TeamPill team={matchup.away} />
        <TeamPill team={matchup.home} align="right" />
      </div>
      <div className="nfl-compare-rows">
        {rows.map(([label, away, home]) => (
          <div className="nfl-compare-row" key={label}>
            <strong>{away}</strong>
            <div>
              <span>{label}</span>
              <i>
                <b style={{ width: `${away}%`, background: matchup.away.color }} />
                <b style={{ width: `${home}%`, background: matchup.home.color }} />
              </i>
            </div>
            <strong>{home}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function FantasyCard({
  player,
  scoringFormat,
}: {
  player: FantasyPlayer;
  scoringFormat: ScoringFormat;
}) {
  const fantasy = fantasyProjection(player, scoringFormat);

  return (
    <article className="nfl-fantasy-card">
      <div className="nfl-player-id">
        <span style={{ background: player.color }}>{player.team}</span>
        <div>
          <strong>{player.name}</strong>
          <em>
            {player.position} · {player.opponent}
          </em>
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
      <p>{player.read}</p>
    </article>
  );
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
  const sourceProjection = player.sourceProjection ?? projection.projection;
  const sourceLabel =
    typeof player.sourceProjection === "number" ? "Source" : "Model seed";
  const delta =
    typeof player.seerDelta === "number"
      ? player.seerDelta
      : projection.projection - sourceProjection;
  const tags = player.seerAdjustments?.slice(0, compact ? 2 : 4) ?? [];

  return (
    <div className={cx("nfl-projection-receipt", compact && "compact")}>
      <small>
        {sourceLabel} {sourceProjection.toFixed(1)} -&gt; Seer{" "}
        {projection.projection.toFixed(1)} {formatFantasyDelta(delta)}
      </small>
      {tags.length > 0 ? (
        <div>
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
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
  const fantasy = fantasyProjection(player, scoringFormat);

  return (
    <article className={cx("nfl-duel-player", winner && "winner")}>
      <div className="nfl-player-id">
        <span style={{ background: player.color }}>{player.team}</span>
        <div>
          <strong>{player.name}</strong>
          <em>
            {player.position} · {player.opponent}
          </em>
        </div>
      </div>
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
      <MiniMeter icon={<Timer size={16} />} label="Chaos" value={player.chaos} hot />
    </article>
  );
}

function ScoutingBoard({
  analysis,
  allRows,
  depth,
  onDepthChange,
  onPositionChange,
  onRequest,
  position,
  rows,
  scoringFormat,
  status,
}: {
  analysis: NflScoutingAnalysis | null;
  allRows: ScoutingRow[];
  depth: ScoutingDepth;
  onDepthChange: (depth: ScoutingDepth) => void;
  onPositionChange: (position: ScoutingPosition) => void;
  onRequest: () => void;
  position: ScoutingPosition;
  rows: ScoutingRow[];
  scoringFormat: ScoringFormat;
  status: ScoutStatus;
}) {
  const counts = countScoutingPositions(allRows);
  const depthOption =
    scoutingDepthOptions.find((option) => option.value === depth) ??
    scoutingDepthOptions[0];
  const laneTotal = position === "ALL" ? allRows.length : counts[position] ?? 0;

  return (
    <section className="nfl-scouting-board" id="scouting-board">
      <div className="nfl-scouting-head">
        <div>
          <div className="nfl-section-kicker">
            <Search size={17} />
            Player scouting
          </div>
          <h2>Seer ranking board</h2>
          <p>
            Format-aware projection, role pulse, matchup, health, and chaos. Baseline
            rank is a placeholder until a live external ranking feed is connected.
          </p>
        </div>
        <div className="nfl-scouting-actions">
          <span className="nfl-scouting-summary">
            Showing {rows.length} of {laneTotal} · {depthOption.summary}
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
        <div className="nfl-scouting-filter-bar" aria-label="Position lanes">
          {scoutingPositionOptions.map((option) => {
            const count =
              option.value === "ALL" ? allRows.length : counts[option.value] ?? 0;

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
                <span>{analysis.source === "openai" ? "OpenAI scout" : "Seer fallback"}</span>
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
      {rows.length ? (
        <div className="nfl-scouting-list">
          {rows.map((player, index) => (
            <article className="nfl-scout-row" key={player.id}>
              <div className="nfl-rank-stack">
                <span>#{index + 1}</span>
                <em>{scoutingRankLabel(position)}</em>
              </div>
              <div className="nfl-scout-player">
                <div className="nfl-player-id">
                  <span style={{ background: player.color }}>{player.team}</span>
                  <div>
                    <strong>{player.name}</strong>
                    <em>
                      {player.position} · {player.opponent}
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
            <strong>No {scoutingPositionLabel(position).toLowerCase()} rows loaded yet</strong>
            <p>
              Add them through a projection feed, Sleeper import, roster paste, or
              screenshot upload and this lane will fill itself.
            </p>
          </div>
        </article>
      )}
    </section>
  );
}

function FantasyTeamLab({
  activeReport,
  contextStatus,
  fantasyImport,
  manualImportMessage,
  manualImportStatus,
  manualRosterText,
  matchupReport,
  onManualImport,
  onLensChange,
  onManualRosterTextChange,
  onOpponentTeamChange,
  onScoringChange,
  onScreenshotFile,
  onScreenshotImport,
  onSleeperImport,
  onSleeperQueryChange,
  onTeamChange,
  opponentTeamId,
  scoringFormat,
  screenshotFileName,
  screenshotImportMessage,
  screenshotImportStatus,
  sleeperImportMessage,
  sleeperImportStatus,
  sleeperQuery,
  teamLens,
  teams,
}: {
  activeReport: FantasyTeamReport;
  contextStatus: FantasyContextStatus;
  fantasyImport: ImportedFantasyLeague | null;
  manualImportMessage: string;
  manualImportStatus: FantasyImportStatus;
  manualRosterText: string;
  matchupReport: FantasyMatchupReport;
  onManualImport: () => void;
  onLensChange: (lens: FantasyTeamLens) => void;
  onManualRosterTextChange: (value: string) => void;
  onOpponentTeamChange: (teamId: string) => void;
  onScoringChange: (format: ScoringFormat) => void;
  onScreenshotFile: (file: File | null | undefined) => void;
  onScreenshotImport: () => void;
  onSleeperImport: () => void;
  onSleeperQueryChange: (value: string) => void;
  onTeamChange: (teamId: string) => void;
  opponentTeamId: string;
  scoringFormat: ScoringFormat;
  screenshotFileName: string;
  screenshotImportMessage: string;
  screenshotImportStatus: FantasyImportStatus;
  sleeperImportMessage: string;
  sleeperImportStatus: FantasyImportStatus;
  sleeperQuery: string;
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
          <h2>Analyze my squad</h2>
          <p>
            Roster shape, matchup pressure, trade paths, and start/sit texture.
            Pure fantasy fun, with the Seer doing the math in the background.
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

      <FantasyImportPanel
        fantasyImport={fantasyImport}
        manualImportMessage={manualImportMessage}
        manualImportStatus={manualImportStatus}
        manualRosterText={manualRosterText}
        onManualImport={onManualImport}
        onManualRosterTextChange={onManualRosterTextChange}
        onScreenshotFile={onScreenshotFile}
        onScreenshotImport={onScreenshotImport}
        onSleeperImport={onSleeperImport}
        onSleeperQueryChange={onSleeperQueryChange}
        screenshotFileName={screenshotFileName}
        screenshotImportMessage={screenshotImportMessage}
        screenshotImportStatus={screenshotImportStatus}
        sleeperImportMessage={sleeperImportMessage}
        sleeperImportStatus={sleeperImportStatus}
        sleeperQuery={sleeperQuery}
      />

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

      <div className="nfl-team-lab-grid">
        <article className="nfl-team-report-card">
          <div className="nfl-team-report-top">
            <div>
              <span>{activeReport.team.manager}</span>
              <strong>{activeReport.team.name}</strong>
              <em>{activeReport.team.identity}</em>
            </div>
            <b>{activeReport.score}</b>
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
                  <span style={{ background: player.color }}>{player.team}</span>
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
            <span>Seer coaching note</span>
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
              Win lean {matchupReport.winLean}% · chaos {matchupReport.chaos}%
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
          <span>Source says {report.lineupSourceProjection.toFixed(1)}</span>
          <strong>Seer says {report.projection.toFixed(1)}</strong>
          <em>{formatFantasyDelta(report.lineupSeerDelta)}</em>
        </div>
      </div>

      <div className="nfl-decision-summary">
        <div>
          <span>Confidence</span>
          <strong>{matchupReport.confidence}%</strong>
        </div>
        <div>
          <span>Chaos</span>
          <strong>{matchupReport.chaos}%</strong>
        </div>
        <div>
          <span>Context</span>
          <strong>
            {contextStatus.coveredTeams}/{contextStatus.totalTeams}
          </strong>
        </div>
        <div>
          <span>Strong lane</span>
          <strong>{report.strongestLane.label}</strong>
        </div>
        <div>
          <span>Fix lane</span>
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
            <div className="nfl-lineup-receipt">
              <span>Source {slot.sourceProjection.toFixed(1)}</span>
              <strong>Seer {slot.seerProjection.toFixed(1)}</strong>
              <em>{formatFantasyDelta(slot.delta)}</em>
            </div>
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
              <strong>{receipt.label}</strong> {receipt.summary}
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

function FantasyImportPanel({
  fantasyImport,
  manualImportMessage,
  manualImportStatus,
  manualRosterText,
  onManualImport,
  onManualRosterTextChange,
  onScreenshotFile,
  onScreenshotImport,
  onSleeperImport,
  onSleeperQueryChange,
  screenshotFileName,
  screenshotImportMessage,
  screenshotImportStatus,
  sleeperImportMessage,
  sleeperImportStatus,
  sleeperQuery,
}: {
  fantasyImport: ImportedFantasyLeague | null;
  manualImportMessage: string;
  manualImportStatus: FantasyImportStatus;
  manualRosterText: string;
  onManualImport: () => void;
  onManualRosterTextChange: (value: string) => void;
  onScreenshotFile: (file: File | null | undefined) => void;
  onScreenshotImport: () => void;
  onSleeperImport: () => void;
  onSleeperQueryChange: (value: string) => void;
  screenshotFileName: string;
  screenshotImportMessage: string;
  screenshotImportStatus: FantasyImportStatus;
  sleeperImportMessage: string;
  sleeperImportStatus: FantasyImportStatus;
  sleeperQuery: string;
}) {
  const importLabel = fantasyImport
    ? `${fantasyImport.label} · ${fantasyImport.teams.length} team${fantasyImport.teams.length === 1 ? "" : "s"}`
    : "Seeded lab rosters";

  return (
    <div className="nfl-fantasy-import-panel">
      <div className="nfl-import-panel-head">
        <div>
          <span>Roster source</span>
          <strong>{importLabel}</strong>
        </div>
        <em>{fantasyImport?.source ?? "demo"}</em>
      </div>

      <div className="nfl-import-grid">
        <article className="nfl-import-card">
          <div>
            <RefreshCw size={18} />
            <strong>Sleeper</strong>
          </div>
          <input
            onChange={(event) => onSleeperQueryChange(event.target.value)}
            placeholder="username, league id, or link"
            value={sleeperQuery}
          />
          <button
            disabled={sleeperImportStatus === "loading"}
            onClick={onSleeperImport}
            type="button"
          >
            <RefreshCw size={16} />
            {sleeperImportStatus === "loading" ? "Loading" : "Load"}
          </button>
          <p className={cx("nfl-import-status", sleeperImportStatus)}>
            {sleeperImportMessage}
          </p>
        </article>

        <article className="nfl-import-card wide">
          <div>
            <ClipboardList size={18} />
            <strong>Copy paste</strong>
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
            <strong>Screenshot</strong>
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
      name: "Seer House",
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
      name: "Rival House",
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
  roster,
  scoringFormat,
}: {
  lens: FantasyTeamLens;
  roster: ScoutingRow[];
  scoringFormat: ScoringFormat;
}) {
  const usedIds = new Set<string>();
  const lineup = fantasyLineupSlots.map((slot) => {
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
    scoringFormat,
    lens,
  );
  const closeCalls = fantasyCloseCalls(lineup, benchPlayers, scoringFormat, lens);
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
    receipt: `${player.name} gets the ${slot.label} lane with ${tagCopy || "a balanced profile"}. ${contextReceiptLine(player.context)}`,
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
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
): FantasyBenchAlternative[] {
  return benchPlayers
    .flatMap((benchPlayer) => {
      const eligibleSlots = lineup
        .filter(
          (slot) =>
            slot.player &&
            fantasyLineupSlots
              .find((definition) => definition.id === slot.id)
              ?.positions.includes(normalizeScoutingPosition(benchPlayer.position)),
        )
        .sort(
          (left, right) =>
            (left.player?.contextProjection.projection ?? 0) -
              (right.player?.contextProjection.projection ?? 0) ||
            fantasyLineupFitScore(benchPlayer, slotDefinition(left.id), scoringFormat, lens) -
              fantasyLineupFitScore(benchPlayer, slotDefinition(right.id), scoringFormat, lens),
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
          ? `${benchPlayer.name} is ${formatFantasyDelta(lift)} over ${targetSlot.player.name} at ${targetSlot.label}.`
          : `${benchPlayer.name} is the closest ${targetSlot.label} challenger, ${Math.abs(lift).toFixed(1)} behind ${targetSlot.player.name}.`;

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
  scoringFormat: ScoringFormat,
  lens: FantasyTeamLens,
): FantasyCloseCall[] {
  return fantasyBenchAlternatives(lineup, benchPlayers, scoringFormat, lens)
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
          ? `${alternative.player.name} should jump ${targetSlot.player.name} at ${alternative.slotLabel}.`
          : `${targetSlot.player.name} holds ${alternative.slotLabel}, but ${alternative.player.name} is only ${gap.toFixed(1)} back.`;

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
  const seerProjection = round1(player.fantasy.projection);
  const contextProjection = round1(player.contextProjection.projection);
  const opponentRead =
    player.context.defenseVsPosition <= 68
      ? "friendly opponent lane"
      : player.context.defenseVsPosition >= 78
        ? "defensive tax"
        : "neutral opponent read";
  const volumeRead =
    scoringFormat !== "standard" &&
    (player.position === "WR" || player.position === "TE") &&
    player.baseline.receptions >= 5
      ? "PPR volume"
      : player.carryShare >= 24
        ? "touch control"
        : player.touchdownPulse >= 78
          ? "TD swing"
          : "role stability";

  return `${player.name} fits ${slotLabel}: source ${sourceProjection.toFixed(1)}, base Seer ${seerProjection.toFixed(1)}, context Seer ${contextProjection.toFixed(1)} with ${opponentRead} and ${volumeRead}.`;
}

function fantasyDecisionTags(player: ScoutingRow, scoringFormat: ScoringFormat) {
  const tags = [
    player.context.defenseVsPosition <= 68
      ? "Matchup boost"
      : player.context.defenseVsPosition >= 78
        ? "Defense tax"
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

function slotDefinition(slotId: FantasyLineupSlotId) {
  return (
    fantasyLineupSlots.find((definition) => definition.id === slotId) ??
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

    return { label, summary, value };
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
    strongestEdge,
    swingFactors: fantasySwingFactors(leftReport, rightReport),
    recommendation:
      edgeMagnitude < 2
        ? "This matchup is close enough that one lineup choice can swing it. Chase role clarity over name value."
        : `${edgeTeam.name} has the cleaner projected lane. The chase side can close it by patching ${trailingReport.weakestLane.label} and trimming chaos.`,
  };
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
      ? "Reception volume gives this roster a nice PPR safety net."
      : rushingControl >= 22
        ? "Touch volume gives this roster a sturdy weekly base."
        : "The top-end players carry enough ceiling to make the matchup interesting.",
    lens === "dynasty" && teamDynastyCore(roster) >= 74
      ? "The dynasty core has enough age-value and role security to build around."
      : roleSecurity >= 78
        ? "Role security is steady, which makes lineup decisions easier."
      : "The roster has a clear identity, which makes lineup decisions easier.",
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
    weakSpots.push("PPR formats want more target volume than this roster is showing.");
  }

  if (!positionCounts.RB) {
    weakSpots.push("RB depth is thin, so one injury or committee shift can bite.");
  }

  if (balance < 62) {
    weakSpots.push("The roster is tilted toward one position bucket.");
  }

  if (depth < 62) {
    weakSpots.push("Depth is light; the bench needs another usable weekly option.");
  }

  if (risk > 58) {
    weakSpots.push("Chaos is a little loud, so floor protection matters.");
  }

  if (average(roster.map((player) => player.roleSecurity ?? 72)) < 68) {
    weakSpots.push("Role security is thin, so late news can move the lineup more than usual.");
  }

  if (lens === "dynasty" && teamDynastyCore(roster) < 62) {
    weakSpots.push("Dynasty value needs a younger, steadier core piece.");
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
    moves.push("If another manager needs a QB, shop the surplus for WR/RB depth.");
  }

  if (scoringFormat !== "standard") {
    moves.push("Prioritize target earners; a quiet 7-catch player can patch a lot of leaks.");
  } else {
    moves.push("In standard scoring, chase touchdown equity and early-down work first.");
  }

  if (highChaos.chaos > 55) {
    moves.push(`Pair ${highChaos.name}'s ceiling with a steadier floor play when possible.`);
  } else {
    moves.push(`${bestFloor.name} is the kind of stabilizer to keep in tight matchups.`);
  }

  if (lens === "dynasty") {
    moves.push("In dynasty, do not trade away role growth unless the return fixes two roster holes.");
  }

  return moves.slice(0, 4);
}

function fantasyBenchUpgrades(starters: ScoutingRow[], benchPlayers: ScoutingRow[]) {
  if (benchPlayers.length === 0) {
    return ["No bench receipt yet; import a full roster to unlock swap ideas."];
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
      `${bestBench.name} is pushing past ${weakestStarter.name}; check the slot before kickoff.`,
    );
  } else {
    ideas.push(
      `${bestBench.name} is the first bench pressure point, but the starters still hold the lane.`,
    );
  }

  if (
    samePositionBench &&
    samePositionBench.id !== bestBench.id &&
    samePositionBench.contextProjection.floor > weakestStarter.contextProjection.floor
  ) {
    ideas.push(
      `${samePositionBench.name} has the cleaner ${samePositionBench.position} floor if you need less chaos.`,
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
    return ["Hold the core for now; the best move is improving bench flexibility."];
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

    return `Ask about ${player.name} if the price is reasonable: ${reason} fits the current roster need.`;
  });
}

function teamAdviceSummary(report: FantasyTeamReport, lens: FantasyTeamLens) {
  if (lens === "dynasty") {
    return `${report.team.name} grades ${report.score}/100 with a ${report.dynastyCore}% dynasty core. The Seer likes moves that add durable role growth without draining the weekly lineup.`;
  }

  return `${report.team.name} grades ${report.score}/100 for the current matchup window. The cleanest path is protecting floor while keeping one ceiling lever in the lineup.`;
}

function fantasySwingFactors(
  leftReport: FantasyTeamReport,
  rightReport: FantasyTeamReport,
) {
  const factors = [
    Math.abs(leftReport.ceiling - rightReport.ceiling) >= 4
      ? `${leftReport.ceiling > rightReport.ceiling ? leftReport.team.name : rightReport.team.name} has the better ceiling lane.`
      : "Ceiling is close; floor choices matter more.",
    Math.abs(leftReport.risk - rightReport.risk) >= 8
      ? `${leftReport.risk > rightReport.risk ? leftReport.team.name : rightReport.team.name} carries more chaos.`
      : "Risk profile is fairly even.",
    Math.abs(leftReport.depth - rightReport.depth) >= 8
      ? `${leftReport.depth > rightReport.depth ? leftReport.team.name : rightReport.team.name} has the deeper bench shape.`
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
  const leftScore = fantasyScore(left, scoringFormat);
  const rightScore = fantasyScore(right, scoringFormat);
  const winner = leftScore >= rightScore ? left : right;
  const loser = winner.id === left.id ? right : left;
  const margin = Math.abs(leftScore - rightScore);

  return {
    id: winner.id,
    name: winner.name,
    verdict:
      margin < 5
        ? `${winner.name} gets the tiny nod, but this is a lineup coin flip with teeth.`
        : `${winner.name} gets the nod: stronger blend of floor, ceiling, and matchup stability over ${loser.name}.`,
  };
}

function filterScoutingRows(
  rows: ScoutingRow[],
  position: ScoutingPosition,
  depth: ScoutingDepth,
) {
  const depthOption =
    scoutingDepthOptions.find((option) => option.value === depth) ??
    scoutingDepthOptions[0];
  const laneRows =
    position === "ALL"
      ? rows
      : rows.filter(
          (row) => normalizeScoutingPosition(row.position) === position,
        );

  return laneRows.slice(0, depthOption.limit);
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

function scoutingRankLabel(position: ScoutingPosition) {
  if (position === "ALL") {
    return "Seer";
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
          ? [`${uncovered} fantasy team lane${uncovered === 1 ? "" : "s"} need live opponent context.`]
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
          ? "Opponent lane is friendlier than average."
          : "Opponent lane adds resistance.",
    },
    {
      delta: weatherDelta,
      kind: "weather",
      label: "Weather",
      summary:
        weatherDelta >= 0
          ? "Conditions help the fantasy path."
          : "Conditions trim the clean projection path.",
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
          : "Role or health keeps the Seer cautious.",
    },
    {
      delta: volatilityDelta,
      kind: "volatility",
      label: "Volatility",
      summary:
        volatilityDelta >= 0
          ? "Range is stable enough for lineup trust."
          : "Chaos pushes this closer to a swing play.",
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
    return "Context stayed neutral.";
  }

  return `Context: ${strongest
    .map((adjustment) => `${adjustment.label.toLowerCase()} ${formatFantasyDelta(adjustment.delta)}`)
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
  const confidence = clampMeter(
    Math.round(
      matchup.confidence +
        Math.abs(homeWin - matchup.homeWin) * 1.2 -
        Math.abs(windDelta) * 0.05 -
        Math.abs(tempoDelta) * 0.04,
    ),
  );
  const chaos = clampMeter(
    Math.round(
      matchup.chaos +
        Math.abs(windDelta) * 0.18 +
        Math.abs(healthDelta) * 0.5 +
        Math.max(0, levers.tempo - baseline.tempo) * 0.12 +
        Math.max(0, 64 - levers.tempo) * 0.08,
    ),
  );
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
    return "Syncing NFL data";
  }

  if (source === "espn-scoreboard") {
    return "NFL slate live";
  }

  if (source === "configured-feed") {
    return "NFL feed live";
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
