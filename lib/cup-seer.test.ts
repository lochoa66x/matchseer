import { describe, expect, it } from "vitest";
import { buildCupCandidates } from "./cup-seer";
import type { MatchSummary, TeamRating } from "./domain";

function team(name: string, code: string, power: number): TeamRating {
  return {
    name,
    code,
    color: "#5eead4",
    record: "0-0-0",
    form: [],
    attack: power,
    control: power,
    defense: power,
    setPieces: power,
  };
}

function match(
  home: TeamRating,
  away: TeamRating,
  status: MatchSummary["status"] = "Upcoming",
  score?: string,
): MatchSummary {
  return {
    id: `${home.code}-${away.code}`,
    status,
    startsAt: "2026-06-18T16:00:00.000Z",
    group: "Group A",
    time: "4:00 PM",
    venue: "Test Stadium",
    city: "Test City",
    home,
    away,
    score,
    forecast: {
      home: 50,
      draw: 25,
      away: 25,
      confidence: 60,
      chaos: 55,
      projected: "2-1",
      tone: { en: "", es: "", fr: "" },
      reasons: { en: [], es: [], fr: [] },
    },
    weather: {
      temp: "24°C",
      wind: "8 km/h",
      mood: { en: "", es: "", fr: "" },
    },
    referee: {
      name: "TBD",
      cardRisk: "Pending",
    },
    players: [],
  };
}

describe("Cup Seer final 8 lane", () => {
  it("returns eight teams and adds second-round path probability", () => {
    const teams = [
      team("France", "FRA", 94),
      team("Brazil", "BRA", 91),
      team("Argentina", "ARG", 93),
      team("Spain", "ESP", 92),
      team("England", "ENG", 90),
      team("Germany", "GER", 88),
      team("Netherlands", "NED", 87),
      team("Portugal", "POR", 88),
      team("Canada", "CAN", 66),
    ];
    const matches = teams.map((item, index) =>
      match(item, team(`Opponent ${index}`, `O${index}`, 52)),
    );

    const candidates = buildCupCandidates(matches, "en");

    expect(candidates).toHaveLength(8);
    expect(candidates[0].advanceProbability).toBeGreaterThan(0);
  });

  it("uses final scores as actual points once a match is complete", () => {
    const canada = team("Canada", "CAN", 66);
    const qatar = team("Qatar", "QAT", 58);

    const [winner, loser] = buildCupCandidates(
      [match(canada, qatar, "Final", "2 - 0")],
      "en",
    );

    expect(winner.team.name).toBe("Canada");
    expect(winner.expectedPoints).toBe(3);
    expect(loser.expectedPoints).toBe(0);
  });

  it("ignores pending next-round slots until teams are confirmed", () => {
    const pendingHome = {
      ...team("Round of 32 home slot", "TBD", 50),
      isPlaceholder: true,
    };
    const pendingAway = {
      ...team("Round of 32 away slot", "TBD", 50),
      isPlaceholder: true,
    };
    const france = team("France", "FRA", 94);
    const canada = team("Canada", "CAN", 66);

    const candidates = buildCupCandidates(
      [
        {
          ...match(pendingHome, pendingAway),
          stage: "LAST_32",
          group: "Round of 32",
          forecast: {
            ...match(pendingHome, pendingAway).forecast,
            isPending: true,
            projected: "TBD",
          },
        },
        match(france, canada),
      ],
      "en",
    );

    expect(candidates.map((candidate) => candidate.team.code)).not.toContain("TBD");
    expect(candidates).toHaveLength(2);
  });
});
