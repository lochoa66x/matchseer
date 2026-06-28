export type FantasyPowerPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type FantasyPowerLens = "redraft" | "dynasty";

export type FantasyPowerTier =
  | "contender"
  | "playoffHunt"
  | "rebuild"
  | "chaos";

export type FantasyPowerPlayer = {
  id: string;
  name: string;
  position: FantasyPowerPosition | string;
  projection: number;
  floor?: number;
  ceiling?: number;
  dynastyValue?: number;
  risk?: number;
  roleSecurity?: number;
  starter?: boolean;
};

export type FantasyPowerTeamInput = {
  id: string;
  name: string;
  manager?: string;
  players: FantasyPowerPlayer[];
};

export type FantasyPowerPositionRank = {
  position: FantasyPowerPosition;
  rank: number;
  teamCount: number;
  projection: number;
  leaderProjection: number;
};

export type FantasyPowerRankedTeam = {
  id: string;
  name: string;
  manager?: string;
  rank: number;
  score: number;
  tier: FantasyPowerTier;
  starterScore: number;
  benchScore: number;
  dynastyScore: number;
  riskScore: number;
  strongestPosition: FantasyPowerPosition;
  weakestPosition: FantasyPowerPosition;
  positionRanks: FantasyPowerPositionRank[];
};

export type FantasyPowerTradePartner = {
  teamId: string;
  teamName: string;
  manager?: string;
  askFor: FantasyPowerPosition;
  offerFrom: FantasyPowerPosition;
  fitScore: number;
  reason: string;
};

export type FantasyPowerMapResult = {
  active: FantasyPowerRankedTeam;
  teams: FantasyPowerRankedTeam[];
  rankLabel: string;
  bestMatchupId: string;
  worstMatchupId: string;
  tradePartners: FantasyPowerTradePartner[];
  recommendation: string;
};

export type FantasyPowerMapInput = {
  activeTeamId: string;
  lens: FantasyPowerLens;
  teams: FantasyPowerTeamInput[];
};

const powerPositions: FantasyPowerPosition[] = ["QB", "RB", "WR", "TE", "K", "DST"];

const starterNeeds: Record<FantasyPowerPosition, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

type TeamSnapshot = {
  team: FantasyPowerTeamInput;
  starterProjection: number;
  benchProjection: number;
  dynastyValue: number;
  risk: number;
  positionProjection: Record<FantasyPowerPosition, number>;
};

export function rankFantasyLeaguePower({
  activeTeamId,
  lens,
  teams,
}: FantasyPowerMapInput): FantasyPowerMapResult {
  const snapshots = teams.map(teamPowerSnapshot);
  const starterAverage = average(
    snapshots.map((snapshot) => snapshot.starterProjection),
  );
  const benchAverage = average(snapshots.map((snapshot) => snapshot.benchProjection));
  const positionRanks = buildPositionRanks(snapshots);
  const rankedTeams = snapshots
    .map((snapshot) =>
      rankTeamSnapshot({
        benchAverage,
        lens,
        positionRanks: positionRanks.get(snapshot.team.id) ?? [],
        snapshot,
        starterAverage,
        teamCount: snapshots.length,
      }),
    )
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((team, index) => ({
      ...team,
      rank: index + 1,
      tier: fantasyPowerTier(team.score, index + 1, snapshots.length, lens, team.riskScore),
    }));
  const active =
    rankedTeams.find((team) => team.id === activeTeamId) ??
    rankedTeams[0] ??
    emptyRankedTeam();
  const opponents = rankedTeams.filter((team) => team.id !== active.id);
  const bestMatchup =
    [...opponents].sort(
      (left, right) =>
        fantasyPowerMatchupScore(active, right) - fantasyPowerMatchupScore(active, left),
    )[0] ?? active;
  const worstMatchup =
    [...opponents].sort(
      (left, right) =>
        fantasyPowerMatchupScore(active, left) - fantasyPowerMatchupScore(active, right),
    )[0] ?? active;

  return {
    active,
    bestMatchupId: bestMatchup.id,
    rankLabel: `#${active.rank} of ${rankedTeams.length}`,
    recommendation: fantasyPowerRecommendation(active, worstMatchup, lens, rankedTeams.length),
    teams: rankedTeams,
    tradePartners: fantasyPowerTradePartners(active, rankedTeams),
    worstMatchupId: worstMatchup.id,
  };
}

function rankTeamSnapshot({
  benchAverage,
  lens,
  positionRanks,
  snapshot,
  starterAverage,
}: {
  benchAverage: number;
  lens: FantasyPowerLens;
  positionRanks: FantasyPowerPositionRank[];
  snapshot: TeamSnapshot;
  starterAverage: number;
  teamCount: number;
}): FantasyPowerRankedTeam {
  const starterScore = clampScore(
    Math.round(66 + (snapshot.starterProjection - starterAverage) * 2.35),
  );
  const benchScore = clampScore(
    Math.round(64 + (snapshot.benchProjection - benchAverage) * 1.7),
  );
  const dynastyScore = clampScore(Math.round(snapshot.dynastyValue));
  const riskScore = clampScore(Math.round(100 - snapshot.risk));
  const strongestPosition =
    [...powerPositions].sort(
      (left, right) =>
        snapshot.positionProjection[right] - snapshot.positionProjection[left],
    )[0] ?? "WR";
  const weakestPosition =
    [...positionRanks].sort(
      (left, right) =>
        right.rank - left.rank || left.projection - right.projection,
    )[0]?.position ?? "WR";
  const score = clampScore(
    Math.round(
      starterScore * 0.46 +
        benchScore * 0.18 +
        riskScore * 0.12 +
        (lens === "dynasty" ? dynastyScore * 0.24 : dynastyScore * 0.08 + benchScore * 0.16),
    ),
  );

  return {
    benchScore,
    dynastyScore,
    id: snapshot.team.id,
    manager: snapshot.team.manager,
    name: snapshot.team.name,
    positionRanks,
    rank: 0,
    riskScore,
    score,
    starterScore,
    strongestPosition,
    tier: "playoffHunt",
    weakestPosition,
  };
}

function teamPowerSnapshot(team: FantasyPowerTeamInput): TeamSnapshot {
  const usedIds = new Set<string>();
  const normalizedPlayers = team.players
    .map((player) => ({
      ...player,
      position: normalizePosition(player.position),
    }))
    .filter((player) => Number.isFinite(player.projection));
  const positionProjection = powerPositions.reduce<Record<FantasyPowerPosition, number>>(
    (totals, position) => {
      const starters = normalizedPlayers
        .filter((player) => player.position === position)
        .sort((left, right) => playerPowerValue(right) - playerPowerValue(left))
        .slice(0, starterNeeds[position]);

      starters.forEach((player) => usedIds.add(player.id));
      totals[position] = round1(sum(starters.map((player) => player.projection)));

      return totals;
    },
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );
  const starters = normalizedPlayers.filter((player) => usedIds.has(player.id));
  const bench = normalizedPlayers
    .filter((player) => !usedIds.has(player.id))
    .sort((left, right) => playerPowerValue(right) - playerPowerValue(left));

  return {
    benchProjection: round1(sum(bench.slice(0, 6).map((player) => player.projection))),
    dynastyValue: round1(
      average(
        normalizedPlayers
          .slice()
          .sort(
            (left, right) =>
              (right.dynastyValue ?? right.roleSecurity ?? 70) -
              (left.dynastyValue ?? left.roleSecurity ?? 70),
          )
          .slice(0, 10)
          .map((player) => player.dynastyValue ?? player.roleSecurity ?? 70),
      ),
    ),
    positionProjection,
    risk: round1(average(starters.map((player) => player.risk ?? 48))),
    starterProjection: round1(sum(Object.values(positionProjection))),
    team,
  };
}

function buildPositionRanks(snapshots: TeamSnapshot[]) {
  const ranks = new Map<string, FantasyPowerPositionRank[]>();

  for (const position of powerPositions) {
    const ordered = snapshots
      .map((snapshot) => ({
        projection: snapshot.positionProjection[position],
        teamId: snapshot.team.id,
      }))
      .sort((left, right) => right.projection - left.projection || left.teamId.localeCompare(right.teamId));
    const leaderProjection = ordered[0]?.projection ?? 0;

    ordered.forEach((row, index) => {
      const current = ranks.get(row.teamId) ?? [];
      current.push({
        leaderProjection,
        position,
        projection: row.projection,
        rank: index + 1,
        teamCount: ordered.length,
      });
      ranks.set(row.teamId, current);
    });
  }

  return ranks;
}

function fantasyPowerTier(
  score: number,
  rank: number,
  teamCount: number,
  lens: FantasyPowerLens,
  riskScore: number,
): FantasyPowerTier {
  if (riskScore < 42 && score >= 58) {
    return "chaos";
  }

  if (rank <= Math.max(2, Math.ceil(teamCount * 0.25)) || score >= 80) {
    return "contender";
  }

  if (lens === "dynasty" && score < 58) {
    return "rebuild";
  }

  if (score < 52) {
    return "rebuild";
  }

  return "playoffHunt";
}

function fantasyPowerMatchupScore(
  active: FantasyPowerRankedTeam,
  opponent: FantasyPowerRankedTeam,
) {
  const activeRanks = new Map(
    active.positionRanks.map((rank) => [rank.position, rank]),
  );
  const opponentRanks = new Map(
    opponent.positionRanks.map((rank) => [rank.position, rank]),
  );
  const laneScore = powerPositions.reduce((total, position) => {
    const activeProjection = activeRanks.get(position)?.projection ?? 0;
    const opponentProjection = opponentRanks.get(position)?.projection ?? 0;
    const multiplier = position === "K" || position === "DST" ? 0.45 : 1;

    return total + (activeProjection - opponentProjection) * multiplier;
  }, 0);

  return active.score - opponent.score + laneScore * 0.72;
}

function fantasyPowerTradePartners(
  active: FantasyPowerRankedTeam,
  teams: FantasyPowerRankedTeam[],
) {
  return teams
    .filter((team) => team.id !== active.id)
    .map<FantasyPowerTradePartner>((team) => {
      const askFor = active.weakestPosition;
      const offerFrom = active.strongestPosition;
      const teamAskRank = team.positionRanks.find((rank) => rank.position === askFor);
      const teamOfferRank = team.positionRanks.find((rank) => rank.position === offerFrom);
      const activeAskRank = active.positionRanks.find((rank) => rank.position === askFor);
      const activeOfferRank = active.positionRanks.find((rank) => rank.position === offerFrom);
      const canHelpMe =
        (teamAskRank?.projection ?? 0) - (activeAskRank?.projection ?? 0);
      const needsMySurplus =
        (activeOfferRank?.projection ?? 0) - (teamOfferRank?.projection ?? 0);
      const fitScore = round1(canHelpMe * 1.35 + needsMySurplus);

      return {
        askFor,
        fitScore,
        manager: team.manager,
        offerFrom,
        reason:
          fitScore > 0
            ? `${team.name} can help your ${positionLabel(askFor)} while your ${positionLabel(offerFrom)} depth can make the offer feel fair.`
            : `${team.name} is not a perfect match, but they are worth watching if their ${positionLabel(offerFrom)} depth thins out.`,
        teamId: team.id,
        teamName: team.name,
      };
    })
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, 3);
}

function fantasyPowerRecommendation(
  active: FantasyPowerRankedTeam,
  worstMatchup: FantasyPowerRankedTeam,
  lens: FantasyPowerLens,
  teamCount: number,
) {
  const weakest = positionLabel(active.weakestPosition);

  if (active.tier === "contender") {
    return `${active.name} looks like a contender. Protect the core, patch ${weakest} quietly, and plan ahead for ${worstMatchup.name}.`;
  }

  if (active.tier === "rebuild") {
    return lens === "dynasty"
      ? `${active.name} should not burn future value chasing one week. Build around youth and add a playable ${weakest}.`
      : `${active.name} needs usable points before chasing upside. Start with a waiver or small trade at ${weakest}.`;
  }

  if (active.tier === "chaos") {
    return `${active.name} has enough ceiling to scare people, but the weekly floor is jumpy. Turn one risky bench piece into steadier ${weakest} help.`;
  }

  return `${active.name} is in the playoff hunt tier at ${active.rank} of ${teamCount}. A modest ${weakest} upgrade is the cleanest path.`;
}

function emptyRankedTeam(): FantasyPowerRankedTeam {
  return {
    benchScore: 0,
    dynastyScore: 0,
    id: "empty",
    name: "My team",
    positionRanks: powerPositions.map((position) => ({
      leaderProjection: 0,
      position,
      projection: 0,
      rank: 1,
      teamCount: 1,
    })),
    rank: 1,
    riskScore: 50,
    score: 0,
    starterScore: 0,
    strongestPosition: "WR",
    tier: "playoffHunt",
    weakestPosition: "WR",
  };
}

function playerPowerValue(player: FantasyPowerPlayer) {
  return (
    player.projection * 1.8 +
    (player.floor ?? player.projection * 0.72) * 0.6 +
    (player.ceiling ?? player.projection * 1.3) * 0.22 +
    (player.roleSecurity ?? 70) * 0.04 -
    (player.risk ?? 48) * 0.035
  );
}

function normalizePosition(position: string): FantasyPowerPosition {
  const normalized = position.toUpperCase();

  if (normalized === "DEF" || normalized === "D") {
    return "DST";
  }

  return powerPositions.includes(normalized as FantasyPowerPosition)
    ? (normalized as FantasyPowerPosition)
    : "WR";
}

function positionLabel(position: FantasyPowerPosition) {
  return position === "DST" ? "DEF" : position;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function average(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
