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

type ActionStatus = "idle" | "loading" | "success" | "error";

const fantasyPositions: FantasyPosition[] = ["QB", "RB", "WR", "TE", "K", "DST"];

const setupLanes = [
  {
    label: "Schedule feed",
    value: "NFL_SEER_DATA_URL",
    detail: "Optional override for the ESPN scoreboard rail.",
  },
  {
    label: "Sleeper rosters",
    value: "NFL_SLEEPER_LEAGUE_ID",
    detail: "Public league id for a shared fantasy roster spine.",
  },
  {
    label: "Sleeper week",
    value: "NFL_SLEEPER_WEEK",
    detail: "Optional manual week override; otherwise Sleeper current week is used.",
  },
  {
    label: "Player feed",
    value: "NFL_FANTASY_DATA_URL",
    detail: "Canonical player pool when we are not relying on seeded preseason players.",
  },
  {
    label: "Projection feed",
    value: "NFL_FANTASY_PROJECTIONS_URL",
    detail: "Source projection rows before the Seer context nudges them.",
  },
  {
    label: "Rankings feed",
    value: "NFL_FANTASY_RANKINGS_URL",
    detail: "ECR, ADP, or ranking rows for baseline rank comparisons.",
  },
  {
    label: "Crowd signal",
    value: "NFL_POLYMARKET_ENABLED",
    detail: "Controls the light Polymarket nudge lane.",
  },
];

export default function NflAdminPage() {
  const [secret, setSecret] = useState("");
  const [dataset, setDataset] = useState<NflSeerDataset | null>(null);
  const [loadStatus, setLoadStatus] = useState<ActionStatus>("idle");
  const [messageStatus, setMessageStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState("NFL data console is ready.");

  useEffect(() => {
    const storedSecret = window.sessionStorage.getItem("matchseer-admin-secret");

    if (storedSecret) {
      setSecret(storedSecret);
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

  async function refreshDashboard() {
    setLoadStatus("loading");
    setMessageStatus("loading");
    setMessage("Refreshing NFL source health...");

    try {
      const nextDataset = await fetchJson<NflSeerDataset>("/api/nfl/seer");

      setDataset(nextDataset);
      setLoadStatus("success");
      setMessageStatus("success");
      setMessage(
        `NFL dashboard refreshed: ${nextDataset.matchups.length} matchup${nextDataset.matchups.length === 1 ? "" : "s"}, ${nextDataset.providerStatus.fantasyProviders?.length ?? 0} fantasy provider lane${nextDataset.providerStatus.fantasyProviders?.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setLoadStatus("error");
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "NFL dashboard refresh failed.");
    }
  }

  return (
    <main className="admin-shell nfl-admin-shell">
      <section className="admin-topbar">
        <div>
          <p className="eyebrow">MatchSeer admin</p>
          <h1>NFL data console</h1>
        </div>
        <div className="admin-topbar-actions">
          <a className="admin-command" href="/admin">
            <Trophy size={18} />
            World Cup admin
          </a>
          <button
            className="icon-button"
            onClick={() => void refreshDashboard()}
            title="Refresh NFL dashboard"
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
            Kept in this browser session. NFL controls can reuse the same admin key
            as the World Cup console when protected actions are added.
          </p>
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
              Provider status will appear after the NFL feed responds.
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
              <h2>Source setup</h2>
            </div>
            <strong>env driven</strong>
          </div>
          <div className="nfl-admin-setup-list">
            {setupLanes.map((lane) => (
              <article key={lane.value}>
                <span>{lane.label}</span>
                <strong>{lane.value}</strong>
                <p>{lane.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="admin-panel nfl-admin-matchups-panel">
        <div className="admin-table-header">
          <div>
            <p className="eyebrow">Game feed</p>
            <h2>NFL matchup rail</h2>
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
                    <strong>No NFL matchups loaded yet.</strong>
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

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
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
