import { describe, expect, it } from "vitest";
import {
  isKnownPlaceholderTeamName,
  normalizeMatchPhase,
  normalizeStageLabel,
} from "./match-stage";

describe("match stage labels", () => {
  it("keeps known group names ahead of generic group-stage values", () => {
    expect(normalizeMatchPhase("GROUP_STAGE", "GROUP_A")).toBe("Group A");
    expect(normalizeMatchPhase("REGULAR_SEASON", "Group L")).toBe("Group L");
  });

  it("maps knockout provider stages to fan-facing rounds", () => {
    expect(normalizeMatchPhase("LAST_32", null)).toBe("Round of 32");
    expect(normalizeMatchPhase("ROUND_OF_16", null)).toBe("Round of 16");
    expect(normalizeMatchPhase("QUARTER_FINALS", null)).toBe("Quarter-finals");
    expect(normalizeMatchPhase("SEMI_FINALS", null)).toBe("Semi-finals");
    expect(normalizeMatchPhase("THIRD_PLACE", null)).toBe("Third place");
    expect(normalizeMatchPhase("FINAL", null)).toBe("Final");
  });

  it("lets knockout stages override stale group labels", () => {
    expect(normalizeMatchPhase("LAST_32", "Group A")).toBe("Round of 32");
  });

  it("recovers stage labels when providers put the stage in the group field", () => {
    expect(normalizeMatchPhase(null, "LAST_16")).toBe("Round of 16");
    expect(normalizeMatchPhase(null, "quarter-finals")).toBe("Quarter-finals");
  });

  it("normalizes open-ended round numbers", () => {
    expect(normalizeStageLabel("R32")).toBe("Round of 32");
    expect(normalizeStageLabel("ROUND_OF_64")).toBe("Round of 64");
  });

  it("detects generic placeholder team names", () => {
    expect(isKnownPlaceholderTeamName("TBD")).toBe(true);
    expect(isKnownPlaceholderTeamName("To be determined")).toBe(true);
    expect(isKnownPlaceholderTeamName("Winner Group A")).toBe(false);
  });
});
