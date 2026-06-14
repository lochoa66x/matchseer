import { NextResponse } from "next/server";
import {
  hasRestrictedBettingLanguage,
  hasRestrictedToneLanguage,
  type Language,
  type ForecastInterpretation,
  type ForecastInterpretationRequest,
  type MatchSummary,
} from "../../../../lib/domain";
import {
  getMatch,
  recordAiRequestAudit,
  saveForecastInterpretation,
} from "../../../../lib/database";

const disclaimer =
  "Forecasts are for entertainment and sports analysis only. No betting advice.";

export const dynamic = "force-dynamic";

type ForecastSide = "home" | "draw" | "away";

type OfficialModelCall = {
  pick: ForecastSide;
  pickLabel: string;
  projectedScore: string;
  projectedScores: string[];
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  confidence: number;
  chaos: number;
};

function cleanExplanation(raw: unknown): string {
  const s = typeof raw === "string" ? raw : String(raw ?? "");
  return s.replace(/^explanation:\s*/i, "").trim();
}

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
  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const officialModelCall = createOfficialModelCall(match);
  const fallback = createFallbackInterpretation(
    match,
    language,
    result.source === "database",
    officialModelCall,
  );

  if (match.status === "Final") {
    await recordAiRequestAudit({
      matchId: match.id,
      model,
      requestPayload: {
        matchId: match.id,
        language,
        reason: "completed-match",
      },
      responsePayload: null,
      status: "blocked-completed-match",
    });

    return NextResponse.json(
      {
        error: "Completed matches cannot be re-read.",
        reason: "completed-match",
        interpretation: fallback,
      },
      { status: 409 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      source: "seeded-fallback",
      reason: "missing-openai-api-key",
      model,
      interpretation: fallback,
    });
  }

  const openAiRequest = createOpenAiRequest(
    match,
    language,
    model,
    officialModelCall,
  );

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
      officialModelCall,
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

      await saveForecastInterpretation({
        matchId: match.id,
        interpretation: fallback,
      });

      return NextResponse.json({
        source: "seeded-fallback",
        reason: "blocked-betting-language",
        model,
        interpretation: fallback,
      });
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
    const saved = await saveForecastInterpretation({
      matchId: match.id,
      interpretation,
    });

    return NextResponse.json({
      source: "openai",
      model,
      audited,
      saved,
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
  officialModelCall: OfficialModelCall,
): ForecastInterpretation {
  const lead =
    officialModelCall.pick === "draw"
      ? `MatchSeer models ${match.home.name} and ${match.away.name} on a draw lane around ${officialModelCall.projectedScore}.`
      : `MatchSeer models ${officialModelCall.pickLabel} ahead around ${officialModelCall.projectedScore}.`;
  const context =
    match.forecast.reasons[language]?.[0] ?? match.forecast.tone[language];

  return {
    language,
    headline: `${match.home.name} vs ${match.away.name}`,
    summary: `${lead} The Seer read explains why that model forecast could happen.`,
    toneLine: `The Seer follows the model's ${officialModelCall.projectedScore} trail and reads the match from there.`,
    keyFactors: [
      {
        label: "Model forecast",
        explanation:
          `${officialModelCall.pickLabel} is the stored public call with ${officialModelCall.confidence}% confidence.`,
      },
      {
        label: "Forecast shape",
        explanation:
          `Probabilities sit at ${officialModelCall.probabilities.home}% home, ${officialModelCall.probabilities.draw}% draw, and ${officialModelCall.probabilities.away}% away.`,
      },
      {
        label: "Context",
        explanation: cleanExplanation(context),
      },
    ],
    missingDataNotes: [
      usingDatabase
        ? "This read explains the stored MatchSeer model forecast."
        : "Live forecast data is unavailable for this match.",
    ],
    disclaimer,
  };
}

function createOpenAiRequest(
  match: MatchSummary,
  language: Language,
  model: string,
  officialModelCall: OfficialModelCall,
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
              "You write MatchSeer Seer reads for fans. The official public call is the stored Model Forecast supplied by the app. Explain that model forecast; do not create an independent prediction. If you mention a winner, draw, score, probability, or confidence, it must match officialModelForecast exactly. Never invent another winner, scoreline, or certainty. Keep it concise and playful through football, weather, venue, and tactical imagery. Never write betting advice, odds language, wagers, picks, locks, parlays, lines, sure things, guarantees, or sportsbook-style copy. Never use national stereotypes, cultural costumes, cultural props, ethnicity jokes, or caricatures.",
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
              officialModelForecast: officialModelCall,
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
                summary:
                  "One or two sentences explaining why the official model forecast could happen. Do not predict a different outcome.",
                toneLine:
                  "One playful sentence that matches the official model forecast exactly. Do not use cultural stereotypes or cultural props.",
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
  officialModelCall: OfficialModelCall,
): ForecastInterpretation {
  const parsed = JSON.parse(extractOutputText(responsePayload)) as Partial<
    ForecastInterpretation
  >;

  const interpretation = {
    language,
    headline: parsed.headline ?? fallback.headline,
    summary: parsed.summary ?? fallback.summary,
    toneLine: parsed.toneLine ?? fallback.toneLine,
    keyFactors:
      parsed.keyFactors && parsed.keyFactors.length > 0
        ? parsed.keyFactors.map((f) => ({
            label: f.label ?? "Model signal",
            team: typeof f.team === "string" ? f.team : undefined,
            explanation: cleanExplanation(f.explanation),
          }))
        : fallback.keyFactors,
    missingDataNotes: parsed.missingDataNotes ?? fallback.missingDataNotes,
    disclaimer,
  };

  return enforceModelForecastAlignment(
    interpretation,
    fallback,
    officialModelCall,
  );
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

function createOfficialModelCall(match: MatchSummary): OfficialModelCall {
  const projectedScores = parseProjectedScores(match.forecast.projected);
  const primaryScore = parsePrimaryProjectedScore(match.forecast.projected);
  const pick = primaryScore
    ? getScoreSide(primaryScore.home, primaryScore.away)
    : getForecastSide(match);
  const projectedScore = projectedScores[0] ?? match.forecast.projected;

  return {
    pick,
    pickLabel: sideLabel(match, pick),
    projectedScore,
    projectedScores: projectedScores.length > 0 ? projectedScores : [projectedScore],
    probabilities: {
      home: match.forecast.home,
      draw: match.forecast.draw,
      away: match.forecast.away,
    },
    confidence: match.forecast.confidence,
    chaos: match.forecast.chaos,
  };
}

function enforceModelForecastAlignment(
  interpretation: ForecastInterpretation,
  fallback: ForecastInterpretation,
  officialModelCall: OfficialModelCall,
) {
  const text = [
    interpretation.headline,
    interpretation.summary,
    interpretation.toneLine,
    ...interpretation.keyFactors.map((factor) => factor.explanation),
  ].join(" ");
  const mentionedScores = text.match(/\b\d+\s*[-–]\s*\d+\b/g) ?? [];
  const allowedScores = new Set(
    officialModelCall.projectedScores.map((score) => normalizeScoreline(score)),
  );
  const hasWrongScore = mentionedScores.some(
    (score) => !allowedScores.has(normalizeScoreline(score)),
  );

  return hasWrongScore ? fallback : interpretation;
}

function getForecastSide(match: MatchSummary): ForecastSide {
  return [
    { side: "home" as const, value: match.forecast.home },
    { side: "draw" as const, value: match.forecast.draw },
    { side: "away" as const, value: match.forecast.away },
  ].sort((left, right) => right.value - left.value)[0].side;
}

function sideLabel(match: MatchSummary, side: ForecastSide) {
  if (side === "home") {
    return match.home.code;
  }

  if (side === "away") {
    return match.away.code;
  }

  return "DRAW";
}

function getScoreSide(home: number, away: number): ForecastSide {
  if (home > away) {
    return "home";
  }

  if (away > home) {
    return "away";
  }

  return "draw";
}

function parseScoreline(value?: string) {
  const match = value?.match(/(\d+)\s*[-–]\s*(\d+)/);

  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

function parseProjectedScores(value: string) {
  return value
    .split(/[\/|,]/)
    .map((part) => parseScoreline(part.trim()))
    .filter((score): score is { home: number; away: number } => Boolean(score))
    .map((score) => `${score.home}-${score.away}`);
}

function parsePrimaryProjectedScore(value: string) {
  for (const part of value.split(/[\/|,]/)) {
    const score = parseScoreline(part.trim());

    if (score) {
      return score;
    }
  }

  return null;
}

function normalizeScoreline(value: string) {
  return value.replace(/\s/g, "").replace(/–/g, "-");
}
