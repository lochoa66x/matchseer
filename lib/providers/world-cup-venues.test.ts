import { describe, expect, it } from "vitest";
import { findScheduledWorldCupVenueForMatch } from "./world-cup-venues";

describe("World Cup venue schedule fallback", () => {
  it("fills the Round of 32 opener venue from the kickoff slot", () => {
    const venue = findScheduledWorldCupVenueForMatch({
      homeTeam: { name: "South Africa", tla: "RSA" },
      awayTeam: { name: "Canada", tla: "CAN" },
      startsAt: "2026-06-28T19:00:00Z",
    });

    expect(venue?.slug).toBe("los-angeles-stadium");
    expect(venue?.name).toBe("SoFi Stadium");
  });

  it("fills later knockout venues by match number when the provider exposes it", () => {
    const venue = findScheduledWorldCupVenueForMatch({
      homeTeam: { name: "Round of 16 home slot" },
      awayTeam: { name: "Round of 16 away slot" },
      providerId: 104,
    });

    expect(venue?.slug).toBe("new-york-new-jersey-stadium");
    expect(venue?.name).toBe("MetLife Stadium");
  });

  it.each([
    [73, "los-angeles-stadium"],
    [89, "philadelphia-stadium"],
    [97, "boston-stadium"],
    [101, "dallas-stadium"],
    [103, "miami-stadium"],
    [104, "new-york-new-jersey-stadium"],
  ])("keeps knockout match %s away from the TBD fallback", (providerId, venueSlug) => {
    const venue = findScheduledWorldCupVenueForMatch({
      homeTeam: { name: `Knockout home slot ${providerId}` },
      awayTeam: { name: `Knockout away slot ${providerId}` },
      providerId,
    });

    expect(venue?.slug).toBe(venueSlug);
  });

  it("keeps group-stage team mapping working ahead of the slot fallback", () => {
    const venue = findScheduledWorldCupVenueForMatch({
      homeTeam: { name: "Mexico", tla: "MEX" },
      awayTeam: { name: "South Africa", tla: "RSA" },
      startsAt: "2026-06-28T19:00:00Z",
    });

    expect(venue?.slug).toBe("mexico-city-stadium");
  });
});
