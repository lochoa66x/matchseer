import { NextResponse } from "next/server";
import { getDatabaseReadiness, listMatches } from "../../../lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listMatches();

  return NextResponse.json({
    ...result,
    database: getDatabaseReadiness(),
  });
}
