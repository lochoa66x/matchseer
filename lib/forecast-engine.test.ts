import { describe, expect, it } from "vitest";
import {
  applyCalibrationTuningToExpectedGoals,
  applyLiveMatchProbabilityNudge,
  applyMarketPulseProbabilityNudge,
  availabilityForecastModifier,
  buildKnockoutResolutionLane,
  buildPublicSeerTrail,
  deriveForecastFromExpectedGoals,
  knockoutRoundForecastModifier,
  marketPulseMatchIdentifiers,
  opponentAdjustedExpectedGoals,
  playerDependencyImpact,
  shouldApplyMarketPulseUpdate,
  sourcePayloadWithRecoveredMarketPulse,
  tacticalMatchupModifier,
  travelBodyCostModifier,
  type ForecastPlayerContext,
} from "./database";
import { computeCalibration, type CalibrationSample } from "./calibration";

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
    lineupStatus: "unknown",
    lineupConfirmedAt: null,
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

describe("market pulse probability nudge", () => {
  it("blends crowd signal into probabilities without becoming the market", () => {
    const nudge = applyMarketPulseProbabilityNudge({
      probabilities: { home: 58, draw: 24, away: 18 },
      marketPulse: {
        home: 30,
        draw: 20,
        away: 50,
        liquidityScore: 1,
      },
      maxShift: 5,
      maxWeight: 0.6,
    });

    expect(nudge.applied).toBe(true);
    expect(nudge.probabilities.home + nudge.probabilities.draw + nudge.probabilities.away).toBe(100);
    expect(nudge.probabilities.away).toBeGreaterThan(18);
    expect(nudge.probabilities.away).toBeLessThan(50);
    expect(Math.abs(nudge.deltas.home)).toBeLessThanOrEqual(5);
    expect(Math.abs(nudge.deltas.draw)).toBeLessThanOrEqual(5);
    expect(Math.abs(nudge.deltas.away)).toBeLessThanOrEqual(5);
    expect(nudge.summary.en).toContain("crowd breeze");
    expect(nudge.summary.en).toContain("Seer");
    expect(nudge.summary.en).not.toContain("probability lanes");
  });

  it("keeps thin crowd signal out of the live read", () => {
    const nudge = applyMarketPulseProbabilityNudge({
      probabilities: { home: 52, draw: 27, away: 21 },
      marketPulse: {
        home: 15,
        draw: 20,
        away: 65,
        liquidityScore: 0.08,
      },
    });

    expect(nudge.applied).toBe(false);
    expect(nudge.probabilities).toEqual({ home: 52, draw: 27, away: 21 });
    expect(nudge.summary.en).toContain("crowd murmur");
    expect(nudge.summary.en).not.toContain("actual probabilities");
  });
});

describe("live match probability model", () => {
  it("moves a late live lead toward the leading team", () => {
    const live = applyLiveMatchProbabilityNudge({
      probabilities: { home: 45, draw: 25, away: 30 },
      status: "live",
      homeScore: 1,
      awayScore: 0,
      minute: 75,
      confidence: 62,
      chaos: 54,
    });

    expect(live.applied).toBe(true);
    expect(live.probabilities.home).toBeGreaterThan(45);
    expect(live.probabilities.draw).toBeLessThan(25);
    expect(live.probabilities.home + live.probabilities.draw + live.probabilities.away).toBe(100);
  });

  it("prices a late level match as more draw-heavy", () => {
    const live = applyLiveMatchProbabilityNudge({
      probabilities: { home: 42, draw: 26, away: 32 },
      status: "live",
      homeScore: 0,
      awayScore: 0,
      minute: 82,
      confidence: 55,
      chaos: 60,
    });

    expect(live.probabilities.draw).toBeGreaterThan(26);
    expect(live.confidenceDelta).toBeLessThan(0);
  });

  it("uses live red cards to tilt the remaining match state", () => {
    const noCard = applyLiveMatchProbabilityNudge({
      probabilities: { home: 44, draw: 28, away: 28 },
      status: "live",
      homeScore: 0,
      awayScore: 0,
      minute: 35,
      confidence: 58,
      chaos: 62,
    });
    const awayRed = applyLiveMatchProbabilityNudge({
      probabilities: { home: 44, draw: 28, away: 28 },
      status: "live",
      homeScore: 0,
      awayScore: 0,
      minute: 35,
      awayRedCards: 1,
      confidence: 58,
      chaos: 62,
    });

    expect(awayRed.probabilities.home).toBeGreaterThan(noCard.probabilities.home);
    expect(awayRed.chaosDelta).toBeGreaterThan(noCard.chaosDelta);
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

  it("rewards xG created against strong defenses and discounts easy defensive matchups", () => {
    const attackingSide = { attack: 82, control: 78, defense: 70, setPieces: 72 };
    const strongDefense = { attack: 70, control: 82, defense: 90, setPieces: 74 };
    const weakDefense = { attack: 70, control: 58, defense: 52, setPieces: 60 };

    const againstStrongDefense = opponentAdjustedExpectedGoals({
      homeXg: 1.3,
      awayXg: 1,
      homeRatings: attackingSide,
      awayRatings: strongDefense,
    });
    const againstWeakDefense = opponentAdjustedExpectedGoals({
      homeXg: 1.3,
      awayXg: 1,
      homeRatings: attackingSide,
      awayRatings: weakDefense,
    });

    expect(againstStrongDefense.homeXg).toBeGreaterThan(1.3);
    expect(againstWeakDefense.homeXg).toBeLessThan(1.3);
    expect(againstStrongDefense.homeXg).toBeGreaterThan(againstWeakDefense.homeXg);
  });

  it("rewards low xG allowed against dangerous attacks", () => {
    const suppressingDefense = { attack: 70, control: 76, defense: 86, setPieces: 70 };
    const dangerousAttack = { attack: 90, control: 86, defense: 68, setPieces: 74 };
    const limitedAttack = { attack: 52, control: 55, defense: 68, setPieces: 58 };

    const suppressedDanger = opponentAdjustedExpectedGoals({
      homeXg: 1,
      awayXg: 0.65,
      homeRatings: suppressingDefense,
      awayRatings: dangerousAttack,
    });
    const suppressedLimited = opponentAdjustedExpectedGoals({
      homeXg: 1,
      awayXg: 0.65,
      homeRatings: suppressingDefense,
      awayRatings: limitedAttack,
    });

    expect(suppressedDanger.awayXg).toBeLessThan(suppressedLimited.awayXg);
    expect(suppressedDanger.away.defensiveSuppression).toBeLessThan(0);
    expect(suppressedLimited.away.defensiveSuppression).toBeGreaterThan(0);
  });

  it("lets tournament form lightly shade opponent-adjusted xG", () => {
    const homeRatings = { attack: 76, control: 74, defense: 72, setPieces: 70 };
    const awayRatings = { attack: 74, control: 73, defense: 72, setPieces: 70 };
    const neutral = opponentAdjustedExpectedGoals({
      homeXg: 1.25,
      awayXg: 1.1,
      homeRatings,
      awayRatings,
    });
    const formLift = opponentAdjustedExpectedGoals({
      homeXg: 1.25,
      awayXg: 1.1,
      homeRatings,
      awayRatings,
      tournamentForm: {
        formGap: 0.9,
        home: { signal: 0.72 },
        away: { signal: -0.18 },
      },
    });

    expect(formLift.homeXg).toBeGreaterThan(neutral.homeXg);
    expect(formLift.awayXg).toBeLessThan(neutral.awayXg);
  });
});

describe("receipt-tuned forecast knobs", () => {
  const receiptSamples: CalibrationSample[] = [
    { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "home", confidence: 80, chaos: 44 },
    { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away", confidence: 80, chaos: 46 },
    { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away", confidence: 80, chaos: 48 },
    { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "draw", confidence: 80, chaos: 72 },
    { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "draw", confidence: 80, chaos: 74 },
    { probabilities: { home: 0.6, draw: 0.2, away: 0.2 }, actual: "away", confidence: 80, chaos: 76 },
  ];

  it("keeps early receipt recommendations out of forecast xG", () => {
    const tuning = computeCalibration(receiptSamples).tuning.application;
    const tuned = applyCalibrationTuningToExpectedGoals({
      homeXg: 1.9,
      awayXg: 0.8,
      calibrationTuning: tuning,
    });

    expect(tuning.applied).toBe(false);
    expect(tuned.applied).toBe(false);
    expect(tuned.homeXg).toBe(1.9);
    expect(tuned.awayXg).toBe(0.8);
  });

  it("applies actionable receipt tuning gently to the xG spine", () => {
    const tuning = computeCalibration([
      ...receiptSamples,
      ...receiptSamples,
    ]).tuning.application;
    const tuned = applyCalibrationTuningToExpectedGoals({
      homeXg: 1.9,
      awayXg: 0.8,
      calibrationTuning: tuning,
    });

    expect(tuning.applied).toBe(true);
    expect(tuned.applied).toBe(true);
    expect(tuned.homeXg - tuned.awayXg).toBeLessThan(1.1);
    expect(Math.abs(tuned.deltas.homeXg)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(tuned.deltas.awayXg)).toBeLessThanOrEqual(0.3);
  });
});

describe("tactical matchup modifier", () => {
  it("turns a press-versus-weak-control clash into a bounded xG nudge", () => {
    const modifier = tacticalMatchupModifier({
      homeName: "Press FC",
      awayName: "Loose Buildout",
      homeRatings: { attack: 88, control: 82, defense: 86, setPieces: 70 },
      awayRatings: { attack: 66, control: 60, defense: 68, setPieces: 65 },
    });

    expect(modifier.homeXgDelta).toBeGreaterThan(0);
    expect(modifier.homeXgDelta).toBeLessThanOrEqual(0.18);
    expect(modifier.payload.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "home-press-trap" }),
      ]),
    );
  });

  it("makes set pieces louder when the referee profile is card heavy", () => {
    const modifier = tacticalMatchupModifier({
      homeName: "Restart Kings",
      awayName: "Open Play FC",
      homeRatings: { attack: 76, control: 74, defense: 72, setPieces: 90 },
      awayRatings: { attack: 76, control: 74, defense: 72, setPieces: 62 },
      context: { cards_per_match: 4.8 } as never,
    });

    expect(modifier.homeXgDelta).toBeGreaterThan(0);
    expect(modifier.chaosDelta).toBeGreaterThan(0);
    expect(modifier.payload.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "home-set-piece-referee" }),
      ]),
    );
  });

  it("lets heat and body cost mute a high press", () => {
    const shared = {
      homeName: "Press FC",
      awayName: "Loose Buildout",
      homeRatings: { attack: 88, control: 82, defense: 86, setPieces: 70 },
      awayRatings: { attack: 66, control: 60, defense: 68, setPieces: 65 },
    };
    const cool = tacticalMatchupModifier(shared);
    const hot = tacticalMatchupModifier({
      ...shared,
      bodyCost: {
        heatStress: 1.2,
        home: { totalStress: 0.9 },
        away: { totalStress: 0.2 },
      },
    });

    expect(hot.homeXgDelta).toBeLessThan(cool.homeXgDelta);
    expect(hot.payload.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "home-heat-press-drag" }),
      ]),
    );
  });

  it("rewards transition attacks against travel-tired opponents without breaking the cap", () => {
    const modifier = tacticalMatchupModifier({
      homeName: "Counter FC",
      awayName: "Heavy Legs",
      homeRatings: { attack: 94, control: 58, defense: 72, setPieces: 78 },
      awayRatings: { attack: 72, control: 64, defense: 66, setPieces: 68 },
      bodyCost: {
        heatStress: 0.2,
        home: { totalStress: 0.1 },
        away: { totalStress: 2.8 },
      },
      referee: { cardsPerMatch: 5.4 },
    });

    expect(modifier.homeXgDelta).toBeGreaterThan(0);
    expect(modifier.homeXgDelta).toBeLessThanOrEqual(0.18);
    expect(modifier.chaosDelta).toBeLessThanOrEqual(5);
    expect(modifier.payload.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "home-transition-vs-tired-legs" }),
      ]),
    );
  });
});

describe("travel and body-cost modifier", () => {
  const mexico = {
    id: 1,
    slug: "mexico",
    name: "Mexico",
    code: "MEX",
    color: "#0b8f5a",
    country: "Mexico",
  };
  const canada = {
    id: 2,
    slug: "canada",
    name: "Canada",
    code: "CAN",
    color: "#d91e36",
    country: "Canada",
  };
  const germany = {
    id: 3,
    slug: "germany",
    name: "Germany",
    code: "GER",
    color: "#111111",
    country: "Germany",
  };

  it("makes Mexico City altitude louder for non-acclimated teams", () => {
    const modifier = travelBodyCostModifier({
      homeTeam: mexico,
      awayTeam: canada,
      phase: "Group A",
      venueSlug: "mexico-city-stadium",
      context: {
        starts_at: "2026-06-11T19:00:00.000Z",
        temperature_c: 24,
        humidity: 42,
      } as never,
    });

    expect(modifier.payload.altitudeStress).toBeGreaterThan(1);
    expect(modifier.awayPenalty).toBeGreaterThan(modifier.homePenalty);
    expect(modifier.factor?.explanation).toContain("Mexico City altitude");
  });

  it("charges the bigger travel/rest tax to the side making the long jump", () => {
    const modifier = travelBodyCostModifier({
      homeTeam: canada,
      awayTeam: germany,
      phase: "Round of 16",
      venueSlug: "miami-stadium",
      context: {
        starts_at: "2026-07-04T19:00:00.000Z",
        temperature_c: 31,
        humidity: 76,
        home_rest_hours: 118,
        away_rest_hours: 68,
        home_previous_match: {
          venueSlug: "atlanta-stadium",
          duration: "regular",
        },
        away_previous_match: {
          venueSlug: "vancouver-stadium",
          duration: "regular",
        },
      } as never,
    });

    expect(modifier.awayPenalty).toBeGreaterThan(modifier.homePenalty);
    expect(modifier.payload.away.travelDistanceKm).toBeGreaterThan(4000);
    expect(modifier.payload.heatStress).toBeGreaterThan(1);
  });

  it("adds a knockout hangover after extra time or penalties", () => {
    const regular = travelBodyCostModifier({
      homeTeam: canada,
      awayTeam: germany,
      phase: "Quarter-finals",
      venueSlug: "dallas-stadium",
      context: {
        starts_at: "2026-07-10T19:00:00.000Z",
        home_rest_hours: 90,
        away_rest_hours: 90,
        home_previous_match: {
          venueSlug: "houston-stadium",
          duration: "regular",
        },
        away_previous_match: {
          venueSlug: "houston-stadium",
          duration: "regular",
        },
      } as never,
    });
    const penalties = travelBodyCostModifier({
      homeTeam: canada,
      awayTeam: germany,
      phase: "Quarter-finals",
      venueSlug: "dallas-stadium",
      context: {
        starts_at: "2026-07-10T19:00:00.000Z",
        home_rest_hours: 90,
        away_rest_hours: 90,
        home_previous_match: {
          venueSlug: "houston-stadium",
          duration: "penalties",
        },
        away_previous_match: {
          venueSlug: "houston-stadium",
          duration: "regular",
        },
      } as never,
    });

    expect(penalties.homePenalty).toBeGreaterThan(regular.homePenalty);
    expect(penalties.payload.home.extraTimeStress).toBeGreaterThan(0);
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

  it("turns yellow-card accumulation into a suspension hit", () => {
    const modifier = availabilityForecastModifier([
      player({ yellowCards: 2, isSuspended: true }),
    ]);

    expect(modifier.homePenalty).toBeGreaterThan(1);
    expect(modifier.payload.impactedPlayers[0]).toMatchObject({
      reason: "is suspended by yellow-card accumulation",
    });
  });

  it("prices one-card-away players as suspension risk", () => {
    const modifier = availabilityForecastModifier([
      player({ yellowCards: 1, isSuspended: false }),
    ]);

    expect(modifier.homePenalty).toBeGreaterThan(0);
    expect(modifier.payload.suspensionRiskCount).toBe(1);
    expect(modifier.payload.impactedPlayers[0]?.reason).toContain(
      "suspension risk",
    );
  });

  it("uses confirmed lineups to separate starters from bench and missing players", () => {
    const confirmed = availabilityForecastModifier([
      player({ lineupStatus: "confirmed_start" }),
    ]);
    const bench = availabilityForecastModifier([
      player({ lineupStatus: "bench" }),
    ]);
    const missing = availabilityForecastModifier([
      player({ lineupStatus: "not_in_squad" }),
    ]);

    expect(confirmed.homePenalty).toBe(0);
    expect(confirmed.confidenceDelta).toBeGreaterThan(0);
    expect(confirmed.payload.confirmedLineupCount).toBe(1);
    expect(bench.homePenalty).toBeGreaterThan(0);
    expect(bench.payload.impactedPlayers[0]?.reason).toBe("starts on the bench");
    expect(missing.homePenalty).toBeGreaterThan(bench.homePenalty);
    expect(missing.payload.impactedPlayers[0]?.reason).toBe(
      "is missing from the confirmed squad",
    );
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
