import { describe, expect, it } from "vitest";
import {
  nflCloseGameMargin,
  nflResultLaneFromScore,
  nflResultLaneLabel,
} from "./nfl-outcomes";

describe("nflResultLaneFromScore", () => {
  it("treats a one-score game (<= 7) as the close-game 'draw' lane", () => {
    expect(nflResultLaneFromScore({ homeScore: 24, awayScore: 20 })).toBe("draw");
  });

  it("treats an exactly-7 margin as a close game", () => {
    expect(nflResultLaneFromScore({ homeScore: 27, awayScore: 20 })).toBe("draw");
  });

  it("returns 'home' when the home team wins by 8 or more", () => {
    expect(nflResultLaneFromScore({ homeScore: 31, awayScore: 20 })).toBe("home");
  });

  it("returns 'away' when the away team wins by 8 or more", () => {
    expect(nflResultLaneFromScore({ homeScore: 14, awayScore: 24 })).toBe("away");
  });

  it("respects a custom close-game margin", () => {
    // Margin of 4 is no longer 'close' when the threshold is 3.
    expect(
      nflResultLaneFromScore({ homeScore: 24, awayScore: 20, closeMargin: 3 }),
    ).toBe("home");
  });

  it("exposes the default close-game margin", () => {
    expect(nflCloseGameMargin).toBe(7);
  });
});

describe("nflResultLaneLabel", () => {
  it("labels each lane in plain language", () => {
    expect(nflResultLaneLabel("draw")).toBe("Close game");
    expect(nflResultLaneLabel("home")).toBe("Home by 8+");
    expect(nflResultLaneLabel("away")).toBe("Away by 8+");
  });
});
