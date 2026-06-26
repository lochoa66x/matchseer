import { NextResponse } from "next/server";
import {
  hasRestrictedBettingLanguage,
  hasRestrictedToneLanguage,
  restrictedBettingTerms,
  restrictedToneTerms,
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

type SafetyIssue = "betting-language" | "tone-language";

type RepairContext = {
  blockedInterpretation: ForecastInterpretation;
  safetyIssue: SafetyIssue;
};

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

  if (isPendingMatchRead(match)) {
    const interpretation = createPendingMatchInterpretation(match, language);

    await recordAiRequestAudit({
      matchId: match.id,
      model,
      requestPayload: {
        matchId: match.id,
        language,
        reason: "pending-teams",
      },
      responsePayload: null,
      status: "blocked-pending-teams",
    });

    return NextResponse.json(
      {
        error: "Teams are not confirmed yet.",
        reason: "pending-teams",
        interpretation,
      },
      { status: 409 },
    );
  }

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
    const safetyIssue = getInterpretationSafetyIssue(interpretation);

    if (safetyIssue) {
      await recordAiRequestAudit({
        matchId: match.id,
        model,
        requestPayload: openAiRequest,
        responsePayload,
        status: `blocked-${safetyIssue}`,
      });

      const repaired = await requestRepairedInterpretation({
        fallback,
        language,
        match,
        model,
        officialModelCall,
        safetyIssue,
        blockedInterpretation: interpretation,
      });

      if (repaired) {
        const saved = await saveForecastInterpretation({
          matchId: match.id,
          interpretation: repaired.interpretation,
        });

        return NextResponse.json({
          source: "openai",
          reason: `rewritten-${safetyIssue}`,
          model,
          audited: repaired.audited,
          saved,
          interpretation: repaired.interpretation,
        });
      }

      await saveForecastInterpretation({
        matchId: match.id,
        interpretation: fallback,
      });

      return NextResponse.json({
        source: "seeded-fallback",
        reason: `blocked-${safetyIssue}`,
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

function isPendingMatchRead(match: MatchSummary) {
  return (
    Boolean(match.forecast.isPending) ||
    Boolean(match.home.isPlaceholder) ||
    Boolean(match.away.isPlaceholder)
  );
}

function createPendingMatchInterpretation(
  match: MatchSummary,
  language: Language,
): ForecastInterpretation {
  const copy = {
    en: {
      headline: `${match.home.name} vs ${match.away.name}`,
      summary:
        "The next-round slot is on the board, but the Seer waits for confirmed teams before opening the lens.",
      toneLine: "No forecast is minted until the matchup is real.",
      forecastLabel: "Round slot",
      forecastFactor: `${match.group} is synced, with teams still pending.`,
      shapeLabel: "Teams pending",
      shapeFactor: "MatchSeer will generate the read once both sides are confirmed.",
      contextLabel: "Signal status",
      contextFactor: "Fixture timing and venue can appear before the matchup is known.",
      missingDataNote: "Teams are not confirmed yet.",
    },
    es: {
      headline: `${match.home.name} vs ${match.away.name}`,
      summary:
        "La plaza de la siguiente ronda ya está en el tablero, pero el Vidente espera equipos confirmados antes de abrir la lente.",
      toneLine: "No se crea pronóstico hasta que el cruce sea real.",
      forecastLabel: "Plaza de ronda",
      forecastFactor: `${match.group} está sincronizada, con equipos pendientes.`,
      shapeLabel: "Equipos pendientes",
      shapeFactor: "MatchSeer generará la lectura cuando ambos lados estén confirmados.",
      contextLabel: "Estado de señal",
      contextFactor: "Horario y sede pueden aparecer antes de conocer el cruce.",
      missingDataNote: "Los equipos aún no están confirmados.",
    },
    fr: {
      headline: `${match.home.name} vs ${match.away.name}`,
      summary:
        "La place du prochain tour est au tableau, mais le voyant attend les équipes confirmées avant d'ouvrir la lentille.",
      toneLine: "Aucune prévision n'est créée tant que l'affiche n'est pas réelle.",
      forecastLabel: "Place de tour",
      forecastFactor: `${match.group} est synchronisé, avec les équipes encore en attente.`,
      shapeLabel: "Équipes en attente",
      shapeFactor: "MatchSeer générera la lecture quand les deux côtés seront confirmés.",
      contextLabel: "État du signal",
      contextFactor: "L'horaire et le stade peuvent apparaître avant que l'affiche soit connue.",
      missingDataNote: "Les équipes ne sont pas encore confirmées.",
    },
  } satisfies Record<Language, Record<string, string>>;
  const text = copy[language];

  return {
    language,
    headline: text.headline,
    summary: text.summary,
    toneLine: text.toneLine,
    keyFactors: [
      {
        label: text.forecastLabel,
        explanation: text.forecastFactor,
      },
      {
        label: text.shapeLabel,
        explanation: text.shapeFactor,
      },
      {
        label: text.contextLabel,
        explanation: text.contextFactor,
      },
    ],
    missingDataNotes: [text.missingDataNote],
    disclaimer,
  };
}

async function requestRepairedInterpretation({
  blockedInterpretation,
  fallback,
  language,
  match,
  model,
  officialModelCall,
  safetyIssue,
}: {
  blockedInterpretation: ForecastInterpretation;
  fallback: ForecastInterpretation;
  language: Language;
  match: MatchSummary;
  model: string;
  officialModelCall: OfficialModelCall;
  safetyIssue: SafetyIssue;
}) {
  const repairRequest = createOpenAiRequest(
    match,
    language,
    model,
    officialModelCall,
    {
      blockedInterpretation,
      safetyIssue,
    },
  );

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(repairRequest),
    });

    const responsePayload = (await response.json()) as unknown;

    if (!response.ok) {
      await recordAiRequestAudit({
        matchId: match.id,
        model,
        requestPayload: repairRequest,
        responsePayload,
        status: `repair-openai-error-${safetyIssue}`,
      });

      return null;
    }

    const interpretation = parseOpenAiInterpretation(
      responsePayload,
      language,
      fallback,
      officialModelCall,
    );
    const repairSafetyIssue = getInterpretationSafetyIssue(interpretation);

    if (repairSafetyIssue) {
      await recordAiRequestAudit({
        matchId: match.id,
        model,
        requestPayload: repairRequest,
        responsePayload,
        status: `repair-blocked-${repairSafetyIssue}`,
      });

      return null;
    }

    const audited = await recordAiRequestAudit({
      matchId: match.id,
      model,
      requestPayload: repairRequest,
      responsePayload,
      status: `repaired-${safetyIssue}`,
    });

    return {
      audited,
      interpretation,
    };
  } catch (error) {
    await recordAiRequestAudit({
      matchId: match.id,
      model,
      requestPayload: repairRequest,
      responsePayload: {
        error: error instanceof Error ? error.message : "Unknown OpenAI error",
      },
      status: `repair-request-failed-${safetyIssue}`,
    });

    return null;
  }
}

function createFallbackInterpretation(
  match: MatchSummary,
  language: Language,
  usingDatabase: boolean,
  officialModelCall: OfficialModelCall,
): ForecastInterpretation {
  const context =
    match.forecast.reasons[language]?.[0] ?? match.forecast.tone[language];
  const favoriteName =
    officialModelCall.pick === "home"
      ? match.home.name
      : officialModelCall.pick === "away"
        ? match.away.name
        : null;
  const fallbackCopy = createSeerFallbackCopy({
    context: cleanExplanation(context),
    favoriteName,
    language,
    match,
    officialModelCall,
    usingDatabase,
  });

  return {
    language,
    headline: fallbackCopy.headline,
    summary: fallbackCopy.summary,
    toneLine: fallbackCopy.toneLine,
    keyFactors: [
      {
        label: fallbackCopy.forecastLabel,
        explanation: fallbackCopy.forecastFactor,
      },
      {
        label: fallbackCopy.shapeLabel,
        explanation: fallbackCopy.shapeFactor,
      },
      {
        label: fallbackCopy.contextLabel,
        explanation: fallbackCopy.contextFactor,
      },
    ],
    missingDataNotes: [fallbackCopy.missingDataNote],
    disclaimer,
  };
}

function createSeerFallbackCopy({
  context,
  favoriteName,
  language,
  match,
  officialModelCall,
  usingDatabase,
}: {
  context: string;
  favoriteName: string | null;
  language: Language;
  match: MatchSummary;
  officialModelCall: OfficialModelCall;
  usingDatabase: boolean;
}) {
  const score = officialModelCall.projectedScore;
  const home = officialModelCall.probabilities.home;
  const draw = officialModelCall.probabilities.draw;
  const away = officialModelCall.probabilities.away;

  if (language === "es") {
    return {
      headline: `${match.home.name} contra ${match.away.name}`,
      summary: favoriteName
        ? `El Vidente ve a ${favoriteName} con el filo más claro, pero no como paseo: el rastro marca ${score} y pide cuidar cada rebote. ${context}`
        : `El Vidente no encuentra dueño claro todavía: el rastro apunta a ${score}, con el partido caminando sobre una cuerda tensa. ${context}`,
      toneLine: `La lectura sigue el sendero ${score}: fútbol de margen corto, un giro y el guion cambia.`,
      forecastLabel: "Rastro del Vidente",
      forecastFactor: favoriteName
        ? `${favoriteName} aparece delante en la lectura guardada, con ${officialModelCall.confidence}% de confianza.`
        : `La lectura guardada deja el empate como carril principal, con ${officialModelCall.confidence}% de confianza.`,
      shapeLabel: "Pulso del partido",
      shapeFactor: `El mapa queda en ${home}% local, ${draw}% empate y ${away}% visitante.`,
      contextLabel: "La pista",
      contextFactor: context,
      missingDataNote: usingDatabase
        ? "Lectura segura desde el pronóstico guardado de MatchSeer."
        : "Faltan datos en vivo para completar la lectura.",
    };
  }

  if (language === "fr") {
    return {
      headline: `${match.home.name} contre ${match.away.name}`,
      summary: favoriteName
        ? `Le voyant voit ${favoriteName} avec le tranchant le plus net, mais pas une promenade : la trace indique ${score} et chaque rebond compte. ${context}`
        : `Le voyant ne donne pas encore les clés du match : la trace pointe vers ${score}, sur un fil très serré. ${context}`,
      toneLine: `La lecture suit le chemin ${score} : marge courte, un détail, et le script bouge.`,
      forecastLabel: "Trace du voyant",
      forecastFactor: favoriteName
        ? `${favoriteName} ressort devant dans la lecture gardée, avec ${officialModelCall.confidence} % de confiance.`
        : `La lecture gardée laisse le nul comme couloir principal, avec ${officialModelCall.confidence} % de confiance.`,
      shapeLabel: "Pouls du match",
      shapeFactor: `La carte affiche ${home} % domicile, ${draw} % nul et ${away} % extérieur.`,
      contextLabel: "L'indice",
      contextFactor: context,
      missingDataNote: usingDatabase
        ? "Lecture sûre depuis la prévision MatchSeer enregistrée."
        : "Les données en direct manquent pour compléter la lecture.",
    };
  }

  return {
    headline: `${match.home.name} vs ${match.away.name}`,
    summary: favoriteName
      ? `The Seer sees ${favoriteName} carrying the sharper blade, but not a clean walk: the trail points to ${score}, with every loose bounce still mattering. ${context}`
      : `The Seer does not see a clean owner yet: the trail bends toward ${score}, a tightrope match where one strange bounce can write the story. ${context}`,
    toneLine: `The Seer follows the ${score} trail: short margins, live nerves, and one moment ready to tilt the room.`,
    forecastLabel: "Seer trail",
    forecastFactor: favoriteName
      ? `${favoriteName} sits ahead on the stored read, with ${officialModelCall.confidence}% confidence.`
      : `The stored read keeps the draw lane alive, with ${officialModelCall.confidence}% confidence.`,
    shapeLabel: "Match pulse",
    shapeFactor: `The board leans ${home}% home, ${draw}% draw, and ${away}% away.`,
    contextLabel: "The clue",
    contextFactor: context,
    missingDataNote: usingDatabase
      ? "Safe read from the stored MatchSeer forecast."
      : "Live forecast data is unavailable for this match.",
  };
}

function createOpenAiRequest(
  match: MatchSummary,
  language: Language,
  model: string,
  officialModelCall: OfficialModelCall,
  repairContext?: RepairContext,
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
              "You are the Seer: a mystical, playful football oracle who reads a match like omens, not a spreadsheet. Speak in vivid, sensory, theatrical language — the pitch, the night, the weather, momentum, the trail you follow. Keep the app's stored forecast exactly as given (the winner/draw direction, projected score, probabilities, confidence, and chaos); never invent your own prediction, winner, scoreline, probability, certainty, or guarantee. Do NOT sound like a match preview, analyst note, or data report: avoid stiff analyst tics such as 'however', 'that said', 'on paper', 'statistically', 'the data suggests', 'expected', 'overall', and 'in conclusion'. The summary must not use the phrases 'official model', 'stored forecast', 'public call', or 'probabilities', and must not state raw percentages, confidence numbers, or chaos numbers — translate those into feeling and imagery instead. It may name the projected score once. Lead with match imagery, tactical texture, venue/weather mood, or the Seer's trail. Keep it concise, punchy, and fun. If marketPulse appears in context, treat it only as crowd signal or public sentiment that colours the confidence/chaos mood, never as the match forecast itself, and never name Polymarket. Never write betting advice, odds language, wagers, picks, locks, parlays, lines, sure things, value bets, bookmaker, sportsbook-style copy, make-money copy, or trading links. Never use national stereotypes, cultural costumes, cultural props, ethnicity jokes, or caricatures. If a previous draft is provided for repair, rewrite it into lively but neutral language while preserving the stored forecast.",
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
                headline:
                  "Use the teams or a short match title. No percentages in the headline.",
                summary:
                  "One or two vivid sentences explaining why the stored forecast could happen. Start with the Seer, a match image, tactical pressure, weather, or venue. Do not use the phrases 'official model', 'stored forecast', 'public call', or 'probabilities'. Do not include raw percentages, confidence numbers, or chaos numbers in the summary. The projected score may appear once. Do not predict a different outcome.",
                toneLine:
                  "One playful sentence that matches the stored forecast exactly. Do not use cultural stereotypes or cultural props.",
                keyFactors:
                  "Three factors max. Keep labels short and fan-friendly, such as Sharp edge, Midfield glue, Weather bite, Set-piece door, or Chaos lever.",
                disclaimer,
              },
              repair: repairContext
                ? {
                    safetyIssue: repairContext.safetyIssue,
                    previousDraft: repairContext.blockedInterpretation,
                    instruction:
                      "Rewrite the previous draft so it remains vivid fan analysis but avoids the blocked language category. Keep the same stored forecast, avoid stiff phrasing, and return a clean JSON object.",
                    avoidTerms:
                      repairContext.safetyIssue === "betting-language"
                        ? restrictedBettingTerms
                        : restrictedToneTerms,
                  }
                : null,
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

function getInterpretationSafetyIssue(
  interpretation: ForecastInterpretation,
): SafetyIssue | null {
  const serialized = JSON.stringify(interpretation);

  if (hasRestrictedBettingLanguage(serialized.replace(disclaimer, ""))) {
    return "betting-language";
  }

  if (hasRestrictedToneLanguage(serialized)) {
    return "tone-language";
  }

  return null;
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
