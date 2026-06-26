import { NextResponse } from "next/server";
import {
  hasRestrictedBettingLanguage,
  hasRestrictedToneLanguage,
} from "../../../../lib/domain";

export const dynamic = "force-dynamic";

const disclaimer =
  "Not affiliated with or endorsed by the NFL, NFLPA, or any team. For entertainment and analysis only. No betting advice.";

type ScoringFormat = "standard" | "halfPpr" | "fullPpr";

type ScoutingPlayer = {
  name: string;
  team: string;
  position: string;
  opponent: string;
  projection: number;
  floor: number;
  ceiling: number;
  baselineRank: number;
  seerRank: number;
  sourceRank?: number;
  positionRank?: number;
  roleSecurity?: number;
  dynastyValue?: number;
  depthTier?: string;
  traits: string[];
};

type NflScoutingRequest = {
  depth?: string;
  positionLane?: string;
  scoringFormat: ScoringFormat;
  players: ScoutingPlayer[];
};

type NflScoutingAnalysis = {
  headline: string;
  summary: string;
  factors: string[];
  watchlist: string;
  disclaimer: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<NflScoutingRequest>;

  if (!isScoringFormat(body.scoringFormat) || !Array.isArray(body.players)) {
    return NextResponse.json(
      { error: "scoringFormat and players are required" },
      { status: 400 },
    );
  }

  const players = body.players.slice(0, 12).filter(isScoutingPlayer);

  if (players.length === 0) {
    return NextResponse.json(
      { error: "At least one player is required" },
      { status: 400 },
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const fallback = createFallbackAnalysis(body.scoringFormat, players);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      source: "seeded-fallback",
      reason: "missing-openai-api-key",
      model,
      analysis: fallback,
    });
  }

  const openAiRequest = createOpenAiRequest({
    depth: cleanLine(body.depth),
    model,
    players,
    positionLane: cleanLine(body.positionLane),
    scoringFormat: body.scoringFormat,
  });

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
      return NextResponse.json({
        source: "seeded-fallback",
        reason: "openai-error",
        model,
        analysis: fallback,
      });
    }

    const analysis = parseOpenAiAnalysis(responsePayload, fallback);

    if (hasUnsafeLanguage(analysis)) {
      return NextResponse.json({
        source: "seeded-fallback",
        reason: "blocked-language",
        model,
        analysis: fallback,
      });
    }

    return NextResponse.json({
      source: "openai",
      model,
      analysis,
    });
  } catch {
    return NextResponse.json({
      source: "seeded-fallback",
      reason: "request-failed",
      model,
      analysis: fallback,
    });
  }
}

function createOpenAiRequest({
  depth,
  model,
  players,
  positionLane,
  scoringFormat,
}: {
  depth: string;
  model: string;
  players: ScoutingPlayer[];
  positionLane: string;
  scoringFormat: ScoringFormat;
}) {
  return {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are MatchSeer's pro football fantasy scout: playful, sharp, and practical. MatchSeer is independent and not affiliated with or endorsed by the NFL, NFLPA, or any team. Use real team and player names only as reference points. Use the provided algorithmic projections exactly as inputs; do not invent new projections, rankings, injuries, teams, opponents, or live news. Explain why the ranking board moves in vivid Seer language without sounding stiff. No betting advice, no odds language, no wagers, no locks, no make-money copy, and no trading links. Keep it useful for fantasy football start/sit and scouting decisions.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              scoringFormat,
              players,
              depth,
              positionLane,
              outputRules: {
                headline: "Short title for the scouting board.",
                summary:
                  "Two concise, fun sentences explaining the strongest fantasy signal on this board.",
                factors:
                  "Three short bullets max. Mention role, scoring format, matchup, floor, ceiling, or chaos.",
                watchlist:
                  "One sentence naming the player who deserves extra scouting attention and why.",
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
        name: "matchseer_nfl_scouting",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["headline", "summary", "factors", "watchlist", "disclaimer"],
          properties: {
            headline: { type: "string" },
            summary: { type: "string" },
            factors: {
              type: "array",
              maxItems: 3,
              items: { type: "string" },
            },
            watchlist: { type: "string" },
            disclaimer: { type: "string" },
          },
        },
      },
    },
  };
}

function createFallbackAnalysis(
  scoringFormat: ScoringFormat,
  players: ScoutingPlayer[],
): NflScoutingAnalysis {
  const top = players[0];
  const riser =
    players.find((player) => player.baselineRank > player.seerRank) ?? top;
  const roleAnchor =
    [...players].sort(
      (left, right) => (right.roleSecurity ?? 0) - (left.roleSecurity ?? 0),
    )[0] ?? top;
  const label = scoringFormatLabel(scoringFormat);

  return {
    headline: `${label} scouting trail`,
    summary: `${top.name} sits at the front of the Seer board because the projection and range both keep the lantern bright. ${riser.name} gets the biggest nudge when role, matchup, and format all start humming together.`,
    factors: [
      `${label} scoring is baked into every projection.`,
      `Floor, ceiling, and role security decide the lane before the vibes get loud.`,
      `${roleAnchor.name} has the cleanest role-security read in this slice.`,
    ],
    watchlist: `${riser.name} deserves the next deeper look: the Seer has him ahead of the baseline shape.`,
    disclaimer,
  };
}

function parseOpenAiAnalysis(
  responsePayload: unknown,
  fallback: NflScoutingAnalysis,
): NflScoutingAnalysis {
  const parsed = JSON.parse(extractOutputText(responsePayload)) as Partial<
    NflScoutingAnalysis
  >;

  return {
    headline: cleanLine(parsed.headline) || fallback.headline,
    summary: cleanLine(parsed.summary) || fallback.summary,
    factors:
      parsed.factors && parsed.factors.length > 0
        ? parsed.factors.slice(0, 3).map(cleanLine).filter(Boolean)
        : fallback.factors,
    watchlist: cleanLine(parsed.watchlist) || fallback.watchlist,
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

function hasUnsafeLanguage(analysis: NflScoutingAnalysis) {
  const serialized = JSON.stringify(analysis);

  return (
    hasRestrictedBettingLanguage(serialized.replace(disclaimer, "")) ||
    hasRestrictedToneLanguage(serialized)
  );
}

function isScoringFormat(value: unknown): value is ScoringFormat {
  return value === "standard" || value === "halfPpr" || value === "fullPpr";
}

function isScoutingPlayer(value: unknown): value is ScoutingPlayer {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const player = value as Partial<ScoutingPlayer>;

  return (
    typeof player.name === "string" &&
    typeof player.team === "string" &&
    typeof player.position === "string" &&
    typeof player.opponent === "string" &&
    typeof player.projection === "number" &&
    typeof player.floor === "number" &&
    typeof player.ceiling === "number" &&
    typeof player.baselineRank === "number" &&
    typeof player.seerRank === "number" &&
    Array.isArray(player.traits)
  );
}

function scoringFormatLabel(scoringFormat: ScoringFormat) {
  if (scoringFormat === "standard") {
    return "Standard";
  }

  if (scoringFormat === "halfPpr") {
    return "Half PPR";
  }

  return "Full PPR";
}

function cleanLine(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
