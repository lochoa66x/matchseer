import { NextResponse } from "next/server";
import { getMatch } from "../../../../lib/database";

type Params = {
  params: Promise<{
    matchId: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { matchId } = await params;
  const result = await getMatch(matchId);

  if (!result.match) {
    return NextResponse.json(
      { error: "Match not found", matchId },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}

