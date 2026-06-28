import { describe, expect, it } from "vitest";
import {
  rankFantasyLeaguePower,
  type FantasyPowerPlayer,
  type FantasyPowerTeamInput,
} from "./nfl-fantasy-power-map";

function player(
  id: string,
  position: FantasyPowerPlayer["position"],
  projection: number,
  options: Partial<FantasyPowerPlayer> = {},
): FantasyPowerPlayer {
  return {
    ceiling: projection + 7,
    floor: Math.max(1, projection - 5),
    id,
    name: id,
    position,
    projection,
    roleSecurity: 74,
    risk: 46,
    ...options,
  };
}

function team(id: string, players: FantasyPowerPlayer[]): FantasyPowerTeamInput {
  return {
    id,
    manager: `${id}-manager`,
    name: id,
    players,
  };
}

describe("rankFantasyLeaguePower", () => {
  it("ranks the strongest starter room as a contender", () => {
    const result = rankFantasyLeaguePower({
      activeTeamId: "mine",
      lens: "redraft",
      teams: [
        team("mine", [
          player("qb1", "QB", 24),
          player("rb1", "RB", 18),
          player("rb2", "RB", 16),
          player("wr1", "WR", 19),
          player("wr2", "WR", 17),
          player("te1", "TE", 12),
          player("k1", "K", 8),
          player("dst1", "DST", 8),
        ]),
        team("rival", [
          player("qb2", "QB", 18),
          player("rb3", "RB", 12),
          player("rb4", "RB", 11),
          player("wr3", "WR", 13),
          player("wr4", "WR", 12),
          player("te2", "TE", 8),
          player("k2", "K", 7),
          player("dst2", "DST", 7),
        ]),
      ],
    });

    expect(result.active.id).toBe("mine");
    expect(result.active.rank).toBe(1);
    expect(result.active.tier).toBe("contender");
    expect(result.rankLabel).toBe("#1 of 2");
  });

  it("returns per-position ranks across the league", () => {
    const result = rankFantasyLeaguePower({
      activeTeamId: "mine",
      lens: "redraft",
      teams: [
        team("mine", [
          player("qb1", "QB", 17),
          player("rb1", "RB", 11),
          player("rb2", "RB", 10),
          player("wr1", "WR", 20),
          player("wr2", "WR", 18),
          player("te1", "TE", 7),
        ]),
        team("wr-room", [
          player("qb2", "QB", 16),
          player("rb3", "RB", 12),
          player("rb4", "RB", 11),
          player("wr3", "WR", 14),
          player("wr4", "WR", 13),
          player("te2", "TE", 8),
        ]),
      ],
    });

    const wideReceiverRank = result.active.positionRanks.find(
      (rank) => rank.position === "WR",
    );
    const tightEndRank = result.active.positionRanks.find(
      (rank) => rank.position === "TE",
    );

    expect(wideReceiverRank?.rank).toBe(1);
    expect(wideReceiverRank?.projection).toBe(38);
    expect(tightEndRank?.rank).toBe(2);
  });

  it("finds trade partners who can help the active weak lane", () => {
    const result = rankFantasyLeaguePower({
      activeTeamId: "mine",
      lens: "dynasty",
      teams: [
        team("mine", [
          player("qb1", "QB", 18, { dynastyValue: 78 }),
          player("rb1", "RB", 17, { dynastyValue: 82 }),
          player("rb2", "RB", 16, { dynastyValue: 80 }),
          player("wr1", "WR", 18, { dynastyValue: 84 }),
          player("wr2", "WR", 16, { dynastyValue: 83 }),
          player("te1", "TE", 5, { dynastyValue: 55 }),
        ]),
        team("tight-end-room", [
          player("qb2", "QB", 15),
          player("rb3", "RB", 10),
          player("rb4", "RB", 9),
          player("wr3", "WR", 11),
          player("wr4", "WR", 10),
          player("te2", "TE", 14),
          player("te3", "TE", 11),
        ]),
      ],
    });

    expect(result.active.weakestPosition).toBe("TE");
    expect(result.tradePartners[0].teamId).toBe("tight-end-room");
    expect(result.tradePartners[0].askFor).toBe("TE");
    expect(result.tradePartners[0].fitScore).toBeGreaterThan(0);
  });
});
