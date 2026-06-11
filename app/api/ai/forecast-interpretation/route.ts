import { NextResponse } from "next/server";
import {
  hasRestrictedBettingLanguage,
  type ForecastInterpretation,
  type ForecastInterpretationRequest,
} from "../../../../lib/domain";
import { getMatch } from "../../../../lib/database";

const disclaimer =
  "Forecasts are for entertainment and sports analysis only. No betting advice.";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ForecastInterpretationRequest>;

  if (!body.matchId || !body.language) {
    return NextResponse.json(
      { error: "matchId and language are required" },
      { status: 400 },
    );
  }

  const result = await getMatch(body.matchId);
  const match = result.match;

  if (!match) {
    return NextResponse.json(
      { error: "Match not found", matchId: body.matchId },
      { status: 404 },
    );
  }

  const language = body.language;
  const interpretation: ForecastInterpretation = {
    language,
    headline: `${match.home.name} vs ${match.away.name}`,
    summary: match.forecast.tone[language],
    toneLine: match.forecast.tone[language],
    keyFactors: match.forecast.reasons[language].map((reason, index) => ({
      label: `Factor ${index + 1}`,
      explanation: reason,
    })),
    missingDataNotes: [
      result.source === "database"
        ? "This interpretation uses the current seeded Neon forecast data."
        : "This interpretation uses sample forecast data until Neon is available in this runtime.",
    ],
    disclaimer,
  };

  const serialized = JSON.stringify(interpretation);

  if (hasRestrictedBettingLanguage(serialized.replace(disclaimer, ""))) {
    return NextResponse.json(
      { error: "Generated copy included restricted betting language" },
      { status: 422 },
    );
  }

  return NextResponse.json({
    source: process.env.OPENAI_API_KEY ? "seeded-fallback" : "seeded-fallback",
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    interpretation,
  });
}
