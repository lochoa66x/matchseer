"use client";

import {
  Activity,
  BrainCircuit,
  DatabaseZap,
  Gauge,
  KeyRound,
  LineChart,
  LoaderCircle,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  FantasyPosition,
  NflFantasyProviderStatus,
  NflSeerDataset,
} from "../../../lib/nfl-seer-data";
import type {
  NflAdminSettings,
  NflAdminSettingsDashboard,
} from "../../../lib/nfl-admin-settings";

type ActionStatus = "idle" | "loading" | "success" | "error";
type NflAdminAction =
  | "all"
  | "players"
  | "polymarket"
  | "projections"
  | "rankings"
  | "schedule"
  | "sleeper";

type NflActionResponse = {
  action: NflAdminAction;
  dataset: NflSeerDataset;
  fetchedAt: string;
  receipt: string;
};

const fantasyPositions: FantasyPosition[] = ["QB", "RB", "WR", "TE", "K", "DST"];

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

const settingFields: Array<{
  detail: string;
  key: Exclude<keyof NflAdminSettings, "polymarketEnabled">;
  label: string;
  placeholder: string;
}> = [
  {
    key: "nflSeerDataUrl",
    label: "Schedule feed",
    detail: "Optional override for the ESPN scoreboard rail.",
    placeholder: "https://...",
  },
  {
    key: "sleeperLeagueId",
    label: "Sleeper rosters",
    detail: "Public league id for a shared fantasy roster spine.",
    placeholder: "league id",
  },
  {
    key: "sleeperWeek",
    label: "Sleeper week",
    detail: "Optional manual week override; otherwise Sleeper current week is used.",
    placeholder: "auto",
  },
  {
    key: "fantasyDataUrl",
    label: "Player feed",
    detail: "Canonical player pool when we are not relying on seeded preseason players.",
    placeholder: "https://...",
  },
  {
    key: "fantasyProjectionsUrl",
    label: "Projection feed",
    detail: "Source projection rows before the Seer context nudges them.",
    placeholder: "https://...",
  },
  {
    key: "fantasyRankingsUrl",
    label: "Rankings feed",
    detail: "ECR, ADP, or ranking rows for baseline rank comparisons.",
    placeholder: "https://...",
  },
  {
    key: "polymarketMaxGames",
    label: "Crowd games",
    detail: "How many slate games the crowd lane scans.",
    placeholder: "6",
  },
  {
    key: "polymarketMaxShift",
    label: "Crowd cap",
    detail: "Max probability points the crowd can move a matchup.",
    placeholder: "4",
  },
  {
    key: "polymarketMaxWeight",
    label: "Crowd weight",
    detail: "Max blend weight for Polymarket before caps.",
    placeholder: "0.16",
  },
];

const actionButtons: Array<{
  action: NflAdminAction;
  icon: ReactNode;
  label: string;
}> = [
  { action: "schedule", icon: <DatabaseZap size={18} />, label: "Refresh schedule" },
  { action: "sleeper", icon: <UsersRound size={18} />, label: "Sync Sleeper" },
  { action: "players", icon: <BrainCircuit size={18} />, label: "Check players" },
  { action: "projections", icon: <LineChart size={18} />, label: "Sync projections" },
  { action: "rankings", icon: <Gauge size={18} />, label: "Sync rankings" },
  { action: "polymarket", icon: <Activity size={18} />, label: "Sync crowd" },
  { action: "all", icon: <RefreshCcw size={18} />, label: "Run all lanes" },
];

export default function NflAdminPage() {
  const [secret, setSecret] = useState("");
  const [dataset, setDataset] = useState<NflSeerDataset | null>(null);
  const [settingsDashboard, setSettingsDashboard] =
    useState<NflAdminSettingsDashboard | null>(null);
  const [settingsDraft, setSettingsDraft] =
    useState<NflAdminSettings>(emptySettings);
  const [loadStatus, setLoadStatus] = useState<ActionStatus>("idle");
  const [settingsStatus, setSettingsStatus] = useState<ActionStatus>("idle");
  const [activeAction, setActiveAction] = useState<NflAdminAction | null>(null);
  const [messageStatus, setMessageStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState("Pro football data console is ready.");

  useEffect(() => {
    const storedSecret = window.sessionStorage.getItem("matchseer-admin-secret");

    if (storedSecret) {
      setSecret(storedSecret);
      void refreshSettings(storedSecret);
    }

    void refreshDashboard();
  }, []);

  useEffect(() => {
    if (secret) {
      window.sessionStorage.setItem("matchseer-admin-secret", secret);
    } else {
      window.sessionStorage.removeItem("matchseer-admin-secret");
    }
  }, [secret]);

  const providers = dataset?.providerStatus.fantasyProviders ?? [];
  const coverage = dataset?.providerStatus.fantasyCoverage ?? null;
  const liveProviderCount = providers.filter((provider) => provider.status === "live").length;
  const totalProviderRows = providers.reduce((total, provider) => total + provider.count, 0);
  const matchupRows = useMemo(
    () =>
      [...(dataset?.matchups ?? [])].sort((left, right) => {
        const leftTime = left.startsAt ? new Date(left.startsAt).getTime() : 0;
        const rightTime = right.startsAt ? new Date(right.startsAt).getTime() : 0;

        return leftTime - rightTime;
      }),
    [dataset],
  );
  const marketLiveCount = matchupRows.filter((matchup) => matchup.marketPulse).length;
  const effectiveSettings = settingsDashboard?.effective;

  async function refreshDashboard() {
    setLoadStatus("loading");
    setMessageStatus("loading");
    setMessage("Refreshing pro football source health...");

    try {
      const nextDataset = await fetchJson<NflSeerDataset>("/api/nfl/seer");

      setDataset(nextDataset);
      setLoadStatus("success");
      setMessageStatus("success");
      setMessage(
        `Pro football dashboard refreshed: ${nextDataset.matchups.length} matchup${nextDataset.matchups.length === 1 ? "" : "s"}, ${nextDataset.providerStatus.fantasyProviders?.length ?? 0} fantasy provider lane${nextDataset.providerStatus.fantasyProviders?.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setLoadStatus("error");
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "Pro football dashboard refresh failed.");
    }
  }

  async function refreshSettings(adminSecret = secret) {
    if (!adminSecret) {
      setSettingsDashboard(null);
      setSettingsDraft(emptySettings);
      return;
    }

    setSettingsStatus("loading");

    try {
      const dashboard = await fetchJson<NflAdminSettingsDashboard>(
        "/api/admin/nfl-settings",
        {
          headers: {
            Authorization: `Bearer ${adminSecret}`,
          },
        },
      );

      setSettingsDashboard(dashboard);
      setSettingsDraft(dashboard.settings);
      setSettingsStatus("success");
    } catch (error) {
      setSettingsStatus("error");
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "Pro football settings failed.");
    }
  }

  async function saveSettings() {
    if (!secret) {
      setMessageStatus("error");
      setMessage("Add the admin secret before saving pro football settings.");
      return;
    }

    setSettingsStatus("loading");
    setMessageStatus("loading");
    setMessage("Saving pro football runtime settings...");

    try {
      const dashboard = await fetchJson<NflAdminSettingsDashboard>(
        "/api/admin/nfl-settings",
        {
          body: JSON.stringify(settingsDraft),
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      setSettingsDashboard(dashboard);
      setSettingsDraft(dashboard.settings);
      setSettingsStatus("success");
      setMessageStatus("success");
      setMessage("Pro football runtime settings saved. Run a lane to refresh receipts.");
      await refreshDashboard();
    } catch (error) {
      setSettingsStatus("error");
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "Pro football settings save failed.");
    }
  }

  async function runNflAction(action: NflAdminAction) {
    if (!secret) {
      setMessageStatus("error");
      setMessage("Add the admin secret before running pro football admin actions.");
      return;
    }

    setActiveAction(action);
    setMessageStatus("loading");
    setMessage(`Running ${actionLabel(action)}...`);

    try {
      const payload = await fetchJson<NflActionResponse>("/api/admin/nfl-actions", {
        body: JSON.stringify({ action }),
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setDataset(payload.dataset);
      setMessageStatus("success");
      setMessage(payload.receipt);
      await refreshSettings(secret);
    } catch (error) {
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "Pro football action failed.");
    } finally {
      setActiveAction(null);
    }
  }

  function updateSetting<Key extends keyof NflAdminSettings>(
    key: Key,
    value: NflAdminSettings[Key],
  ) {
    setSettingsDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <main className="admin-shell nfl-admin-shell">
      <section className="admin-topbar">
        <div>
          <p className="eyebrow">MatchSeer admin</p>
          <h1>Pro football data console</h1>
        </div>
        <div className="admin-topbar-actions">
          <a className="admin-command" href="/admin">
            <Trophy size={18} />
            World Cup admin
          </a>
          <button
            className="icon-button"
            onClick={() => void refreshDashboard()}
            title="Refresh pro football dashboard"
            type="button"
          >
            {loadStatus === "loading" ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <RefreshCcw size={18} />
            )}
          </button>
        </div>
      </section>

      <section className="admin-grid nfl-admin-grid">
        <div className="admin-panel admin-secret-panel">
          <div className="panel-heading">
            <KeyRound size={18} />
            <h2>Admin secret</h2>
          </div>
          <input
            className="admin-input"
            onChange={(event) => setSecret(event.target.value)}
            placeholder="MATCHSEER_SYNC_SECRET"
            type="password"
            value={secret}
          />
          <p className="admin-muted">
            Kept in this browser session. Pro football lane actions use this as the bearer
            token.
          </p>
          <button
            className="admin-command nfl-admin-load-settings"
            disabled={!secret || settingsStatus === "loading"}
            onClick={() => void refreshSettings()}
            type="button"
          >
            <RefreshCcw size={16} />
            {settingsStatus === "loading" ? "Loading settings" : "Load settings"}
          </button>
        </div>

        <AdminMetric
          icon={<DatabaseZap size={18} />}
          label="Schedule"
          note={dataset ? `${dataset.season} · ${dataset.weekLabel}` : "loading"}
          value={dataset?.providerStatus.schedule ?? "loading"}
        />
        <AdminMetric
          icon={<Activity size={18} />}
          label="Crowd"
          note={`${marketLiveCount}/${matchupRows.length} games with pulse`}
          value={dataset?.providerStatus.market ?? "loading"}
        />
        <AdminMetric
          icon={<UsersRound size={18} />}
          label="Fantasy"
          note={`${totalProviderRows} source rows`}
          value={dataset?.providerStatus.fantasy ?? "loading"}
        />
        <AdminMetric
          icon={<ShieldCheck size={18} />}
          label="Provider lanes"
          note={`${providers.length} configured lanes`}
          value={`${liveProviderCount}/${providers.length || 4} live`}
        />
      </section>

      <section className="admin-actions nfl-admin-actions">
        {actionButtons.map((button) => (
          <button
            className={button.action === "all" ? "admin-command primary" : "admin-command"}
            disabled={!secret || activeAction !== null}
            key={button.action}
            onClick={() => void runNflAction(button.action)}
            type="button"
          >
            {activeAction === button.action ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              button.icon
            )}
            {button.label}
          </button>
        ))}
      </section>

      <p className={`admin-message ${messageStatus}`}>{message}</p>

      <section className="admin-panel nfl-admin-status-panel">
        <div className="admin-table-header">
          <div>
            <p className="eyebrow">Source health</p>
            <h2>Fantasy provider lanes</h2>
          </div>
          <strong>{formatUpdated(dataset?.updatedAt)}</strong>
        </div>
        <div className="nfl-admin-provider-grid">
          {providers.length > 0 ? (
            providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))
          ) : (
            <p className="admin-muted nfl-admin-empty">
              Provider status will appear after the pro football feed responds.
            </p>
          )}
        </div>
      </section>

      <section className="nfl-admin-two-column">
        <section className="admin-panel nfl-admin-coverage-panel">
          <div className="admin-table-header">
            <div>
              <p className="eyebrow">Fantasy source coverage</p>
              <h2>Position lanes</h2>
            </div>
            <strong>
              {coverage
                ? `${coverage.totalPlayers} players · ${coverage.totalProjections} projections`
                : "waiting"}
            </strong>
          </div>
          <div className="nfl-admin-position-grid">
            {fantasyPositions.map((position) => {
              const row = coverage?.positions[position];
              const total = row?.total ?? 0;

              return (
                <article
                  className={total > 0 ? "live" : undefined}
                  key={position}
                >
                  <span>{positionLabel(position)}</span>
                  <strong>{total}</strong>
                  <em>
                    {row?.players ?? 0} players · {row?.projections ?? 0} proj ·{" "}
                    {row?.rankings ?? 0} rank
                  </em>
                </article>
              );
            })}
          </div>
          <p className="admin-muted">
            {coverage?.missingPositions.length
              ? `Missing ${coverage.missingPositions.map(positionLabel).join(", ")} lanes.`
              : "All position lanes have at least one source row."}
          </p>
        </section>

        <section className="admin-panel nfl-admin-setup-panel">
          <div className="admin-table-header">
            <div>
              <p className="eyebrow">Data knobs</p>
              <h2>Runtime settings</h2>
            </div>
            <strong>{settingsDashboard?.storage.source ?? "locked"}</strong>
          </div>
          <div className="nfl-admin-settings-grid">
            {settingFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <input
                  className="admin-input"
                  onChange={(event) => updateSetting(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  value={settingsDraft[field.key]}
                />
                <em>{field.detail}</em>
                <small>
                  {effectiveSettings?.sources[field.key] ?? "default"} ·{" "}
                  {effectiveSettingValue(field.key, effectiveSettings)}
                </small>
              </label>
            ))}
            <label>
              <span>Crowd signal</span>
              <select
                className="admin-select"
                onChange={(event) =>
                  updateSetting(
                    "polymarketEnabled",
                    event.target.value as NflAdminSettings["polymarketEnabled"],
                  )
                }
                value={settingsDraft.polymarketEnabled}
              >
                <option value="auto">Auto from env</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <em>Controls the light Polymarket nudge lane.</em>
              <small>
                {effectiveSettings?.sources.polymarketEnabled ?? "default"} ·{" "}
                {effectiveSettings?.polymarketEnabled ? "enabled" : "disabled"}
              </small>
            </label>
          </div>
          <div className="nfl-admin-settings-actions">
            <button
              className="admin-command primary"
              disabled={!secret || settingsStatus === "loading"}
              onClick={() => void saveSettings()}
              type="button"
            >
              {settingsStatus === "loading" ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              Save pro football settings
            </button>
            <button
              className="admin-command"
              onClick={() => setSettingsDraft(settingsDashboard?.settings ?? emptySettings)}
              type="button"
            >
              Reset draft
            </button>
          </div>
        </section>
      </section>

      <section className="admin-panel nfl-admin-matchups-panel">
        <div className="admin-table-header">
          <div>
            <p className="eyebrow">Game feed</p>
            <h2>Pro football matchup rail</h2>
          </div>
          <strong>{matchupRows.length} games</strong>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table nfl-admin-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Kickoff</th>
                <th>Seer lean</th>
                <th>Source</th>
                <th>Crowd</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {matchupRows.length > 0 ? (
                matchupRows.map((matchup) => {
                  const homeLean = matchup.homeWin >= matchup.awayWin;
                  const leanTeam = homeLean ? matchup.home : matchup.away;
                  const leanValue = homeLean ? matchup.homeWin : matchup.awayWin;

                  return (
                    <tr key={matchup.id}>
                      <td>
                        <strong>
                          {matchup.away.code} at {matchup.home.code}
                        </strong>
                        <span>{matchup.week} · {matchup.venue}</span>
                      </td>
                      <td>
                        <strong>{matchup.slot}</strong>
                        <span>{formatKickoff(matchup.startsAt)}</span>
                      </td>
                      <td>
                        <strong>
                          {leanTeam.code} {leanValue}%
                        </strong>
                        <span>{matchup.projected}</span>
                      </td>
                      <td>
                        <strong>
                          {matchup.sourceHomeWin ?? matchup.homeWin}% /{" "}
                          {matchup.sourceAwayWin ?? matchup.awayWin}%
                        </strong>
                        <span>home / away before crowd</span>
                      </td>
                      <td>
                        <strong>
                          {matchup.marketPulse
                            ? `${matchup.marketPulse.leader} · ${matchup.marketPulse.alignment}`
                            : "none"}
                        </strong>
                        <span>
                          {matchup.marketPulse?.nudge.summary ??
                            "No usable Polymarket signal yet."}
                        </span>
                      </td>
                      <td>
                        <strong>{matchup.confidence}% confidence</strong>
                        <span>{matchup.read}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <strong>No pro football matchups loaded yet.</strong>
                    <span>Refresh the dashboard or check the schedule feed.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function ProviderCard({ provider }: { provider: NflFantasyProviderStatus }) {
  return (
    <article
      className={`nfl-admin-provider-card ${provider.status} ${provider.freshness}`}
    >
      <div>
        <span>{providerIcon(provider.kind)}</span>
        <strong>{provider.label}</strong>
        <em>{provider.status}</em>
      </div>
      <p>{provider.message}</p>
      <small>
        {provider.count} rows · {provider.freshness}
        {provider.updatedAt ? ` · ${formatUpdated(provider.updatedAt)}` : ""}
      </small>
      <div className="nfl-admin-position-strip">
        {fantasyPositions.map((position) => (
          <span
            className={(provider.positions[position] ?? 0) > 0 ? "live" : undefined}
            key={position}
          >
            {positionLabel(position)} {provider.positions[position] ?? 0}
          </span>
        ))}
      </div>
    </article>
  );
}

function AdminMetric({
  icon,
  label,
  note,
  value,
}: {
  icon: ReactNode;
  label: string;
  note: string;
  value: string;
}) {
  return (
    <div className="admin-panel admin-metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const error =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Request failed.";

    throw new Error(error);
  }

  return payload as T;
}

function actionLabel(action: NflAdminAction) {
  if (action === "all") {
    return "all pro football lanes";
  }

  if (action === "polymarket") {
    return "crowd signal";
  }

  return action;
}

function effectiveSettingValue(
  key: keyof NflAdminSettings,
  settings: NflAdminSettingsDashboard["effective"] | undefined,
) {
  if (!settings) {
    return "not loaded";
  }

  if (key === "polymarketEnabled") {
    return settings.polymarketEnabled ? "enabled" : "disabled";
  }

  const value = settings[key];

  if (value === null || value === "") {
    return "empty";
  }

  return String(value);
}

function providerIcon(kind: NflFantasyProviderStatus["kind"]) {
  if (kind === "sleeper") {
    return <UsersRound size={17} />;
  }

  if (kind === "players") {
    return <BrainCircuit size={17} />;
  }

  if (kind === "projections") {
    return <LineChart size={17} />;
  }

  return <Gauge size={17} />;
}

function positionLabel(position: FantasyPosition) {
  return position === "DST" ? "Def" : position;
}

function formatUpdated(value: string | null | undefined) {
  if (!value) {
    return "not loaded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatKickoff(value: string | null | undefined) {
  if (!value) {
    return "TBD";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
