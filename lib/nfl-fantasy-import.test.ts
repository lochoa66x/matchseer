import { describe, expect, it } from "vitest";
import {
  buildSleeperFantasyLeague,
  createManualFantasyLeague,
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
});
