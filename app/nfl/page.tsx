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
  const activeMatchup =
    matchups.find((matchup) => matchup.id === activeMatchupId) ?? matchups[0];
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
          <a href="#fantasy-seer">Fantasy Seer</a>
          <a href="#player-compare">Player vs player</a>
        </nav>
      </header>

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
                {activeMatchup.awayWin > activeMatchup.homeWin
                  ? activeMatchup.away.code
                  : activeMatchup.home.code}{" "}
                {Math.max(activeMatchup.awayWin, activeMatchup.homeWin)}%
              </strong>
            </div>
            <div>
              <span>Projected</span>
              <strong>{activeMatchup.projected}</strong>
            </div>
            <div>
              <span>Game script</span>
              <strong>{activeMatchup.pace}% pace</strong>
            </div>
          </div>
          <p className="nfl-seer-read">{activeMatchup.read}</p>
          <ProbabilityBar
            leftColor={activeMatchup.away.color}
            leftLabel={activeMatchup.away.code}
            leftValue={activeMatchup.awayWin}
            rightColor={activeMatchup.home.color}
            rightLabel={activeMatchup.home.code}
            rightValue={activeMatchup.homeWin}
          />
          <div className="nfl-meter-grid">
            <MiniMeter icon={<Gauge size={16} />} label="Confidence" value={activeMatchup.confidence} />
            <MiniMeter icon={<Activity size={16} />} label="Chaos" value={activeMatchup.chaos} hot />
            <MiniMeter icon={<Wind size={16} />} label="Weather drag" value={weatherDrag(activeMatchup)} />
          </div>
          <div className="nfl-edge-row">
            {activeMatchup.edges.map((edge) => (
              <span key={edge}>{edge}</span>
            ))}
          </div>
        </article>
      </section>

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

      <ScoutingBoard rows={scoutingBoard} scoringFormat={scoringFormat} />

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
  rows,
  scoringFormat,
}: {
  rows: ScoutingRow[];
  scoringFormat: ScoringFormat;
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
        <strong>{scoringLabels[scoringFormat]}</strong>
      </div>
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

function weatherDrag(matchup: NflMatchup) {
  return matchup.weather.toLowerCase().includes("wind") ? 68 : 24;
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
