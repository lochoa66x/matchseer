import { NextResponse } from "next/server";
import { recordTrafficEvent } from "../../../lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ready: Boolean(process.env.DATABASE_URL),
    purpose: "First-party MatchSeer page-view collection.",
  });
}

export async function POST(request: Request) {
  const payload = await readJson(request);
  const headers = request.headers;

  const result = await recordTrafficEvent({
    path: readString(payload, "path"),
    referrer: readString(payload, "referrer"),
    language: readString(payload, "language"),
    matchId: readString(payload, "matchId"),
    visitorId: readString(payload, "visitorId"),
    timezone: readString(payload, "timezone"),
    viewport: readViewport(payload),
    userAgent: headers.get("user-agent"),
    requestHost: headers.get("x-forwarded-host") ?? headers.get("host"),
  });

  return NextResponse.json(result, {
    status: result.recorded ? 201 : 202,
  });
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function readString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];

  return typeof value === "string" ? value : null;
}

function readViewport(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("viewport" in payload)) {
    return null;
  }

  const viewport = (payload as { viewport?: unknown }).viewport;

  if (!viewport || typeof viewport !== "object") {
    return null;
  }

  return {
    width: (viewport as { width?: unknown }).width,
    height: (viewport as { height?: unknown }).height,
  };
}
