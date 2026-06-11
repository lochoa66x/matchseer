import { NextResponse } from "next/server";
import {
  hasRestrictedBettingLanguage,
  hasRestrictedToneLanguage,
  type Language,
  type ForecastInterpretation,
  type ForecastInterpretationRequest,
  type MatchSummary,
} from "../../../../lib/domain";
import { getMatch, recordAiRequestAudit } from "../../../../lib/database";

const disclaimer =
  "Forecasts are for entertainment and sports analysis only. No betting advice.";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ForecastInterpretationRequest>;

  if (!body.matchId || !body.language || !isLanguage(body.language)) {
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
  const fallback = createFallbackInterpretation(
    match,
    language,
    result.source === "database",
  );

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      source: "seeded-fallback",
      reason: "missing-openai-api-key",
      model: process.env.OPENAI_MODEL ?? "gpt-5.5",
      interpretation: fallback,
    });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const openAiRequest = createOpenAiRequest(match, language, model);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openAiRequest),
    });

    const responsePayload = (await response.json()) as unknown;

    if (!response.ok) {
      await recordAiRequestAudit({
        matchId: match.id,
        model,
        requestPayload: openAiRequest,
        responsePayload,
        status: "openai-error",
      });

      return NextResponse.json({
        source: "seeded-fallback",
        reason: "openai-error",
        model,
        interpretation: fallback,
      });
    }

    const interpretation = parseOpenAiInterpretation(
      responsePayload,
      language,
      fallback,
    );
    const serialized = JSON.stringify(interpretation);

    if (hasRestrictedBettingLanguage(serialized.replace(disclaimer, ""))) {
      await recordAiRequestAudit({
        matchId: match.id,
        model,
        requestPayload: openAiRequest,
        responsePayload,
        status: "blocked-betting-language",
      });

      return NextResponse.json(
        { error: "Generated copy included restricted betting language" },
        { status: 422 },
      );
    }

    if (hasRestrictedToneLanguage(serialized)) {
      await recordAiRequestAudit({
        matchId: match.id,
        model,
        requestPayload: openAiRequest,
        responsePayload,
        status: "blocked-tone-language",
      });

      return NextResponse.json({
        source: "seeded-fallback",
        reason: "blocked-tone-language",
        model,
        interpretation: fallback,
      });
    }

    const audited = await recordAiRequestAudit({
      matchId: match.id,
      model,
      requestPayload: openAiRequest,
      responsePayload,
      status: "ok",
    });

    return NextResponse.json({
      source: "openai",
      model,
      audited,
      interpretation,
    });
  } catch (error) {
    await recordAiRequestAudit({
      matchId: match.id,
      model,
      requestPayload: openAiRequest,
      responsePayload: {
        error: error instanceof Error ? error.message : "Unknown OpenAI error",
      },
      status: "request-failed",
    });

    return NextResponse.json({
      source: "seeded-fallback",
      reason: "request-failed",
      model,
      interpretation: fallback,
    });
  }
}

function createFallbackInterpretation(
  match: MatchSummary,
  language: Language,
  usingDatabase: boolean,
): ForecastInterpretation {
  return {
    language,
    headline: `${match.home.name} vs ${match.away.name}`,
    summary: match.forecast.tone[language],
    toneLine: match.forecast.tone[language],
    keyFactors: match.forecast.reasons[language].map((reason, index) => ({
      label: `Factor ${index + 1}`,
      explanation: reason,
    })),
    missingDataNotes: [
      usingDatabase
        ? "This interpretation uses the current seeded Neon forecast data."
        : "This interpretation uses sample forecast data until Neon is available in this runtime.",
    ],
    disclaimer,
  };
}

function createOpenAiRequest(
  match: MatchSummary,
  language: Language,
  model: string,
) {
  return {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are MatchSeer's playful sports oracle. Interpret football match forecast data for fans. Use real-stat language, keep it concise, and stay playful through football, weather, venue, and tactical imagery. Never write betting advice, odds language, wagers, picks, locks, parlays, lines, sure things, guarantees, or sportsbook-style copy. Never use national stereotypes, cultural costumes, cultural props, ethnicity jokes, or caricatures.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              language,
              match: {
                id: match.id,
                teams: {
                  home: match.home,
                  away: match.away,
                },
                score: match.score,
                status: match.status,
                venue: `${match.venue}, ${match.city}`,
                forecast: match.forecast,
                weather: match.weather,
                referee: match.referee,
                players: match.players,
              },
              outputRules: {
                headline: "Use the teams or a short match title.",
                summary: "One or two sentences.",
                toneLine:
                  "One playful sentence based on football, weather, venue, tactics, or live data only. Do not use cultural stereotypes or cultural props.",
                keyFactors: "Three factors max.",
                disclaimer,
              },
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "matchseer_forecast_interpretation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "language",
            "headline",
            "summary",
            "toneLine",
            "keyFactors",
            "missingDataNotes",
            "disclaimer",
          ],
          properties: {
            language: { type: "string", enum: ["en", "es", "fr"] },
            headline: { type: "string" },
            summary: { type: "string" },
            toneLine: { type: "string" },
            keyFactors: {
              type: "array",
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "team", "explanation"],
                properties: {
                  label: { type: "string" },
                  team: { type: ["string", "null"] },
                  explanation: { type: "string" },
                },
              },
            },
            missingDataNotes: {
              type: "array",
              items: { type: "string" },
            },
            disclaimer: { type: "string" },
          },
        },
      },
    },
  };
}

function parseOpenAiInterpretation(
  responsePayload: unknown,
  language: Language,
  fallback: ForecastInterpretation,
): ForecastInterpretation {
  const parsed = JSON.parse(extractOutputText(responsePayload)) as Partial<
    ForecastInterpretation
  >;

  return {
    language,
    headline: parsed.headline ?? fallback.headline,
    summary: parsed.summary ?? fallback.summary,
    toneLine: parsed.toneLine ?? fallback.toneLine,
    keyFactors:
      parsed.keyFactors && parsed.keyFactors.length > 0
        ? parsed.keyFactors
        : fallback.keyFactors,
    missingDataNotes: parsed.missingDataNotes ?? fallback.missingDataNotes,
    disclaimer,
  };
}

function extractOutputText(responsePayload: unknown) {
  if (
    typeof responsePayload === "object" &&
    responsePayload !== null &&
    "output_text" in responsePayload &&
    typeof responsePayload.output_text === "string"
  ) {
    return responsePayload.output_text;
  }

  if (
    typeof responsePayload === "object" &&
    responsePayload !== null &&
    "output" in responsePayload &&
    Array.isArray(responsePayload.output)
  ) {
    for (const output of responsePayload.output) {
      if (
        typeof output === "object" &&
        output !== null &&
        "content" in output &&
        Array.isArray(output.content)
      ) {
        for (const content of output.content) {
          if (
            typeof content === "object" &&
            content !== null &&
            "text" in content &&
            typeof content.text === "string"
          ) {
            return content.text;
          }
        }
      }
    }
  }

  throw new Error("OpenAI response did not include output text");
}

function isLanguage(value: string): value is Language {
  return value === "en" || value === "es" || value === "fr";
}
