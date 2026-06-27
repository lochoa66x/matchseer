import { describe, expect, it } from "vitest";
import {
  applyFantasyProviderBridge,
  applyFantasyProjectionRealism,
  buildSleeperFantasyLeague,
  createFantasyProviderBridgeImport,
  createManualFantasyLeague,
  createSeededFantasyPlayerPool,
  fantasyPlayersFromSourceProjections,
  mergeFantasyPlayerPools,
  mergeFantasySourceFeeds,
  normalizeFantasyProjectionFeed,
  sanitizeImportedFantasyLeague,
  type NflFantasyPlayer,
} from "./nfl-fantasy-import";

const knownPlayer: NflFantasyPlayer = {
  id: "known-josh-allen",
  name: "Josh Allen",
  team: "BUF",
  position: "QB",
  opponent: "vs BAL",
  color: "#2563eb",
  baseline: {
    passYards: 250,
    passTd: 2,
    interceptions: 0.6,
    rushYards: 42,
    rushTd: 0.4,
    receivingYards: 0,
    receivingTd: 0,
    receptions: 0,
  },
  targetShare: 0,
  carryShare: 18,
  touchdownPulse: 74,
  matchup: 70,
  health: 90,
  chaos: 55,
  nflRank: 4,
  seerRank: 4,
  traits: ["Rushing floor"],
  read: "Known player.",
};

describe("NFL fantasy imports", () => {
  it("parses pasted my-team and opponent rosters", () => {
    const league = createManualFantasyLeague({
      knownPlayers: [knownPlayer],
      text: `
        My Team:
        QB Josh Allen BUF 22.4
        WR Amon-Ra St. Brown DET

        Opponent:
        RB Jahmyr Gibbs DET
        QB Lamar Jackson BAL
      `,
    });
    const sanitized = sanitizeImportedFantasyLeague(league);

    expect(sanitized?.teams).toHaveLength(2);
    expect(sanitized?.teams[0].rosterIds).toContain("known-josh-allen");
    expect(sanitized?.players.some((player) => player.name === "Jahmyr Gibbs")).toBe(
      true,
    );
    expect(sanitized?.source).toBe("manual");
  });

  it("turns Sleeper rosters into fantasy teams with starters and bench", () => {
    const league = buildSleeperFantasyLeague({
      league: {
        league_id: "123456789",
        name: "Fun League",
        season: "2026",
      },
      matchups: [
        { roster_id: 1, matchup_id: 7 },
        { roster_id: 2, matchup_id: 7 },
      ],
      players: {
        "111": {
          full_name: "Amon-Ra St. Brown",
          position: "WR",
          team: "DET",
          search_rank: 9,
        },
        "222": {
          full_name: "Jahmyr Gibbs",
          position: "RB",
          team: "DET",
          search_rank: 15,
        },
        "333": {
          full_name: "Lamar Jackson",
          position: "QB",
          team: "BAL",
          search_rank: 5,
        },
      },
      rosters: [
        { roster_id: 1, owner_id: "u1", players: ["111", "222"], starters: ["111"] },
        { roster_id: 2, owner_id: "u2", players: ["333"], starters: ["333"] },
      ],
      users: [
        { user_id: "u1", display_name: "Luis", metadata: { team_name: "Seer House" } },
        { user_id: "u2", display_name: "Rival" },
      ],
      week: 1,
    });

    expect(league.label).toBe("Fun League");
    expect(league.teams).toHaveLength(2);
    expect(league.teams[0]).toMatchObject({
      name: "Seer House",
      source: "sleeper",
    });
    expect(league.teams[0].starterIds).toHaveLength(1);
    expect(league.teams[0].benchIds).toHaveLength(1);
    expect(league.players.map((player) => player.source)).toContain("sleeper");
  });

  it("normalizes projection feeds and matches players by name team position", () => {
    const projections = normalizeFantasyProjectionFeed({
      projections: [
        {
          playerName: "Josh Allen",
          team: "BUF",
          position: "QB",
          projectedPoints: 24.6,
          provider: "test-feed",
        },
      ],
    });
    const [player] = applyFantasyProjectionRealism([knownPlayer], projections, {
      matchups: [
        {
          team: "BUF",
          opponent: "vs BAL",
          weather: "Dome",
          pace: 72,
          teamWin: 54,
          opponentWin: 46,
          opponentDefense: 74,
          teamHealth: 88,
        },
      ],
    });

    expect(projections).toHaveLength(1);
    expect(player.sourceProjection).toBe(24.6);
    expect(player.projectionSource).toBe("test-feed");
    expect(player.seerProjection).toBeGreaterThan(24.6);
    expect(player.seerAdjustments?.some((tag) => tag.includes("clean track"))).toBe(
      true,
    );
  });

  it("parses manual CSV provider bridge uploads with metadata", () => {
    const bridge = createFantasyProviderBridgeImport({
      providerLabel: "Friday Sheet",
      season: "2026",
      text: `Player,Team,Pos,Projected Points,Rank,Position Rank,Provider,Week,Updated At
Josh Allen,BUF,QB,25.2,3,1,Fantasy Sheet,1,2026-09-04T12:00:00.000Z
Brock Bowers,LV,TE,15.1,22,1,Fantasy Sheet,1,2026-09-04T12:00:00.000Z`,
      updatedAt: "2026-09-04T13:00:00.000Z",
      week: "1",
    });

    expect(bridge.providerLabel).toBe("Friday Sheet");
    expect(bridge.projections).toHaveLength(2);
    expect(bridge.projections[0]).toMatchObject({
      name: "Josh Allen",
      position: "QB",
      projection: 25.2,
      sourceRank: 3,
      positionRank: 1,
      season: "2026",
      week: "1",
    });
  });

  it("applies provider bridge rows over seeded source projections and keeps the Seer capped", () => {
    const bridge = createFantasyProviderBridgeImport({
      providerLabel: "Projection Room",
      text: JSON.stringify({
        provider: "Projection Room",
        season: "2026",
        week: 1,
        updatedAt: "2026-09-04T12:00:00.000Z",
        projections: [
          {
            playerName: "Josh Allen",
            team: "BUF",
            position: "QB",
            projection: 30,
            sourceRank: 1,
            positionRank: 1,
          },
          {
            playerName: "New Deep Sleeper",
            team: "DAL",
            position: "WR",
            projection: 9.5,
            positionRank: 88,
          },
        ],
      }),
    });
    const players = applyFantasyProviderBridge([knownPlayer], bridge.projections, {
      cap: 1.2,
      matchups: [
        {
          team: "BUF",
          weather: "Dome",
          pace: 72,
          teamWin: 54,
          opponentWin: 46,
          opponentDefense: 74,
          teamHealth: 88,
        },
      ],
    });
    const known = players.find((player) => player.id === knownPlayer.id);

    expect(known?.sourceProjection).toBe(30);
    expect(known?.sourceProviderLabel).toBe("Projection Room");
    expect(known?.seerDelta).toBeLessThanOrEqual(1.2);
    expect(players.some((player) => player.name === "New Deep Sleeper")).toBe(true);
  });

  it("keeps kicker and defense projection rows in their own lanes", () => {
    const projections = normalizeFantasyProjectionFeed({
      projections: [
        {
          playerName: "Jake Elliott",
          team: "PHI",
          position: "K",
          projectedPoints: 8.4,
        },
        {
          playerName: "Eagles",
          team: "PHI",
          position: "DEF",
          projectedPoints: 7.8,
        },
      ],
    });

    expect(projections.map((projection) => projection.position)).toEqual([
      "K",
      "DST",
    ]);
  });

  it("builds a seeded fantasy spine with deep position coverage and receipts", () => {
    const players = createSeededFantasyPlayerPool();
    const counts = players.reduce<Record<string, number>>((positionCounts, player) => {
      positionCounts[player.position] = (positionCounts[player.position] ?? 0) + 1;
      return positionCounts;
    }, {});

    expect(players.length).toBeGreaterThanOrEqual(80);
    expect(counts.QB).toBeGreaterThanOrEqual(10);
    expect(counts.RB).toBeGreaterThanOrEqual(10);
    expect(counts.WR).toBeGreaterThanOrEqual(10);
    expect(counts.TE).toBeGreaterThanOrEqual(10);
    expect(counts.K).toBeGreaterThanOrEqual(10);
    expect(counts.DST).toBeGreaterThanOrEqual(10);
    expect(players.every((player) => typeof player.sourceProjection === "number")).toBe(true);
    expect(players.every((player) => typeof player.seerProjection === "number")).toBe(true);
    expect(players.every((player) => typeof player.positionRank === "number")).toBe(true);
  });

  it("accepts rankings-only feeds and turns them into usable players", () => {
    const rankings = normalizeFantasyProjectionFeed({
      rankings: [
        {
          playerName: "Brock Bowers",
          team: "LV",
          position: "TE",
          rank: 18,
          positionRank: 1,
          dynastyValue: 96,
          roleSecurity: 91,
          tier: "anchor",
          provider: "rank-feed",
        },
      ],
    });
    const [player] = fantasyPlayersFromSourceProjections(rankings);

    expect(rankings[0]).toMatchObject({
      name: "Brock Bowers",
      sourceRank: 18,
      positionRank: 1,
      projection: undefined,
    });
    expect(player.position).toBe("TE");
    expect(player.positionRank).toBe(1);
    expect(player.sourceRank).toBe(18);
    expect(player.depthTier).toBe("anchor");
    expect(player.sourceProjection).toBeGreaterThan(0);
    expect(player.seerProjection).toBeDefined();
  });

  it("merges projection and ranking feeds into one player signal", () => {
    const projections = normalizeFantasyProjectionFeed({
      projections: [
        {
          playerName: "Josh Allen",
          team: "BUF",
          position: "QB",
          projectedPoints: 24.6,
          provider: "projection-feed",
        },
      ],
    });
    const rankings = normalizeFantasyProjectionFeed({
      rankings: [
        {
          playerName: "Josh Allen",
          team: "BUF",
          position: "QB",
          overallRank: 4,
          positionRank: 2,
          provider: "ranking-feed",
        },
      ],
    });
    const [merged] = mergeFantasySourceFeeds(projections, rankings);

    expect(merged.projection).toBe(24.6);
    expect(merged.sourceRank).toBe(4);
    expect(merged.positionRank).toBe(2);
    expect(merged.source).toContain("projection-feed");
    expect(merged.source).toContain("ranking-feed");
  });

  it("caps Seer projection adjustments so source data still owns the baseline", () => {
    const [player] = applyFantasyProjectionRealism(
      [
        {
          ...knownPlayer,
          position: "RB",
          targetShare: 45,
          carryShare: 95,
          chaos: 5,
          health: 100,
          sourceProjection: 12,
        },
      ],
      [],
      {
        cap: 1.2,
        matchups: [
          {
            team: "BUF",
            weather: "Dome",
            pace: 92,
            teamWin: 70,
            opponentWin: 30,
            opponentDefense: 40,
            teamHealth: 100,
          },
        ],
      },
    );

    expect(player.seerDelta).toBe(1.2);
    expect(player.seerProjection).toBe(13.2);
  });

  it("keeps fallback players usable when no source projection matches", () => {
    const [player] = applyFantasyProjectionRealism([knownPlayer], [], {
      cap: 1.2,
    });

    expect(player.sourceProjection).toBeUndefined();
    expect(player.seerProjection).toBeUndefined();
    expect(player.seerAdjustments).toContain("No source projection yet");
  });

  it("carries projection receipts from source players into imported rosters", () => {
    const [sourcePlayer] = applyFantasyProjectionRealism(
      [knownPlayer],
      [
        {
          id: "ja",
          name: "Josh Allen",
          team: "BUF",
          position: "QB",
          projection: 23,
          source: "test-feed",
        },
      ],
    );
    const merged = mergeFantasyPlayerPools([sourcePlayer], [
      {
        ...knownPlayer,
        id: "sleeper-111-joshallen",
        source: "sleeper",
      },
    ]);
    const imported = merged.find((player) => player.id === "sleeper-111-joshallen");

    expect(imported?.sourceProjection).toBe(23);
    expect(imported?.seerProjection).toBeDefined();
  });
});
