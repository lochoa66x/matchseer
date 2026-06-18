import type { MarketPulseUpdate } from "../database";

export type MarketPulseTarget = {
  matchId: string;
  league?: string;
  sport?: string;
  marketShape?: "three-way" | "two-way";
  startsAt?: string | null;
  home: {
    name: string;
    code: string;
    aliases?: string[];
  };
  away: {
    name: string;
    code: string;
    aliases?: string[];
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
  active?: unknown;
  markets?: unknown;
};

export type PulseSkipReason =
  | "usable"
  | "fetch-error"
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

export type PolymarketPulseLookup = {
  source: "polymarket";
  fetchedAt: string;
  target: MarketPulseTarget;
  update: MarketPulseUpdate | null;
  reason: PulseSkipReason;
  marketsScanned: number;
  event: {
    id: string | null;
    slug: string | null;
    title: string | null;
    closed: boolean | null;
    active: boolean | null;
  } | null;
  error?: string;
};

// Polymarket usually models a match as an EVENT (e.g. "Netherlands vs. Japan").
// Depending on the event, the signal can be one outcome market (Home / Draw /
// Away, or Home / Away for no-draw sports) or separate yes/no markets. We
// support both shapes and normalize them into one home/draw/away pulse.
const POLYMARKET_SEARCH_URL =
  process.env.POLYMARKET_SEARCH_URL ??
  "https://gamma-api.polymarket.com/public-search";
const POLYMARKET_EVENTS_URL =
  process.env.POLYMARKET_EVENTS_URL ??
  "https://gamma-api.polymarket.com/events";
const POLYMARKET_WORLD_CUP_GAMES_URL =
  process.env.POLYMARKET_WORLD_CUP_GAMES_URL ??
  "https://polymarket.com/sports/world-cup/games";

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
    "fetch-error": 0,
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
        const lookup = await fetchPolymarketPulseForTarget(target, fetchedAt);

        return {
          update: lookup.update,
          reason: lookup.reason,
          scanned: lookup.marketsScanned,
        };
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

export async function fetchPolymarketPulseForTarget(
  target: MarketPulseTarget,
  fetchedAt = new Date().toISOString(),
): Promise<PolymarketPulseLookup> {
  let primaryLookup: PolymarketPulseLookup | null = null;
  let gammaError: string | null = null;

  try {
    const event = await findMatchEvent(target);

    if (event) {
      const markets = parseArrayField(event.markets) as GammaMarket[];
      const classified = classifyEvent(event, markets, target, fetchedAt);

      primaryLookup = {
        source: "polymarket",
        fetchedAt,
        target,
        update: classified.update,
        reason: classified.reason,
        marketsScanned: markets.length,
        event: {
          id: readString(event.id),
          slug: readString(event.slug),
          title: readString(event.title),
          closed: typeof event.closed === "boolean" ? event.closed : null,
          active: typeof event.active === "boolean" ? event.active : null,
        },
      };

      if (classified.update || classified.reason === "settled") {
        return primaryLookup;
      }
    } else {
      primaryLookup = {
        source: "polymarket",
        fetchedAt,
        target,
        update: null,
        reason: "no-event",
        marketsScanned: 0,
        event: null,
      };
    }
  } catch (error) {
    gammaError =
      error instanceof Error
        ? error.message
        : "Polymarket lookup failed before a usable response was returned.";
  }

  try {
    const pageFallback = await fetchSportsPagePulseForTarget(target, fetchedAt);

    if (pageFallback.update) {
      return {
        source: "polymarket",
        fetchedAt,
        target,
        update: pageFallback.update,
        reason: "usable",
        marketsScanned: (primaryLookup?.marketsScanned ?? 0) + 1,
        event: {
          id: null,
          slug: pageFallback.update.marketSlug ?? "sports-world-cup-games",
          title: pageFallback.update.question ?? `${target.home.name} vs ${target.away.name}`,
          closed: null,
          active: true,
        },
      };
    }

    return (
      primaryLookup ?? {
        source: "polymarket",
        fetchedAt,
        target,
        update: null,
        reason: pageFallback.reason,
        marketsScanned: 0,
        event: null,
      }
    );
  } catch (error) {
    const pageError =
      error instanceof Error
        ? error.message
        : "Polymarket sports page lookup failed.";

    if (primaryLookup && !gammaError) {
      return primaryLookup;
    }

    return {
      source: "polymarket",
      fetchedAt,
      target,
      update: null,
      reason: "fetch-error",
      marketsScanned: primaryLookup?.marketsScanned ?? 0,
      event: null,
      error: [gammaError, pageError].filter(Boolean).join(" · "),
    };
  }
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
    for (const url of buildSearchUrls(query)) {
      const events = extractEvents(await fetchJson(url));
      const match = pickMatchEvent(events, homeAliases, awayAliases);

      if (match) {
        return match;
      }
    }
  }

  return null;
}

function buildSearchUrls(query: string): URL[] {
  const publicSearchUrl = new URL(POLYMARKET_SEARCH_URL);
  publicSearchUrl.searchParams.set("q", query);
  publicSearchUrl.searchParams.set("limit_per_type", "20");

  const eventsUrl = new URL(POLYMARKET_EVENTS_URL);
  eventsUrl.searchParams.set("search", query);
  eventsUrl.searchParams.set("limit", "20");
  eventsUrl.searchParams.set("active", "true");
  eventsUrl.searchParams.set("closed", "false");

  return [publicSearchUrl, eventsUrl];
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

async function fetchSportsPagePulseForTarget(
  target: MarketPulseTarget,
  fetchedAt: string,
): Promise<{ update: MarketPulseUpdate | null; reason: PulseSkipReason }> {
  const text = htmlToReadableText(await fetchText(new URL(POLYMARKET_WORLD_CUP_GAMES_URL)));
  const matchWindow = findSportsPageMatchWindow(text, target);

  if (!matchWindow) {
    return { update: null, reason: "no-event" };
  }

  const home = extractCentsPrice(matchWindow, marketPriceLabels(target.home));
  const draw =
    target.marketShape === "two-way" ? 0 : extractCentsPrice(matchWindow, ["draw"]);
  const away = extractCentsPrice(matchWindow, marketPriceLabels(target.away));

  if (home === null || draw === null || away === null || home + draw + away <= 0) {
    return { update: null, reason: "no-market" };
  }

  if (Math.max(home, draw, away) >= DEGENERATE_PRICE) {
    return { update: null, reason: "not-open" };
  }

  return {
    update: {
      matchId: target.matchId,
      source: "polymarket",
      home,
      draw,
      away,
      liquidityScore: 0.72,
      capturedAt: fetchedAt,
      marketSlug: "sports-world-cup-games",
      question: `${target.home.name} vs ${target.away.name}`,
    },
    reason: "usable",
  };
}

// Human-readable name spellings to search with (display names, not codes),
// mirroring the alias map used for matching.
function searchNames(team: MarketPulseTarget["home"]): string[] {
  const names = [team.name, ...(team.aliases ?? [])];
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
  if (target.marketShape === "two-way") {
    const twoWayPulse = classifyTwoWayMarket(markets, target, fetchedAt);

    if (twoWayPulse.reason !== "no-market") {
      if (event.closed === true && twoWayPulse.update) {
        return { update: null, reason: "settled" };
      }

      if (event.active === false && twoWayPulse.update) {
        return { update: null, reason: "not-open" };
      }

      return twoWayPulse;
    }

    return classifyTwoWayYesNoMarkets(event, markets, target, fetchedAt);
  }

  const threeWayPulse = classifyThreeWayMarket(markets, target, fetchedAt);

  if (threeWayPulse.reason !== "no-market") {
    if (event.closed === true && threeWayPulse.update) {
      return { update: null, reason: "settled" };
    }

    if (event.active === false && threeWayPulse.update) {
      return { update: null, reason: "not-open" };
    }

    return threeWayPulse;
  }

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

  if (event.active === false || pickMarkets.some((market) => market.active === false)) {
    return { update: null, reason: "not-open" };
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

function classifyTwoWayMarket(
  markets: GammaMarket[],
  target: MarketPulseTarget,
  fetchedAt: string,
): { update: MarketPulseUpdate | null; reason: PulseSkipReason } {
  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);

  for (const market of markets) {
    const outcomes = parseArrayField(market.outcomes);
    const prices = parseArrayField(market.outcomePrices).map(readPrice);

    if (outcomes.length < 2 || prices.length < outcomes.length) {
      continue;
    }

    const normalizedOutcomes = outcomes.map(normalizeText);
    const homeIndex = normalizedOutcomes.findIndex((outcome) =>
      homeAliases.some((alias) => outcome.includes(alias)),
    );
    const awayIndex = normalizedOutcomes.findIndex((outcome) =>
      awayAliases.some((alias) => outcome.includes(alias)),
    );

    if (homeIndex === -1 || awayIndex === -1 || homeIndex === awayIndex) {
      continue;
    }

    const home = prices[homeIndex];
    const away = prices[awayIndex];

    if (home === null || away === null || home + away <= 0) {
      continue;
    }

    if (market.closed === true) {
      return { update: null, reason: "settled" };
    }

    if (market.active === false || Math.max(home, away) >= DEGENERATE_PRICE) {
      return { update: null, reason: "not-open" };
    }

    const liquidity = readNumber(market.liquidityNum) ?? readNumber(market.liquidity);
    const volume = readNumber(market.volumeNum) ?? readNumber(market.volume);

    if ((liquidity ?? 0) < MIN_LIQUIDITY) {
      return { update: null, reason: "illiquid" };
    }

    return {
      update: {
        matchId: target.matchId,
        source: "polymarket",
        home,
        draw: 0,
        away,
        liquidity,
        volume,
        capturedAt: fetchedAt,
        marketId: readString(market.id),
        marketSlug: readString(market.slug),
        question: readString(market.question),
      },
      reason: "usable",
    };
  }

  return { update: null, reason: "no-market" };
}

function classifyTwoWayYesNoMarkets(
  event: GammaEvent,
  markets: GammaMarket[],
  target: MarketPulseTarget,
  fetchedAt: string,
): { update: MarketPulseUpdate | null; reason: PulseSkipReason } {
  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);
  let homeMarket: GammaMarket | null = null;
  let awayMarket: GammaMarket | null = null;

  for (const market of markets) {
    const text = normalizeText(market.question);

    if (!text.includes("win")) {
      continue;
    }

    if (homeAliases.some((alias) => text.includes(alias))) {
      homeMarket = homeMarket ?? market;
    } else if (awayAliases.some((alias) => text.includes(alias))) {
      awayMarket = awayMarket ?? market;
    }
  }

  if (!homeMarket || !awayMarket) {
    return { update: null, reason: "no-market" };
  }

  const pickMarkets = [homeMarket, awayMarket];
  const home = yesPrice(homeMarket);
  const away = yesPrice(awayMarket);

  if (home === null || away === null || home + away <= 0) {
    return { update: null, reason: "no-market" };
  }

  if (event.closed === true || pickMarkets.some((market) => market.closed === true)) {
    return { update: null, reason: "settled" };
  }

  if (event.active === false || pickMarkets.some((market) => market.active === false)) {
    return { update: null, reason: "not-open" };
  }

  if (Math.max(home, away) >= DEGENERATE_PRICE) {
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

  if ((liquidity ?? 0) < MIN_LIQUIDITY) {
    return { update: null, reason: "illiquid" };
  }

  return {
    update: {
      matchId: target.matchId,
      source: "polymarket",
      home,
      draw: 0,
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

function classifyThreeWayMarket(
  markets: GammaMarket[],
  target: MarketPulseTarget,
  fetchedAt: string,
): { update: MarketPulseUpdate | null; reason: PulseSkipReason } {
  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);

  for (const market of markets) {
    const outcomes = parseArrayField(market.outcomes);
    const prices = parseArrayField(market.outcomePrices).map(readPrice);

    if (outcomes.length < 3 || prices.length < outcomes.length) {
      continue;
    }

    const normalizedOutcomes = outcomes.map(normalizeText);
    const homeIndex = normalizedOutcomes.findIndex((outcome) =>
      homeAliases.some((alias) => outcome.includes(alias)),
    );
    const drawIndex = normalizedOutcomes.findIndex(
      (outcome) => outcome.includes("draw") || outcome.includes("tie"),
    );
    const awayIndex = normalizedOutcomes.findIndex((outcome) =>
      awayAliases.some((alias) => outcome.includes(alias)),
    );

    if (homeIndex === -1 || drawIndex === -1 || awayIndex === -1) {
      continue;
    }

    const home = prices[homeIndex];
    const draw = prices[drawIndex];
    const away = prices[awayIndex];

    if (home === null || draw === null || away === null || home + draw + away <= 0) {
      continue;
    }

    if (market.closed === true) {
      return { update: null, reason: "settled" };
    }

    if (market.active === false || Math.max(home, draw, away) >= DEGENERATE_PRICE) {
      return { update: null, reason: "not-open" };
    }

    const liquidity = readNumber(market.liquidityNum) ?? readNumber(market.liquidity);
    const volume = readNumber(market.volumeNum) ?? readNumber(market.volume);

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
        marketId: readString(market.id),
        marketSlug: readString(market.slug),
        question: readString(market.question),
      },
      reason: "usable",
    };
  }

  return { update: null, reason: "no-market" };
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

async function fetchText(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 },
      headers: { accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Polymarket sports page failed (${response.status}).`);
    }

    return response.text();
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

function findSportsPageMatchWindow(
  text: string,
  target: MarketPulseTarget,
): string | null {
  const folded = foldForMarketPage(text);
  const homeLabels = marketPriceLabels(target.home);
  const awayLabels = marketPriceLabels(target.away);

  for (const homeLabel of homeLabels) {
    for (const homeIndex of labelIndexes(folded, homeLabel)) {
      for (const awayLabel of awayLabels) {
        const awayIndex = labelIndexes(folded, awayLabel).find(
          (index) => Math.abs(index - homeIndex) <= 1200,
        );

        if (awayIndex !== undefined) {
          const start = Math.max(0, Math.min(homeIndex, awayIndex) - 8);
          const end = Math.min(folded.length, Math.max(homeIndex, awayIndex) + 900);

          return folded.slice(start, end);
        }
      }
    }
  }

  return null;
}

function labelIndexes(text: string, label: string) {
  const pattern = labelPattern(label);

  if (!pattern) {
    return [];
  }

  return [...text.matchAll(new RegExp(`(?:^|\\s)${pattern}(?=\\s|$|\\d|[+\\-.])`, "gi"))].map(
    (match) => (match.index ?? 0) + match[0].search(/\S/),
  );
}

function extractCentsPrice(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const pattern = labelPattern(label);

    if (!pattern) {
      continue;
    }

    const match = text.match(
      new RegExp(`(?:^|\\s)${pattern}\\s*(\\d{1,3})\\s*(?:¢|c\\b|cent)`, "i"),
    );
    const cents = match ? Number(match[1]) : NaN;

    if (Number.isFinite(cents) && cents >= 0 && cents <= 100) {
      return cents / 100;
    }
  }

  return null;
}

function marketPriceLabels(team: MarketPulseTarget["home"]) {
  const aliases = [
    team.code,
    team.name,
    ...(team.aliases ?? []),
    ...searchNames(team),
    ...marketCodeAliases(team.code),
  ];

  return [...new Set(aliases.map(foldForMarketPage).filter(Boolean))];
}

function marketCodeAliases(code: string) {
  const normalizedCode = foldForMarketPage(code).toUpperCase();
  const aliases: Record<string, string[]> = {
    BIH: ["Bosnia-Herzegovina", "Bosnia and Herzegovina"],
    CIV: ["Ivory Coast", "Cote d Ivoire"],
    CUW: ["Curacao", "Curaçao"],
    CZE: ["Czechia", "Czech Republic"],
    KOR: ["KR", "South Korea", "Korea Republic"],
    RSA: ["South Africa"],
    SUI: ["CHE", "Switzerland"],
  };

  return aliases[normalizedCode] ?? [];
}

function labelPattern(label: string) {
  return foldForMarketPage(label)
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join("(?:\\s|-)+");
}

function htmlToReadableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&cent;|&#162;/gi, "¢")
    .replace(/\s+/g, " ")
    .trim();
}

function foldForMarketPage(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function teamAliases(team: MarketPulseTarget["home"]) {
  const aliases = [team.name, team.code, ...(team.aliases ?? [])];
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
