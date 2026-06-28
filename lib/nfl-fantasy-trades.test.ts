import { describe, expect, it } from "vitest";
import {
  buildFantasyTradePackages,
  fantasyTradePlayerValue,
  type FantasyTradePlayer,
  type FantasyTradeTeam,
} from "./nfl-fantasy-trades";

function player(
  id: string,
  position: FantasyTradePlayer["position"],
  projection: number,
  options: Partial<FantasyTradePlayer> = {},
): FantasyTradePlayer {
  return {
    ceiling: projection + 7,
    floor: Math.max(1, projection - 5),
    id,
    name: id,
    position,
    projection,
    roleSecurity: 74,
    risk: 48,
    ...options,
  };
}

function team(id: string, players: FantasyTradePlayer[]): FantasyTradeTeam {
  return {
    id,
    name: id,
    players,
  };
}

describe("buildFantasyTradePackages", () => {
  it("uses surplus depth to attack the weakest position", () => {
    const result = buildFantasyTradePackages({
      activeTeamId: "mine",
      lens: "redraft",
      scoringFormat: "fullPpr",
      teams: [
        team("mine", [
          player("anchor-rb", "RB", 20, { starter: true }),
          player("bench-rb", "RB", 15),
          player("bench-rb-2", "RB", 13),
          player("thin-wr", "WR", 8, { starter: true }),
          player("qb", "QB", 18, { starter: true }),
          player("te", "TE", 10, { starter: true }),
        ]),
        team("rival", [
          player("target-wr", "WR", 16, { starter: true }),
          player("rival-rb", "RB", 7, { starter: true }),
          player("rival-qb", "QB", 16, { starter: true }),
          player("rival-te", "TE", 8, { starter: true }),
        ]),
      ],
    });

    expect(result.needPosition).toBe("WR");
    expect(result.surplusPosition).toBe("RB");
    expect(result.packages[0].target.position).toBe("WR");
    expect(result.packages[0].offerPlayers.some((offer) => offer.position === "RB")).toBe(true);
    expect(result.packages[0].impact.myTeam.teamName).toBe("mine");
    expect(result.packages[0].impact.partnerTeam.teamName).toBe("rival");
    expect(result.packages[0].impact.myTeam.starterProjectionDelta).toBeGreaterThan(0);
    expect(result.packages[0].impact.verdict).toContain("target-wr");
    expect(result.packages[0].impact.counterOffer.length).toBeGreaterThan(10);
  });

  it("sets a walk-away line and protects core players from overpay packages", () => {
    const result = buildFantasyTradePackages({
      activeTeamId: "mine",
      lens: "redraft",
      scoringFormat: "standard",
      teams: [
        team("mine", [
          player("untouchable", "WR", 24, { starter: true }),
          player("qb", "QB", 19, { starter: true }),
          player("bench-rb", "RB", 12),
          player("bench-rb-2", "RB", 11),
          player("te", "TE", 8, { starter: true }),
        ]),
        team("rival", [
          player("target-te", "TE", 15, { starter: true }),
          player("rival-wr", "WR", 14, { starter: true }),
          player("rival-rb", "RB", 8, { starter: true }),
        ]),
      ],
    });

    expect(result.doNotInclude.map((candidate) => candidate.name)).toContain("untouchable");
    for (const tradePackage of result.packages) {
      expect(tradePackage.offerValue).toBeLessThanOrEqual(
        tradePackage.walkAwayValue + 0.1,
      );
      expect(tradePackage.offerPlayers.map((offer) => offer.name)).not.toContain(
        "untouchable",
      );
      expect(tradePackage.impact.overpayWarning).toMatch(
        /overpay|expensive|lineup|protects/i,
      );
      expect(tradePackage.impact.regretCheck.length).toBeGreaterThan(10);
    }
  });

  it("changes target value by scoring format", () => {
    const receiver = player("receiver", "WR", 15);
    const fullPprValue = fantasyTradePlayerValue(receiver, "fullPpr", "redraft");
    const standardValue = fantasyTradePlayerValue(receiver, "standard", "redraft");

    expect(fullPprValue).toBeGreaterThan(standardValue);
  });

  it("protects dynasty value in dynasty trade reads", () => {
    const result = buildFantasyTradePackages({
      activeTeamId: "mine",
      lens: "dynasty",
      scoringFormat: "halfPpr",
      teams: [
        team("mine", [
          player("young-core", "WR", 13, {
            dynastyValue: 92,
            starter: true,
          }),
          player("bench-qb", "QB", 15),
          player("bench-qb-2", "QB", 13),
          player("rb", "RB", 10, { starter: true }),
          player("te", "TE", 7, { starter: true }),
        ]),
        team("rival", [
          player("target-wr", "WR", 16, { starter: true }),
          player("rival-rb", "RB", 9, { starter: true }),
          player("rival-qb", "QB", 12, { starter: true }),
        ]),
      ],
    });

    expect(result.doNotInclude.map((candidate) => candidate.name)).toContain(
      "young-core",
    );
    expect(
      result.packages.flatMap((tradePackage) =>
        tradePackage.offerPlayers.map((offer) => offer.name),
      ),
    ).not.toContain("young-core");
  });
});
