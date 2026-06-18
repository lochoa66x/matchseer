import { describe, expect, it } from "vitest";
import {
  availabilityForecastModifier,
  buildPublicSeerTrail,
  marketPulseMatchIdentifiers,
  playerDependencyImpact,
  shouldApplyMarketPulseUpdate,
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
