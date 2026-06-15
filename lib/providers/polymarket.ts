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

export type PulseSkipReason =
  | "usable"
  | "settled"
  | "not-open"
  | "illiquid"
  | "no-market"
  | "no-event";

export type PulseSkipBreakdown = Record<
  Exclude<PulseSkipReason, "usable">,
  number
>;

export type PolymarketPulseSnapshot = {
  source: "polymarket";
  fetchedAt: string;
  targets: number;
  marketsScanned: number;
  updates: MarketPulseUpdate[];
  // Why fixtures produced no usable signal — so the admin can see "5 settled,
  // 1 not open yet" instead of a mysterious "Saved 0".
  skipped: PulseSkipBreakdown;
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

// An open, tradeable market has a live order book (liquidity > 0). Settled or
// not-yet-open markets sit at ~0 liquidity — this tells real crowd odds apart
// from results and placeholders.
const MIN_LIQUIDITY = Number(process.env.POLYMARKET_MIN_LIQUIDITY ?? "1");

// A single 1X2 outcome at/above this is never a real forecast — it's either a
// resolved result (1.0) or a pre-trading placeholder (e.g. 0.9995).
const DEGENERATE_PRICE = Number(process.env.POLYMARKET_DEGENERATE_PRICE ?? "0.95");

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

  const skipped: PulseSkipBreakdown = {
    settled: 0,
    "not-open": 0,
    illiquid: 0,
    "no-market": 0,
    "no-event": 0,
  };

  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (target) => {
        try {
          const event = await findMatchEvent(target);

          if (!event) {
            return { update: null, reason: "no-event" as PulseSkipReason, scanned: 0 };
          }

          const markets = parseArrayField(event.markets) as GammaMarket[];
          const classified = classifyEvent(event, markets, target, fetchedAt);

          return { ...classified, scanned: markets.length };
        } catch {
          return { update: null, reason: "no-event" as PulseSkipReason, scanned: 0 };
        }
      }),
    );

    for (const result of results) {
      marketsScanned += result.scanned;

      if (result.update) {
        updates.push(result.update);
      } else if (result.reason !== "usable") {
        skipped[result.reason] += 1;
      }
    }
  }

  return {
    source: "polymarket",
    fetchedAt,
    targets: targets.length,
    marketsScanned,
    updates,
    skipped,
  };
}

async function findMatchEvent(
  target: MarketPulseTarget,
): Promise<GammaEvent | null> {
  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);

  // Try a few query spellings (e.g. "USA" and "United States") so teams whose
  // common name differs from Polymarket's spelling still surface in search.
  // Normal teams produce exactly one query, so this adds no extra requests for them.
  for (const query of buildSearchQueries(target)) {
    const url = new URL(POLYMARKET_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit_per_type", "20");

    const events = extractEvents(await fetchJson(url));
    const match = pickMatchEvent(events, homeAliases, awayAliases);

    if (match) {
      return match;
    }
  }

  return null;
}

function pickMatchEvent(
  events: GammaEvent[],
  homeAliases: string[],
  awayAliases: string[],
): GammaEvent | null {
  // Note: we no longer drop closed events here — we want to find them and label
  // them "settled" so the admin understands why there's no live signal.
  const candidates = events.filter((event) => {
    const text = normalizeText(event.title);

    return (
      homeAliases.some((alias) => text.includes(alias)) &&
      awayAliases.some((alias) => text.includes(alias))
    );
  });

  // Prefer an explicit "X vs Y" match event over anything else.
  const versus = candidates.find((event) =>
    /\bvs\b|\bv\b/.test(normalizeText(event.title)),
  );

  return versus ?? candidates[0] ?? null;
}

function buildSearchQueries(target: MarketPulseTarget): string[] {
  const homeNames = searchNames(target.home);
  const awayNames = searchNames(target.away);
  const queries: string[] = [];

  for (const home of homeNames) {
    for (const away of awayNames) {
      queries.push(`${home} ${away}`.trim());
    }
  }

  return [...new Set(queries)].slice(0, 4);
}

// Human-readable name spellings to search with (display names, not codes),
// mirroring the alias map used for matching.
function searchNames(team: MarketPulseTarget["home"]): string[] {
  const names = [team.name];
  const normalized = normalizeText(team.name);

  if (normalized === "usa") {
    names.push("United States");
  }

  if (normalized === "curacao") {
    names.push("Curaçao");
  }

  if (normalized === "cote d ivoire" || normalized === "ivory coast") {
    names.push("Ivory Coast");
  }

  if (normalized === "korea republic") {
    names.push("South Korea");
  }

  return [...new Set(names.filter(Boolean))];
}

function classifyEvent(
  event: GammaEvent,
  markets: GammaMarket[],
  target: MarketPulseTarget,
  fetchedAt: string,
): { update: MarketPulseUpdate | null; reason: PulseSkipReason } {
  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);

  let homeMarket: GammaMarket | null = null;
  let drawMarket: GammaMarket | null = null;
  let awayMarket: GammaMarket | null = null;

  // Match all three markets by question text (including closed ones, so we can
  // recognise and label a settled event rather than mislabelling it "no-market").
  for (const market of markets) {
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
    return { update: null, reason: "no-market" };
  }

  const pickMarkets = [homeMarket, drawMarket, awayMarket];
  const home = yesPrice(homeMarket);
  const draw = yesPrice(drawMarket);
  const away = yesPrice(awayMarket);

  if (home === null || draw === null || away === null || home + draw + away <= 0) {
    return { update: null, reason: "no-market" };
  }

  // Resolved / closed: prices are pinned to a result, not a forecast.
  const isClosed =
    event.closed === true || pickMarkets.some((market) => market.closed === true);

  if (isClosed) {
    return { update: null, reason: "settled" };
  }

  // Degenerate pricing (a 1X2 outcome at ~100%) = pre-trading placeholder.
  if (Math.max(home, draw, away) >= DEGENERATE_PRICE) {
    return { update: null, reason: "not-open" };
  }

  const liquidity = sumNumbers(
    pickMarkets.map(
      (market) => readNumber(market.liquidityNum) ?? readNumber(market.liquidity),
    ),
  );
  const volume = sumNumbers(
    pickMarkets.map(
      (market) => readNumber(market.volumeNum) ?? readNumber(market.volume),
    ),
  );

  // No live order book → not actively traded right now (no real crowd to read).
  if ((liquidity ?? 0) < MIN_LIQUIDITY) {
    return { update: null, reason: "illiquid" };
  }

  return {
    update: {
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
    },
    reason: "usable",
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
