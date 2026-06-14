import { NextResponse } from "next/server";
import {
  applyPlayerAvailabilityUpdates,
  getModelControlDashboard,
  type PlayerAvailabilityUpdate,
} from "../../../../lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const dashboard = await getModelControlDashboard();

  return NextResponse.json(dashboard);
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
  const updates = parseUpdates(payload);

  if (updates.length === 0) {
    return NextResponse.json(
      {
        error:
          'Provide updates like {"updates":[{"slug":"lionel-messi","availabilityStatus":"limited","minutesRecent":240}]}',
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyPlayerAvailabilityUpdates(updates);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Player availability update failed",
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

function parseUpdates(payload: unknown): PlayerAvailabilityUpdate[] {
  if (!payload || typeof payload !== "object" || !("updates" in payload)) {
    return [];
  }

  const updates = (payload as { updates?: unknown }).updates;

  if (!Array.isArray(updates)) {
    return [];
  }

  return updates.flatMap((update): PlayerAvailabilityUpdate[] => {
    if (!update || typeof update !== "object") {
      return [];
    }

    const value = update as {
      slug?: unknown;
      availabilityStatus?: unknown;
      availabilityNote?: unknown;
      yellowCards?: unknown;
      redCards?: unknown;
      isSuspended?: unknown;
      minutesRecent?: unknown;
    };

    if (
      typeof value.slug !== "string" ||
      typeof value.availabilityStatus !== "string"
    ) {
      return [];
    }

    const slug = value.slug.trim();
    const availabilityStatus = value.availabilityStatus.trim();

    if (!slug || !availabilityStatus) {
      return [];
    }

    return [
      {
        slug,
        availabilityStatus,
        availabilityNote:
          typeof value.availabilityNote === "string"
            ? value.availabilityNote
            : null,
        yellowCards: toFiniteNumber(value.yellowCards),
        redCards: toFiniteNumber(value.redCards),
        isSuspended: Boolean(value.isSuspended),
        minutesRecent: toFiniteNumber(value.minutesRecent),
      },
    ];
  });
}

function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get("authorization");
  const syncSecret = request.headers.get("x-sync-secret");

  return authorization === `Bearer ${secret}` || syncSecret === secret;
}
