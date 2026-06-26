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
  source?: FantasyImportSource;
  sourceProjection?: number;
  seerProjection?: number;
  seerDelta?: number;
  seerAdjustmentCap?: number;
  seerAdjustments?: string[];
  seerAdjustmentDetails?: FantasyProjectionAdjustment[];
  projectionSource?: string;
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
};

export type FantasySourceProjection = {
  id: string;
  name: string;
  team: string;
  position: string;
  projection: number;
  scoring?: "standard" | "halfPpr" | "fullPpr" | "unknown";
  source: string;
  opponent?: string;
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
};

export type FantasyProjectionRealismOptions = {
  cap?: number;
  matchups?: FantasyProjectionMatchupContext[];
};

type ManualPlayerLine = {
  name: string;
  position: string;
  team: string;
  sourceProjection?: number;
};

export type SleeperLeague = {
  league_id?: string | number | null;
  name?: string | null;
  season?: string | number | null;
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
  rosters,
  users,
  week,
}: {
  league: SleeperLeague;
  matchups?: SleeperMatchup[];
  players: Record<string, SleeperPlayer>;
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
  const importedPlayers = new Map<string, NflFantasyPlayer>();
  const sortedRosters = [...rosters].sort((left, right) => {
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

  return {
    id: `sleeper-${stringId(league.league_id) || "league"}`,
    label: cleanLine(league.name) || "Sleeper league import",
    source: "sleeper",
    season: stringId(league.season) || undefined,
    week,
    teams,
    players: [...importedPlayers.values()],
    notes: [
      "Sleeper import loaded rosters, starters, benches, and player names.",
      "Sleeper projections are not included in the public roster endpoint, so the Seer creates the forecast layer from role, position, matchup, and health signals.",
    ],
  };
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
  const rows = projectionRowsFromPayload(payload);

  return rows
    .map((row, index) => normalizeSourceProjection(row, index))
    .filter((projection): projection is FantasySourceProjection => projection !== null);
}

export function fantasyPlayersFromSourceProjections(
  projections: FantasySourceProjection[],
) {
  return projections.map((projection, index) =>
    createGeneratedFantasyPlayer({
      line: {
        name: projection.name,
        position: projection.position,
        team: projection.team,
        sourceProjection: projection.projection,
      },
      rank: index + 18,
      source: "feed",
    }),
  );
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
    const sourceProjection = player.sourceProjection ?? source?.projection;

    if (typeof sourceProjection !== "number") {
      return {
        ...player,
        seerAdjustments:
          player.seerAdjustments && player.seerAdjustments.length > 0
            ? player.seerAdjustments
            : ["No source projection yet", "Seer model fallback"],
      };
    }

    const context = matchupContextForPlayer(player, options.matchups ?? []);
    const adjustmentDetails = projectionAdjustmentDetails(player, context);
    const rawDelta = sum(adjustmentDetails.map((detail) => detail.delta));
    const seerDelta = round1(clampNumber(rawDelta, -cap, cap));
    const seerProjection = round1(Math.max(0, sourceProjection + seerDelta));
    const adjustmentLabels = adjustmentDetails
      .filter((detail) => Math.abs(detail.delta) >= 0.15)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .slice(0, 4)
      .map((detail) => `${detail.label} ${formatSignedDecimal(detail.delta)}`);

    return {
      ...player,
      opponent: source?.opponent ?? context?.opponent ?? player.opponent,
      sourceProjection: round1(sourceProjection),
      seerProjection,
      seerDelta,
      seerAdjustmentCap: cap,
      seerAdjustmentDetails: adjustmentDetails,
      seerAdjustments:
        adjustmentLabels.length > 0 ? adjustmentLabels : ["Source and Seer agree"],
      projectionSource: source?.source ?? player.projectionSource ?? "imported projection",
    };
  });
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
  if (!player) {
    return null;
  }

  const name =
    cleanLine(player.full_name) ||
    cleanLine(`${player.first_name ?? ""} ${player.last_name ?? ""}`) ||
    cleanLine(player.search_full_name);

  if (!name || isDefenseId(playerId)) {
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
    source,
    sourceProjection,
    seerAdjustments: seerAdjustmentLabels({ chaos, health, matchup, position }),
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
    value === "screenshot"
  );
}

function normalizeSleeperIds(values: string[] | null | undefined) {
  return Array.isArray(values) ? values.map(String).filter((id) => id.length > 0) : [];
}

function sleeperFantasyId(playerId: string, player?: Partial<SleeperPlayer | ManualPlayerLine>) {
  if (isDefenseId(playerId)) {
    return null;
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

function projectionRowsFromPayload(payload: unknown): unknown[] {
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
    "players",
    "fantasyPlayers",
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

  if (!name || typeof projection !== "number") {
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
    projection: round1(projection),
    scoring: scoringFromProjectionRow(row),
    source: cleanLine(row.source) || cleanLine(row.provider) || "projection-feed",
    opponent:
      cleanLine(row.opponent) ||
      cleanLine(row.opp) ||
      cleanLine(row.matchup) ||
      undefined,
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
    sourceProjection: player.sourceProjection,
    seerProjection: player.seerProjection,
    seerDelta: player.seerDelta,
    seerAdjustmentCap: player.seerAdjustmentCap,
    seerAdjustments: player.seerAdjustments,
    seerAdjustmentDetails: player.seerAdjustmentDetails,
    projectionSource: player.projectionSource,
  };
}

function matchupContextForPlayer(
  player: NflFantasyPlayer,
  matchups: FantasyProjectionMatchupContext[],
) {
  return matchups.find((matchup) => matchup.team === normalizeTeam(player.team));
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
    delta: round1(
      player.targetShare * (isPassCatcher ? 0.035 : 0.012) +
        player.carryShare * (position === "RB" ? 0.025 : 0.006) -
        0.55,
    ),
  });
  details.push({ label: "health", delta: round1((player.health - 84) / 24) });
  details.push({ label: "chaos", delta: round1(-(player.chaos - 48) / 34) });

  if (typeof context?.teamHealth === "number") {
    details.push({
      label: "team health",
      delta: round1((context.teamHealth - 78) / 36),
    });
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

  if (position === "DEF" || position === "D") {
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
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
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

function formatSignedDecimal(value: number) {
  const rounded = round1(value);

  if (rounded > 0) {
    return `+${rounded.toFixed(1)}`;
  }

  return rounded.toFixed(1);
}
