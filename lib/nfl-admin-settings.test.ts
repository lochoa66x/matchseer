import { describe, expect, it } from "vitest";
import {
  resolveNflRuntimeSettings,
  sanitizeNflAdminSettings,
} from "./nfl-admin-settings";

describe("NFL admin settings", () => {
  it("lets saved runtime settings override env values", () => {
    const settings = resolveNflRuntimeSettings(
      sanitizeNflAdminSettings({
        fantasyProjectionsUrl: "https://saved.example/projections.json",
        polymarketEnabled: "disabled",
        polymarketMaxGames: "12",
        polymarketMaxShift: "9",
        polymarketMaxWeight: "0.5",
        sleeperLeagueId: "123456",
        sleeperWeek: "3",
      }),
      {
        NFL_FANTASY_PROJECTIONS_URL: "https://env.example/projections.json",
        NFL_POLYMARKET_ENABLED: "1",
        NFL_SLEEPER_LEAGUE_ID: "env-league",
      },
    );

    expect(settings.fantasyProjectionsUrl).toBe(
      "https://saved.example/projections.json",
    );
    expect(settings.sleeperLeagueId).toBe("123456");
    expect(settings.sleeperWeek).toBe(3);
    expect(settings.polymarketEnabled).toBe(false);
    expect(settings.polymarketMaxGames).toBe(10);
    expect(settings.polymarketMaxShift).toBe(8);
    expect(settings.polymarketMaxWeight).toBe(0.3);
    expect(settings.sources.fantasyProjectionsUrl).toBe("saved");
  });

  it("uses env values before defaults when settings are empty", () => {
    const settings = resolveNflRuntimeSettings(
      sanitizeNflAdminSettings({}),
      {
        NFL_FANTASY_RANKINGS_URL: "https://env.example/rankings.json",
        NFL_POLYMARKET_ENABLED: "0",
        NFL_POLYMARKET_MAX_GAMES: "4",
        NFL_SLEEPER_WEEK: "7",
      },
    );

    expect(settings.fantasyRankingsUrl).toBe("https://env.example/rankings.json");
    expect(settings.polymarketEnabled).toBe(false);
    expect(settings.polymarketMaxGames).toBe(4);
    expect(settings.polymarketMaxShift).toBe(4);
    expect(settings.sleeperWeek).toBe(7);
    expect(settings.sources.fantasyRankingsUrl).toBe("env");
    expect(settings.sources.polymarketMaxShift).toBe("default");
  });
});
