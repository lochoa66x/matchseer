"use client";

import {
  CloudSun,
  DatabaseZap,
  KeyRound,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  Save,
  ShieldCheck,
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

    void refreshDashboard();
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

  async function refreshDashboard() {
    setLoadStatus("loading");

    try {
      const [football, weather, candidates, matches] = await Promise.all([
        fetchJson<AdminStatus>("/api/admin/sync-football-data"),
        fetchJson<AdminStatus>("/api/admin/sync-weather"),
        fetchJson<VenueCandidatesResponse>("/api/admin/venue-candidates?all=1"),
        fetchJson<MatchesResponse>("/api/matches"),
      ]);

      setFootballStatus(football);
      setWeatherStatus(weather);
      setCandidateData(candidates);
      setMatchesResponse(matches);
      setSelectedVenues({});
      setLoadStatus("success");
      setMessageStatus("success");
      setMessage("Dashboard refreshed.");
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

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? `Failed to load ${path}`);
  }

  return payload as T;
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
