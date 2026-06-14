"use client";

import {
  Activity,
  CloudSun,
  DatabaseZap,
  Eye,
  Globe2,
  KeyRound,
  LoaderCircle,
  MapPin,
  MonitorSmartphone,
  RefreshCcw,
  Save,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type AdminStatus = {
  ready: boolean;
  provider: string;
  envStatus?: Record<string, boolean>;
};

type VenueCandidate = {
  matchId: string;
  home: string;
  away: string;
  group: string;
  status: string;
  startsAt: string | null;
  currentVenue: {
    slug: string;
    name: string;
    city: string;
  };
};

type VenueOption = {
  slug: string;
  name: string;
  city: string;
  country: string;
};

type VenueCandidatesResponse = {
  count: number;
  matches: VenueCandidate[];
  venues: VenueOption[];
};

type MatchesResponse = {
  source: string;
  reason?: string;
  database?: {
    hasDatabaseUrl: boolean;
    driver: string;
  };
  matches: unknown[];
};

type TrafficDashboard = {
  source: string;
  reason: string;
  generatedAt: string;
  windows: {
    last24h: {
      views: number;
      visitors: number;
    };
    last7d: {
      views: number;
      visitors: number;
    };
  };
  topPaths: Array<{
    path: string;
    views: number;
    visitors: number;
  }>;
  topReferrers: Array<{
    referrer: string;
    views: number;
  }>;
  devices: Array<{
    device: string;
    views: number;
  }>;
  timeline: Array<{
    bucket: string;
    views: number;
    visitors: number;
  }>;
  recent: Array<{
    occurredAt: string;
    path: string;
    referrer: string;
    device: string;
    language: string | null;
    matchId: string | null;
  }>;
  error?: string;
};

type ActionStatus = "idle" | "loading" | "success" | "error";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [footballStatus, setFootballStatus] = useState<AdminStatus | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<AdminStatus | null>(null);
  const [candidateData, setCandidateData] =
    useState<VenueCandidatesResponse | null>(null);
  const [matchesResponse, setMatchesResponse] = useState<MatchesResponse | null>(
    null,
  );
  const [trafficData, setTrafficData] = useState<TrafficDashboard | null>(null);
  const [selectedVenues, setSelectedVenues] = useState<Record<string, string>>(
    {},
  );
  const [showMapped, setShowMapped] = useState(false);
  const [loadStatus, setLoadStatus] = useState<ActionStatus>("idle");
  const [actionStatus, setActionStatus] = useState<ActionStatus>("idle");
  const [messageStatus, setMessageStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState("Ready when you are.");

  useEffect(() => {
    const storedSecret = window.sessionStorage.getItem("matchseer-admin-secret");

    if (storedSecret) {
      setSecret(storedSecret);
    }

    void refreshDashboard(storedSecret ?? "");
  }, []);

  useEffect(() => {
    if (secret) {
      window.sessionStorage.setItem("matchseer-admin-secret", secret);
    } else {
      window.sessionStorage.removeItem("matchseer-admin-secret");
    }
  }, [secret]);

  const visibleMatches = useMemo(() => {
    const matches = candidateData?.matches ?? [];

    if (showMapped) {
      return matches;
    }

    return matches.filter(
      (match) => match.currentVenue.slug === "provider-venue-tbd",
    );
  }, [candidateData, showMapped]);

  const mappedCount =
    candidateData?.matches.filter(
      (match) => match.currentVenue.slug !== "provider-venue-tbd",
    ).length ?? 0;
  const pendingCount = (candidateData?.matches.length ?? 0) - mappedCount;
  const selectedCount = Object.entries(selectedVenues).filter(
    ([matchId, venueSlug]) => {
      const match = candidateData?.matches.find((item) => item.matchId === matchId);

      return match && venueSlug && venueSlug !== match.currentVenue.slug;
    },
  ).length;

  async function refreshDashboard(adminSecret = secret) {
    setLoadStatus("loading");

    try {
      const trafficPromise = adminSecret
        ? fetchJson<TrafficDashboard>("/api/admin/traffic", {
            headers: {
              Authorization: `Bearer ${adminSecret}`,
            },
          }).catch((error) => ({
            ...emptyTrafficDashboard(),
            error: error instanceof Error ? error.message : "Traffic failed.",
          }))
        : Promise.resolve<TrafficDashboard | null>(null);
      const [football, weather, candidates, matches, traffic] = await Promise.all([
        fetchJson<AdminStatus>("/api/admin/sync-football-data"),
        fetchJson<AdminStatus>("/api/admin/sync-weather"),
        fetchJson<VenueCandidatesResponse>("/api/admin/venue-candidates?all=1"),
        fetchJson<MatchesResponse>("/api/matches"),
        trafficPromise,
      ]);

      setFootballStatus(football);
      setWeatherStatus(weather);
      setCandidateData(candidates);
      setMatchesResponse(matches);
      setTrafficData(traffic);
      setSelectedVenues({});
      setLoadStatus("success");
      setMessageStatus("success");
      setMessage(
        !adminSecret
          ? "Dashboard refreshed. Add the admin secret to unlock traffic."
          : "Dashboard refreshed.",
      );
    } catch (error) {
      setLoadStatus("error");
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    }
  }

  async function runProtectedAction({
    path,
    success,
  }: {
    path: string;
    success: string;
  }) {
    if (!secret) {
      setMessage("Add the admin secret first.");
      setActionStatus("error");
      setMessageStatus("error");
      return;
    }

    setActionStatus("loading");
    setMessageStatus("loading");

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed.");
      }

      setActionStatus("success");
      setMessageStatus("success");
      setMessage(`${success} ${summarizePayload(payload)}`);
      await refreshDashboard();
    } catch (error) {
      setActionStatus("error");
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }

  async function saveVenueOverrides() {
    if (!secret) {
      setMessage("Add the admin secret first.");
      setActionStatus("error");
      setMessageStatus("error");
      return;
    }

    const overrides = Object.entries(selectedVenues)
      .map(([matchId, venueSlug]) => ({ matchId, venueSlug }))
      .filter(({ matchId, venueSlug }) => {
        const match = candidateData?.matches.find((item) => item.matchId === matchId);

        return match && venueSlug && venueSlug !== match.currentVenue.slug;
      });

    if (overrides.length === 0) {
      setMessage("Pick at least one venue change.");
      setActionStatus("error");
      setMessageStatus("error");
      return;
    }

    setActionStatus("loading");
    setMessageStatus("loading");

    try {
      const response = await fetch("/api/admin/venue-overrides", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ overrides }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Venue save failed.");
      }

      setActionStatus("success");
      setMessageStatus("success");
      setMessage(
        `Saved ${payload.matchesUpdated ?? 0} venue override${
          payload.matchesUpdated === 1 ? "" : "s"
        }.`,
      );
      await refreshDashboard();
    } catch (error) {
      setActionStatus("error");
      setMessageStatus("error");
      setMessage(error instanceof Error ? error.message : "Venue save failed.");
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-topbar">
        <div>
          <p className="eyebrow">MatchSeer admin</p>
          <h1>Data control room</h1>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void refreshDashboard()}
          title="Refresh dashboard"
        >
          {loadStatus === "loading" ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <RefreshCcw size={18} />
          )}
        </button>
      </section>

      <section className="admin-grid">
        <div className="admin-panel admin-secret-panel">
          <div className="panel-heading">
            <KeyRound size={18} />
            <h2>Admin secret</h2>
          </div>
          <input
            className="admin-input"
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="MATCHSEER_SYNC_SECRET"
          />
          <p className="admin-muted">
            Stored only in this browser session. Data-changing actions use this
            as the bearer token.
          </p>
        </div>

        <AdminMetric
          icon={<DatabaseZap size={18} />}
          label="Football data"
          value={footballStatus?.ready ? "Ready" : "Needs env"}
          note={footballStatus?.provider ?? "football-data"}
        />
        <AdminMetric
          icon={<CloudSun size={18} />}
          label="Weather sync"
          value={weatherStatus?.ready ? "Ready" : "Needs env"}
          note={weatherStatus?.provider ?? "open-meteo"}
        />
        <AdminMetric
          icon={<MapPin size={18} />}
          label="Venues mapped"
          value={`${mappedCount}/${candidateData?.matches.length ?? 0}`}
          note={`${pendingCount} pending`}
        />
        <AdminMetric
          icon={<ShieldCheck size={18} />}
          label="Public feed"
          value={matchesResponse?.source ?? "Loading"}
          note={[
            `${matchesResponse?.matches.length ?? 0} matches`,
            matchesResponse?.database?.driver ?? matchesResponse?.reason,
          ].filter(Boolean).join(" · ")}
        />
        <AdminMetric
          icon={<Eye size={18} />}
          label="Views 24h"
          value={formatNumber(trafficData?.windows.last24h.views ?? 0)}
          note={`${formatNumber(trafficData?.windows.last7d.views ?? 0)} in 7 days`}
        />
        <AdminMetric
          icon={<UsersRound size={18} />}
          label="Visitors 24h"
          value={formatNumber(trafficData?.windows.last24h.visitors ?? 0)}
          note={`${formatNumber(trafficData?.windows.last7d.visitors ?? 0)} in 7 days`}
        />
      </section>

      <section className="admin-actions">
        <button
          className="admin-command"
          type="button"
          onClick={() =>
            void runProtectedAction({
              path: "/api/admin/sync-football-data",
              success: "Football-data sync complete.",
            })
          }
        >
          <DatabaseZap size={18} />
          Sync football data
        </button>
        <button
          className="admin-command"
          type="button"
          onClick={() =>
            void runProtectedAction({
              path: "/api/admin/sync-weather",
              success: "Weather sync complete.",
            })
          }
        >
          <CloudSun size={18} />
          Sync weather
        </button>
        <button
          className="admin-command primary"
          type="button"
          onClick={() => void saveVenueOverrides()}
        >
          <Save size={18} />
          Save venue picks
        </button>
      </section>

      <p className={`admin-message ${messageStatus}`}>{message}</p>

      <TrafficPanel traffic={trafficData} hasSecret={Boolean(secret)} />

      <section className="admin-panel">
        <div className="admin-table-header">
          <div>
            <p className="eyebrow">Venue mapping</p>
            <h2>Matches needing stadiums</h2>
          </div>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={showMapped}
              onChange={(event) => setShowMapped(event.target.checked)}
            />
            Show mapped
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Kickoff</th>
                <th>Current venue</th>
                <th>Pick venue</th>
              </tr>
            </thead>
            <tbody>
              {visibleMatches.map((match) => (
                <tr key={match.matchId}>
                  <td>
                    <strong>{match.home} vs {match.away}</strong>
                    <span>{match.matchId} · {match.group} · {match.status}</span>
                  </td>
                  <td>{formatKickoff(match.startsAt)}</td>
                  <td>
                    <strong>{match.currentVenue.name}</strong>
                    <span>{match.currentVenue.city}</span>
                  </td>
                  <td>
                    <select
                      className="admin-select"
                      value={selectedVenues[match.matchId] ?? match.currentVenue.slug}
                      onChange={(event) =>
                        setSelectedVenues((current) => ({
                          ...current,
                          [match.matchId]: event.target.value,
                        }))
                      }
                    >
                      <option value="provider-venue-tbd">Venue pending</option>
                      {(candidateData?.venues ?? []).map((venue) => (
                        <option key={venue.slug} value={venue.slug}>
                          {venue.name} · {venue.city}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-footer">
          <span>{visibleMatches.length} visible</span>
          <span>{selectedCount} unsaved venue pick{selectedCount === 1 ? "" : "s"}</span>
        </div>
      </section>
    </main>
  );
}

function TrafficPanel({
  traffic,
  hasSecret,
}: {
  traffic: TrafficDashboard | null;
  hasSecret: boolean;
}) {
  const ready = hasSecret && traffic && !traffic.error;
  const maxViews = Math.max(
    1,
    ...(traffic?.timeline.map((point) => point.views) ?? [0]),
  );

  return (
    <section className="admin-panel traffic-panel">
      <div className="admin-table-header">
        <div>
          <p className="eyebrow">Traffic monitor</p>
          <h2>Page pulse</h2>
        </div>
        <div className="traffic-generated">
          <Activity size={16} />
          {traffic ? formatAdminTime(traffic.generatedAt) : "Locked"}
        </div>
      </div>

      {!ready ? (
        <div className="traffic-empty">
          <Globe2 size={22} />
          <strong>{hasSecret ? "Traffic unavailable" : "Traffic locked"}</strong>
          <span>
            {traffic?.error ??
              "Add the admin secret and refresh to load private traffic metrics."}
          </span>
        </div>
      ) : (
        <>
          <div className="traffic-overview">
            <div className="traffic-chart-card">
              <div className="traffic-chart-head">
                <span>Last 24 hours</span>
                <strong>{formatNumber(traffic.windows.last24h.views)} views</strong>
              </div>
              <div className="traffic-bars" aria-label="Views by hour">
                {traffic.timeline.map((point) => (
                  <span
                    key={point.bucket}
                    style={{
                      height: `${Math.max(6, (point.views / maxViews) * 100)}%`,
                    }}
                    title={`${formatTrafficHour(point.bucket)} · ${point.views} views`}
                  />
                ))}
              </div>
            </div>

            <TrafficRankList
              title="Top pages"
              items={traffic.topPaths.map((item) => ({
                label: item.path,
                value: `${formatNumber(item.views)} views`,
                note: `${formatNumber(item.visitors)} visitors`,
              }))}
              emptyLabel="No page views yet."
            />

            <TrafficRankList
              title="Referrers"
              items={traffic.topReferrers.map((item) => ({
                label: item.referrer,
                value: `${formatNumber(item.views)} views`,
              }))}
              emptyLabel="No referrers yet."
            />

            <TrafficRankList
              title="Devices"
              items={traffic.devices.map((item) => ({
                label: item.device,
                value: `${formatNumber(item.views)} views`,
              }))}
              emptyLabel="No devices yet."
            />
          </div>

          <div className="traffic-recent">
            <div className="traffic-section-title">
              <MonitorSmartphone size={16} />
              <span>Recent visits</span>
            </div>
            <div className="traffic-recent-grid">
              {traffic.recent.length === 0 ? (
                <div className="traffic-empty compact">No visits recorded yet.</div>
              ) : (
                traffic.recent.map((event) => (
                  <article className="traffic-visit" key={`${event.occurredAt}-${event.path}`}>
                    <strong>{event.path}</strong>
                    <span>
                      {formatAdminTime(event.occurredAt)} · {event.device}
                      {event.language ? ` · ${event.language}` : ""}
                    </span>
                    <em>{event.referrer}</em>
                  </article>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function TrafficRankList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
  emptyLabel: string;
}) {
  return (
    <div className="traffic-rank-card">
      <div className="traffic-section-title">
        <Globe2 size={16} />
        <span>{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="admin-muted">{emptyLabel}</p>
      ) : (
        <div className="traffic-rank-list">
          {items.map((item) => (
            <div className="traffic-rank-row" key={`${title}-${item.label}`}>
              <strong>{item.label}</strong>
              <span>{item.value}</span>
              {item.note && <em>{item.note}</em>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminMetric({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? `Failed to load ${path}`);
  }

  return payload as T;
}

function emptyTrafficDashboard(): TrafficDashboard {
  return {
    source: "database-unavailable",
    reason: "database-query-failed",
    generatedAt: new Date().toISOString(),
    windows: {
      last24h: { views: 0, visitors: 0 },
      last7d: { views: 0, visitors: 0 },
    },
    topPaths: [],
    topReferrers: [],
    devices: [],
    timeline: [],
    recent: [],
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAdminTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function formatTrafficHour(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function summarizePayload(payload: Record<string, unknown>) {
  if (typeof payload.matchesUpdated === "number") {
    return `${payload.matchesUpdated} match update${
      payload.matchesUpdated === 1 ? "" : "s"
    }.`;
  }

  if (typeof payload.matches === "number") {
    return `${payload.matches} matches.`;
  }

  return "";
}

function formatKickoff(startsAt: string | null) {
  if (!startsAt) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(startsAt));
}
