import { NextResponse } from "next/server";
import { fetchNflSeerDataset } from "../../../../lib/nfl-seer-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const dataset = await fetchNflSeerDataset();

  return NextResponse.json(dataset);
}
