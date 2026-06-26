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
  createManualFantasyLeague,
  mergeFantasyPlayerPools,
  sanitizeImportedFantasyLeague,
  type ImportedFantasyLeague,
  type ImportedFantasyTeam,
  type NflFantasyPlayer,
} from "../../lib/nfl-fantasy-import";

type ScoringFormat = "standard" | "halfPpr" | "fullPpr";
type FantasyTeamLens = "redraft" | "dynasty";

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

type ScoutingRow = FantasyPlayer & {
  fantasy: FantasyProjection;
  rankDelta: number;
  score: number;
};

type FantasyTeam = ImportedFantasyTeam;

type FantasyTeamReport = {
  team: FantasyTeam;
  players: ScoutingRow[];
  benchPlayers: ScoutingRow[];
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
  swingFactors: string[];
  recommendation: string;
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

const seededFantasyPlayers: FantasyPlayer[] = [
  {
    id: "st-brown",
    name: "Amon-Ra St. Brown",
    team: "DET",
    position: "WR",
    opponent: "at PHI",
    color: teams.det.color,
    baseline: {
      rushYards: 2,
      rushTd: 0,
      receivingYards: 86,
      receivingTd: 0.55,
      receptions: 7.6,
    },
    targetShare: 31,
    carryShare: 1,
    touchdownPulse: 62,
    matchup: 74,
    health: 91,
    chaos: 38,
    nflRank: 9,
    seerRank: 5,
    traits: ["Target gravity", "Slot leverage", "Script proof"],
    read:
      "Target gravity is the whole spell. Even if the game gets messy, his route volume keeps the floor warm.",
  },
  {
    id: "gibbs",
    name: "Jahmyr Gibbs",
    team: "DET",
    position: "RB",
    opponent: "at PHI",
    color: teams.det.color,
    baseline: {
      rushYards: 72,
      rushTd: 0.62,
      receivingYards: 34,
      receivingTd: 0.18,
      receptions: 4.2,
    },
    targetShare: 19,
    carryShare: 44,
    touchdownPulse: 69,
    matchup: 68,
    health: 86,
    chaos: 53,
    nflRank: 15,
    seerRank: 11,
    traits: ["Explosive touches", "Receiving boost", "TD swing"],
    read:
      "Explosive-touch profile is loud, but touchdown dependency adds wobble. Ceiling monster, slightly thinner floor.",
  },
  {
    id: "allen",
    name: "Josh Allen",
    team: "BUF",
    position: "QB",
    opponent: "vs BAL",
    color: teams.buf.color,
    baseline: {
      passYards: 252,
      passTd: 1.9,
      interceptions: 0.7,
      rushYards: 42,
      rushTd: 0.48,
      receivingYards: 0,
      receivingTd: 0,
      receptions: 0,
    },
    targetShare: 0,
    carryShare: 18,
    touchdownPulse: 78,
    matchup: 70,
    health: 88,
    chaos: 61,
    nflRank: 4,
    seerRank: 4,
    traits: ["Rushing floor", "Weather-proof path", "Red-zone keeper"],
    read:
      "Rushing equity keeps him alive in ugly weather. The matchup bites, but fantasy points do not need the game to look pretty.",
  },
  {
    id: "lamar",
    name: "Lamar Jackson",
    team: "BAL",
    position: "QB",
    opponent: "at BUF",
    color: teams.bal.color,
    baseline: {
      passYards: 236,
      passTd: 1.7,
      interceptions: 0.55,
      rushYards: 58,
      rushTd: 0.44,
      receivingYards: 0,
      receivingTd: 0,
      receptions: 0,
    },
    targetShare: 0,
    carryShare: 22,
    touchdownPulse: 76,
    matchup: 73,
    health: 87,
    chaos: 58,
    nflRank: 5,
    seerRank: 3,
    traits: ["Rushing cheat code", "Wind insulation", "Explosive scramble"],
    read:
      "The legs are the cheat code. If wind cuts the passing tree, Lamar still has a path through the side door.",
  },
];

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
    () => buildScoutingBoard(fantasyPlayers, scoringFormat),
    [fantasyPlayers, scoringFormat],
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
        lens: teamLens,
        scoringFormat,
        team: activeFantasyTeam,
      }),
    [activeFantasyTeam, fantasyPlayers, scoringFormat, teamLens],
  );
  const fantasyMatchupReport = useMemo(
    () =>
      compareFantasyTeams({
        allPlayers: fantasyPlayers,
        left: activeFantasyTeam,
        lens: teamLens,
        right: opponentFantasyTeam,
        scoringFormat,
      }),
    [activeFantasyTeam, fantasyPlayers, opponentFantasyTeam, scoringFormat, teamLens],
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

  async function requestScoutingRead() {
    setScoutStatus("loading");

    try {
      const response = await fetch("/api/ai/nfl-scouting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scoringFormat,
          players: scoutingBoard.map((player, index) => ({
            name: player.name,
            team: player.team,
            position: player.position,
            opponent: player.opponent,
            projection: player.fantasy.projection,
            floor: player.fantasy.floor,
            ceiling: player.fantasy.ceiling,
            baselineRank: player.nflRank,
            seerRank: index + 1,
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
          <span>
            <Sparkles size={18} />
          </span>
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

      <NflDataRibbon dataset={nflDataset} status={nflDataStatus} />

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
            {fantasyPlayers.map((player) => (
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
        onRequest={requestScoutingRead}
        rows={scoutingBoard}
        scoringFormat={scoringFormat}
        status={scoutStatus}
      />

      <FantasyTeamLab
        activeReport={activeTeamReport}
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
  dataset,
  status,
}: {
  dataset: NflSeerDataset;
  status: NflDataStatus;
}) {
  const updatedAt =
    dataset.updatedAt === new Date(0).toISOString()
      ? "waiting"
      : formatDataUpdated(dataset.updatedAt);

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
      </div>
      {dataset.providerStatus.notes.length > 0 ? (
        <p>{dataset.providerStatus.notes.slice(0, 2).join(" ")}</p>
      ) : null}
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
        <span>{player.baseline.receptions.toFixed(1)} rec</span>
        <span>{player.carryShare}% carry</span>
        <span>{player.touchdownPulse}% TD pulse</span>
      </div>
      <p>{player.read}</p>
    </article>
  );
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
  onRequest,
  rows,
  scoringFormat,
  status,
}: {
  analysis: NflScoutingAnalysis | null;
  onRequest: () => void;
  rows: ScoutingRow[];
  scoringFormat: ScoringFormat;
  status: ScoutStatus;
}) {
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
      <div className="nfl-scouting-list">
        {rows.map((player, index) => (
          <article className="nfl-scout-row" key={player.id}>
            <div className="nfl-rank-stack">
              <span>#{index + 1}</span>
              <em>Seer</em>
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
                {player.traits.map((trait) => (
                  <span key={trait}>{trait}</span>
                ))}
              </div>
            </div>
            <div className="nfl-scout-metric">
              <span>Projection</span>
              <strong>{player.fantasy.projection.toFixed(1)}</strong>
            </div>
            <div className="nfl-scout-metric">
              <span>Range</span>
              <strong>
                {player.fantasy.floor.toFixed(1)}-{player.fantasy.ceiling.toFixed(1)}
              </strong>
            </div>
            <div className="nfl-rank-delta">
              <span>Baseline #{player.nflRank}</span>
              <strong>{formatRankDelta(player.rankDelta)}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FantasyTeamLab({
  activeReport,
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
                    {typeof player.sourceProjection === "number" ? (
                      <small>
                        Source {player.sourceProjection.toFixed(1)} -&gt; Seer{" "}
                        {player.fantasy.projection.toFixed(1)}{" "}
                        {formatFantasyDelta(
                          player.fantasy.projection - player.sourceProjection,
                        )}
                      </small>
                    ) : null}
                  </div>
                </div>
                <strong>{player.fantasy.projection.toFixed(1)}</strong>
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
          <b>{matchupReport.edgeLabel}</b>
        </div>
        <div className="nfl-matchup-score-grid">
          <FantasyTeamMiniReport report={matchupReport.left} />
          <div className="nfl-matchup-verdict">
            <Sparkles size={20} />
            <span>Seer edge</span>
            <strong>{matchupReport.edgeTeam.name}</strong>
            <p>{matchupReport.recommendation}</p>
          </div>
          <FantasyTeamMiniReport report={matchupReport.right} />
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
  lens,
  scoringFormat,
  team,
}: {
  allPlayers: FantasyPlayer[];
  lens: FantasyTeamLens;
  scoringFormat: ScoringFormat;
  team: FantasyTeam;
}): FantasyTeamReport {
  const board = buildScoutingBoard(allPlayers, scoringFormat);
  const rosterIdSet = new Set(team.rosterIds);
  const starterIdSet = new Set(team.starterIds?.length ? team.starterIds : team.rosterIds);
  const fullRoster = board.filter((player) => rosterIdSet.has(player.id));
  const starters = fullRoster.filter((player) => starterIdSet.has(player.id));
  const benchPlayers = fullRoster.filter((player) => !starterIdSet.has(player.id));
  const roster =
    starters.length > 0
      ? starters
      : fullRoster.length > 0
        ? fullRoster
        : board.slice(0, 1);
  const projection = round1(sum(roster.map((player) => player.fantasy.projection)));
  const floor = round1(sum(roster.map((player) => player.fantasy.floor)));
  const ceiling = round1(sum(roster.map((player) => player.fantasy.ceiling)));
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
      roster: fullRoster.length > 0 ? fullRoster : roster,
      scoringFormat,
    }),
  };
}

function compareFantasyTeams({
  allPlayers,
  left,
  lens,
  right,
  scoringFormat,
}: {
  allPlayers: FantasyPlayer[];
  left: FantasyTeam;
  lens: FantasyTeamLens;
  right: FantasyTeam;
  scoringFormat: ScoringFormat;
}): FantasyMatchupReport {
  const leftReport = analyzeFantasyTeam({ allPlayers, lens, scoringFormat, team: left });
  const rightReport = analyzeFantasyTeam({ allPlayers, lens, scoringFormat, team: right });
  const projectionGap = round1(leftReport.projection - rightReport.projection);
  const edgeTeam = projectionGap >= 0 ? leftReport.team : rightReport.team;
  const edgeMagnitude = Math.abs(projectionGap);
  const edgeLabel =
    edgeMagnitude < 2
      ? "True toss-up"
      : `${edgeTeam.name} +${edgeMagnitude.toFixed(1)}`;

  return {
    left: leftReport,
    right: rightReport,
    edgeTeam,
    edgeLabel,
    projectionGap,
    swingFactors: fantasySwingFactors(leftReport, rightReport),
    recommendation:
      edgeMagnitude < 2
        ? "This matchup is close enough that one lineup choice can swing it. Chase role clarity over name value."
        : `${edgeTeam.name} has the cleaner projected lane, but the lower side can close it by attacking floor and reducing chaos.`,
  };
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

  return [
    `${top.name} is the lineup anchor at ${top.fantasy.projection.toFixed(1)} projected points.`,
    receivingFloor >= 6 && scoringFormat !== "standard"
      ? "Reception volume gives this roster a nice PPR safety net."
      : rushingControl >= 22
        ? "Touch volume gives this roster a sturdy weekly base."
        : "The top-end players carry enough ceiling to make the matchup interesting.",
    lens === "dynasty" && health >= 84
      ? "The core is healthy enough to build around instead of panic-selling."
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
    (left, right) => right.fantasy.floor - left.fantasy.floor,
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
    (left, right) => left.fantasy.projection - right.fantasy.projection,
  )[0];
  const bestBench = [...benchPlayers].sort(
    (left, right) => right.fantasy.projection - left.fantasy.projection,
  )[0];
  const samePositionBench = benchPlayers
    .filter((player) => player.position === weakestStarter.position)
    .sort((left, right) => right.fantasy.floor - left.fantasy.floor)[0];
  const ideas: string[] = [];

  if (bestBench.fantasy.projection > weakestStarter.fantasy.projection + 1.5) {
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
    samePositionBench.fantasy.floor > weakestStarter.fantasy.floor
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
      player.position === "WR" && scoringFormat !== "standard"
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
    score += player.fantasy.floor * 1.2 - player.chaos * 0.2;
  }

  if (needs.has("core") || lens === "dynasty") {
    score += player.health * 0.2 + (100 - player.nflRank) * 0.12;
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
  const playable = roster.filter((player) => player.fantasy.projection >= 12).length;

  return clampMeter(42 + roster.length * 8 + playable * 8);
}

function teamRisk(roster: ScoutingRow[]) {
  const chaos = average(roster.map((player) => player.chaos));
  const healthDrag = 100 - average(roster.map((player) => player.health));
  const touchdownDependence = average(
    roster.map((player) => player.touchdownPulse - player.targetShare / 2),
  );

  return clampMeter(Math.round(chaos * 0.55 + healthDrag * 0.3 + touchdownDependence * 0.15));
}

function teamDynastyCore(roster: ScoutingRow[]) {
  return clampMeter(
    Math.round(
      average(
        roster.map(
          (player) =>
            player.health * 0.36 +
            (100 - player.nflRank) * 0.24 +
            player.targetShare * 0.22 +
            player.carryShare * 0.12 +
            (100 - player.chaos) * 0.06,
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

function buildScoutingBoard(players: FantasyPlayer[], scoringFormat: ScoringFormat) {
  return players
    .map((player) => {
      const fantasy = fantasyProjection(player, scoringFormat);
      return {
        ...player,
        fantasy,
        rankDelta: player.nflRank - player.seerRank,
        score: fantasyScore(player, scoringFormat),
      };
    })
    .sort((a, b) => b.score - a.score);
}

function fantasyScore(player: FantasyPlayer, scoringFormat: ScoringFormat) {
  const fantasy = fantasyProjection(player, scoringFormat);

  return (
    fantasy.projection * 3.2 +
    fantasy.floor * 1.8 +
    fantasy.ceiling * 1.1 +
    player.matchup * 0.18 +
    player.health * 0.14 -
    player.chaos * 0.18
  );
}

function fantasyProjection(
  player: FantasyPlayer,
  scoringFormat: ScoringFormat,
): FantasyProjection {
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
        providerStatus.fantasy === "live" && incomingFantasyPlayers.length > 0
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
    },
  };
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
