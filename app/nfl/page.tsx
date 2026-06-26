"use client";

import {
  Activity,
  BrainCircuit,
  ChevronRight,
  Gauge,
  HeartPulse,
  LineChart,
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
import { useMemo, useState } from "react";

type ScoringFormat = "standard" | "halfPpr" | "fullPpr";

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
  venue: string;
  weather: string;
  home: NflTeam;
  away: NflTeam;
  homeWin: number;
  awayWin: number;
  projected: string;
  confidence: number;
  chaos: number;
  pace: number;
  read: string;
  edges: string[];
};

type FantasyPlayer = {
  id: string;
  name: string;
  team: string;
  position: string;
  opponent: string;
  color: string;
  baseline: {
    passYards?: number;
    passTd?: number;
    interceptions?: number;
    rushYards: number;
    rushTd: number;
    receivingYards: number;
    receivingTd: number;
    receptions: number;
  };
  targetShare: number;
  carryShare: number;
  touchdownPulse: number;
  matchup: number;
  health: number;
  chaos: number;
  nflRank: number;
  seerRank: number;
  traits: string[];
  read: string;
};

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

type NflScoutingAnalysis = {
  headline: string;
  summary: string;
  factors: string[];
  watchlist: string;
  disclaimer: string;
  source?: string;
};

type ScoutStatus = "idle" | "loading" | "ready" | "error";

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

const matchups: NflMatchup[] = [
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

const fantasyPlayers: FantasyPlayer[] = [
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

const playerPair = [fantasyPlayers[0], fantasyPlayers[1]] as const;

export default function NflPage() {
  const [activeMatchupId, setActiveMatchupId] = useState(matchups[0].id);
  const [leftPlayerId, setLeftPlayerId] = useState(playerPair[0].id);
  const [rightPlayerId, setRightPlayerId] = useState(playerPair[1].id);
  const [scoringFormat, setScoringFormat] = useState<ScoringFormat>("fullPpr");
  const [scoutStatus, setScoutStatus] = useState<ScoutStatus>("idle");
  const [scoutRead, setScoutRead] = useState<NflScoutingAnalysis | null>(null);
  const [scenarioLeversByMatchup, setScenarioLeversByMatchup] = useState<
    Record<string, ScenarioLevers>
  >({});
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
    fantasyPlayers.find((player) => player.id === leftPlayerId) ?? playerPair[0];
  const rightPlayer =
    fantasyPlayers.find((player) => player.id === rightPlayerId) ?? playerPair[1];
  const startLean = useMemo(
    () => compareFantasyPlayers(leftPlayer, rightPlayer, scoringFormat),
    [leftPlayer, rightPlayer, scoringFormat],
  );
  const scoutingBoard = useMemo(
    () => buildScoutingBoard(fantasyPlayers, scoringFormat),
    [scoringFormat],
  );

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
          <a href="#player-compare">Player vs player</a>
        </nav>
      </header>

      <div className="nfl-disclaimer" role="note">
        <ShieldCheck size={17} />
        <span>{nflIndependenceDisclaimer}</span>
      </div>

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

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}
