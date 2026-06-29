import { describe, expect, it } from "vitest";
import type { MatchSummary } from "./domain";
import {
  isMatchOnDate,
  sortMatchesForExplorer,
  sortRoundLabelsForExplorer,
  toMatchDateKey,
} from "./match-schedule";

const baseMatch: MatchSummary = {
  id: "match",
  status: "Upcoming",
  startsAt: "2026-06-28T19:00:00.000Z",
  group: "Round of 32",
  time: "3:00 PM",
  venue: "Venue TBD",
  city: "TBD",
  home: {
    name: "South Africa",
    code: "RSA",
    color: "#f5c542",
    record: "",
    form: [],
    attack: 70,
    control: 70,
    defense: 70,
    setPieces: 70,
  },
  away: {
    name: "Canada",
    code: "CAN",
    color: "#e1251b",
    record: "",
    form: [],
    attack: 70,
    control: 70,
    defense: 70,
    setPieces: 70,
  },
  forecast: {
    tone: { en: "", es: "", fr: "" },
    reasons: { en: [], es: [], fr: [] },
    home: 30,
    draw: 27,
    away: 43,
    confidence: 62,
    chaos: 57,
    projected: "0-1",
  },
  weather: {
    temp: "TBD",
    wind: "TBD",
    mood: { en: "", es: "", fr: "" },
  },
  referee: {
    name: "TBD",
    cardRisk: "TBD",
  },
  players: [],
};

describe("match schedule filtering", () => {
  it("matches the tournament timezone date for fully timed fixtures", () => {
    expect(isMatchOnDate(baseMatch, "2026-06-28")).toBe(true);
  });

  it("keeps date-only knockout placeholders on their scheduled calendar day", () => {
    expect(
      isMatchOnDate(
        {
          ...baseMatch,
          startsAt: "2026-06-28T00:00:00.000Z",
          home: { ...baseMatch.home, isPlaceholder: true },
        },
        "2026-06-28",
      ),
    ).toBe(true);
  });

  it("still respects the local day for real late-night UTC kickoffs", () => {
    expect(
      isMatchOnDate(
        {
          ...baseMatch,
          startsAt: "2026-06-29T00:00:00.000Z",
          venue: "MetLife Stadium",
        },
        "2026-06-28",
      ),
    ).toBe(true);
  });

  it("does not dump every undated upcoming fixture into today", () => {
    expect(
      isMatchOnDate(
        {
          ...baseMatch,
          startsAt: null,
          time: "TBD",
        },
        toMatchDateKey(new Date("2026-06-28T15:00:00.000Z")),
      ),
    ).toBe(false);
  });

  it("puts live and upcoming knockout rounds before completed groups", () => {
    const labels = sortRoundLabelsForExplorer(
      [
        createMatch({ group: "Group A", id: "group-a", startsAt: "2026-06-18T19:00:00.000Z", status: "Final" }),
        createMatch({ group: "Round of 16", id: "r16", startsAt: "2026-07-03T19:00:00.000Z" }),
        createMatch({ group: "Round of 32", id: "r32", startsAt: "2026-06-28T19:00:00.000Z" }),
      ],
      "2026-06-28",
    );

    expect(labels).toEqual(["Round of 32", "Round of 16", "Group A"]);
  });

  it("moves a finished knockout round behind the next open round", () => {
    const labels = sortRoundLabelsForExplorer(
      [
        createMatch({ group: "Round of 32", id: "r32", startsAt: "2026-06-28T19:00:00.000Z", status: "Final" }),
        createMatch({ group: "Group B", id: "group-b", startsAt: "2026-06-19T19:00:00.000Z", status: "Final" }),
        createMatch({ group: "Round of 16", id: "r16", startsAt: "2026-07-03T19:00:00.000Z" }),
      ],
      "2026-07-01",
    );

    expect(labels).toEqual(["Round of 16", "Round of 32", "Group B"]);
  });

  it("sorts explorer matches by tournament focus instead of raw feed order", () => {
    const matches = sortMatchesForExplorer(
      [
        createMatch({ group: "Group C", id: "group-c", startsAt: "2026-06-20T19:00:00.000Z", status: "Final" }),
        createMatch({ group: "Round of 32", id: "r32-final", startsAt: "2026-06-29T19:00:00.000Z", status: "Final" }),
        createMatch({ group: "Round of 16", id: "r16-next", startsAt: "2026-07-03T19:00:00.000Z" }),
      ],
      "2026-07-01",
    );

    expect(matches.map((match) => match.id)).toEqual(["r16-next", "r32-final", "group-c"]);
  });
});

function createMatch(overrides: Partial<MatchSummary>) {
  return {
    ...baseMatch,
    ...overrides,
    home: {
      ...baseMatch.home,
      ...overrides.home,
    },
    away: {
      ...baseMatch.away,
      ...overrides.away,
    },
    forecast: {
      ...baseMatch.forecast,
      ...overrides.forecast,
    },
  };
}
