import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFootballDataSnapshot } from "./football-data";

describe("football-data snapshot adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets scheduled knockout venues replace provider TBD labels", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          competition: { name: "FIFA World Cup" },
          season: { startDate: "2026-06-11" },
          teams: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          competition: { name: "FIFA World Cup" },
          matches: [
            {
              id: 73,
              utcDate: "2026-06-28T19:00:00Z",
              status: "SCHEDULED",
              stage: "LAST_32",
              group: "LAST_32",
              venue: "Venue TBD",
              homeTeam: { id: 1, name: "South Africa", shortName: "South Africa", tla: "RSA" },
              awayTeam: { id: 2, name: "Canada", shortName: "Canada", tla: "CAN" },
              score: { fullTime: { home: null, away: null } },
            },
          ],
        }),
      );

    const snapshot = await fetchFootballDataSnapshot({ token: "test-token" });

    expect(snapshot.matches[0]).toMatchObject({
      venueSlug: "los-angeles-stadium",
      venueName: "SoFi Stadium",
    });
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
