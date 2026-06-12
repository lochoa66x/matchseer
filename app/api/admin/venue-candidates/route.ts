import { NextResponse } from "next/server";
import { listVenueMappingCandidates } from "../../../../lib/database";
import { worldCupVenues } from "../../../../lib/providers/world-cup-venues";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeMapped = url.searchParams.get("all") === "1";

  try {
    const matches = await listVenueMappingCandidates({ includeMapped });

    return NextResponse.json({
      source: "database",
      includeMapped,
      count: matches.length,
      matches,
      venues: worldCupVenues.map((venue) => ({
        slug: venue.slug,
        name: venue.name,
        city: venue.city,
        country: venue.country,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Venue candidate lookup failed",
      },
      { status: 500 },
    );
  }
}
