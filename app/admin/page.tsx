"use client";

import {
  Activity,
  BrainCircuit,
  CloudSun,
  DatabaseZap,
  DollarSign,
  Eye,
  Globe2,
  History,
  KeyRound,
  LoaderCircle,
  MapPin,
  MonitorSmartphone,
  RefreshCcw,
  Save,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
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
  topLocations: Array<{
    label: string;
    country: string | null;
    region: string | null;
    city: string | null;
    views: number;
    visitors: number;
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
    location: string;
  }>;
  revenue: {
    currency: "USD";
    formula: string;
    assumptions: {
      adSlotsPerPage: number;
      fillRate: number;
      viewability: number;
      ecpms: {
        low: number;
        base: number;
        high: number;
      };
    };
    windows: {
      last24h: TrafficRevenueWindow;
      last7d: TrafficRevenueWindow;
      projected30d: TrafficRevenueWindow;
    };
  };
  error?: string;
};

type TrafficRevenueWindow = {
  views: number;
  estimatedImpressions: number;
  low: number;
  base: number;
  high: number;
};

type PlayerControlRow = {
  slug: string;
  name: string;
  team: string;
  teamCode: string;
  role: string;
  spark: number;
  importance: number;
  availabilityStatus: string;
  availabilityNote: string | null;
  yellowCards: number;
  redCards: number;
  isSuspended: boolean;
  age: number | null;
  minutesRecent: number;
};

type ForecastVersionRow = {
  matchId: string;
  group: string;
  status: string;
  startsAt: string | null;
  home: string;
  homeCode: string;
  away: string;
  awayCode: string;
  version: number;
  createdAt: string | null;
  homeWin: number;
  draw: number;
  awayWin: number;
  projected: string;
  confidence: number;
  chaos: number;
  modelVersion: string;
  forecastStatus: string;
  supersedesVersion: number | null;
  previousProjected: string | null;
};

type ModelControlDashboard = {
  source: string;
  reason: string;
  generatedAt: string;
  players: PlayerControlRow[];
  forecasts: ForecastVersionRow[];
  error?: string;
};

type PlayerDraft = {
  availabilityStatus: string;
  availabilityNote: string;
  yellowCards: number;
  redCards: number;
  isSuspended: boolean;
  minutesRecent: number;
};

type ActionStatus = "idle" | "loading" | "success" | "error";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [footballStatus, setFootballStatus] = useState<AdminStatus | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<AdminStatus | null>(null);
  const [marketStatus, setMarketStatus] = useState<AdminStatus | null>(null);
  const [candidateData, setCandidateData] =
    useState<VenueCandidatesResponse | null>(null);
  const [matchesResponse, setMatchesResponse] = useState<MatchesResponse | null>(
    null,
  );
  const [trafficData, setTrafficData] = useState<TrafficDashboard | null>(null);
  const [modelControlData, setModelControlData] =
    useState<ModelControlDashboard | null>(null);
  const [playerDrafts, setPlayerDrafts] = useState<Record<string, PlayerDraft>>(
    {},
  );
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
      const modelControlsPromise = adminSecret
        ? fetchJson<ModelControlDashboard>("/api/admin/model-controls", {
            headers: {
              Authorization: `Bearer ${adminSecret}`,
            },
          }).catch((error) => ({
            ...emptyModelControlDashboard(),
            error:
              error instanceof Error ? error.message : "Model controls failed.",
          }))
        : Promise.resolve<ModelControlDashboard | null>(null);
      const [
        football,
        weather,
        market,
        candidates,
        matches,
        traffic,
        modelControls,
      ] =
        await Promise.all([
          fetchJson<AdminStatus>("/api/admin/sync-football-data"),
          fetchJson<AdminStatus>("/api/admin/sync-weather"),
          fetchJson<AdminStatus>("/api/admin/sync-market-pulse"),
          fetchJson<VenueCandidatesResponse>("/api/admin/venue-candidates?all=1"),
          fetchJson<MatchesResponse>("/api/matches"),
          trafficPromise,
          modelControlsPromise,
        ]);

      setFootballStatus(football);
      setWeatherStatus(weather);
      setMarketStatus(market);
      setCandidateData(candidates);
      setMatchesResponse(matches);
      setTrafficData(traffic);
      setModelControlData(modelControls);
      setPlayerDrafts(createPlayerDrafts(modelControls?.players ?? []));
      setSelectedVenues({});
      setLoadStatus("success");
      setMessageStatus("success");
      setMessage(
        !adminSecret
          ? "Dashboard refreshed. Add the admin secret to unlock private controls."
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

  async function savePlayerUpdates() {
    if (!secret) {
      setMessage("Add the admin secret first.");
      setActionStatus("error");
      setMessageStatus("error");
      return;
    }

    const updates = changedPlayerUpdates(
      modelControlData?.players ?? [],
      playerDrafts,
    );

    if (updates.length === 0) {
      setMessage("No player controls changed yet.");
      setActionStatus("error");
      setMessageStatus("error");
      return;
    }

    setActionStatus("loading");
    setMessageStatus("loading");

    try {
      const response = await fetch("/api/admin/model-controls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Player controls save failed.");
      }

      setActionStatus("success");
      setMessageStatus("success");
      setMessage(
        `Saved ${payload.playersUpdated ?? 0} player control${
          payload.playersUpdated === 1 ? "" : "s"
        }. Run football sync when you want fresh versions from the new inputs.`,
      );
      await refreshDashboard();
    } catch (error) {
      setActionStatus("error");
      setMessageStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Player controls save failed.",
      );
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
          icon={<Activity size={18} />}
          label="Market pulse"
          value={marketStatus?.ready ? "Free" : "Locked"}
          note={marketStatus?.provider ?? "polymarket"}
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
        <AdminMetric
          icon={<DollarSign size={18} />}
          label="Ad estimate"
          value={formatMoney(trafficData?.revenue.windows.last7d.base ?? 0)}
          note={`${formatMoney(
            trafficData?.revenue.windows.projected30d.base ?? 0,
          )} 30d pace`}
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
          className="admin-command"
          type="button"
          onClick={() =>
            void runProtectedAction({
              path: "/api/admin/sync-market-pulse",
              success: "Market pulse sync complete.",
            })
          }
        >
          <Activity size={18} />
          Sync market pulse
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

      <ModelControlPanel
        data={modelControlData}
        hasSecret={Boolean(secret)}
        drafts={playerDrafts}
        onDraftChange={setPlayerDrafts}
        onSave={() => void savePlayerUpdates()}
        actionStatus={actionStatus}
      />

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

function ModelControlPanel({
  data,
  hasSecret,
  drafts,
  onDraftChange,
  onSave,
  actionStatus,
}: {
  data: ModelControlDashboard | null;
  hasSecret: boolean;
  drafts: Record<string, PlayerDraft>;
  onDraftChange: Dispatch<SetStateAction<Record<string, PlayerDraft>>>;
  onSave: () => void;
  actionStatus: ActionStatus;
}) {
  const ready = hasSecret && data && !data.error;
  const changedCount = countChangedPlayers(data?.players ?? [], drafts);

  function updateDraft(slug: string, patch: Partial<PlayerDraft>) {
    onDraftChange((current) => ({
      ...current,
      [slug]: {
        ...current[slug],
        ...patch,
      },
    }));
  }

  return (
    <section className="admin-panel model-control-panel">
      <div className="admin-table-header">
        <div>
          <p className="eyebrow">Model controls</p>
          <h2>Seer tuning bench</h2>
        </div>
        <div className="traffic-generated">
          <BrainCircuit size={16} />
          {data ? formatAdminTime(data.generatedAt) : "Locked"}
        </div>
      </div>

      {!ready ? (
        <div className="traffic-empty">
          <BrainCircuit size={22} />
          <strong>{hasSecret ? "Model controls unavailable" : "Controls locked"}</strong>
          <span>
            {data?.error ??
              "Add the admin secret and refresh to edit key-player availability."}
          </span>
        </div>
      ) : (
        <div className="model-control-grid">
          <div className="model-control-card player-controls-card">
            <div className="model-card-title">
              <BrainCircuit size={16} />
              <span>Key-player board</span>
              <em>{changedCount} changed</em>
            </div>
            <div className="player-control-list">
              {data.players.map((player) => {
                const draft = drafts[player.slug] ?? playerToDraft(player);

                return (
                  <article className="player-control-row" key={player.slug}>
                    <div className="player-control-id">
                      <strong>{player.name}</strong>
                      <span>
                        {player.teamCode} · {player.role} · impact{" "}
                        {player.importance} · spark {player.spark}
                      </span>
                    </div>
                    <select
                      className="admin-select player-status-select"
                      value={draft.availabilityStatus}
                      onChange={(event) =>
                        updateDraft(player.slug, {
                          availabilityStatus: event.target.value,
                          isSuspended:
                            event.target.value === "suspended"
                              ? true
                              : draft.isSuspended,
                        })
                      }
                    >
                      {availabilityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="player-mini-fields">
                      <label>
                        Y
                        <input
                          type="number"
                          min="0"
                          max="3"
                          value={draft.yellowCards}
                          onChange={(event) =>
                            updateDraft(player.slug, {
                              yellowCards: toAdminInteger(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        R
                        <input
                          type="number"
                          min="0"
                          max="2"
                          value={draft.redCards}
                          onChange={(event) =>
                            updateDraft(player.slug, {
                              redCards: toAdminInteger(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Min
                        <input
                          type="number"
                          min="0"
                          max="450"
                          value={draft.minutesRecent}
                          onChange={(event) =>
                            updateDraft(player.slug, {
                              minutesRecent: toAdminInteger(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="player-check">
                        <input
                          type="checkbox"
                          checked={draft.isSuspended}
                          onChange={(event) =>
                            updateDraft(player.slug, {
                              isSuspended: event.target.checked,
                              availabilityStatus: event.target.checked
                                ? "suspended"
                                : draft.availabilityStatus === "suspended"
                                  ? "available"
                                  : draft.availabilityStatus,
                            })
                          }
                        />
                        Susp
                      </label>
                    </div>
                    <input
                      className="admin-input player-note-input"
                      value={draft.availabilityNote}
                      onChange={(event) =>
                        updateDraft(player.slug, {
                          availabilityNote: event.target.value,
                        })
                      }
                      placeholder="Availability note"
                    />
                  </article>
                );
              })}
            </div>
            <button
              className="admin-command primary model-save-button"
              type="button"
              onClick={onSave}
              disabled={changedCount === 0 || actionStatus === "loading"}
            >
              {actionStatus === "loading" ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <Save size={18} />
              )}
              Save player controls
            </button>
          </div>

          <div className="model-control-card forecast-history-card">
            <div className="model-card-title">
              <History size={16} />
              <span>Forecast versions</span>
              <em>{data.forecasts.length} recent</em>
            </div>
            <div className="forecast-version-list">
              {data.forecasts.length === 0 ? (
                <p className="admin-muted">No forecast versions recorded yet.</p>
              ) : (
                data.forecasts.map((forecast) => (
                  <article
                    className="forecast-version-row"
                    key={`${forecast.matchId}-${forecast.version}-${forecast.createdAt}`}
                  >
                    <div>
                      <strong>
                        {forecast.homeCode} vs {forecast.awayCode}
                      </strong>
                      <span>
                        v{forecast.version} · {forecast.projected} ·{" "}
                        {forecast.status}
                      </span>
                    </div>
                    <b>
                      {forecast.homeWin}/{forecast.draw}/{forecast.awayWin}
                    </b>
                    <em>
                      {forecast.createdAt
                        ? formatAdminTime(forecast.createdAt)
                        : "No timestamp"}
                      {forecast.supersedesVersion
                        ? ` · replaced v${forecast.supersedesVersion}`
                        : ""}
                      {forecast.previousProjected
                        ? ` · was ${forecast.previousProjected}`
                        : ""}
                    </em>
                  </article>
                ))
              )}
            </div>
            <p className="admin-muted">
              Saving players updates the inputs. Run football sync to mint a fresh
              forecast version when those inputs should move the public read.
            </p>
          </div>
        </div>
      )}
    </section>
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

            <RevenueEstimateCard revenue={traffic.revenue} />

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
              title="Locations"
              items={traffic.topLocations.map((item) => ({
                label: item.label,
                value: `${formatNumber(item.views)} views`,
                note: `${formatNumber(item.visitors)} visitors`,
              }))}
              emptyLabel="No location headers yet."
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
                      {event.location && event.location !== "Unknown"
                        ? ` · ${event.location}`
                        : ""}
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

function RevenueEstimateCard({
  revenue,
}: {
  revenue: TrafficDashboard["revenue"];
}) {
  return (
    <div className="traffic-revenue-card">
      <div className="traffic-section-title">
        <DollarSign size={16} />
        <span>Ad estimate</span>
      </div>
      <div className="revenue-primary">
        <span>7-day base</span>
        <strong>{formatMoney(revenue.windows.last7d.base)}</strong>
      </div>
      <div className="revenue-range">
        <span>{formatMoney(revenue.windows.last7d.low)} low</span>
        <span>{formatMoney(revenue.windows.last7d.high)} high</span>
      </div>
      <div className="revenue-grid">
        <div>
          <span>24h</span>
          <strong>{formatMoney(revenue.windows.last24h.base)}</strong>
        </div>
        <div>
          <span>30d pace</span>
          <strong>{formatMoney(revenue.windows.projected30d.base)}</strong>
        </div>
      </div>
      <p>
        {formatNumber(revenue.windows.last7d.estimatedImpressions)} estimated ad
        impressions · {revenue.assumptions.adSlotsPerPage} slots ·{" "}
        {formatPercent(revenue.assumptions.fillRate)} fill ·{" "}
        {formatPercent(revenue.assumptions.viewability)} viewable ·{" "}
        {formatMoney(revenue.assumptions.ecpms.base)} eCPM
      </p>
    </div>
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
    topLocations: [],
    timeline: [],
    recent: [],
    revenue: {
      currency: "USD",
      formula:
        "views * ad slots per page * fill rate * viewability * eCPM / 1000",
      assumptions: {
        adSlotsPerPage: 2,
        fillRate: 0.82,
        viewability: 0.68,
        ecpms: {
          low: 1.25,
          base: 3.5,
          high: 7.5,
        },
      },
      windows: {
        last24h: emptyRevenueWindow(),
        last7d: emptyRevenueWindow(),
        projected30d: emptyRevenueWindow(),
      },
    },
  };
}

function emptyModelControlDashboard(): ModelControlDashboard {
  return {
    source: "database-unavailable",
    reason: "database-query-failed",
    generatedAt: new Date().toISOString(),
    players: [],
    forecasts: [],
  };
}

function emptyRevenueWindow(): TrafficRevenueWindow {
  return {
    views: 0,
    estimatedImpressions: 0,
    low: 0,
    base: 0,
    high: 0,
  };
}

const availabilityOptions = [
  { value: "available", label: "Available" },
  { value: "doubtful", label: "Doubtful" },
  { value: "limited", label: "Limited" },
  { value: "sick", label: "Sick" },
  { value: "injured", label: "Injured" },
  { value: "suspended", label: "Suspended" },
  { value: "out", label: "Out" },
];

function createPlayerDrafts(players: PlayerControlRow[]) {
  return Object.fromEntries(
    players.map((player) => [player.slug, playerToDraft(player)]),
  ) as Record<string, PlayerDraft>;
}

function playerToDraft(player: PlayerControlRow): PlayerDraft {
  return {
    availabilityStatus: player.availabilityStatus,
    availabilityNote: player.availabilityNote ?? "",
    yellowCards: player.yellowCards,
    redCards: player.redCards,
    isSuspended: player.isSuspended,
    minutesRecent: player.minutesRecent,
  };
}

function changedPlayerUpdates(
  players: PlayerControlRow[],
  drafts: Record<string, PlayerDraft>,
) {
  return players
    .map((player) => {
      const draft = drafts[player.slug];

      if (!draft || !playerDraftChanged(player, draft)) {
        return null;
      }

      return {
        slug: player.slug,
        availabilityStatus: draft.availabilityStatus,
        availabilityNote: draft.availabilityNote,
        yellowCards: draft.yellowCards,
        redCards: draft.redCards,
        isSuspended: draft.isSuspended,
        minutesRecent: draft.minutesRecent,
      };
    })
    .filter((update): update is PlayerDraft & { slug: string } => Boolean(update));
}

function countChangedPlayers(
  players: PlayerControlRow[],
  drafts: Record<string, PlayerDraft>,
) {
  return players.filter((player) => {
    const draft = drafts[player.slug];

    return draft ? playerDraftChanged(player, draft) : false;
  }).length;
}

function playerDraftChanged(player: PlayerControlRow, draft: PlayerDraft) {
  return (
    draft.availabilityStatus !== player.availabilityStatus ||
    draft.availabilityNote.trim() !== (player.availabilityNote ?? "") ||
    draft.yellowCards !== player.yellowCards ||
    draft.redCards !== player.redCards ||
    draft.isSuspended !== player.isSuspended ||
    draft.minutesRecent !== player.minutesRecent
  );
}

function toAdminInteger(value: string) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
    minimumFractionDigits: value >= 100 ? 0 : 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    style: "percent",
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

  if (typeof payload.playersUpdated === "number") {
    return `${payload.playersUpdated} player update${
      payload.playersUpdated === 1 ? "" : "s"
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
