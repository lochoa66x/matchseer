import type { MarketPulseUpdate } from "../database";

export type MarketPulseTarget = {
  matchId: string;
  startsAt?: string | null;
  home: {
    name: string;
    code: string;
  };
  away: {
    name: string;
    code: string;
  };
};

type GammaMarket = {
  id?: unknown;
  slug?: unknown;
  question?: unknown;
  description?: unknown;
  outcomes?: unknown;
  outcomePrices?: unknown;
  volume?: unknown;
  volumeNum?: unknown;
  liquidity?: unknown;
  liquidityNum?: unknown;
  closed?: unknown;
  active?: unknown;
};

type GammaEvent = {
  id?: unknown;
  slug?: unknown;
  title?: unknown;
  closed?: unknown;
  markets?: unknown;
};

export type PolymarketPulseSnapshot = {
  source: "polymarket";
  fetchedAt: string;
  targets: number;
  marketsScanned: number;
  updates: MarketPulseUpdate[];
};

// Polymarket models a single match as an EVENT (e.g. "Netherlands vs. Japan")
// containing three separate yes/no markets:
//   "Will {home} win on {date}?"  -> Yes/No
//   "Will {home} vs. {away} end in a draw?" -> Yes/No
//   "Will {away} win on {date}?"  -> Yes/No
// We look up each match's event via the public-search endpoint, then read the
// "Yes" price from each of those three markets to build the home/draw/away pulse.
const POLYMARKET_SEARCH_URL =
  process.env.POLYMARKET_SEARCH_URL ??
  "https://gamma-api.polymarket.com/public-search";

// How many target matches to look up at once (each is one search request).
const SEARCH_CONCURRENCY = Number(process.env.POLYMARKET_SEARCH_CONCURRENCY ?? "5");

// Skip emitting a pulse when a match's markets have essentially no money behind
// them — those prices are placeholders, not real crowd sentiment. Tunable.
const MIN_MARKET_SIGNAL = Number(process.env.POLYMARKET_MIN_SIGNAL ?? "1");

const FETCH_TIMEOUT_MS = Number(process.env.POLYMARKET_FETCH_TIMEOUT_MS ?? "8000");

export async function fetchPolymarketPulseSnapshot(
  targets: MarketPulseTarget[],
): Promise<PolymarketPulseSnapshot> {
  const fetchedAt = new Date().toISOString();
  const updates: MarketPulseUpdate[] = [];
  let marketsScanned = 0;

  const concurrency = Number.isFinite(SEARCH_CONCURRENCY)
    ? Math.max(1, Math.min(10, Math.floor(SEARCH_CONCURRENCY)))
    : 5;

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (target) => {
        try {
          const event = await findMatchEvent(target);

          if (!event) {
            return { update: null, scanned: 0 };
          }

          const markets = parseArrayField(event.markets) as GammaMarket[];

          return {
            update: eventToPulse(event, markets, target, fetchedAt),
            scanned: markets.length,
          };
        } catch {
          return { update: null, scanned: 0 };
        }
      }),
    );

    for (const result of results) {
      marketsScanned += result.scanned;

      if (result.update) {
        updates.push(result.update);
      }
    }
  }

  return {
    source: "polymarket",
    fetchedAt,
    targets: targets.length,
    marketsScanned,
    updates,
  };
}

async function findMatchEvent(
  target: MarketPulseTarget,
): Promise<GammaEvent | null> {
  const query = `${target.home.name} ${target.away.name}`.trim();
  const url = new URL(POLYMARKET_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit_per_type", "20");

  const payload = await fetchJson(url);
  const events = extractEvents(payload);

  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);

  const candidates = events.filter((event) => {
    if (event.closed === true) {
      return false;
    }

    const text = normalizeText(event.title);
    const hasHome = homeAliases.some((alias) => text.includes(alias));
    const hasAway = awayAliases.some((alias) => text.includes(alias));

    return hasHome && hasAway;
  });

  // Prefer an explicit "X vs Y" match event over anything else.
  const versus = candidates.find((event) =>
    /\bvs\b|\bv\b/.test(normalizeText(event.title)),
  );

  return versus ?? candidates[0] ?? null;
}

function eventToPulse(
  event: GammaEvent,
  markets: GammaMarket[],
  target: MarketPulseTarget,
  fetchedAt: string,
): MarketPulseUpdate | null {
  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);

  let homeMarket: GammaMarket | null = null;
  let drawMarket: GammaMarket | null = null;
  let awayMarket: GammaMarket | null = null;

  for (const market of markets) {
    if (market.closed === true || market.active === false) {
      continue;
    }

    const text = normalizeText(market.question);
    const isDraw = text.includes("draw") || text.includes("tie");

    if (isDraw) {
      drawMarket = drawMarket ?? market;
      continue;
    }

    if (!text.includes("win")) {
      continue;
    }

    if (homeAliases.some((alias) => text.includes(alias))) {
      homeMarket = homeMarket ?? market;
    } else if (awayAliases.some((alias) => text.includes(alias))) {
      awayMarket = awayMarket ?? market;
    }
  }

  if (!homeMarket || !drawMarket || !awayMarket) {
    return null;
  }

  const home = yesPrice(homeMarket);
  const draw = yesPrice(drawMarket);
  const away = yesPrice(awayMarket);

  if (home === null || draw === null || away === null) {
    return null;
  }

  if (home + draw + away <= 0) {
    return null;
  }

  // Reject degenerate / placeholder pricing. No real football 1X2 market puts a
  // single outcome (least of all a draw) at ~100%; values like 0.9995 / 0.0005
  // are pre-trading defaults, not crowd sentiment.
  if (Math.max(home, draw, away) >= 0.95) {
    return null;
  }

  const liquidity = sumNumbers(
    [homeMarket, drawMarket, awayMarket].map(
      (market) => readNumber(market.liquidityNum) ?? readNumber(market.liquidity),
    ),
  );
  const volume = sumNumbers(
    [homeMarket, drawMarket, awayMarket].map(
      (market) => readNumber(market.volumeNum) ?? readNumber(market.volume),
    ),
  );

  // Guard against placeholder/empty markets that carry no real money — emitting
  // those would show a meaningless "crowd signal". Let real volume drive it.
  if (Math.max(liquidity ?? 0, volume ?? 0) < MIN_MARKET_SIGNAL) {
    return null;
  }

  return {
    matchId: target.matchId,
    source: "polymarket",
    home,
    draw,
    away,
    liquidity,
    volume,
    capturedAt: fetchedAt,
    marketId: readString(event.id),
    marketSlug: readString(event.slug),
    question: readString(event.title),
  };
}

async function fetchJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 },
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Polymarket search failed (${response.status}).`);
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function extractEvents(payload: unknown): GammaEvent[] {
  if (Array.isArray(payload)) {
    return payload as GammaEvent[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.events)) {
      return record.events as GammaEvent[];
    }

    if (Array.isArray(record.data)) {
      return record.data as GammaEvent[];
    }
  }

  return [];
}

function yesPrice(market: GammaMarket): number | null {
  const outcomes = parseArrayField(market.outcomes).map((value) =>
    normalizeText(value),
  );
  const prices = parseArrayField(market.outcomePrices).map(readPrice);

  if (outcomes.length === 0 || prices.length < outcomes.length) {
    return null;
  }

  const yesIndex = outcomes.findIndex((outcome) => outcome === "yes");

  if (yesIndex === -1) {
    return null;
  }

  return prices[yesIndex];
}

function teamAliases(team: MarketPulseTarget["home"]) {
  const aliases = [team.name, team.code];
  const normalizedName = normalizeText(team.name);

  if (normalizedName === "usa") {
    aliases.push("united states");
  }

  if (normalizedName === "curacao") {
    aliases.push("curacao", "curaçao");
  }

  if (normalizedName === "cote d ivoire" || normalizedName === "ivory coast") {
    aliases.push("ivory coast", "cote d ivoire", "cote divoire");
  }

  if (normalizedName === "korea republic") {
    aliases.push("south korea", "korea");
  }

  return aliases.map(normalizeText).filter(Boolean);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseArrayField(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPrice(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function readNumber(value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function sumNumbers(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);

  if (present.length === 0) {
    return null;
  }

  return present.reduce((sum, value) => sum + value, 0);
}

function readString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}
