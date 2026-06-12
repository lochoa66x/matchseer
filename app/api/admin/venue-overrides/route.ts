import { NextResponse } from "next/server";
import {
  applyVenueOverrides,
  type VenueOverride,
} from "../../../../lib/database";
import { worldCupVenues } from "../../../../lib/providers/world-cup-venues";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasSyncSecret = Boolean(process.env.MATCHSEER_SYNC_SECRET);

  return NextResponse.json({
    ready: hasSyncSecret,
    purpose: "Map synced football-data match IDs to World Cup venue slugs.",
    requiredEnv: ["MATCHSEER_SYNC_SECRET"],
    venues: [
      { slug: "provider-venue-tbd", name: "Venue TBD", city: "City TBD" },
      ...worldCupVenues.map((venue) => ({
        slug: venue.slug,
        name: venue.name,
        city: venue.city,
      })),
    ],
    example: {
      overrides: [
        {
          matchId: "fd-123456",
          venueSlug: "mexico-city-stadium",
        },
      ],
    },
  });
}

export async function POST(request: Request) {
  const secret = process.env.MATCHSEER_SYNC_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "MATCHSEER_SYNC_SECRET is required" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await readJson(request);
  const overrides = parseOverrides(payload);

  if (overrides.length === 0) {
    return NextResponse.json(
      {
        error:
          'Provide overrides like {"overrides":[{"matchId":"fd-123456","venueSlug":"mexico-city-stadium"}]}',
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyVenueOverrides(overrides);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Venue override sync failed",
      },
      { status: 500 },
    );
  }
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function parseOverrides(payload: unknown): VenueOverride[] {
  if (!payload || typeof payload !== "object" || !("overrides" in payload)) {
    return [];
  }

  const overrides = (payload as { overrides?: unknown }).overrides;

  if (!Array.isArray(overrides)) {
    return [];
  }

  return overrides
    .map((override) => {
      if (!override || typeof override !== "object") {
        return null;
      }

      const value = override as {
        matchId?: unknown;
        venueSlug?: unknown;
      };

      if (
        typeof value.matchId !== "string" ||
        typeof value.venueSlug !== "string"
      ) {
        return null;
      }

      return {
        matchId: value.matchId.trim(),
        venueSlug: value.venueSlug.trim(),
      };
    })
    .filter(
      (override): override is VenueOverride =>
        Boolean(override?.matchId && override.venueSlug),
    );
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  const syncSecret = request.headers.get("x-sync-secret");

  return authorization === `Bearer ${secret}` || syncSecret === secret;
}
