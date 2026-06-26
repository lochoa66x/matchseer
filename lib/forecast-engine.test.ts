import { describe, expect, it } from "vitest";
import {
  availabilityForecastModifier,
  buildKnockoutResolutionLane,
  buildPublicSeerTrail,
  deriveForecastFromExpectedGoals,
  knockoutRoundForecastModifier,
  marketPulseMatchIdentifiers,
  playerDependencyImpact,
  shouldApplyMarketPulseUpdate,
  sourcePayloadWithRecoveredMarketPulse,
  type ForecastPlayerContext,
} from "./database";

function player(
  overrides: Partial<ForecastPlayerContext> = {},
): ForecastPlayerContext {
  return {
    teamSide: "home",
    teamCode: "ARG",
    teamName: "Argentina",
    name: "Lionel Messi",
    role: "Creator",
    spark: 96,
    importance: 99,
    availabilityStatus: "available",
    availabilityNote: null,
    yellowCards: 0,
    redCards: 0,
    isSuspended: false,
    age: 39,
    minutesRecent: 0,
    ...overrides,
  };
}

describe("market pulse write safety", () => {
  it("protects manual crowd signals from automatic sync", () => {
    expect(shouldApplyMarketPulseUpdate("manual", "polymarket")).toBe(false);
    expect(shouldApplyMarketPulseUpdate("polymarket", "polymarket")).toBe(true);
    expect(shouldApplyMarketPulseUpdate(null, "polymarket")).toBe(true);
  });

  it("allows a manual update to replace any existing signal", () => {
    expect(shouldApplyMarketPulseUpdate("manual", "manual")).toBe(true);
    expect(shouldApplyMarketPulseUpdate("polymarket", "manual")).toBe(true);
  });

  it("normalizes football-data match ids for provider and external matching", () => {
    expect(marketPulseMatchIdentifiers("12345")).toEqual({
      matchId: "12345",
      externalMatchId: "fd-12345",
      providerMatchId: "12345",
    });
    expect(marketPulseMatchIdentifiers("fd-12345")).toEqual({
      matchId: "fd-12345",
      externalMatchId: "fd-12345",
      providerMatchId: "12345",
    });
  });

  it("recovers a saved crowd signal when the latest forecast payload lacks it", () => {
    expect(
      sourcePayloadWithRecoveredMarketPulse(
        { forecastFingerprint: "latest-without-pulse" },
        {
          source: "manual",
          home: 58,
          draw: 24,
          away: 18,
          capturedAt: "2026-06-18T15:00:00.000Z",
        },
      ),
    ).toMatchObject({
      forecastFingerprint: "latest-without-pulse",
      marketPulse: {
        source: "manual",
        home: 58,
      },
    });
  });

  it("keeps the current payload crowd signal when it already has one", () => {
    expect(
      sourcePayloadWithRecoveredMarketPulse(
        {
          marketPulse: {
            source: "manual",
            home: 52,
            draw: 26,
            away: 22,
          },
        },
        {
          source: "polymarket",
          home: 10,
          draw: 20,
          away: 70,
        },
      ),
    ).toMatchObject({
      marketPulse: {
        source: "manual",
        home: 52,
      },
    });
  });
});

describe("xG-derived forecast spine", () => {
  it("derives outcome probabilities and projected score from the same xG grid", () => {
    const forecast = deriveForecastFromExpectedGoals({
      homeXg: 2.15,
      awayXg: 0.72,
    });
    const [homeGoals, awayGoals] = forecast.projectedScore
      .split("-")
      .map(Number);

    expect(forecast.homeWin + forecast.draw + forecast.awayWin).toBe(100);
    expect(forecast.homeWin).toBeGreaterThan(forecast.awayWin);
    expect(forecast.projectedSide).toBe("home");
    expect(homeGoals).toBeGreaterThan(awayGoals);
    expect(forecast.homeCleanSheet).toBeGreaterThan(forecast.awayCleanSheet);
  });

  it("derives over and under style signals from total xG", () => {
    const openGame = deriveForecastFromExpectedGoals({
      homeXg: 2.05,
      awayXg: 1.45,
    });
    const tightGame = deriveForecastFromExpectedGoals({
      homeXg: 0.82,
      awayXg: 0.74,
    });

    expect(openGame.over25).toBeGreaterThan(openGame.under25);
    expect(openGame.signals.some((signal) => signal.id === "over-lean")).toBe(true);
    expect(tightGame.under25).toBeGreaterThan(tightGame.over25);
    expect(tightGame.signals.some((signal) => signal.id === "under-lean")).toBe(true);
  });
});

describe("knockout-round forecast logic", () => {
  const homeTeam = {
    id: 1,
    slug: "mexico",
    name: "Mexico",
    code: "MEX",
    color: "#0b8f5a",
    country: "Mexico",
  };
  const awayTeam = {
    id: 2,
    slug: "netherlands",
    name: "Netherlands",
    code: "NED",
    color: "#f58220",
    country: "Netherlands",
  };

  it("keeps group matches on normal draw logic", () => {
    expect(knockoutRoundForecastModifier("Group A")).toMatchObject({
      isKnockout: false,
      gapMultiplier: 1,
      drawDelta: 0,
      drawFloor: 15,
      drawCeiling: 34,
    });
  });

  it("makes knockout matches tighter and more cautious", () => {
    expect(knockoutRoundForecastModifier("Round of 16")).toMatchObject({
      isKnockout: true,
      gapMultiplier: 0.86,
      drawDelta: 4,
      drawFloor: 22,
      drawCeiling: 40,
      xgDelta: -0.12,
      chaosDelta: 2,
      confidenceDelta: -2,
    });
  });

  it("turns a 90-minute deadlock into extra-time and penalties lanes", () => {
    const lane = buildKnockoutResolutionLane({
      phase: "Quarter-finals",
      homeTeam,
      awayTeam,
      homeProbability: 42,
      drawProbability: 30,
      awayProbability: 28,
      powerGap: 6,
      chaos: 64,
    });

    expect(lane.regulationDraw).toBe(30);
    expect(lane.extraTime).toBe(30);
    expect(lane.penalties).toBeGreaterThan(0);
    expect(lane.penalties).toBeLessThan(lane.extraTime);
    expect(lane.homeAdvance + lane.awayAdvance).toBe(100);
    expect(lane.projectedAdvancer).toBe("home");
    expect(lane.summary.en).toContain("cannot end level");
  });
});

describe("key-player dependency modifier", () => {
  it("makes a star-dependent team warning louder than a collective team warning", () => {
    const argentina = player({
      teamCode: "ARG",
      name: "Lionel Messi",
      availabilityStatus: "limited",
    });
    const southAfrica = player({
      teamCode: "RSA",
      teamName: "South Africa",
      name: "Teboho Mokoena",
      spark: 78,
      importance: 72,
      availabilityStatus: "limited",
    });

    expect(playerDependencyImpact(argentina).multiplier).toBeGreaterThan(
      playerDependencyImpact(southAfrica).multiplier,
    );
  });

  it("stores dependency metadata when availability changes the read", () => {
    const modifier = availabilityForecastModifier([
      player({ availabilityStatus: "suspended", isSuspended: true }),
    ]);

    expect(modifier.homePenalty).toBeGreaterThan(0);
    expect(modifier.payload.impactedPlayers[0]).toMatchObject({
      name: "Lionel Messi",
      dependencyNote: expect.stringContaining("Messi"),
    });
  });
});

describe("public Seer trail", () => {
  it("turns dependency metadata into Seerified star-gravity copy", () => {
    const trail = buildPublicSeerTrail({
      homeName: "Argentina",
      awayName: "South Africa",
      marketPulse: null,
      sourcePayload: {
        modifiers: {
          availability: {
            impactedPlayers: [
              {
                name: "Lionel Messi",
                reason: "is limited",
                dependencyMultiplier: 1.09,
              },
            ],
          },
        },
      },
    });

    expect(trail.some((signal) => signal.id === "player-watch")).toBe(true);
    expect(trail.some((signal) => signal.id === "star-gravity")).toBe(true);
    expect(
      trail.find((signal) => signal.id === "star-gravity")?.text.en,
    ).toContain("team orbit");
  });
});
