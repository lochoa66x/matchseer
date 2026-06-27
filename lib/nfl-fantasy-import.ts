export type FantasyImportSource =
  | "seeded"
  | "sleeper"
  | "manual"
  | "screenshot"
  | "feed";

export type FantasyProjectionAdjustment = {
  label: string;
  delta: number;
};

export type FantasyDepthTier =
  | "anchor"
  | "starter"
  | "rotation"
  | "stash"
  | "streamer";

export type FantasySourcePosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type FantasySourceCoverageStatus = {
  totalPlayers: number;
  totalProjections: number;
  totalRankings: number;
  positions: Record<
    FantasySourcePosition,
    { players: number; projections: number; rankings: number; total: number }
  >;
  missingPositions: FantasySourcePosition[];
};

export type FantasySourceFreshness = "fresh" | "stale" | "unknown";

export type FantasyMatchupPlanLens = "redraft" | "dynasty" | string;

export type FantasyMatchupPlanPosition = {
  position: FantasySourcePosition | string;
  myProjection: number;
  opponentProjection: number;
  myDepth?: number;
  opponentDepth?: number;
  myRisk?: number;
  opponentRisk?: number;
  myRoleSecurity?: number;
  opponentRoleSecurity?: number;
};

export type FantasyMatchupPlanPlayer = {
  name: string;
  position: FantasySourcePosition | string;
  projection: number;
  floor?: number;
  ceiling?: number;
  risk?: number;
  roleSecurity?: number;
  dynastyValue?: number;
};

export type FantasyMatchupWeaknessPlan = {
  attackLane: {
    position: FantasySourcePosition;
    title: string;
    summary: string;
    edge: number;
  };
  dangerLane: {
    position: FantasySourcePosition;
    title: string;
    summary: string;
    gap: number;
  };
  benchLever: {
    type: "bench" | "hold";
    playerName?: string;
    position: FantasySourcePosition;
    summary: string;
  };
  tradePath: {
    type: "trade" | "waiver";
    targetName?: string;
    offerName?: string;
    position: FantasySourcePosition;
    summary: string;
  };
  swingChecklist: string[];
  myWeakPosition: FantasySourcePosition;
  opponentWeakPosition: FantasySourcePosition;
};

export type FantasyMatchupWeaknessPlanInput = {
  myTeamName: string;
  opponentTeamName: string;
  lens?: FantasyMatchupPlanLens;
  positionEdges: FantasyMatchupPlanPosition[];
  myBench?: FantasyMatchupPlanPlayer[];
  myPlayers?: FantasyMatchupPlanPlayer[];
  opponentPlayers?: FantasyMatchupPlanPlayer[];
};

export type NflFantasyPlayer = {
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
  age?: number;
  experience?: number;
  sourceRank?: number;
  positionRank?: number;
  roleSecurity?: number;
  dynastyValue?: number;
  depthTier?: FantasyDepthTier;
  source?: FantasyImportSource;
  sourceProjection?: number;
  sourceBlendProjection?: number;
  sourceProjectionWeight?: number;
  sourceTrustLabel?: string;
  seerProjection?: number;
  seerDelta?: number;
  seerAdjustmentCap?: number;
  seerAdjustments?: string[];
  seerAdjustmentDetails?: FantasyProjectionAdjustment[];
  crowdSignalDelta?: number;
  crowdSignalLabel?: string;
  projectionSource?: string;
  rankingSource?: string;
  sourceProviderLabel?: string;
  sourceSeason?: string;
  sourceWeek?: string;
  sourceUpdatedAt?: string;
};

export type ImportedFantasyTeam = {
  id: string;
  name: string;
  manager: string;
  rosterIds: string[];
  starterIds?: string[];
  benchIds?: string[];
  identity: string;
  source: FantasyImportSource;
};

export type ImportedFantasyLeague = {
  id: string;
  label: string;
  source: FantasyImportSource;
  season?: string;
  week?: number;
  teams: ImportedFantasyTeam[];
  players: NflFantasyPlayer[];
  notes: string[];
  sleeper?: SleeperImportReceipt;
  suggestedTeamId?: string;
  suggestedOpponentTeamId?: string;
};

export type FantasySourceProjection = {
  id: string;
  name: string;
  team: string;
  position: string;
  projection?: number;
  scoring?: "standard" | "halfPpr" | "fullPpr" | "unknown";
  source: string;
  opponent?: string;
  sourceRank?: number;
  positionRank?: number;
  age?: number;
  experience?: number;
  roleSecurity?: number;
  dynastyValue?: number;
  depthTier?: FantasyDepthTier;
  rankingSource?: string;
  providerLabel?: string;
  season?: string;
  week?: string;
  updatedAt?: string;
};

export type FantasyProjectionMatchupContext = {
  team: string;
  opponent?: string;
  weather?: string;
  pace?: number;
  teamWin?: number;
  opponentWin?: number;
  teamOffense?: number;
  opponentDefense?: number;
  teamHealth?: number;
  venue?: string;
  crowdNudge?: number;
  crowdSignal?: string;
};

export type FantasyProjectionRealismOptions = {
  cap?: number;
  matchups?: FantasyProjectionMatchupContext[];
  sourceWeight?: number;
};

type ManualPlayerLine = {
  name: string;
  position: string;
  team: string;
  sourceProjection?: number;
  sourceRank?: number;
  positionRank?: number;
  age?: number;
  experience?: number;
  roleSecurity?: number;
  dynastyValue?: number;
  depthTier?: FantasyDepthTier;
  rankingSource?: string;
  sourceProviderLabel?: string;
  sourceSeason?: string;
  sourceWeek?: string;
  sourceUpdatedAt?: string;
};

export type FantasyProviderBridgeImport = {
  id: string;
  label: string;
  providerLabel: string;
  source: "manual-upload";
  season?: string;
  week?: string;
  updatedAt: string;
  projections: FantasySourceProjection[];
  notes: string[];
};

export type FantasyProviderBridgeInput = {
  text: string;
  providerLabel?: string;
  season?: string;
  week?: string;
  updatedAt?: string;
};

export type SleeperLeague = {
  league_id?: string | number | null;
  name?: string | null;
  season?: string | number | null;
  status?: string | null;
  total_rosters?: string | number | null;
};

export type SleeperRoster = {
  roster_id?: string | number | null;
  owner_id?: string | number | null;
  players?: string[] | null;
  starters?: string[] | null;
};

export type SleeperUser = {
  user_id?: string | number | null;
  display_name?: string | null;
  username?: string | null;
  metadata?: {
    team_name?: string | null;
  } | null;
};

export type SleeperPlayer = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  search_full_name?: string | null;
  team?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  injury_status?: string | null;
  status?: string | null;
  search_rank?: number | string | null;
  age?: number | string | null;
};

export type SleeperMatchup = {
  roster_id?: string | number | null;
  matchup_id?: string | number | null;
};

export type SleeperImportReceipt = {
  leagueId: string;
  leagueName: string;
  season?: string;
  week?: number;
  matchupId?: string;
  rosterCount: number;
  selectedRosterId?: string;
  opponentRosterId?: string;
  selectedTeamId?: string;
  opponentTeamId?: string;
  userId?: string;
  status: "matched" | "no-matchup" | "no-user-match";
};

export type SleeperLeagueOption = {
  leagueId: string;
  name: string;
  season?: string;
  status?: string;
  rosterCount?: number;
  userId?: string;
  isBestGuess: boolean;
};

export type SleeperImportQuery = {
  token: string;
  kind: "league" | "user" | "id" | "empty";
};

const nflTeamColors: Record<string, string> = {
  ARI: "#97233f",
  ATL: "#a71930",
  BAL: "#6b46c1",
  BUF: "#2563eb",
  CAR: "#0085ca",
  CHI: "#0b162a",
  CIN: "#fb4f14",
  CLE: "#311d00",
  DAL: "#869397",
  DEN: "#fb4f14",
  DET: "#0fb5ff",
  GB: "#203731",
  HOU: "#03202f",
  IND: "#002c5f",
  JAX: "#006778",
  KC: "#ef4444",
  LAC: "#0080c6",
  LAR: "#f59e0b",
  LV: "#a5acaf",
  MIA: "#008e97",
  MIN: "#4f2683",
  NE: "#002244",
  NO: "#d3bc8d",
  NYG: "#0b2265",
  NYJ: "#125740",
  PHI: "#2dd4bf",
  PIT: "#ffb612",
  SEA: "#002a5c",
  SF: "#aa0000",
  TB: "#d50a0a",
  TEN: "#4b92db",
  WAS: "#5a1414",
  FA: "#8fb3d9",
};

const teamCodes = new Set(Object.keys(nflTeamColors));
const positionTokens = new Set([
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
  "DEF",
  "D",
  "FLEX",
  "SUPERFLEX",
  "BN",
  "BENCH",
]);

const fantasySourcePositions: FantasySourcePosition[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

type SeededFantasySpineRow = {
  name: string;
  team: string;
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST";
  positionRank: number;
  age?: number;
  dynastyValue?: number;
  roleSecurity?: number;
};

const seededFantasySpineRows: SeededFantasySpineRow[] = [
  ...seedPositionRows("QB", [
    ["Lamar Jackson", "BAL", 29],
    ["Josh Allen", "BUF", 30],
    ["Jalen Hurts", "PHI", 28],
    ["Jayden Daniels", "WAS", 25],
    ["Joe Burrow", "CIN", 29],
    ["Patrick Mahomes", "KC", 30],
    ["C.J. Stroud", "HOU", 24],
    ["Anthony Richardson", "IND", 24],
    ["Kyler Murray", "ARI", 29],
    ["Jordan Love", "GB", 27],
    ["Dak Prescott", "DAL", 33],
    ["Brock Purdy", "SF", 26],
  ]),
  ...seedPositionRows("RB", [
    ["Jahmyr Gibbs", "DET", 24],
    ["Bijan Robinson", "ATL", 24],
    ["Saquon Barkley", "PHI", 29],
    ["Christian McCaffrey", "SF", 30],
    ["De'Von Achane", "MIA", 24],
    ["Breece Hall", "NYJ", 25],
    ["Jonathan Taylor", "IND", 27],
    ["Derrick Henry", "BAL", 32],
    ["Josh Jacobs", "GB", 28],
    ["Kyren Williams", "LAR", 26],
    ["Ashton Jeanty", "LV", 22],
    ["Chase Brown", "CIN", 26],
    ["James Cook", "BUF", 26],
    ["Kenneth Walker III", "SEA", 25],
    ["David Montgomery", "DET", 29],
    ["Alvin Kamara", "NO", 31],
    ["Isiah Pacheco", "KC", 27],
    ["Brian Robinson Jr.", "WAS", 27],
  ]),
  ...seedPositionRows("WR", [
    ["Ja'Marr Chase", "CIN", 26],
    ["Justin Jefferson", "MIN", 27],
    ["CeeDee Lamb", "DAL", 27],
    ["Amon-Ra St. Brown", "DET", 26],
    ["Puka Nacua", "LAR", 25],
    ["Malik Nabers", "NYG", 23],
    ["Nico Collins", "HOU", 27],
    ["Brian Thomas Jr.", "JAX", 23],
    ["A.J. Brown", "PHI", 29],
    ["Drake London", "ATL", 25],
    ["Tyreek Hill", "MIA", 32],
    ["Garrett Wilson", "NYJ", 26],
    ["Ladd McConkey", "LAC", 24],
    ["Tee Higgins", "CIN", 27],
    ["Marvin Harrison Jr.", "ARI", 24],
    ["DK Metcalf", "PIT", 28],
    ["Terry McLaurin", "WAS", 31],
    ["Mike Evans", "TB", 32],
    ["Chris Olave", "NO", 26],
    ["Xavier Worthy", "KC", 23],
    ["Rashee Rice", "KC", 26],
    ["Courtland Sutton", "DEN", 30],
    ["DJ Moore", "CHI", 29],
    ["Rome Odunze", "CHI", 24],
  ]),
  ...seedPositionRows("TE", [
    ["Brock Bowers", "LV", 23],
    ["Trey McBride", "ARI", 26],
    ["George Kittle", "SF", 32],
    ["Travis Kelce", "KC", 36],
    ["Sam LaPorta", "DET", 25],
    ["T.J. Hockenson", "MIN", 29],
    ["Mark Andrews", "BAL", 30],
    ["Evan Engram", "DEN", 31],
    ["David Njoku", "CLE", 30],
    ["Jake Ferguson", "DAL", 27],
    ["Dalton Kincaid", "BUF", 26],
    ["Tyler Warren", "IND", 23],
  ]),
  ...seedPositionRows("K", [
    ["Brandon Aubrey", "DAL", 31],
    ["Harrison Butker", "KC", 31],
    ["Jake Elliott", "PHI", 31],
    ["Ka'imi Fairbairn", "HOU", 32],
    ["Cameron Dicker", "LAC", 26],
    ["Tyler Bass", "BUF", 29],
    ["Chase McLaughlin", "TB", 30],
    ["Younghoe Koo", "ATL", 31],
    ["Chris Boswell", "PIT", 35],
    ["Jake Bates", "DET", 27],
  ]),
  ...seedPositionRows("DST", [
    ["Philadelphia Eagles", "PHI"],
    ["Baltimore Ravens", "BAL"],
    ["Pittsburgh Steelers", "PIT"],
    ["Buffalo Bills", "BUF"],
    ["Kansas City Chiefs", "KC"],
    ["New York Jets", "NYJ"],
    ["San Francisco 49ers", "SF"],
    ["Cleveland Browns", "CLE"],
    ["Houston Texans", "HOU"],
    ["Dallas Cowboys", "DAL"],
    ["Minnesota Vikings", "MIN"],
    ["Denver Broncos", "DEN"],
  ]),
];

export function createSeededFantasyPlayerPool() {
  return seededFantasySpineRows
    .map((row) => ({
      ...row,
      sourceProjection: seededSourceProjection(row.position, row.positionRank),
      roleSecurity:
        row.roleSecurity ?? seededRoleSecurity(row.position, row.positionRank),
      dynastyValue:
        row.dynastyValue ??
        seededDynastyValue(row.position, row.positionRank, row.age),
      depthTier: seededDepthTier(row.positionRank),
      rankingSource: "MatchSeer seeded spine",
    }))
    .sort(
      (left, right) =>
        right.sourceProjection - left.sourceProjection ||
        left.positionRank - right.positionRank,
    )
    .map((row, index) =>
      createGeneratedFantasyPlayer({
        line: {
          name: row.name,
          position: row.position,
          team: row.team,
          sourceProjection: row.sourceProjection,
          sourceRank: index + 1,
          positionRank: row.positionRank,
          age: row.age,
          experience: row.age ? Math.max(0, row.age - 22) : undefined,
          roleSecurity: row.roleSecurity,
          dynastyValue: row.dynastyValue,
          depthTier: row.depthTier,
          rankingSource: row.rankingSource,
        },
        rank: index + 1,
        source: "seeded",
      }),
    );
}

function seedPositionRows(
  position: SeededFantasySpineRow["position"],
  rows: Array<[name: string, team: string, age?: number]>,
) {
  return rows.map(([name, team, age], index) => ({
    name,
    team,
    position,
    age,
    positionRank: index + 1,
  }));
}

function seededSourceProjection(
  position: SeededFantasySpineRow["position"],
  positionRank: number,
) {
  const rank = Math.max(1, positionRank);
  const baseByPosition = {
    QB: 24.8,
    RB: 22.6,
    WR: 22.4,
    TE: 16.1,
    K: 9.7,
    DST: 9.6,
  };
  const falloffByPosition = {
    QB: 0.56,
    RB: 0.46,
    WR: 0.38,
    TE: 0.5,
    K: 0.18,
    DST: 0.22,
  };
  const floorByPosition = {
    QB: 14.2,
    RB: 7.8,
    WR: 7.4,
    TE: 5.5,
    K: 6.8,
    DST: 5.8,
  };

  return round1(
    Math.max(
      floorByPosition[position],
      baseByPosition[position] - (rank - 1) * falloffByPosition[position],
    ),
  );
}

function seededRoleSecurity(
  position: SeededFantasySpineRow["position"],
  positionRank: number,
) {
  const positionBias = position === "QB" || position === "K" || position === "DST" ? 5 : 0;

  return clampMeter(92 - positionRank * 2 + positionBias);
}

function seededDynastyValue(
  position: SeededFantasySpineRow["position"],
  positionRank: number,
  age: number | undefined,
) {
  const ageValue = age ? clampMeter(108 - Math.max(0, age - 22) * 5) : 74;
  const positionBias = position === "QB" ? 8 : position === "RB" ? -4 : 0;

  return clampMeter(ageValue + 22 - positionRank * 2 + positionBias);
}

function seededDepthTier(positionRank: number): FantasyDepthTier {
  if (positionRank <= 3) {
    return "anchor";
  }

  if (positionRank <= 10) {
    return "starter";
  }

  if (positionRank <= 18) {
    return "rotation";
  }

  return "stash";
}

export function createManualFantasyLeague({
  knownPlayers,
  source = "manual",
  text,
}: {
  knownPlayers: NflFantasyPlayer[];
  source?: "manual" | "screenshot";
  text: string;
}): ImportedFantasyLeague {
  const parsedTeams = parseManualTeamBlocks(text);
  const knownByName = new Map(
    knownPlayers.map((player) => [normalizeName(player.name), player]),
  );
  const playersById = new Map<string, NflFantasyPlayer>();
  const teams = parsedTeams.map((team, teamIndex) => {
    const rosterIds = team.players.map((line, playerIndex) => {
      const matched = knownByName.get(normalizeName(line.name));
      const player =
        matched ??
        createGeneratedFantasyPlayer({
          line,
          rank: teamIndex * 20 + playerIndex + 24,
          source,
        });

      const importedPlayer =
        matched && line.sourceProjection
          ? {
              ...matched,
              source,
              sourceProjection: line.sourceProjection,
              seerAdjustments: [
                "Known player matched from the Seer board.",
                "Imported projection kept as the source receipt.",
              ],
            }
          : {
              ...player,
              source,
            };

      playersById.set(importedPlayer.id, importedPlayer);

      return importedPlayer.id;
    });

    return {
      id: `${source}-${slugify(team.name)}-${teamIndex + 1}`,
      name: team.name,
      manager: teamIndex === 0 ? "My squad" : "Opponent",
      rosterIds,
      starterIds: rosterIds,
      benchIds: [],
      identity:
        teamIndex === 0
          ? "Imported roster, ready for a real squad read."
          : "Imported opponent roster, built for a clean fantasy comparison.",
      source,
    };
  });

  return {
    id: `${source}-${hashText(text)}`,
    label: source === "screenshot" ? "Screenshot roster import" : "Manual roster import",
    source,
    teams,
    players: [...playersById.values()],
    notes:
      teams.length >= 2
        ? ["Manual teams parsed into the Team Lab."]
        : ["Add a My team and Opponent heading for the cleanest comparison."],
  };
}

export function buildSleeperFantasyLeague({
  league,
  matchups = [],
  players,
  preferredOwnerId,
  preferredRosterId,
  rosters,
  users,
  week,
}: {
  league: SleeperLeague;
  matchups?: SleeperMatchup[];
  players: Record<string, SleeperPlayer>;
  preferredOwnerId?: string;
  preferredRosterId?: string;
  rosters: SleeperRoster[];
  users: SleeperUser[];
  week?: number;
}): ImportedFantasyLeague {
  const userById = new Map(
    users
      .map((user) => [stringId(user.user_id), user] as const)
      .filter(([id]) => id.length > 0),
  );
  const matchupByRosterId = new Map(
    matchups
      .map((matchup) => [stringId(matchup.roster_id), stringId(matchup.matchup_id)] as const)
      .filter(([rosterId, matchupId]) => rosterId.length > 0 && matchupId.length > 0),
  );
  const preferredRoster =
    rosters.find((roster) => stringId(roster.roster_id) === stringId(preferredRosterId)) ??
    rosters.find((roster) => stringId(roster.owner_id) === stringId(preferredOwnerId)) ??
    null;
  const preferredSleeperRosterId = stringId(preferredRoster?.roster_id);
  const preferredMatchupId = matchupByRosterId.get(preferredSleeperRosterId);
  const opponentRoster =
    preferredMatchupId
      ? rosters.find((roster) => {
          const rosterId = stringId(roster.roster_id);

          return (
            rosterId !== preferredSleeperRosterId &&
            matchupByRosterId.get(rosterId) === preferredMatchupId
          );
        }) ?? null
      : null;
  const opponentSleeperRosterId = stringId(opponentRoster?.roster_id);
  const importedPlayers = new Map<string, NflFantasyPlayer>();
  const sortedRosters = [...rosters].sort((left, right) => {
    const leftRosterId = stringId(left.roster_id);
    const rightRosterId = stringId(right.roster_id);

    if (leftRosterId === preferredSleeperRosterId) {
      return -1;
    }

    if (rightRosterId === preferredSleeperRosterId) {
      return 1;
    }

    if (leftRosterId === opponentSleeperRosterId) {
      return -1;
    }

    if (rightRosterId === opponentSleeperRosterId) {
      return 1;
    }

    const leftMatchup = matchupByRosterId.get(stringId(left.roster_id)) ?? "";
    const rightMatchup = matchupByRosterId.get(stringId(right.roster_id)) ?? "";

    return leftMatchup.localeCompare(rightMatchup) || Number(left.roster_id) - Number(right.roster_id);
  });
  const teams = sortedRosters
    .map((roster, index) => {
      const user = userById.get(stringId(roster.owner_id));
      const rosterId = stringId(roster.roster_id) || String(index + 1);
      const rosterPlayerIds = normalizeSleeperIds(roster.players);
      const starterSleeperIds = normalizeSleeperIds(roster.starters);
      const fantasyIds = rosterPlayerIds
        .map((playerId, playerIndex) => {
          const player = sleeperPlayerToFantasyPlayer({
            player: players[playerId],
            playerId,
            rank: index * 20 + playerIndex + 18,
          });

          if (!player) {
            return null;
          }

          importedPlayers.set(player.id, player);

          return player.id;
        })
        .filter((playerId): playerId is string => Boolean(playerId));
      const starterIds = starterSleeperIds
        .map((playerId) => sleeperFantasyId(playerId, players[playerId]))
        .filter(
          (playerId): playerId is string =>
            typeof playerId === "string" && fantasyIds.includes(playerId),
        );
      const starterSet = new Set(starterIds);
      const benchIds = fantasyIds.filter((playerId) => !starterSet.has(playerId));
      const teamName =
        cleanLine(user?.metadata?.team_name) ||
        cleanLine(user?.display_name) ||
        cleanLine(user?.username) ||
        `Sleeper Team ${rosterId}`;

      return {
        id: `sleeper-roster-${rosterId}`,
        name: teamName,
        manager: cleanLine(user?.display_name) || `Roster ${rosterId}`,
        rosterIds: fantasyIds,
        starterIds: starterIds.length > 0 ? starterIds : fantasyIds.slice(0, 9),
        benchIds,
        identity: `Sleeper roster ${rosterId}${matchupByRosterId.get(rosterId) ? `, matchup ${matchupByRosterId.get(rosterId)}` : ""}.`,
        source: "sleeper" as const,
      };
    })
    .filter((team) => team.rosterIds.length > 0);
  const selectedTeamId = preferredSleeperRosterId
    ? `sleeper-roster-${preferredSleeperRosterId}`
    : teams[0]?.id;
  const opponentTeamId = opponentSleeperRosterId
    ? `sleeper-roster-${opponentSleeperRosterId}`
    : teams.find((team) => team.id !== selectedTeamId)?.id;
  const receipt: SleeperImportReceipt = {
    leagueId: stringId(league.league_id) || "league",
    leagueName: cleanLine(league.name) || "Sleeper league import",
    matchupId: preferredMatchupId,
    opponentRosterId: opponentSleeperRosterId || undefined,
    opponentTeamId,
    rosterCount: rosters.length,
    season: stringId(league.season) || undefined,
    selectedRosterId: preferredSleeperRosterId || undefined,
    selectedTeamId,
    status: preferredSleeperRosterId
      ? preferredMatchupId && opponentSleeperRosterId
        ? "matched"
        : "no-matchup"
      : "no-user-match",
    userId: stringId(preferredOwnerId) || undefined,
    week,
  };

  return {
    id: `sleeper-${stringId(league.league_id) || "league"}`,
    label: cleanLine(league.name) || "Sleeper league import",
    source: "sleeper",
    season: stringId(league.season) || undefined,
    week,
    teams,
    players: [...importedPlayers.values()],
    sleeper: receipt,
    suggestedOpponentTeamId: opponentTeamId,
    suggestedTeamId: selectedTeamId,
    notes: [
      "Sleeper import loaded rosters, starters, benches, and player names.",
      receipt.status === "matched"
        ? `Matched roster ${receipt.selectedRosterId} to matchup ${receipt.matchupId}.`
        : receipt.status === "no-matchup"
          ? "Your roster loaded, but no current matchup opponent was found for that week."
          : "League loaded, but no Sleeper user roster was matched automatically.",
      "Sleeper projections are not included in the public roster endpoint, so the Seer creates the forecast layer from role, position, matchup, and health signals.",
    ],
  };
}

export function parseSleeperImportQuery(value: string): SleeperImportQuery {
  const trimmed = value.trim();

  if (!trimmed) {
    return { kind: "empty", token: "" };
  }

  const leagueUrlMatch = trimmed.match(
    /sleeper\.com\/leagues?\/(?:nfl\/)?(\d{8,})/i,
  );

  if (leagueUrlMatch) {
    return { kind: "league", token: leagueUrlMatch[1] };
  }

  const userUrlMatch = trimmed.match(/sleeper\.com\/user\/([^/?#\s]+)/i);

  if (userUrlMatch) {
    return { kind: "user", token: decodeURIComponent(userUrlMatch[1]) };
  }

  if (/^\d{8,}$/.test(trimmed)) {
    return { kind: "id", token: trimmed };
  }

  return { kind: "user", token: trimmed };
}

export function sleeperLeagueOptionsFromLeagues({
  leagues,
  season,
  userId,
}: {
  leagues: SleeperLeague[];
  season?: string;
  userId?: string;
}): SleeperLeagueOption[] {
  const sortedLeagues = [...leagues].sort((left, right) => {
    const statusRank =
      sleeperLeagueStatusRank(left.status) - sleeperLeagueStatusRank(right.status);

    if (statusRank !== 0) {
      return statusRank;
    }

    return (cleanLine(left.name) || stringId(left.league_id)).localeCompare(
      cleanLine(right.name) || stringId(right.league_id),
    );
  });

  return sortedLeagues
    .map((league, index) => ({
      isBestGuess: index === 0,
      leagueId: stringId(league.league_id),
      name: cleanLine(league.name) || `Sleeper league ${stringId(league.league_id)}`,
      rosterCount: numberFromLooseValue(league.total_rosters),
      season: stringId(league.season) || season,
      status: cleanLine(league.status) || undefined,
      userId,
    }))
    .filter((league) => league.leagueId.length > 0);
}

export function buildFantasyMatchupWeaknessPlan({
  lens = "redraft",
  myBench = [],
  myPlayers = [],
  myTeamName,
  opponentPlayers = [],
  opponentTeamName,
  positionEdges,
}: FantasyMatchupWeaknessPlanInput): FantasyMatchupWeaknessPlan {
  const normalizedEdges = normalizeMatchupPlanEdges(positionEdges);
  const myWeakEdge =
    [...normalizedEdges].sort((left, right) => right.myWeakScore - left.myWeakScore)[0] ??
    normalizedEdges[0];
  const opponentWeakEdge =
    [...normalizedEdges].sort(
      (left, right) => right.opponentWeakScore - left.opponentWeakScore,
    )[0] ?? normalizedEdges[0];
  const benchLever = matchupBenchLever(myBench, myWeakEdge);
  const tradePath = matchupTradePath({
    lens,
    myPlayers,
    myWeakEdge,
    opponentPlayers,
    opponentWeakEdge,
  });

  return {
    attackLane: {
      edge: round1(Math.max(0, opponentWeakEdge.myProjection - opponentWeakEdge.opponentProjection)),
      position: opponentWeakEdge.position,
      summary:
        opponentWeakEdge.myProjection > opponentWeakEdge.opponentProjection
          ? `${myTeamName} can attack ${opponentTeamName}'s ${opponentWeakEdge.position} lane by leaning into a ${round1(opponentWeakEdge.myProjection - opponentWeakEdge.opponentProjection).toFixed(1)} point edge.`
          : `${opponentTeamName}'s ${opponentWeakEdge.position} lane is the thinnest relative spot; keep pressure there with floor and role volume.`,
      title: `Attack ${opponentWeakEdge.position}`,
    },
    benchLever,
    dangerLane: {
      gap: round1(Math.max(0, myWeakEdge.opponentProjection - myWeakEdge.myProjection)),
      position: myWeakEdge.position,
      summary:
        myWeakEdge.opponentProjection > myWeakEdge.myProjection
          ? `${opponentTeamName} can hurt you at ${myWeakEdge.position}; the gap is ${round1(myWeakEdge.opponentProjection - myWeakEdge.myProjection).toFixed(1)} before bench or trade fixes.`
          : `${myTeamName}'s ${myWeakEdge.position} lane has the most fragility once depth, role security, and chaos are included.`,
      title: `Protect ${myWeakEdge.position}`,
    },
    myWeakPosition: myWeakEdge.position,
    opponentWeakPosition: opponentWeakEdge.position,
    swingChecklist: matchupSwingChecklist({
      benchLever,
      myTeamName,
      myWeakEdge,
      opponentTeamName,
      opponentWeakEdge,
      tradePath,
    }),
    tradePath,
  };
}

type NormalizedMatchupPlanEdge = FantasyMatchupPlanPosition & {
  position: FantasySourcePosition;
  myWeakScore: number;
  opponentWeakScore: number;
};

function normalizeMatchupPlanEdges(
  edges: FantasyMatchupPlanPosition[],
): NormalizedMatchupPlanEdge[] {
  const normalized = edges.map((edge) => {
    const position = normalizePosition(edge.position) as FantasySourcePosition;
    const myGap = edge.opponentProjection - edge.myProjection;
    const opponentGap = edge.myProjection - edge.opponentProjection;
    const myWeakScore =
      myGap +
      Math.max(0, 2 - (edge.myDepth ?? 1)) * 1.4 +
      (edge.myRisk ?? 50) / 45 -
      (edge.myRoleSecurity ?? 72) / 120;
    const opponentWeakScore =
      opponentGap +
      Math.max(0, 2 - (edge.opponentDepth ?? 1)) * 1.4 +
      (edge.opponentRisk ?? 50) / 45 -
      (edge.opponentRoleSecurity ?? 72) / 120;

    return {
      ...edge,
      myWeakScore,
      opponentWeakScore,
      position,
    };
  });

  return normalized.length > 0
    ? normalized
    : [
        {
          myDepth: 0,
          myProjection: 0,
          myRisk: 50,
          myRoleSecurity: 70,
          myWeakScore: 0,
          opponentDepth: 0,
          opponentProjection: 0,
          opponentRisk: 50,
          opponentRoleSecurity: 70,
          opponentWeakScore: 0,
          position: "WR",
        },
      ];
}

function matchupBenchLever(
  myBench: FantasyMatchupPlanPlayer[],
  myWeakEdge: NormalizedMatchupPlanEdge,
): FantasyMatchupWeaknessPlan["benchLever"] {
  const candidate = myBench
    .filter((player) => normalizePosition(player.position) === myWeakEdge.position)
    .sort((left, right) => matchupPlayerUtility(right) - matchupPlayerUtility(left))[0];

  if (!candidate) {
    return {
      position: myWeakEdge.position,
      summary: `No bench ${myWeakEdge.position} cover is obvious; keep the waiver list warm for that lane.`,
      type: "hold",
    };
  }

  const coverValue = round1(
    candidate.projection + (candidate.floor ?? candidate.projection) * 0.25,
  );

  return {
    playerName: candidate.name,
    position: myWeakEdge.position,
    summary: `${candidate.name} is the bench lever at ${myWeakEdge.position}: ${candidate.projection.toFixed(1)} projected with enough floor to cover the weak lane.`,
    type: coverValue >= Math.max(8, myWeakEdge.myProjection * 0.28) ? "bench" : "hold",
  };
}

function matchupTradePath({
  lens,
  myPlayers,
  myWeakEdge,
  opponentPlayers,
  opponentWeakEdge,
}: {
  lens: FantasyMatchupPlanLens;
  myPlayers: FantasyMatchupPlanPlayer[];
  myWeakEdge: NormalizedMatchupPlanEdge;
  opponentPlayers: FantasyMatchupPlanPlayer[];
  opponentWeakEdge: NormalizedMatchupPlanEdge;
}): FantasyMatchupWeaknessPlan["tradePath"] {
  const target = opponentPlayers
    .filter((player) => normalizePosition(player.position) === myWeakEdge.position)
    .sort(
      (left, right) => matchupPlayerUtility(right, lens) - matchupPlayerUtility(left, lens),
    )[0];
  const offer = myPlayers
    .filter((player) => normalizePosition(player.position) === opponentWeakEdge.position)
    .sort(
      (left, right) => matchupPlayerUtility(right, lens) - matchupPlayerUtility(left, lens),
    )[0];

  if (target && offer && matchupTradeLooksPlausible({ lens, offer, target })) {
    return {
      offerName: offer.name,
      position: myWeakEdge.position,
      summary: `Float ${offer.name} for ${target.name}: it attacks your ${myWeakEdge.position} need while giving the other side help at ${opponentWeakEdge.position}.`,
      targetName: target.name,
      type: "trade",
    };
  }

  return {
    position: myWeakEdge.position,
    summary:
      lens === "dynasty"
        ? `No fair trade lane is obvious. Use waivers for young role growth at ${myWeakEdge.position} before moving core pieces.`
        : `No fair trade lane is obvious. Stream waivers or bench volume at ${myWeakEdge.position} before forcing a deal.`,
    type: "waiver",
  };
}

function matchupTradeLooksPlausible({
  lens,
  offer,
  target,
}: {
  lens: FantasyMatchupPlanLens;
  offer: FantasyMatchupPlanPlayer;
  target: FantasyMatchupPlanPlayer;
}) {
  const offerValue = matchupPlayerUtility(offer, lens);
  const targetValue = matchupPlayerUtility(target, lens);

  return offerValue >= targetValue * 0.72 && offerValue <= targetValue * 1.32;
}

function matchupPlayerUtility(
  player: FantasyMatchupPlanPlayer,
  lens: FantasyMatchupPlanLens = "redraft",
) {
  const base =
    player.projection * 1.6 +
    (player.floor ?? player.projection) * 0.55 +
    (player.ceiling ?? player.projection) * 0.2 +
    (player.roleSecurity ?? 72) * 0.05 -
    (player.risk ?? 48) * 0.05;
  const dynastyBoost =
    lens === "dynasty"
      ? (player.dynastyValue ?? player.roleSecurity ?? 72) * 0.16
      : 0;

  return base + dynastyBoost;
}

function matchupSwingChecklist({
  benchLever,
  myTeamName,
  myWeakEdge,
  opponentTeamName,
  opponentWeakEdge,
  tradePath,
}: {
  benchLever: FantasyMatchupWeaknessPlan["benchLever"];
  myTeamName: string;
  myWeakEdge: NormalizedMatchupPlanEdge;
  opponentTeamName: string;
  opponentWeakEdge: NormalizedMatchupPlanEdge;
  tradePath: FantasyMatchupWeaknessPlan["tradePath"];
}) {
  return [
    `${myTeamName} must keep ${myWeakEdge.position} within ${Math.max(2, Math.round(Math.abs(myWeakEdge.opponentProjection - myWeakEdge.myProjection)))} points.`,
    `Attack ${opponentTeamName}'s ${opponentWeakEdge.position} lane with the safest role-volume play.`,
    benchLever.type === "bench"
      ? `Use ${benchLever.playerName} as the bench lever if late news hits ${benchLever.position}.`
      : `Keep a waiver backup ready for ${benchLever.position}.`,
    tradePath.type === "trade"
      ? `Only push the trade path if ${tradePath.targetName} is attainable without gutting the weekly lineup.`
      : `Do not force a trade; patch ${tradePath.position} with waiver or bench flexibility.`,
  ];
}

export function mergeFantasyPlayerPools(
  basePlayers: NflFantasyPlayer[],
  importedPlayers: NflFantasyPlayer[],
) {
  const merged = new Map(basePlayers.map((player) => [player.id, player]));

  importedPlayers.forEach((player) => {
    const matchedBase = findMatchingPlayer(basePlayers, player);
    const receipt: Partial<NflFantasyPlayer> = matchedBase
      ? projectionReceiptFields(matchedBase)
      : {};

    merged.set(player.id, {
      ...player,
      ...receipt,
      sourceProjection: player.sourceProjection ?? receipt.sourceProjection,
      source: player.source,
    });
  });

  return [...merged.values()];
}

export function normalizeFantasyProjectionFeed(payload: unknown): FantasySourceProjection[] {
  const rows = projectionRowsFromPayload(
    typeof payload === "string" ? fantasyProjectionPayloadFromText(payload) : payload,
  );

  return rows
    .map((row, index) => normalizeSourceProjection(row, index))
    .filter((projection): projection is FantasySourceProjection => projection !== null);
}

export function createFantasyProviderBridgeImport({
  providerLabel,
  season,
  text,
  updatedAt,
  week,
}: FantasyProviderBridgeInput): FantasyProviderBridgeImport {
  const payload = fantasyProjectionPayloadFromText(text);
  const metadata = providerBridgeMetadata(payload);
  const rawProjections = normalizeFantasyProjectionFeed(payload);
  const label =
    cleanLine(providerLabel) ||
    metadata.providerLabel ||
    rawProjections[0]?.providerLabel ||
    rawProjections[0]?.source ||
    "Manual provider upload";
  const importSeason = cleanLine(season) || metadata.season || rawProjections[0]?.season;
  const importWeek = cleanLine(week) || metadata.week || rawProjections[0]?.week;
  const importUpdatedAt =
    cleanLine(updatedAt) ||
    metadata.updatedAt ||
    newestProjectionUpdatedAt(rawProjections) ||
    new Date().toISOString();
  const projections = rawProjections.map((projection) => {
    const rowProvider =
      projection.providerLabel === "projection-feed"
        ? undefined
        : projection.providerLabel;
    const rowSource =
      projection.source === "projection-feed" ? undefined : projection.source;

    return {
      ...projection,
      providerLabel: rowProvider ?? label,
      rankingSource:
        projection.rankingSource === "projection-feed"
          ? label
          : projection.rankingSource ?? rowSource ?? label,
      season: projection.season ?? importSeason,
      source: rowSource || label,
      updatedAt: projection.updatedAt ?? importUpdatedAt,
      week: projection.week ?? importWeek,
    };
  });
  const projectionCount = projections.filter(
    (projection) => typeof projection.projection === "number",
  ).length;
  const rankingCount = projections.filter(
    (projection) =>
      typeof projection.sourceRank === "number" ||
      typeof projection.positionRank === "number",
  ).length;

  if (projections.length === 0) {
    throw new Error("No projection or ranking rows found.");
  }

  return {
    id: `provider-bridge-${slugify(label)}-${Date.parse(importUpdatedAt) || Date.now()}`,
    label: `${label}${importWeek ? ` · Week ${importWeek}` : ""}`,
    notes: [
      `${projections.length} player rows loaded.`,
      `${projectionCount} projections · ${rankingCount} rankings.`,
    ],
    projections,
    providerLabel: label,
    season: importSeason,
    source: "manual-upload",
    updatedAt: importUpdatedAt,
    week: importWeek,
  };
}

export function mergeFantasySourceFeeds(
  ...feeds: FantasySourceProjection[][]
): FantasySourceProjection[] {
  const merged = new Map<string, FantasySourceProjection>();

  feeds.flat().forEach((projection) => {
    const key = projectionKeys(projection)[0] ?? projection.id;
    const current = merged.get(key);

    if (!current) {
      merged.set(key, projection);
      return;
    }

    merged.set(key, {
      ...current,
      ...projection,
      projection: current.projection ?? projection.projection,
      scoring: current.scoring ?? projection.scoring,
      sourceRank: bestRank(current.sourceRank, projection.sourceRank),
      positionRank: bestRank(current.positionRank, projection.positionRank),
      source: [current.source, projection.source]
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .join(" + "),
      providerLabel: projection.providerLabel ?? current.providerLabel,
      rankingSource: projection.rankingSource ?? current.rankingSource,
      season: projection.season ?? current.season,
      updatedAt: projection.updatedAt ?? current.updatedAt,
      week: projection.week ?? current.week,
    });
  });

  return [...merged.values()].sort(
    (left, right) =>
      (left.sourceRank ?? 9999) - (right.sourceRank ?? 9999) ||
      (left.positionRank ?? 9999) - (right.positionRank ?? 9999) ||
      (right.projection ?? 0) - (left.projection ?? 0),
  );
}

function emptyFantasySourceCoveragePositions(): FantasySourceCoverageStatus["positions"] {
  return fantasySourcePositions.reduce<FantasySourceCoverageStatus["positions"]>(
    (positions, position) => {
      positions[position] = {
        players: 0,
        projections: 0,
        rankings: 0,
        total: 0,
      };
      return positions;
    },
    {} as FantasySourceCoverageStatus["positions"],
  );
}

export function fantasySourceCoverageFromProjections(
  projections: FantasySourceProjection[],
): FantasySourceCoverageStatus {
  const positions = emptyFantasySourceCoveragePositions();

  projections.forEach((projection) => {
    const position = normalizePosition(projection.position) as FantasySourcePosition;
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

  fantasySourcePositions.forEach((position) => {
    const row = positions[position];
    row.total = row.players + row.projections + row.rankings;
  });

  return {
    missingPositions: fantasySourcePositions.filter(
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

export function mergeFantasySourceCoverageStatuses(
  ...coverages: Array<FantasySourceCoverageStatus | undefined>
): FantasySourceCoverageStatus {
  const positions = emptyFantasySourceCoveragePositions();
  let totalPlayers = 0;
  let totalProjections = 0;
  let totalRankings = 0;

  coverages.forEach((coverage) => {
    if (!coverage) {
      return;
    }

    totalPlayers += coverage.totalPlayers;
    totalProjections += coverage.totalProjections;
    totalRankings += coverage.totalRankings;

    fantasySourcePositions.forEach((position) => {
      const row = coverage.positions[position];
      positions[position].players += row.players;
      positions[position].projections += row.projections;
      positions[position].rankings += row.rankings;
      positions[position].total += row.total;
    });
  });

  return {
    missingPositions: fantasySourcePositions.filter(
      (position) => positions[position].total === 0,
    ),
    positions,
    totalPlayers,
    totalProjections,
    totalRankings,
  };
}

export function fantasySourceFreshness(
  updatedAt: string | null | undefined,
  nowMs = Date.now(),
): FantasySourceFreshness {
  const timestamp = Date.parse(updatedAt ?? "");

  if (!Number.isFinite(timestamp)) {
    return "unknown";
  }

  const ageMs = Math.max(0, nowMs - timestamp);

  return ageMs <= 1000 * 60 * 60 * 24 * 7 ? "fresh" : "stale";
}

export function fantasyPlayersFromSourceProjections(
  projections: FantasySourceProjection[],
) {
  return projections.map((projection, index) => {
    const rank = projection.sourceRank ?? projection.positionRank ?? index + 18;

    return createGeneratedFantasyPlayer({
      line: {
        name: projection.name,
        position: projection.position,
        team: projection.team,
        sourceProjection: projection.projection,
        sourceRank: projection.sourceRank,
        positionRank: projection.positionRank,
        age: projection.age,
        experience: projection.experience,
        roleSecurity: projection.roleSecurity,
        dynastyValue: projection.dynastyValue,
        depthTier: projection.depthTier,
        sourceProviderLabel: projection.providerLabel ?? projection.source,
        sourceSeason: projection.season,
        sourceWeek: projection.week,
        sourceUpdatedAt: projection.updatedAt,
        rankingSource: projection.rankingSource ?? projection.source,
      },
      rank,
      source: "feed",
    });
  });
}

export function applyFantasyProjectionRealism(
  players: NflFantasyPlayer[],
  sourceProjections: FantasySourceProjection[],
  options: FantasyProjectionRealismOptions = {},
) {
  const projectionIndex = buildProjectionIndex(sourceProjections);
  const cap = clampNumber(options.cap ?? 2.4, 0.4, 4);

  return players.map((player) => {
    const source = matchSourceProjection(player, projectionIndex);
    const rawSourceProjection = source?.projection ?? player.sourceProjection;

    if (typeof rawSourceProjection !== "number") {
      return {
        ...player,
        opponent: source?.opponent ?? player.opponent,
        sourceProviderLabel:
          source?.providerLabel ?? source?.source ?? player.sourceProviderLabel,
        sourceRank: source?.sourceRank ?? player.sourceRank,
        positionRank: source?.positionRank ?? player.positionRank,
        age: player.age ?? source?.age,
        experience: player.experience ?? source?.experience,
        roleSecurity: player.roleSecurity ?? source?.roleSecurity,
        dynastyValue: player.dynastyValue ?? source?.dynastyValue,
        depthTier: player.depthTier ?? source?.depthTier,
        rankingSource: source?.rankingSource ?? source?.source ?? player.rankingSource,
        sourceTrustLabel: source
          ? fantasySourceTrustLabel(fantasyProjectionSourceWeight(source, options))
          : player.sourceTrustLabel,
        sourceSeason: source?.season ?? player.sourceSeason,
        sourceUpdatedAt: source?.updatedAt ?? player.sourceUpdatedAt,
        sourceWeek: source?.week ?? player.sourceWeek,
        seerAdjustments:
          player.seerAdjustments && player.seerAdjustments.length > 0
            ? player.seerAdjustments
            : ["No source projection yet", "Seer model fallback"],
      };
    }

    const context = matchupContextForPlayer(player, options.matchups ?? []);
    const sourceWeight = fantasyProjectionSourceWeight(source, options);
    const sourceBlendProjection = fantasyWeightedSourceProjection({
      player,
      rawSourceProjection,
      source,
      sourceWeight,
    });
    const adjustmentDetails = projectionAdjustmentDetails(player, context);
    const rawDelta = sum(adjustmentDetails.map((detail) => detail.delta));
    const seerDelta = round1(clampNumber(rawDelta, -cap, cap));
    const seerProjection = round1(Math.max(0, sourceBlendProjection + seerDelta));
    const crowdDelta =
      adjustmentDetails.find((detail) => detail.label === "crowd lean")?.delta ?? 0;
    const adjustmentLabels = adjustmentDetails
      .filter((detail) => Math.abs(detail.delta) >= 0.15)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 4)
      .map((detail) => `${detail.label} ${formatSignedDecimal(detail.delta)}`);

    return {
      ...player,
      opponent: source?.opponent ?? context?.opponent ?? player.opponent,
      sourceProjection: round1(rawSourceProjection),
      sourceBlendProjection,
      sourceProjectionWeight: sourceWeight,
      sourceTrustLabel: fantasySourceTrustLabel(sourceWeight),
      seerProjection,
      seerDelta,
      seerAdjustmentCap: cap,
      seerAdjustmentDetails: adjustmentDetails,
      seerAdjustments:
        adjustmentLabels.length > 0 ? adjustmentLabels : ["Source and Seer agree"],
      crowdSignalDelta: round1(crowdDelta),
      crowdSignalLabel:
        crowdDelta !== 0 ? context?.crowdSignal ?? "Crowd read nudged this lane" : undefined,
      projectionSource:
        source?.providerLabel ?? source?.source ?? player.projectionSource ?? "imported projection",
      sourceProviderLabel:
        source?.providerLabel ?? source?.source ?? player.sourceProviderLabel,
      sourceRank: source?.sourceRank ?? player.sourceRank,
      positionRank: source?.positionRank ?? player.positionRank,
      age: player.age ?? source?.age,
      experience: player.experience ?? source?.experience,
      roleSecurity: player.roleSecurity ?? source?.roleSecurity,
      dynastyValue: player.dynastyValue ?? source?.dynastyValue,
      depthTier: player.depthTier ?? source?.depthTier,
      rankingSource: source?.rankingSource ?? source?.source ?? player.rankingSource,
      sourceSeason: source?.season ?? player.sourceSeason,
      sourceUpdatedAt: source?.updatedAt ?? player.sourceUpdatedAt,
      sourceWeek: source?.week ?? player.sourceWeek,
    };
  });
}

export function applyFantasyProviderBridge(
  players: NflFantasyPlayer[],
  sourceProjections: FantasySourceProjection[],
  options: FantasyProjectionRealismOptions = {},
) {
  const knownPlayers = applyFantasyProjectionRealism(players, sourceProjections, options);
  const generatedPlayers = fantasyPlayersFromSourceProjections(sourceProjections).filter(
    (generatedPlayer) => !findMatchingPlayer(players, generatedPlayer),
  );

  if (generatedPlayers.length === 0) {
    return knownPlayers;
  }

  return [
    ...knownPlayers,
    ...applyFantasyProjectionRealism(generatedPlayers, sourceProjections, options),
  ];
}

export function sanitizeImportedFantasyLeague(
  value: unknown,
): ImportedFantasyLeague | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const league = value as Partial<ImportedFantasyLeague>;
  const players = Array.isArray(league.players)
    ? league.players.filter(isNflFantasyPlayer)
    : [];
  const playerIds = new Set(players.map((player) => player.id));
  const teams = Array.isArray(league.teams)
    ? league.teams
        .filter(isImportedFantasyTeam)
        .map((team) => ({
          ...team,
          rosterIds: team.rosterIds.filter((id) => playerIds.has(id)),
          starterIds: team.starterIds?.filter((id) => playerIds.has(id)),
          benchIds: team.benchIds?.filter((id) => playerIds.has(id)),
        }))
        .filter((team) => team.rosterIds.length > 0)
    : [];

  if (teams.length === 0 || players.length === 0 || !isImportSource(league.source)) {
    return null;
  }

  return {
    id: typeof league.id === "string" ? league.id : `${league.source}-import`,
    label: cleanLine(league.label) || "Fantasy import",
    source: league.source,
    season: typeof league.season === "string" ? league.season : undefined,
    week: typeof league.week === "number" ? league.week : undefined,
    teams,
    players,
    notes: Array.isArray(league.notes)
      ? league.notes.filter((note) => typeof note === "string")
      : [],
    sleeper: sanitizeSleeperImportReceipt(league.sleeper),
    suggestedOpponentTeamId:
      typeof league.suggestedOpponentTeamId === "string" &&
      teams.some((team) => team.id === league.suggestedOpponentTeamId)
        ? league.suggestedOpponentTeamId
        : undefined,
    suggestedTeamId:
      typeof league.suggestedTeamId === "string" &&
      teams.some((team) => team.id === league.suggestedTeamId)
        ? league.suggestedTeamId
        : undefined,
  };
}

function sanitizeSleeperImportReceipt(value: unknown): SleeperImportReceipt | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const receipt = value as Partial<SleeperImportReceipt>;

  if (
    typeof receipt.leagueId !== "string" ||
    typeof receipt.leagueName !== "string" ||
    typeof receipt.rosterCount !== "number" ||
    !isSleeperImportReceiptStatus(receipt.status)
  ) {
    return undefined;
  }

  return {
    leagueId: receipt.leagueId,
    leagueName: receipt.leagueName,
    matchupId:
      typeof receipt.matchupId === "string" ? receipt.matchupId : undefined,
    opponentRosterId:
      typeof receipt.opponentRosterId === "string"
        ? receipt.opponentRosterId
        : undefined,
    opponentTeamId:
      typeof receipt.opponentTeamId === "string" ? receipt.opponentTeamId : undefined,
    rosterCount: receipt.rosterCount,
    season: typeof receipt.season === "string" ? receipt.season : undefined,
    selectedRosterId:
      typeof receipt.selectedRosterId === "string"
        ? receipt.selectedRosterId
        : undefined,
    selectedTeamId:
      typeof receipt.selectedTeamId === "string" ? receipt.selectedTeamId : undefined,
    status: receipt.status,
    userId: typeof receipt.userId === "string" ? receipt.userId : undefined,
    week: typeof receipt.week === "number" ? receipt.week : undefined,
  };
}

function parseManualTeamBlocks(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const teams: Array<{ name: string; players: ManualPlayerLine[] }> = [];
  let activeTeam: { name: string; players: ManualPlayerLine[] } | null = null;

  lines.forEach((line) => {
    const heading = manualTeamHeading(line);

    if (heading) {
      activeTeam = { name: heading, players: [] };
      teams.push(activeTeam);
      return;
    }

    const playerLine = parseManualPlayerLine(line);

    if (!playerLine) {
      return;
    }

    if (!activeTeam) {
      activeTeam = { name: "My Team", players: [] };
      teams.push(activeTeam);
    }

    activeTeam.players.push(playerLine);
  });

  if (teams.length < 2 && teams[0]?.players.length) {
    const splitAt = Math.ceil(teams[0].players.length / 2);
    const firstPlayers = teams[0].players.slice(0, splitAt);
    const secondPlayers = teams[0].players.slice(splitAt);

    if (secondPlayers.length > 0) {
      return [
        { name: "My Team", players: firstPlayers },
        { name: "Opponent", players: secondPlayers },
      ];
    }
  }

  return teams.filter((team) => team.players.length > 0).slice(0, 8);
}

function manualTeamHeading(line: string) {
  const cleaned = line.replace(/[:#]+$/g, "").trim();
  const normalized = cleaned.toLowerCase();

  if (/^(my|our|home|team 1|me|us)\b/.test(normalized)) {
    return cleaned.includes(":") ? cleaned.split(":")[0] : "My Team";
  }

  if (/^(opponent|rival|away|team 2|vs|versus)\b/.test(normalized)) {
    return cleaned.includes(":") ? cleaned.split(":")[0] : "Opponent";
  }

  if (/roster$/i.test(cleaned) || /team$/i.test(cleaned)) {
    return cleaned;
  }

  return null;
}

function parseManualPlayerLine(line: string): ManualPlayerLine | null {
  const stripped = line
    .replace(/^[-*.\d\s]+/, "")
    .replace(/\b(Q|O|IR|PUP|D|SUSP|NA)\b/g, "")
    .trim();

  if (stripped.length < 3 || /^(bench|starters|lineup)$/i.test(stripped)) {
    return null;
  }

  const sourceProjection = projectionFromLine(stripped);
  const tokens = stripped
    .replace(/[(),|]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const position = tokens.find((token) => positionTokens.has(token.toUpperCase()));
  const team = tokens.find((token) => teamCodes.has(token.toUpperCase()));
  const name = cleanLine(
    stripped
      .replace(/\b(QB|RB|WR|TE|K|DST|DEF|D|FLEX|SUPERFLEX|BN|BENCH)\b/gi, " ")
      .replace(/\b(ARI|ATL|BAL|BUF|CAR|CHI|CIN|CLE|DAL|DEN|DET|GB|HOU|IND|JAX|KC|LAC|LAR|LV|MIA|MIN|NE|NO|NYG|NYJ|PHI|PIT|SEA|SF|TB|TEN|WAS)\b/g, " ")
      .replace(/\b(vs|at|@)\s+[A-Z]{2,3}\b/gi, " ")
      .replace(/\d+(\.\d+)?\s*(pts?|points?|proj|projected)?/gi, " ")
      .replace(/\s+/g, " "),
  );

  if (!name || name.length < 3 || /^\d+$/.test(name)) {
    return null;
  }

  return {
    name,
    position: normalizePosition(position),
    team: normalizeTeam(team),
    sourceProjection,
  };
}

function projectionFromLine(line: string) {
  const match = line.match(/(\d{1,2}(?:\.\d)?)\s*(?:pts?|points?|proj|projected)?\b/i);

  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);

  return value >= 4 && value <= 45 ? value : undefined;
}

function sleeperPlayerToFantasyPlayer({
  player,
  playerId,
  rank,
}: {
  player?: SleeperPlayer;
  playerId: string;
  rank: number;
}) {
  if (isDefenseId(playerId)) {
    return createGeneratedFantasyPlayer({
      line: {
        name: sleeperDefenseName(playerId),
        position: "DST",
        team: playerId,
      },
      playerId,
      rank,
      source: "sleeper",
    });
  }

  if (!player) {
    return null;
  }

  const name =
    cleanLine(player.full_name) ||
    cleanLine(`${player.first_name ?? ""} ${player.last_name ?? ""}`) ||
    cleanLine(player.search_full_name);

  if (!name) {
    return null;
  }

  return createGeneratedFantasyPlayer({
    line: {
      name,
      position: normalizePosition(player.position ?? player.fantasy_positions?.[0]),
      team: normalizeTeam(player.team),
    },
    rank: Number(player.search_rank) || rank,
    source: "sleeper",
    injuryStatus: cleanLine(player.injury_status) || cleanLine(player.status),
    age: Number(player.age) || undefined,
    playerId,
  });
}

function createGeneratedFantasyPlayer({
  age,
  injuryStatus,
  line,
  playerId,
  rank,
  source,
}: {
  age?: number;
  injuryStatus?: string;
  line: ManualPlayerLine;
  playerId?: string;
  rank: number;
  source: FantasyImportSource;
}): NflFantasyPlayer {
  const seed = hashNumber(`${line.name}-${line.position}-${line.team}`);
  const position = normalizePosition(line.position);
  const health = clampMeter(88 - injuryDrag(injuryStatus));
  const chaos = clampMeter(35 + (seed % 28) + (injuryStatus ? 8 : 0));
  const matchup = clampMeter(62 + ((seed >> 2) % 22));
  const touchdownPulse = clampMeter(42 + ((seed >> 3) % 34));
  const generated = projectionProfile(position, seed);
  const sourceProjection = line.sourceProjection ?? generated.sourceProjection;
  const ageValue = line.age ?? age;
  const roleSecurity =
    line.roleSecurity ?? clampMeter(88 - Math.max(0, rank - 18) * 0.2 - chaos * 0.12);
  const dynastyValue =
    line.dynastyValue ??
    clampMeter(
      74 +
        (ageValue ? Math.max(-18, 28 - ageValue) * 2.4 : 0) +
        (100 - Math.min(100, rank)) * 0.12 -
        chaos * 0.08,
    );

  const player = {
    id: playerId
      ? sleeperFantasyId(playerId, { ...line }) ?? `${source}-${slugify(line.name)}`
      : `${source}-${slugify(line.name)}`,
    name: line.name,
    team: normalizeTeam(line.team),
    position,
    opponent: "weekly matchup",
    color: nflTeamColors[normalizeTeam(line.team)] ?? nflTeamColors.FA,
    baseline: generated.baseline,
    targetShare: generated.targetShare,
    carryShare: generated.carryShare,
    touchdownPulse,
    matchup,
    health,
    chaos,
    nflRank: Math.max(1, Math.min(250, rank)),
    seerRank: Math.max(1, Math.min(250, rank - Math.round((matchup - chaos) / 18))),
    traits: generated.traits,
    read: generatedRead(line.name, position, source),
    age: ageValue,
    experience: line.experience ?? (ageValue ? Math.max(0, ageValue - 22) : undefined),
    sourceRank: line.sourceRank ?? rank,
    positionRank: line.positionRank,
    roleSecurity,
    dynastyValue,
    depthTier: line.depthTier ?? seededDepthTier(line.positionRank ?? rank),
    source,
    sourceProjection,
    seerAdjustments: seerAdjustmentLabels({ chaos, health, matchup, position }),
    rankingSource: line.rankingSource,
    sourceProviderLabel: line.sourceProviderLabel,
    sourceSeason: line.sourceSeason,
    sourceUpdatedAt: line.sourceUpdatedAt,
    sourceWeek: line.sourceWeek,
  };

  return applyFantasyProjectionRealism([player], [], { cap: 2.4 })[0];
}

function projectionProfile(position: string, seed: number) {
  if (position === "QB") {
    return {
      baseline: {
        passYards: 215 + (seed % 78),
        passTd: 1.25 + (seed % 9) / 10,
        interceptions: 0.45 + (seed % 5) / 10,
        rushYards: 8 + (seed % 38),
        rushTd: 0.08 + (seed % 6) / 20,
        receivingYards: 0,
        receivingTd: 0,
        receptions: 0,
      },
      targetShare: 0,
      carryShare: 12 + (seed % 16),
      sourceProjection: round1(15 + (seed % 72) / 10),
      traits: ["QB engine", "Weekly ceiling", "Script lever"],
    };
  }

  if (position === "RB") {
    return {
      baseline: {
        rushYards: 42 + (seed % 54),
        rushTd: 0.25 + (seed % 9) / 20,
        receivingYards: 12 + (seed % 36),
        receivingTd: 0.05 + (seed % 5) / 30,
        receptions: 2 + (seed % 36) / 10,
      },
      targetShare: 8 + (seed % 16),
      carryShare: 24 + (seed % 34),
      sourceProjection: round1(9 + (seed % 82) / 10),
      traits: ["Touch path", "Red-zone pulse", "Floor check"],
    };
  }

  if (position === "TE") {
    return {
      baseline: {
        rushYards: 0,
        rushTd: 0,
        receivingYards: 28 + (seed % 45),
        receivingTd: 0.18 + (seed % 8) / 25,
        receptions: 2.8 + (seed % 32) / 10,
      },
      targetShare: 12 + (seed % 15),
      carryShare: 0,
      sourceProjection: round1(7 + (seed % 68) / 10),
      traits: ["Middle-field role", "TD hinge", "Format sensitive"],
    };
  }

  if (position === "K") {
    return {
      baseline: {
        rushYards: 0,
        rushTd: 0,
        receivingYards: 0,
        receivingTd: 0,
        receptions: 0,
      },
      targetShare: 0,
      carryShare: 0,
      sourceProjection: round1(6 + (seed % 50) / 10),
      traits: ["Kick volume", "Dome boost", "Game script"],
    };
  }

  if (position === "DST") {
    return {
      baseline: {
        rushYards: 0,
        rushTd: 0,
        receivingYards: 0,
        receivingTd: 0,
        receptions: 0,
      },
      targetShare: 0,
      carryShare: 0,
      sourceProjection: round1(5 + (seed % 58) / 10),
      traits: ["Pressure rate", "Turnover lane", "Scoring swing"],
    };
  }

  return {
    baseline: {
      rushYards: 0,
      rushTd: 0,
      receivingYards: 43 + (seed % 52),
      receivingTd: 0.18 + (seed % 8) / 18,
      receptions: 3.6 + (seed % 42) / 10,
    },
    targetShare: 14 + (seed % 18),
    carryShare: seed % 4,
    sourceProjection: round1(8 + (seed % 84) / 10),
    traits: ["Target lane", "Air-yard spark", "PPR texture"],
  };
}

function generatedRead(name: string, position: string, source: FantasyImportSource) {
  const sourceLabel =
    source === "sleeper"
      ? "Sleeper roster import"
      : source === "screenshot"
        ? "screenshot receipt"
        : source === "feed"
          ? "external fantasy feed"
          : source === "seeded"
            ? "seeded fantasy spine"
            : "manual roster paste";

  return `${name} enters from the ${sourceLabel}. The Seer builds the first read from position role, team tag, health noise, and matchup shape.`;
}

function seerAdjustmentLabels({
  chaos,
  health,
  matchup,
  position,
}: {
  chaos: number;
  health: number;
  matchup: number;
  position: string;
}) {
  return [
    matchup >= 75 ? "matchup lift" : "matchup check",
    health < 78 ? "health drag" : "health steady",
    chaos > 55 ? "weekly volatility" : `${position} role stability`,
  ];
}

export function isNflFantasyPlayer(value: unknown): value is NflFantasyPlayer {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const player = value as Partial<NflFantasyPlayer>;
  const baseline = player.baseline as Partial<NflFantasyPlayer["baseline"]> | undefined;

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

function isImportedFantasyTeam(value: unknown): value is ImportedFantasyTeam {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const team = value as Partial<ImportedFantasyTeam>;

  return (
    typeof team.id === "string" &&
    typeof team.name === "string" &&
    typeof team.manager === "string" &&
    typeof team.identity === "string" &&
    isImportSource(team.source) &&
    Array.isArray(team.rosterIds) &&
    team.rosterIds.every((id) => typeof id === "string") &&
    (team.starterIds === undefined ||
      team.starterIds.every((id) => typeof id === "string")) &&
    (team.benchIds === undefined ||
      team.benchIds.every((id) => typeof id === "string"))
  );
}

function isImportSource(value: unknown): value is FantasyImportSource {
  return (
    value === "seeded" ||
    value === "sleeper" ||
    value === "manual" ||
    value === "screenshot" ||
    value === "feed"
  );
}

function isSleeperImportReceiptStatus(
  value: unknown,
): value is SleeperImportReceipt["status"] {
  return value === "matched" || value === "no-matchup" || value === "no-user-match";
}

function sleeperLeagueStatusRank(value: unknown) {
  const status = cleanLine(value);

  if (status === "in_season") {
    return 0;
  }

  if (status === "pre_draft") {
    return 1;
  }

  if (status === "drafting") {
    return 2;
  }

  if (status === "complete") {
    return 3;
  }

  return 4;
}

function numberFromLooseValue(value: unknown) {
  const numberValue =
    typeof value === "string" || typeof value === "number" ? Number(value) : NaN;

  return Number.isFinite(numberValue) && numberValue >= 0
    ? Math.round(numberValue)
    : undefined;
}

function normalizeSleeperIds(values: string[] | null | undefined) {
  return Array.isArray(values) ? values.map(String).filter((id) => id.length > 0) : [];
}

function sleeperFantasyId(playerId: string, player?: Partial<SleeperPlayer | ManualPlayerLine>) {
  if (isDefenseId(playerId)) {
    return `sleeper-${playerId}-${slugify(sleeperDefenseName(playerId))}`;
  }

  const name =
    cleanLine((player as Partial<SleeperPlayer>)?.full_name) ||
    cleanLine(
      `${(player as Partial<SleeperPlayer>)?.first_name ?? ""} ${(player as Partial<SleeperPlayer>)?.last_name ?? ""}`,
    ) ||
    cleanLine((player as Partial<ManualPlayerLine>)?.name) ||
    playerId;

  return `sleeper-${playerId}-${slugify(name)}`;
}

function isDefenseId(playerId: string) {
  return teamCodes.has(playerId.toUpperCase());
}

function sleeperDefenseName(playerId: string) {
  return `${playerId.toUpperCase()} D/ST`;
}

function projectionRowsFromPayload(payload: unknown): unknown[] {
  if (typeof payload === "string") {
    return projectionRowsFromPayload(fantasyProjectionPayloadFromText(payload));
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const record = payload as Record<string, unknown>;

  for (const key of [
    "projections",
    "fantasyProjections",
    "rankings",
    "fantasyRankings",
    "players",
    "fantasyPlayers",
    "sourceProjections",
    "rows",
    "data",
  ]) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return Object.values(record).filter(
    (value) => typeof value === "object" && value !== null,
  );
}

function fantasyProjectionPayloadFromText(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return parseCsvText(trimmed);
  }
}

function providerBridgeMetadata(payload: unknown) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    const firstRow = Array.isArray(payload) ? payload[0] : null;
    return providerBridgeMetadata(firstRow);
  }

  const record = payload as Record<string, unknown>;
  const directProvider =
    cleanLine(record.providerLabel) ||
    cleanLine(record.provider) ||
    cleanLine(record.source) ||
    cleanLine(record.label) ||
    cleanLine(record.name);

  return {
    providerLabel: directProvider || undefined,
    season: cleanLine(record.season) || undefined,
    updatedAt:
      cleanLine(record.updatedAt) ||
      cleanLine(record.updated_at) ||
      cleanLine(record.lastUpdated) ||
      undefined,
    week: cleanLine(record.week) || cleanLine(record.scoringPeriod) || undefined,
  };
}

function newestProjectionUpdatedAt(projections: FantasySourceProjection[]) {
  return projections
    .map((projection) => projection.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function parseCsvText(text: string) {
  const records = csvRecords(text);
  const [headers, ...rows] = records;

  if (!headers || headers.length === 0) {
    return [];
  }

  const keys = headers.map(csvHeaderKey);

  return rows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) =>
      keys.reduce<Record<string, string>>((record, key, index) => {
        record[key] = row[index]?.trim() ?? "";
        return record;
      }, {}),
    );
}

function csvRecords(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((cells) => cells.some((value) => value.trim().length > 0));
}

function csvHeaderKey(header: string) {
  const key = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mapped: Record<string, string> = {
    adp: "adp",
    age: "age",
    depthtier: "depthTier",
    dynasty: "dynastyValue",
    dynastyvalue: "dynastyValue",
    ecr: "ecr",
    experience: "experience",
    fantasypoints: "fantasyPoints",
    format: "scoring",
    fullname: "fullName",
    halfppr: "halfPpr",
    keepervalue: "dynastyValue",
    lastupdated: "lastUpdated",
    longtermvalue: "dynastyValue",
    name: "name",
    nflteam: "nflTeam",
    opponent: "opponent",
    overall: "overall",
    overallrank: "overallRank",
    player: "playerName",
    playerid: "playerId",
    playername: "playerName",
    points: "points",
    pos: "pos",
    positionalrank: "positionRank",
    position: "position",
    positionrank: "positionRank",
    posrank: "posRank",
    projected: "projected",
    projectedpoints: "projectedPoints",
    projection: "projection",
    provider: "provider",
    providerlabel: "providerLabel",
    rank: "rank",
    rankingsource: "rankingSource",
    rolescore: "roleScore",
    rolesecurity: "roleSecurity",
    roletier: "roleTier",
    scoring: "scoring",
    scoringformat: "scoringFormat",
    scoringperiod: "scoringPeriod",
    season: "season",
    source: "source",
    sourcerank: "sourceRank",
    standard: "standard",
    team: "team",
    teamcode: "teamCode",
    tier: "tier",
    updatedat: "updatedAt",
    week: "week",
    years: "years",
  };

  return mapped[key] ?? header.trim();
}

function normalizeSourceProjection(
  value: unknown,
  index: number,
): FantasySourceProjection | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const name =
    cleanLine(row.name) ||
    cleanLine(row.playerName) ||
    cleanLine(row.fullName) ||
    cleanLine(row.player);
  const team = normalizeTeam(row.team ?? row.teamCode ?? row.nflTeam);
  const position = normalizePosition(row.position ?? row.pos);
  const projection = firstNumber(
    row.projection,
    row.projected,
    row.projectedPoints,
    row.points,
    row.fantasyPoints,
    row.ppr,
    row.halfPpr,
    row.standard,
  );
  const sourceRank = firstRankNumber(
    row.sourceRank,
    row.rank,
    row.overallRank,
    row.ecr,
    row.adp,
    row.overall,
  );
  const positionRank = firstRankNumber(
    row.positionRank,
    row.posRank,
    row.positionalRank,
    row.position_rank,
    row.pos_rank,
  );
  const providerLabel =
    cleanLine(row.providerLabel) ||
    cleanLine(row.provider) ||
    cleanLine(row.source) ||
    "projection-feed";
  const source = cleanLine(row.source) || providerLabel;

  if (
    !name ||
    (typeof projection !== "number" &&
      typeof sourceRank !== "number" &&
      typeof positionRank !== "number")
  ) {
    return null;
  }

  return {
    id:
      cleanLine(row.id) ||
      cleanLine(row.playerId) ||
      `${slugify(name)}-${team}-${position}-${index + 1}`,
    name,
    team,
    position,
    projection: typeof projection === "number" ? round1(projection) : undefined,
    scoring: scoringFromProjectionRow(row),
    source,
    providerLabel,
    opponent:
      cleanLine(row.opponent) ||
      cleanLine(row.opp) ||
      cleanLine(row.matchup) ||
      undefined,
    sourceRank,
    positionRank,
    age: firstNumber(row.age),
    experience: firstNumber(row.experience, row.years, row.seasons),
    roleSecurity: firstMeterNumber(row.roleSecurity, row.role, row.roleScore),
    dynastyValue: firstMeterNumber(
      row.dynastyValue,
      row.dynasty,
      row.keeperValue,
      row.longTermValue,
    ),
    depthTier: depthTierFromValue(row.depthTier ?? row.tier ?? row.roleTier),
    season: cleanLine(row.season) || undefined,
    updatedAt:
      cleanLine(row.updatedAt) ||
      cleanLine(row.updated_at) ||
      cleanLine(row.lastUpdated) ||
      undefined,
    week: cleanLine(row.week) || cleanLine(row.scoringPeriod) || undefined,
    rankingSource: cleanLine(row.rankingSource) || source,
  };
}

function scoringFromProjectionRow(row: Record<string, unknown>) {
  const scoring = cleanLine(row.scoring ?? row.scoringFormat ?? row.format).toLowerCase();

  if (scoring.includes("half")) {
    return "halfPpr" as const;
  }

  if (scoring.includes("ppr") || "ppr" in row) {
    return "fullPpr" as const;
  }

  if (scoring.includes("standard") || "standard" in row) {
    return "standard" as const;
  }

  return "unknown" as const;
}

function buildProjectionIndex(sourceProjections: FantasySourceProjection[]) {
  const index = new Map<string, FantasySourceProjection>();

  sourceProjections.forEach((projection) => {
    projectionKeys(projection).forEach((key) => {
      if (!index.has(key)) {
        index.set(key, projection);
      }
    });
  });

  return index;
}

function projectionKeys(player: {
  name: string;
  position?: string;
  team?: string;
}) {
  const name = normalizeName(player.name);
  const team = normalizeTeam(player.team);
  const position = normalizePosition(player.position);

  return [
    `${name}|${team}|${position}`,
    `${name}|${team}`,
    `${name}|${position}`,
    name,
  ];
}

function matchSourceProjection(
  player: NflFantasyPlayer,
  projectionIndex: Map<string, FantasySourceProjection>,
) {
  for (const key of projectionKeys(player)) {
    const projection = projectionIndex.get(key);

    if (projection) {
      return projection;
    }
  }

  return null;
}

function findMatchingPlayer(
  players: NflFantasyPlayer[],
  target: NflFantasyPlayer,
) {
  const keys = projectionKeys(target);

  return players.find((player) =>
    projectionKeys(player).some((key) => keys.includes(key)),
  );
}

function projectionReceiptFields(player: NflFantasyPlayer) {
  return {
    age: player.age,
    experience: player.experience,
    sourceRank: player.sourceRank,
    positionRank: player.positionRank,
    roleSecurity: player.roleSecurity,
    dynastyValue: player.dynastyValue,
    depthTier: player.depthTier,
    sourceProjection: player.sourceProjection,
    sourceBlendProjection: player.sourceBlendProjection,
    sourceProjectionWeight: player.sourceProjectionWeight,
    sourceTrustLabel: player.sourceTrustLabel,
    seerProjection: player.seerProjection,
    seerDelta: player.seerDelta,
    seerAdjustmentCap: player.seerAdjustmentCap,
    seerAdjustments: player.seerAdjustments,
    seerAdjustmentDetails: player.seerAdjustmentDetails,
    crowdSignalDelta: player.crowdSignalDelta,
    crowdSignalLabel: player.crowdSignalLabel,
    projectionSource: player.projectionSource,
    rankingSource: player.rankingSource,
    sourceProviderLabel: player.sourceProviderLabel,
    sourceSeason: player.sourceSeason,
    sourceUpdatedAt: player.sourceUpdatedAt,
    sourceWeek: player.sourceWeek,
  };
}

function matchupContextForPlayer(
  player: NflFantasyPlayer,
  matchups: FantasyProjectionMatchupContext[],
) {
  return matchups.find((matchup) => matchup.team === normalizeTeam(player.team));
}

function fantasyProjectionSourceWeight(
  source: FantasySourceProjection | null,
  options: FantasyProjectionRealismOptions,
) {
  if (typeof options.sourceWeight === "number") {
    return round2(clampNumber(options.sourceWeight, 0.35, 0.96));
  }

  if (!source) {
    return 1;
  }

  let weight = typeof source.projection === "number" ? 0.84 : 0.62;

  if (
    typeof source.sourceRank === "number" ||
    typeof source.positionRank === "number"
  ) {
    weight += 0.05;
  }

  const freshness = fantasySourceFreshness(source.updatedAt);

  if (freshness === "stale") {
    weight -= 0.14;
  } else if (freshness === "unknown") {
    weight -= 0.04;
  }

  return round2(clampNumber(weight, 0.45, 0.94));
}

function fantasyWeightedSourceProjection({
  player,
  rawSourceProjection,
  source,
  sourceWeight,
}: {
  player: NflFantasyPlayer;
  rawSourceProjection: number;
  source: FantasySourceProjection | null;
  sourceWeight: number;
}) {
  if (
    !source ||
    typeof source.projection !== "number" ||
    typeof player.sourceProjection !== "number"
  ) {
    return round1(rawSourceProjection);
  }

  return round1(
    player.sourceProjection * (1 - sourceWeight) +
      rawSourceProjection * sourceWeight,
  );
}

function fantasySourceTrustLabel(sourceWeight: number) {
  if (sourceWeight >= 0.95) {
    return "Source fully trusted";
  }

  return `${Math.round(sourceWeight * 100)}% source blend`;
}

function projectionAdjustmentDetails(
  player: NflFantasyPlayer,
  context: FantasyProjectionMatchupContext | undefined,
): FantasyProjectionAdjustment[] {
  const position = normalizePosition(player.position);
  const weather = context?.weather?.toLowerCase() ?? "";
  const isPassCatcher = position === "WR" || position === "TE";
  const details: FantasyProjectionAdjustment[] = [];
  const windOrSnow =
    weather.includes("wind") ||
    weather.includes("snow") ||
    weather.includes("storm") ||
    weather.includes("rain");

  if (windOrSnow) {
    details.push({
      label: "weather",
      delta:
        position === "QB" || isPassCatcher
          ? -0.65
          : position === "RB"
            ? 0.25
            : -0.1,
    });
  } else if (context?.weather === "Dome") {
    details.push({
      label: "clean track",
      delta: isPassCatcher || position === "QB" ? 0.35 : 0.1,
    });
  }

  if (typeof context?.opponentDefense === "number") {
    details.push({
      label: "defense",
      delta: round1((76 - context.opponentDefense) / 18),
    });
  }

  if (typeof context?.pace === "number") {
    details.push({ label: "pace", delta: round1((context.pace - 66) / 24) });
  }

  if (
    typeof context?.teamWin === "number" &&
    typeof context.opponentWin === "number"
  ) {
    const script = context.teamWin - context.opponentWin;
    details.push({
      label: "script",
      delta:
        position === "RB"
          ? round1(script / 55)
          : position === "QB" || isPassCatcher
            ? round1(-script / 80)
            : 0,
    });
  }

  details.push({
    label: "role",
    delta:
      position === "K" || position === "DST"
        ? round1(((player.roleSecurity ?? 78) - 78) / 44)
        : round1(
            player.targetShare * (isPassCatcher ? 0.035 : 0.012) +
              player.carryShare * (position === "RB" ? 0.025 : 0.006) -
              0.55,
          ),
  });

  if (typeof player.roleSecurity === "number" && position !== "K" && position !== "DST") {
    details.push({
      label: "role security",
      delta: round1((player.roleSecurity - 78) / 48),
    });
  }

  details.push({ label: "health", delta: round1((player.health - 84) / 24) });
  details.push({ label: "chaos", delta: round1(-(player.chaos - 48) / 34) });

  if (typeof context?.teamHealth === "number") {
    details.push({
      label: "team health",
      delta: round1((context.teamHealth - 78) / 36),
    });
  }

  if (typeof context?.crowdNudge === "number") {
    const crowdDelta = clampNumber(context.crowdNudge, -0.3, 0.3);

    if (Math.abs(crowdDelta) >= 0.05) {
      details.push({
        label: "crowd lean",
        delta: crowdDelta,
      });
    }
  }

  return details
    .map((detail) => ({
      ...detail,
      delta: round1(clampNumber(detail.delta, -1.2, 1.2)),
    }))
    .filter((detail) => detail.delta !== 0);
}

function normalizePosition(value: unknown) {
  const position = typeof value === "string" ? value.toUpperCase() : "";

  if (position === "DEF" || position === "D" || position === "D/ST") {
    return "DST";
  }

  if (["QB", "RB", "WR", "TE", "K", "DST"].includes(position)) {
    return position;
  }

  return "WR";
}

function normalizeTeam(value: unknown) {
  const team = typeof value === "string" ? value.toUpperCase() : "";

  return teamCodes.has(team) ? team : "FA";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;

    if (Number.isFinite(numberValue) && numberValue >= 0 && numberValue <= 60) {
      return numberValue;
    }
  }

  return undefined;
}

function firstRankNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(/^#+/, ""))
          : NaN;

    if (Number.isFinite(numberValue) && numberValue >= 1 && numberValue <= 500) {
      return Math.round(numberValue);
    }
  }

  return undefined;
}

function firstMeterNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : NaN;

    if (Number.isFinite(numberValue)) {
      return clampMeter(numberValue);
    }
  }

  return undefined;
}

function bestRank(left: number | undefined, right: number | undefined) {
  if (typeof left !== "number") {
    return right;
  }

  if (typeof right !== "number") {
    return left;
  }

  return Math.min(left, right);
}

function depthTierFromValue(value: unknown): FantasyDepthTier | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("anchor") || normalized.includes("elite")) {
    return "anchor";
  }

  if (normalized.includes("starter") || normalized.includes("start")) {
    return "starter";
  }

  if (normalized.includes("rotation") || normalized.includes("bench")) {
    return "rotation";
  }

  if (normalized.includes("stream")) {
    return "streamer";
  }

  if (normalized.includes("stash") || normalized.includes("taxi")) {
    return "stash";
  }

  return undefined;
}

function injuryDrag(value: string | undefined) {
  if (!value) {
    return 0;
  }

  if (/out|ir|pup|suspend/i.test(value)) {
    return 34;
  }

  if (/doubt/i.test(value)) {
    return 24;
  }

  if (/quest|limited|prob/i.test(value)) {
    return 10;
  }

  return 4;
}

function cleanLine(value: unknown) {
  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugify(value: string) {
  return (
    normalizeName(value)
      .replace(/(.{32}).+/, "$1")
      .trim() || "player"
  );
}

function stringId(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function hashNumber(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function hashText(value: string) {
  return hashNumber(value).toString(36);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function formatSignedDecimal(value: number) {
  const rounded = round1(value);

  if (rounded > 0) {
    return `+${rounded.toFixed(1)}`;
  }

  return rounded.toFixed(1);
}
