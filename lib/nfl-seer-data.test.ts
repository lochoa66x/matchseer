import { describe, expect, it } from "vitest";
import { toNflSeerDataset } from "./nfl-seer-data";

describe("toNflSeerDataset", () => {
  it("normalizes ESPN scoreboard games into MatchSeer NFL matchups", () => {
    const dataset = toNflSeerDataset(
      {
        season: { year: 2026 },
        week: { number: 1 },
        events: [
          {
            id: "401872656",
            date: "2026-09-10T00:20Z",
            week: { number: 1 },
            competitions: [
              {
                date: "2026-09-10T00:20Z",
                venue: {
                  fullName: "Lumen Field",
                  indoor: false,
                },
                competitors: [
                  {
                    homeAway: "home",
                    team: {
                      abbreviation: "SEA",
                      color: "002a5c",
                      location: "Seattle",
                      name: "Seahawks",
                      shortDisplayName: "Seahawks",
                    },
                  },
                  {
                    homeAway: "away",
                    team: {
                      abbreviation: "NE",
                      color: "002244",
                      location: "New England",
                      name: "Patriots",
                      shortDisplayName: "Patriots",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        fetchedAt: "2026-06-26T20:00:00.000Z",
        source: "espn-scoreboard",
      },
    );

    expect(dataset.source).toBe("espn-scoreboard");
    expect(dataset.season).toBe("2026");
    expect(dataset.weekLabel).toBe("Week 1");
    expect(dataset.providerStatus.schedule).toBe("live");
    expect(dataset.matchups).toHaveLength(1);
    expect(dataset.matchups[0]).toMatchObject({
      id: "espn-401872656",
      week: "Week 1",
      venue: "Lumen Field",
      weather: "Weather watch",
      home: expect.objectContaining({ code: "SEA", name: "Seahawks" }),
      away: expect.objectContaining({ code: "NE", name: "Patriots" }),
    });
    expect(dataset.matchups[0].homeWin + dataset.matchups[0].awayWin).toBe(100);
  });

  it("passes through canonical datasets from a configured feed", () => {
    const dataset = toNflSeerDataset(
      {
        source: "configured-feed",
        season: "2026",
        weekLabel: "Week 3",
        updatedAt: "2026-09-22T12:00:00.000Z",
        matchups: [],
        fantasyPlayers: [{ id: "wr-1" }],
        providerStatus: {
          schedule: "fallback",
          fantasy: "live",
          market: "fallback",
          notes: ["custom feed"],
          fantasyProviders: [
            {
              count: 2,
              freshness: "fresh",
              id: "rankings",
              kind: "rankings",
              label: "Rankings / ECR / ADP",
              message: "Normalized 2 ranking rows.",
              positions: { DST: 0, K: 0, QB: 1, RB: 0, TE: 0, WR: 1 },
              source: "https://example.com/ranks.json",
              status: "live",
              updatedAt: "2026-09-22T11:45:00.000Z",
            },
          ],
          fantasyCoverage: {
            missingPositions: ["RB", "TE", "K", "DST"],
            positions: {
              DST: { players: 0, projections: 0, rankings: 0, total: 0 },
              K: { players: 0, projections: 0, rankings: 0, total: 0 },
              QB: { players: 1, projections: 0, rankings: 1, total: 2 },
              RB: { players: 0, projections: 0, rankings: 0, total: 0 },
              TE: { players: 0, projections: 0, rankings: 0, total: 0 },
              WR: { players: 1, projections: 0, rankings: 1, total: 2 },
            },
            totalPlayers: 2,
            totalProjections: 0,
            totalRankings: 2,
          },
        },
      },
      {
        fetchedAt: "2026-06-26T20:00:00.000Z",
      },
    );

    expect(dataset.source).toBe("configured-feed");
    expect(dataset.weekLabel).toBe("Week 3");
    expect(dataset.fantasyPlayers).toEqual([{ id: "wr-1" }]);
    expect(dataset.providerStatus.notes).toEqual(["custom feed"]);
    expect(dataset.providerStatus.fantasyProviders?.[0]).toMatchObject({
      id: "rankings",
      status: "live",
    });
    expect(dataset.providerStatus.fantasyCoverage?.positions.WR.total).toBe(2);
  });
});
