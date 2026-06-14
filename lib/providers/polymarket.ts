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
  endDate?: unknown;
  end_date?: unknown;
  closed?: unknown;
  active?: unknown;
};

export type PolymarketPulseSnapshot = {
  source: "polymarket";
  fetchedAt: string;
  targets: number;
  marketsScanned: number;
  updates: MarketPulseUpdate[];
};

const POLYMARKET_GAMMA_MARKETS_URL =
  process.env.POLYMARKET_GAMMA_MARKETS_URL ??
  "https://gamma-api.polymarket.com/markets";

export async function fetchPolymarketPulseSnapshot(
  targets: MarketPulseTarget[],
): Promise<PolymarketPulseSnapshot> {
  const fetchedAt = new Date().toISOString();
  const markets = await fetchGammaMarkets();
  const updates = targets.flatMap((target): MarketPulseUpdate[] => {
    const scored = markets
      .map((market) => ({
        market,
        score: scoreMarketForTarget(market, target),
      }))
      .filter((entry) => entry.score >= 4)
      .sort((left, right) => right.score - left.score);

    for (const entry of scored) {
      const pulse = marketToPulse(entry.market, target, fetchedAt);

      if (pulse) {
        return [pulse];
      }
    }

    return [];
  });

  return {
    source: "polymarket",
    fetchedAt,
    targets: targets.length,
    marketsScanned: markets.length,
    updates,
  };
}

async function fetchGammaMarkets() {
  const url = new URL(POLYMARKET_GAMMA_MARKETS_URL);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", process.env.POLYMARKET_MARKET_LIMIT ?? "500");

  const response = await fetch(url, {
    next: { revalidate: 60 },
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Polymarket market fetch failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;

  if (Array.isArray(payload)) {
    return payload as GammaMarket[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (Array.isArray(record.markets)) {
      return record.markets as GammaMarket[];
    }

    if (Array.isArray(record.data)) {
      return record.data as GammaMarket[];
    }
  }

  return [];
}

function scoreMarketForTarget(market: GammaMarket, target: MarketPulseTarget) {
  if (market.closed === true || market.active === false) {
    return 0;
  }

  const text = searchableMarketText(market);
  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);
  const hasHome = homeAliases.some((alias) => text.includes(alias));
  const hasAway = awayAliases.some((alias) => text.includes(alias));

  if (!hasHome || !hasAway) {
    return 0;
  }

  let score = 4;

  if (text.includes("draw") || text.includes("tie")) {
    score += 2;
  }

  const marketDate = readDate(market.endDate ?? market.end_date);
  const targetDate = target.startsAt ? new Date(target.startsAt) : null;

  if (
    marketDate &&
    targetDate &&
    Math.abs(marketDate.getTime() - targetDate.getTime()) < 1000 * 60 * 60 * 72
  ) {
    score += 2;
  }

  return score;
}

function marketToPulse(
  market: GammaMarket,
  target: MarketPulseTarget,
  fetchedAt: string,
): MarketPulseUpdate | null {
  const outcomes = parseArrayField(market.outcomes).map(String);
  const prices = parseArrayField(market.outcomePrices).map(readNumber);

  if (outcomes.length < 3 || prices.length < outcomes.length) {
    return null;
  }

  const homeAliases = teamAliases(target.home);
  const awayAliases = teamAliases(target.away);
  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;

  outcomes.forEach((outcome, index) => {
    const normalized = normalizeText(outcome);
    const price = prices[index];

    if (price === null) {
      return;
    }

    if (homeAliases.some((alias) => normalized.includes(alias))) {
      home = price;
    } else if (awayAliases.some((alias) => normalized.includes(alias))) {
      away = price;
    } else if (
      normalized.includes("draw") ||
      normalized.includes("tie") ||
      normalized === "x"
    ) {
      draw = price;
    }
  });

  if (home === null || draw === null || away === null) {
    return null;
  }

  return {
    matchId: target.matchId,
    source: "polymarket",
    home,
    draw,
    away,
    liquidity: readNumber(market.liquidityNum) ?? readNumber(market.liquidity),
    volume: readNumber(market.volumeNum) ?? readNumber(market.volume),
    capturedAt: fetchedAt,
    marketId: readString(market.id),
    marketSlug: readString(market.slug),
    question: readString(market.question),
  };
}

function searchableMarketText(market: GammaMarket) {
  return normalizeText(
    [market.question, market.description, market.slug].filter(Boolean).join(" "),
  );
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
    .replace(/[\u0300-\u036f]/g, "")
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

function readNumber(value: unknown) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed <= 1 ? parsed * 100 : parsed;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
