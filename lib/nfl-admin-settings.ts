export type NflAdminSettings = {
  fantasyDataUrl: string;
  fantasyProjectionsUrl: string;
  fantasyRankingsUrl: string;
  nflSeerDataUrl: string;
  polymarketEnabled: "auto" | "disabled" | "enabled";
  polymarketMaxGames: string;
  polymarketMaxShift: string;
  polymarketMaxWeight: string;
  sleeperLeagueId: string;
  sleeperWeek: string;
};

export type NflAdminSettingKey = keyof NflAdminSettings;

export type NflRuntimeSettings = {
  fantasyDataUrl: string;
  fantasyProjectionsUrl: string;
  fantasyRankingsUrl: string;
  nflSeerDataUrl: string;
  polymarketEnabled: boolean;
  polymarketMaxGames: number;
  polymarketMaxShift: number;
  polymarketMaxWeight: number;
  sleeperLeagueId: string;
  sleeperWeek: number | null;
  sources: Record<NflAdminSettingKey, "default" | "env" | "saved">;
};

export type NflAdminSettingsDashboard = {
  effective: NflRuntimeSettings;
  envStatus: Record<NflAdminSettingKey, boolean>;
  generatedAt: string;
  settings: NflAdminSettings;
  storage: {
    detail?: string;
    source: "database" | "memory";
  };
};

type NeonQuery = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

type NeonModule = {
  neon: (connectionString: string) => NeonQuery;
};

const settingsRowId = "default";
const defaultPolymarketMaxGames = 6;
const defaultPolymarketMaxShift = 4;
const defaultPolymarketMaxWeight = 0.16;
let memorySettings: NflAdminSettings | null = null;

const emptySettings: NflAdminSettings = {
  fantasyDataUrl: "",
  fantasyProjectionsUrl: "",
  fantasyRankingsUrl: "",
  nflSeerDataUrl: "",
  polymarketEnabled: "auto",
  polymarketMaxGames: "",
  polymarketMaxShift: "",
  polymarketMaxWeight: "",
  sleeperLeagueId: "",
  sleeperWeek: "",
};

export async function readNflRuntimeSettings() {
  const { settings } = await readStoredNflAdminSettings();

  return resolveNflRuntimeSettings(settings);
}

export async function getNflAdminSettingsDashboard(): Promise<NflAdminSettingsDashboard> {
  const stored = await readStoredNflAdminSettings();

  return {
    effective: resolveNflRuntimeSettings(stored.settings),
    envStatus: {
      fantasyDataUrl: Boolean(envValue("NFL_FANTASY_DATA_URL")),
      fantasyProjectionsUrl: Boolean(envValue("NFL_FANTASY_PROJECTIONS_URL")),
      fantasyRankingsUrl: Boolean(envValue("NFL_FANTASY_RANKINGS_URL")),
      nflSeerDataUrl: Boolean(envValue("NFL_SEER_DATA_URL")),
      polymarketEnabled: Boolean(envValue("NFL_POLYMARKET_ENABLED")),
      polymarketMaxGames: Boolean(envValue("NFL_POLYMARKET_MAX_GAMES")),
      polymarketMaxShift: Boolean(envValue("NFL_POLYMARKET_MAX_SHIFT")),
      polymarketMaxWeight: Boolean(envValue("NFL_POLYMARKET_MAX_WEIGHT")),
      sleeperLeagueId: Boolean(envValue("NFL_SLEEPER_LEAGUE_ID")),
      sleeperWeek: Boolean(envValue("NFL_SLEEPER_WEEK")),
    },
    generatedAt: new Date().toISOString(),
    settings: stored.settings,
    storage: stored.storage,
  };
}

export async function saveNflAdminSettings(input: unknown) {
  const settings = sanitizeNflAdminSettings(input);
  const database = await getSql();

  if (database.sql) {
    try {
      await ensureNflSettingsSchema(database.sql);
      await database.sql`
        insert into nfl_admin_settings (id, settings, updated_at)
        values (${settingsRowId}, ${JSON.stringify(settings)}::jsonb, now())
        on conflict (id) do update
        set settings = excluded.settings,
            updated_at = now();
      `;

      return getNflAdminSettingsDashboard();
    } catch {
      // Fall through to file storage so local/admin saves still have a receipt.
    }
  }

  memorySettings = settings;

  return getNflAdminSettingsDashboard();
}

export function resolveNflRuntimeSettings(
  settings: NflAdminSettings = emptySettings,
  env: Record<string, string | undefined> = process.env,
): NflRuntimeSettings {
  const sanitized = sanitizeNflAdminSettings(settings);
  const schedule = resolveStringSetting(
    sanitized.nflSeerDataUrl,
    env.NFL_SEER_DATA_URL,
    "",
  );
  const sleeperLeague = resolveStringSetting(
    sanitized.sleeperLeagueId,
    env.NFL_SLEEPER_LEAGUE_ID,
    "",
  );
  const sleeperWeek = resolveNumberSetting(
    sanitized.sleeperWeek,
    env.NFL_SLEEPER_WEEK,
    null,
    1,
    22,
    false,
  );
  const fantasyData = resolveStringSetting(
    sanitized.fantasyDataUrl,
    env.NFL_FANTASY_DATA_URL,
    "",
  );
  const projections = resolveStringSetting(
    sanitized.fantasyProjectionsUrl,
    env.NFL_FANTASY_PROJECTIONS_URL,
    "",
  );
  const rankings = resolveStringSetting(
    sanitized.fantasyRankingsUrl,
    env.NFL_FANTASY_RANKINGS_URL,
    "",
  );
  const marketEnabled = resolvePolymarketEnabled(
    sanitized.polymarketEnabled,
    env.NFL_POLYMARKET_ENABLED,
  );
  const maxGames = resolveNumberSetting(
    sanitized.polymarketMaxGames,
    env.NFL_POLYMARKET_MAX_GAMES,
    defaultPolymarketMaxGames,
    0,
    10,
    true,
  );
  const maxShift = resolveNumberSetting(
    sanitized.polymarketMaxShift,
    env.NFL_POLYMARKET_MAX_SHIFT,
    defaultPolymarketMaxShift,
    0,
    8,
    true,
  );
  const maxWeight = resolveNumberSetting(
    sanitized.polymarketMaxWeight,
    env.NFL_POLYMARKET_MAX_WEIGHT,
    defaultPolymarketMaxWeight,
    0.02,
    0.3,
    false,
  );

  return {
    fantasyDataUrl: fantasyData.value,
    fantasyProjectionsUrl: projections.value,
    fantasyRankingsUrl: rankings.value,
    nflSeerDataUrl: schedule.value,
    polymarketEnabled: marketEnabled.value,
    polymarketMaxGames: maxGames.value ?? defaultPolymarketMaxGames,
    polymarketMaxShift: maxShift.value ?? defaultPolymarketMaxShift,
    polymarketMaxWeight: maxWeight.value ?? defaultPolymarketMaxWeight,
    sleeperLeagueId: sleeperLeague.value,
    sleeperWeek: sleeperWeek.value,
    sources: {
      fantasyDataUrl: fantasyData.source,
      fantasyProjectionsUrl: projections.source,
      fantasyRankingsUrl: rankings.source,
      nflSeerDataUrl: schedule.source,
      polymarketEnabled: marketEnabled.source,
      polymarketMaxGames: maxGames.source,
      polymarketMaxShift: maxShift.source,
      polymarketMaxWeight: maxWeight.source,
      sleeperLeagueId: sleeperLeague.source,
      sleeperWeek: sleeperWeek.source,
    },
  };
}

export function sanitizeNflAdminSettings(input: unknown): NflAdminSettings {
  if (!input || typeof input !== "object") {
    return { ...emptySettings };
  }

  const value = input as Partial<Record<NflAdminSettingKey, unknown>>;
  const polymarketEnabled =
    value.polymarketEnabled === "enabled" || value.polymarketEnabled === "disabled"
      ? value.polymarketEnabled
      : "auto";

  return {
    fantasyDataUrl: cleanSetting(value.fantasyDataUrl, 500),
    fantasyProjectionsUrl: cleanSetting(value.fantasyProjectionsUrl, 500),
    fantasyRankingsUrl: cleanSetting(value.fantasyRankingsUrl, 500),
    nflSeerDataUrl: cleanSetting(value.nflSeerDataUrl, 500),
    polymarketEnabled,
    polymarketMaxGames: cleanNumericSetting(value.polymarketMaxGames),
    polymarketMaxShift: cleanNumericSetting(value.polymarketMaxShift),
    polymarketMaxWeight: cleanNumericSetting(value.polymarketMaxWeight),
    sleeperLeagueId: cleanSetting(value.sleeperLeagueId, 80),
    sleeperWeek: cleanNumericSetting(value.sleeperWeek),
  };
}

async function readStoredNflAdminSettings(): Promise<{
  settings: NflAdminSettings;
  storage: NflAdminSettingsDashboard["storage"];
}> {
  const database = await getSql();

  if (database.sql) {
    try {
      await ensureNflSettingsSchema(database.sql);

      const rows = await database.sql`
        select settings
        from nfl_admin_settings
        where id = ${settingsRowId}
        limit 1;
      `;

      return {
        settings: sanitizeNflAdminSettings(rows[0]?.settings),
        storage: { source: "database" },
      };
    } catch (error) {
      return {
        settings: memorySettings ?? { ...emptySettings },
        storage: {
          detail:
            error instanceof Error
              ? `database failed; using memory settings (${error.message})`
              : "database failed; using memory settings",
          source: "memory",
        },
      };
    }
  }

  return {
    settings: memorySettings ?? { ...emptySettings },
    storage: {
      detail: memorySettings
        ? "runtime memory settings"
        : "no saved runtime settings",
      source: "memory",
    },
  };
}

async function ensureNflSettingsSchema(sql: NeonQuery) {
  await sql`
    create table if not exists nfl_admin_settings (
      id text primary key,
      settings jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
  `;
}

async function loadNeon() {
  try {
    return {
      module: (await import("@neondatabase/serverless")) as unknown as NeonModule,
    };
  } catch {
    return { module: null };
  }
}

async function getSql() {
  if (!process.env.DATABASE_URL) {
    return { sql: null };
  }

  const neonModule = await loadNeon();

  if (!neonModule.module) {
    return { sql: null };
  }

  return { sql: neonModule.module.neon(process.env.DATABASE_URL) };
}

function resolveStringSetting(
  saved: string,
  envValueRaw: string | undefined,
  fallback: string,
) {
  if (saved) {
    return { source: "saved" as const, value: saved };
  }

  if (envValueRaw?.trim()) {
    return { source: "env" as const, value: envValueRaw.trim() };
  }

  return { source: "default" as const, value: fallback };
}

function resolveNumberSetting(
  saved: string,
  envValueRaw: string | undefined,
  fallback: number | null,
  min: number,
  max: number,
  integer: boolean,
) {
  const savedNumber = parseFiniteNumber(saved);

  if (savedNumber !== null) {
    return {
      source: "saved" as const,
      value: clampResolvedNumber(savedNumber, min, max, integer),
    };
  }

  const envNumber = parseFiniteNumber(envValueRaw);

  if (envNumber !== null) {
    return {
      source: "env" as const,
      value: clampResolvedNumber(envNumber, min, max, integer),
    };
  }

  return { source: "default" as const, value: fallback };
}

function resolvePolymarketEnabled(
  saved: NflAdminSettings["polymarketEnabled"],
  envValueRaw: string | undefined,
) {
  if (saved === "enabled") {
    return { source: "saved" as const, value: true };
  }

  if (saved === "disabled") {
    return { source: "saved" as const, value: false };
  }

  if (envValueRaw?.trim()) {
    return { source: "env" as const, value: envValueRaw.trim() !== "0" };
  }

  return { source: "default" as const, value: true };
}

function clampResolvedNumber(
  value: number,
  min: number,
  max: number,
  integer: boolean,
) {
  const clamped = Math.max(min, Math.min(max, value));

  return integer ? Math.floor(clamped) : clamped;
}

function parseFiniteNumber(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function cleanSetting(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanNumericSetting(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" ? value.trim().slice(0, 20) : "";
}

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}
