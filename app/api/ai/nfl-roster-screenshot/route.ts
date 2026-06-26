import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RosterScreenshotRequest = {
  imageDataUrl: string;
};

type RosterScreenshotResponse = {
  rosterText: string;
  notes: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<RosterScreenshotRequest>;
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!imageDataUrl.startsWith("data:image/") || imageDataUrl.length < 200) {
    return NextResponse.json(
      { error: "Upload a fantasy roster screenshot image." },
      { status: 400 },
    );
  }

  if (imageDataUrl.length > 6_500_000) {
    return NextResponse.json(
      { error: "That screenshot is too large. Try a smaller crop of the rosters." },
      { status: 413 },
    );
  }

  const model = process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Screenshot extraction needs OPENAI_API_KEY. Paste the roster text for now.",
        source: "manual-fallback",
        model,
      },
      { status: 501 },
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createOpenAiRequest({ imageDataUrl, model })),
    });
    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "The screenshot could not be read. Paste the rosters and try again.",
          source: "manual-fallback",
          model,
        },
        { status: 502 },
      );
    }

    const parsed = parseRosterScreenshot(payload);

    return NextResponse.json({
      source: "openai",
      model,
      rosterText: parsed.rosterText,
      notes: parsed.notes,
    });
  } catch {
    return NextResponse.json(
      {
        error: "The screenshot reader had a hiccup. Paste the rosters and try again.",
        source: "manual-fallback",
        model,
      },
      { status: 502 },
    );
  }
}

function createOpenAiRequest({
  imageDataUrl,
  model,
}: {
  imageDataUrl: string;
  model: string;
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
              "You extract fantasy football rosters from screenshots. Return only names, positions, teams, and visible projections. Do not invent players, teams, injuries, projections, or fantasy advice. If the screenshot has two teams, label them My Team and Opponent. If it only has one team, label it My Team. Keep output safe, neutral, and fantasy-only.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Read this fantasy football screenshot and produce clean roster text that a parser can ingest.",
          },
          {
            type: "input_image",
            image_url: imageDataUrl,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "matchseer_fantasy_roster_screenshot",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["rosterText", "notes"],
          properties: {
            rosterText: {
              type: "string",
              description:
                "Roster text with headings like My Team: and Opponent:, one player per line.",
            },
            notes: {
              type: "array",
              maxItems: 3,
              items: { type: "string" },
            },
          },
        },
      },
    },
  };
}

function parseRosterScreenshot(payload: unknown): RosterScreenshotResponse {
  const parsed = JSON.parse(extractOutputText(payload)) as Partial<
    RosterScreenshotResponse
  >;
  const rosterText =
    typeof parsed.rosterText === "string" ? parsed.rosterText.trim() : "";

  if (!rosterText) {
    return {
      rosterText: "My Team:\n",
      notes: ["No usable roster text was visible in the screenshot."],
    };
  }

  return {
    rosterText,
    notes: Array.isArray(parsed.notes)
      ? parsed.notes.filter((note) => typeof note === "string").slice(0, 3)
      : [],
  };
}

function extractOutputText(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "{}";
  }

  const outputText = (payload as { output_text?: unknown }).output_text;

  if (typeof outputText === "string") {
    return outputText;
  }

  const output = (payload as { output?: unknown }).output;

  if (!Array.isArray(output)) {
    return "{}";
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (typeof part !== "object" || part === null) {
        continue;
      }

      const text = (part as { text?: unknown }).text;

      if (typeof text === "string") {
        return text;
      }
    }
  }

  return "{}";
}
