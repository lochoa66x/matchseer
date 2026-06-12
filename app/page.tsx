"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  CloudSun,
  Languages,
  LoaderCircle,
  MapPin,
  Radio,
  RefreshCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  Wind,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  Language,
  ForecastInterpretation,
  MatchSummary as Match,
  PlayerSpark as Player,
  TeamRating as Team,
} from "../lib/domain";

type Tab = "forecast" | "teams" | "players" | "weather";
type MatchFilter = "today" | "upcoming" | "completed";
type OracleStatus = "idle" | "loading" | "error";
type ShareStatus = "idle" | "copied" | "error";
type OracleResponse = {
  source: "openai" | "seeded-fallback";
  reason?: string;
  model?: string;
  audited?: boolean;
  interpretation: ForecastInterpretation;
};

const copy = {
  en: {
    matchday: "Matchday forecast",
    subtitle: "Real stats, playful readouts, zero betting energy.",
    today: "Today",
    live: "Live",
    upcoming: "Upcoming",
    completed: "Completed",
    final: "Final",
    groups: "Groups",
    allGroups: "All groups",
    matches: "matches",
    noMatches: "No matches in this view yet.",
    matchExplorer: "Match explorer",
    selectedMatch: "Selected match",
    quickRead: "Quick read",
    forecast: "Forecast",
    teams: "Teams",
    players: "Players",
    weather: "Weather",
    confidence: "Confidence",
    chaos: "Chaos",
    projected: "Projected",
    keyReasons: "Why the Seer leans this way",
    teamEdge: "Team edge",
    compareTeams: "Compare teams",
    comparePlayers: "Player sparks",
    referee: "Referee",
    share: "Share card",
    copied: "Copied",
    shareError: "Copy failed",
    review: "Forecasts are for entertainment and sports analysis only. No betting advice.",
    ad: "Sponsor space",
    adCopy: "Future ad slot. No sportsbooks, no weird subscription mambo jumbo.",
    signal: "Oracle signal",
    askSeer: "Ask the Seer",
    reading: "Reading",
    freshRead: "Fresh read",
    seededRead: "Seeded read",
    oracleError: "The Seer blinked. Try again.",
    dataStatus: "Data status",
    liveDatabase: "Live database",
    pendingMode: "Live data pending",
    fallbackMode: "Live data pending",
    dataDepth: "Data depth",
    realFixtures: "Real fixture feed",
    noDemoFixtures: "No demo data",
    venueWeather: "Venue + weather",
    connected: "Connected",
    mapping: "Mapping underway",
    aiLayer: "AI layer",
    aiReady: "Ready on demand",
  },
  es: {
    matchday: "Pronóstico del día",
    subtitle: "Estadísticas reales, lectura divertida y cero vibra de apuestas.",
    today: "Hoy",
    live: "En vivo",
    upcoming: "Próximo",
    completed: "Completados",
    final: "Final",
    groups: "Grupos",
    allGroups: "Todos los grupos",
    matches: "partidos",
    noMatches: "Aún no hay partidos en esta vista.",
    matchExplorer: "Explorar partidos",
    selectedMatch: "Partido seleccionado",
    quickRead: "Lectura rápida",
    forecast: "Pronóstico",
    teams: "Equipos",
    players: "Jugadores",
    weather: "Clima",
    confidence: "Confianza",
    chaos: "Caos",
    projected: "Proyectado",
    keyReasons: "Por qué el Vidente se inclina así",
    teamEdge: "Ventaja",
    compareTeams: "Comparar equipos",
    comparePlayers: "Chispas de jugadores",
    referee: "Árbitro",
    share: "Compartir carta",
    copied: "Copiado",
    shareError: "No se copió",
    review: "Pronósticos solo para entretenimiento y análisis deportivo. No son consejos de apuestas.",
    ad: "Espacio patrocinado",
    adCopy: "Futuro espacio publicitario. Sin casas de apuestas ni suscripciones raras.",
    signal: "Señal del oráculo",
    askSeer: "Preguntar al Vidente",
    reading: "Leyendo",
    freshRead: "Lectura nueva",
    seededRead: "Lectura base",
    oracleError: "El Vidente parpadeó. Intenta otra vez.",
    dataStatus: "Estado de datos",
    liveDatabase: "Base en vivo",
    pendingMode: "Datos reales pendientes",
    fallbackMode: "Datos reales pendientes",
    dataDepth: "Nivel de datos",
    realFixtures: "Calendario real",
    noDemoFixtures: "Sin datos demo",
    venueWeather: "Estadio + clima",
    connected: "Conectado",
    mapping: "Mapeo en curso",
    aiLayer: "Capa IA",
    aiReady: "Lista al pedir",
  },
  fr: {
    matchday: "Prévision du jour",
    subtitle: "Des stats réelles, une lecture légère, aucune vibe pari sportif.",
    today: "Aujourd’hui",
    live: "En direct",
    upcoming: "À venir",
    completed: "Terminés",
    final: "Terminé",
    groups: "Groupes",
    allGroups: "Tous les groupes",
    matches: "matchs",
    noMatches: "Aucun match dans cette vue pour le moment.",
    matchExplorer: "Explorer les matchs",
    selectedMatch: "Match sélectionné",
    quickRead: "Lecture rapide",
    forecast: "Prévision",
    teams: "Équipes",
    players: "Joueurs",
    weather: "Météo",
    confidence: "Confiance",
    chaos: "Chaos",
    projected: "Projeté",
    keyReasons: "Pourquoi le voyant penche ainsi",
    teamEdge: "Avantage",
    compareTeams: "Comparer les équipes",
    comparePlayers: "Étincelles joueurs",
    referee: "Arbitre",
    share: "Partager",
    copied: "Copié",
    shareError: "Échec copie",
    review: "Prévisions à des fins de divertissement et d’analyse sportive seulement. Aucun conseil de pari.",
    ad: "Espace sponsor",
    adCopy: "Futur espace publicitaire. Pas de paris sportifs, pas d’abonnement bizarre.",
    signal: "Signal oracle",
    askSeer: "Demander au voyant",
    reading: "Lecture",
    freshRead: "Lecture fraîche",
    seededRead: "Lecture de base",
    oracleError: "Le voyant a cligné. Réessaie.",
    dataStatus: "État des données",
    liveDatabase: "Base en direct",
    pendingMode: "Données réelles en attente",
    fallbackMode: "Données réelles en attente",
    dataDepth: "Niveau données",
    realFixtures: "Calendrier réel",
    noDemoFixtures: "Aucune donnée démo",
    venueWeather: "Stade + météo",
    connected: "Connecté",
    mapping: "Mappage en cours",
    aiLayer: "Couche IA",
    aiReady: "Prête à la demande",
  },
} satisfies Record<Language, Record<string, string>>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isLanguageOption(value: string | null): value is Language {
  return value === "en" || value === "es" || value === "fr";
}

type MatchesResponse = {
  source: "database" | "database-unavailable";
  reason: string;
  matches: Match[];
  database?: {
    hasDatabaseUrl: boolean;
    driver: string;
    note: string;
  };
};

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatchId, setActiveMatchId] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("forecast");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("today");
  const [groupFilter, setGroupFilter] = useState("all");
  const [dataInfo, setDataInfo] = useState<Pick<MatchesResponse, "source" | "reason" | "database">>({
    source: "database-unavailable",
    reason: "loading",
  });
  const [oracleReads, setOracleReads] = useState<Record<string, OracleResponse>>({});
  const [oracleStatus, setOracleStatus] = useState<Record<string, OracleStatus>>({});
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedLanguage = params.get("lang");
    const linkedMatchId = params.get("match");

    if (isLanguageOption(linkedLanguage)) {
      setLanguage(linkedLanguage);
    }

    if (linkedMatchId) {
      setActiveMatchId(linkedMatchId);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadMatches() {
      try {
        const response = await fetch("/api/matches", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as MatchesResponse;

        if (!ignore) {
          setDataInfo({
            source: payload.source,
            reason: payload.reason,
            database: payload.database,
          });
          setMatches(payload.matches);
          setActiveMatchId((current) => {
            if (payload.matches.length === 0) {
              return "";
            }

            return payload.matches.some((match) => match.id === current)
              ? current
              : payload.matches[0].id;
          });
        }
      } catch {
        if (!ignore) {
          setDataInfo({
            source: "database-unavailable",
            reason: "database-query-failed",
          });
          setMatches([]);
          setActiveMatchId("");
        }
      }
    }

    void loadMatches();

    return () => {
      ignore = true;
    };
  }, []);

  const activeMatch = useMemo(
    () => matches.find((match) => match.id === activeMatchId) ?? matches[0] ?? null,
    [activeMatchId, matches],
  );
  const t = copy[language];
  const oracleKey = activeMatch ? `${activeMatch.id}:${language}` : "";
  const activeOracleRead = activeMatch ? oracleReads[oracleKey] : undefined;
  const activeOracleStatus = activeMatch ? oracleStatus[oracleKey] ?? "idle" : "idle";
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const groups = useMemo(
    () => Array.from(new Set(matches.map((match) => match.group))).sort(),
    [matches],
  );
  const visibleMatches = useMemo(
    () =>
      matches.filter((match) => {
        const groupMatches = groupFilter === "all" || match.group === groupFilter;

        if (!groupMatches) {
          return false;
        }

        if (matchFilter === "today") {
          return isTodayMatch(match, todayKey);
        }

        if (matchFilter === "completed") {
          return match.status === "Final";
        }

        return match.status === "Upcoming" || match.status === "Live";
      }),
    [groupFilter, matchFilter, matches, todayKey],
  );
  const hasPendingWeather =
    !activeMatch ||
    activeMatch.weather.temp === "Pending" ||
    activeMatch.weather.wind === "Pending" ||
    activeMatch.weather.mood[language].toLowerCase().includes("pending");
  const dataSourceLabel =
    dataInfo.source === "database"
      ? t.liveDatabase
      : t.fallbackMode;

  useEffect(() => {
    if (
      visibleMatches.length > 0 &&
      !visibleMatches.some((match) => match.id === activeMatchId)
    ) {
      setActiveMatchId(visibleMatches[0].id);
      setActiveTab("forecast");
    }
  }, [activeMatchId, visibleMatches]);

  async function requestOracleRead(matchId: string, selectedLanguage: Language) {
    const key = `${matchId}:${selectedLanguage}`;
    setOracleStatus((current) => ({ ...current, [key]: "loading" }));

    try {
      const response = await fetch("/api/ai/forecast-interpretation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, language: selectedLanguage }),
      });

      if (!response.ok) {
        throw new Error("Oracle request failed");
      }

      const payload = (await response.json()) as OracleResponse;

      setOracleReads((current) => ({ ...current, [key]: payload }));
      setOracleStatus((current) => ({ ...current, [key]: "idle" }));
    } catch {
      setOracleStatus((current) => ({ ...current, [key]: "error" }));
    }
  }

  async function shareMatch(match: Match) {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("match", match.id);
    shareUrl.searchParams.set("lang", language);
    shareUrl.hash = "";

    const shareText = `${match.home.name} vs ${match.away.name}: ${match.forecast.projected} on MatchSeer. ${t.review}`;
    const shareData = {
      title: `MatchSeer: ${match.home.name} vs ${match.away.name}`,
      text: shareText,
      url: shareUrl.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      }

      setShareStatus("copied");
      window.setTimeout(() => setShareStatus("idle"), 2200);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setShareStatus("error");
      window.setTimeout(() => setShareStatus("idle"), 2200);
    }
  }

  if (!activeMatch) {
    return (
      <main className="app-shell">
        <section className="topbar" aria-label="MatchSeer header">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="eyebrow">MatchSeer</p>
              <h1>{t.matchday}</h1>
            </div>
          </div>
          <div className="language-switcher" aria-label="Language selector">
            <Languages size={17} />
            {(["en", "es", "fr"] as Language[]).map((option) => (
              <button
                className={cx("language-pill", language === option && "active")}
                key={option}
                onClick={() => setLanguage(option)}
                type="button"
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="data-status-grid" aria-label={t.dataStatus}>
          <DataStatusCard
            label={t.dataStatus}
            value={dataSourceLabel}
            detail={dataInfo.source === "database" ? dataInfo.database?.driver ?? "Neon" : dataInfo.reason}
            tone={dataInfo.source === "database" ? "good" : "watch"}
          />
          <DataStatusCard
            label={t.dataDepth}
            value={t.noDemoFixtures}
            detail={`0 ${t.matches}`}
            tone="watch"
          />
          <DataStatusCard
            label={t.venueWeather}
            value={t.mapping}
            detail={t.noMatches}
            tone="watch"
          />
          <DataStatusCard
            label={t.aiLayer}
            value={t.aiReady}
            detail="OpenAI"
            tone="neutral"
          />
        </section>

        <section className="content-grid">
          <aside className="match-rail" aria-label="Match list">
            <div className="section-heading">
              <CalendarDays size={18} />
              <span>{t.matchExplorer}</span>
            </div>
            <div className="match-filter-panel">
              <div className="match-filter-tabs" aria-label="Match filters">
                {(["today", "upcoming", "completed"] as MatchFilter[]).map((filter) => (
                  <button
                    className={cx("filter-pill", matchFilter === filter && "active")}
                    key={filter}
                    onClick={() => setMatchFilter(filter)}
                    type="button"
                  >
                    {t[filter]}
                  </button>
                ))}
              </div>
              <div className="group-chip-panel" aria-label={t.groups}>
                <button className="group-chip active" type="button">
                  {t.allGroups}
                </button>
              </div>
              <p className="match-count">
                0 / 0 {t.matches}
              </p>
            </div>
            <div className="empty-match-state">{t.noMatches}</div>
          </aside>

          <section className="detail-panel empty-detail-panel">
            <div className="empty-match-state">{t.noDemoFixtures}</div>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="MatchSeer header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="eyebrow">MatchSeer</p>
            <h1>{t.matchday}</h1>
          </div>
        </div>
        <div className="language-switcher" aria-label="Language selector">
          <Languages size={17} />
          {(["en", "es", "fr"] as Language[]).map((option) => (
            <button
              className={cx("language-pill", language === option && "active")}
              key={option}
              onClick={() => setLanguage(option)}
              type="button"
            >
              {option.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="hero-kicker-row">
            <div className="status-chip">
              <Radio size={15} />
              {t.today}
            </div>
            <span>{activeMatch.group}</span>
          </div>
          <div className="hero-match-summary">
            <strong>{activeMatch.home.name}</strong>
            <span>vs</span>
            <strong>{activeMatch.away.name}</strong>
          </div>
          <h2>{t.subtitle}</h2>
          <div className="hero-meta-grid">
            <MetaItem icon={<MapPin size={16} />} label={activeMatch.venue} value={activeMatch.city} />
            <MetaItem
              icon={<Clock3 size={16} />}
              label={t[activeMatch.status.toLowerCase() as "live" | "upcoming" | "final"]}
              value={activeMatch.minute ?? activeMatch.time}
            />
            <MetaItem icon={<Activity size={16} />} label={t.forecast} value={activeMatch.forecast.projected} />
          </div>
          <div className="quick-signals">
            <Signal label={t.confidence} value={`${activeMatch.forecast.confidence}%`} />
            <Signal label={t.chaos} value={`${activeMatch.forecast.chaos}%`} />
            <Signal label={t.projected} value={activeMatch.forecast.projected} />
          </div>
        </div>

        <div className="seer-access-panel">
          <p className="eyebrow">{t.selectedMatch}</p>
          <div className="seer-teams">
            <strong>{activeMatch.home.name}</strong>
            <span>vs</span>
            <strong>{activeMatch.away.name}</strong>
          </div>
          <div className="seer-context">
            <span>{activeMatch.group}</span>
            <span>{formatMatchSchedule(activeMatch)}</span>
            <span>{activeMatch.venue}</span>
          </div>
          <button
            className="seer-primary-button"
            disabled={activeOracleStatus === "loading"}
            onClick={() => requestOracleRead(activeMatch.id, language)}
            type="button"
          >
            {activeOracleStatus === "loading" ? (
              <LoaderCircle className="spin-icon" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            {activeOracleStatus === "loading" ? t.reading : t.askSeer}
          </button>
          <div className="seer-mini-grid">
            <Signal label={t.confidence} value={`${activeMatch.forecast.confidence}%`} />
            <Signal label={t.weather} value={activeMatch.weather.temp} />
          </div>
        </div>
      </section>

      <section className="data-status-grid" aria-label={t.dataStatus}>
        <DataStatusCard
          label={t.dataStatus}
          value={dataSourceLabel}
          detail={dataInfo.source === "database" ? dataInfo.database?.driver ?? "Neon" : dataInfo.reason}
          tone={dataInfo.source === "database" ? "good" : "watch"}
        />
        <DataStatusCard
          label={t.dataDepth}
          value={dataInfo.source === "database" ? t.realFixtures : t.noDemoFixtures}
          detail={`${matches.length} matches`}
          tone={dataInfo.source === "database" ? "good" : "watch"}
        />
        <DataStatusCard
          label={t.venueWeather}
          value={hasPendingWeather ? t.mapping : t.connected}
          detail={`${activeMatch.venue} · ${activeMatch.weather.temp}`}
          tone={hasPendingWeather ? "watch" : "good"}
        />
        <DataStatusCard
          label={t.aiLayer}
          value={activeOracleRead?.source === "openai" ? t.freshRead : t.aiReady}
          detail={activeOracleRead?.model ?? "OpenAI"}
          tone={activeOracleRead?.source === "openai" ? "good" : "neutral"}
        />
      </section>

      <section className="content-grid">
        <aside className="match-rail" aria-label="Match list">
          <div className="section-heading">
            <CalendarDays size={18} />
            <span>{t.matchExplorer}</span>
          </div>
          <div className="match-filter-panel">
            <div className="match-filter-tabs" aria-label="Match filters">
              {(["today", "upcoming", "completed"] as MatchFilter[]).map((filter) => (
                <button
                  className={cx("filter-pill", matchFilter === filter && "active")}
                  key={filter}
                  onClick={() => setMatchFilter(filter)}
                  type="button"
                >
                  {t[filter]}
                </button>
              ))}
            </div>
            <div className="group-chip-panel" aria-label={t.groups}>
              <button
                className={cx("group-chip", groupFilter === "all" && "active")}
                onClick={() => setGroupFilter("all")}
                type="button"
              >
                {t.allGroups}
              </button>
              {groups.map((group) => (
                <button
                  className={cx("group-chip", groupFilter === group && "active")}
                  key={group}
                  onClick={() => setGroupFilter(group)}
                  type="button"
                >
                  {group}
                </button>
              ))}
            </div>
            <p className="match-count">
              {visibleMatches.length} / {matches.length} {t.matches}
            </p>
          </div>
          <div className="match-list">
            {visibleMatches.length === 0 && (
              <div className="empty-match-state">{t.noMatches}</div>
            )}
            {visibleMatches.map((match) => (
              <button
                className={cx("match-card", activeMatch.id === match.id && "selected")}
                key={match.id}
                onClick={() => {
                  setActiveMatchId(match.id);
                  setActiveTab("forecast");
                }}
                type="button"
              >
                <div className="match-card-top">
                  <span className={cx("status-dot", match.status.toLowerCase())} />
                  <span>{t[match.status.toLowerCase() as "live" | "upcoming" | "final"]}</span>
                  <span>{formatMatchSchedule(match)}</span>
                </div>
                <TeamLine team={match.home} score={match.score?.split(" - ")[0]} />
                <TeamLine team={match.away} score={match.score?.split(" - ")[1]} />
                <div className="match-card-footer">
                  <span>{match.group}</span>
                  <span className="quick-read-label">
                    <Sparkles size={14} />
                    {t.quickRead}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="ad-card">
            <div className="section-heading">
              <ShieldCheck size={17} />
              <span>{t.ad}</span>
            </div>
            <p>{t.adCopy}</p>
          </div>
        </aside>

        <section className="detail-panel">
          <div className="match-hero">
            <div>
              <p className="eyebrow">{activeMatch.venue} · {activeMatch.city}</p>
              <div className="teams-title">
                <TeamBadge team={activeMatch.home} />
                <span className="versus">vs</span>
                <TeamBadge team={activeMatch.away} />
              </div>
            </div>
            <div className="detail-actions">
              <button
                className="seer-inline-button"
                disabled={activeOracleStatus === "loading"}
                onClick={() => requestOracleRead(activeMatch.id, language)}
                type="button"
              >
                {activeOracleStatus === "loading" ? (
                  <LoaderCircle className="spin-icon" size={17} />
                ) : (
                  <Sparkles size={17} />
                )}
                {activeOracleStatus === "loading" ? t.reading : t.askSeer}
              </button>
              <div className="match-score-card">
                <span>{t[activeMatch.status.toLowerCase() as "live" | "upcoming" | "final"]}</span>
                <strong>{activeMatch.score ?? activeMatch.time}</strong>
                <small>{t.projected}: {activeMatch.forecast.projected}</small>
              </div>
              <button className="share-button" onClick={() => shareMatch(activeMatch)} type="button">
                {shareStatus === "copied" ? <Check size={17} /> : <Share2 size={17} />}
                {shareStatus === "copied" && t.copied}
                {shareStatus === "error" && t.shareError}
                {shareStatus === "idle" && t.share}
              </button>
            </div>
          </div>

          <nav className="tabs" aria-label="Match detail tabs">
            {(["forecast", "teams", "players", "weather"] as Tab[]).map((tab) => (
              <button
                className={cx("tab", activeTab === tab && "active")}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab === "forecast" && <Sparkles size={16} />}
                {tab === "teams" && <UsersRound size={16} />}
                {tab === "players" && <Zap size={16} />}
                {tab === "weather" && <CloudSun size={16} />}
                {t[tab]}
              </button>
            ))}
          </nav>

          {activeTab === "forecast" && (
            <ForecastView
              match={activeMatch}
              t={t}
              language={language}
              oracleRead={activeOracleRead}
              oracleStatus={activeOracleStatus}
              onAskSeer={() => requestOracleRead(activeMatch.id, language)}
            />
          )}
          {activeTab === "teams" && <TeamsView match={activeMatch} t={t} />}
          {activeTab === "players" && <PlayersView match={activeMatch} t={t} />}
          {activeTab === "weather" && <WeatherView match={activeMatch} t={t} language={language} />}
        </section>
      </section>
    </main>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="signal">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function toDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Toronto",
    year: "numeric",
  }).format(date);
}

function isTodayMatch(match: Match, todayKey: string) {
  if (!match.startsAt) {
    return match.status !== "Upcoming";
  }

  return toDateKey(new Date(match.startsAt)) === todayKey;
}

function formatMatchSchedule(match: Match) {
  if (match.status === "Final") {
    return match.time;
  }

  if (!match.startsAt) {
    return match.minute ?? match.time;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/Toronto",
  }).format(new Date(match.startsAt));
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="meta-item">
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DataStatusCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "watch" | "neutral";
}) {
  return (
    <div className={cx("data-status-card", tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function TeamLine({ team, score }: { team: Team; score?: string }) {
  return (
    <div className="team-line">
      <span className="team-dot" style={{ background: team.color }} />
      <strong>{team.name}</strong>
      {score && <span className="score">{score}</span>}
    </div>
  );
}

function TeamBadge({ team }: { team: Team }) {
  return (
    <div className="team-badge">
      <span style={{ background: team.color }}>{team.code}</span>
      <strong>{team.name}</strong>
    </div>
  );
}

function ForecastView({
  match,
  t,
  language,
  oracleRead,
  oracleStatus,
  onAskSeer,
}: {
  match: Match;
  t: Record<string, string>;
  language: Language;
  oracleRead?: OracleResponse;
  oracleStatus: OracleStatus;
  onAskSeer: () => void;
}) {
  const interpretation = oracleRead?.interpretation;
  const signalCopy = interpretation?.summary ?? match.forecast.tone[language];
  const reasons =
    interpretation?.keyFactors.map((factor) => factor.explanation) ??
    match.forecast.reasons[language];
  const readLabel = oracleRead?.source === "openai" ? t.freshRead : t.seededRead;

  return (
    <div className="forecast-layout">
      <div className="forecast-card primary-card">
        <div className="forecast-card-head">
          <div className="section-heading">
            <Sparkles size={18} />
            <span>{t.signal}</span>
          </div>
          <div className="oracle-actions">
            <span className={cx("oracle-source", oracleRead?.source === "openai" && "fresh")}>
              {readLabel}
            </span>
            <button
              className="oracle-button"
              disabled={oracleStatus === "loading"}
              onClick={onAskSeer}
              type="button"
            >
              {oracleStatus === "loading" ? (
                <LoaderCircle className="spin-icon" size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {oracleStatus === "loading" ? t.reading : t.askSeer}
            </button>
          </div>
        </div>
        {interpretation?.headline && <p className="oracle-headline">{interpretation.headline}</p>}
        <p className="seer-line">{signalCopy}</p>
        {oracleStatus === "error" && <p className="oracle-error">{t.oracleError}</p>}
        <div className="probability-grid">
          <Probability label={match.home.code} value={match.forecast.home} color={match.home.color} />
          <Probability label="DRAW" value={match.forecast.draw} color="#8b8f98" />
          <Probability label={match.away.code} value={match.forecast.away} color={match.away.color} />
        </div>
        <div className="metric-row">
          <Meter label={t.confidence} value={match.forecast.confidence} />
          <Meter label={t.chaos} value={match.forecast.chaos} hot />
        </div>
      </div>

      <div className="forecast-card">
        <div className="section-heading">
          <BarChart3 size={18} />
          <span>{t.keyReasons}</span>
        </div>
        <ul className="reason-list">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="disclaimer">{interpretation?.disclaimer ?? t.review}</p>
      </div>
    </div>
  );
}

function Probability({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="probability">
      <div className="probability-ring" style={{ "--ring-color": color, "--ring-value": `${value * 3.6}deg` } as React.CSSProperties}>
        <span>{value}%</span>
      </div>
      <strong>{label}</strong>
    </div>
  );
}

function Meter({ label, value, hot = false }: { label: string; value: number; hot?: boolean }) {
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="meter-track">
        <span className={cx("meter-fill", hot && "hot")} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function TeamsView({ match, t }: { match: Match; t: Record<string, string> }) {
  const rows = [
    ["Attack", match.home.attack, match.away.attack],
    ["Control", match.home.control, match.away.control],
    ["Defense", match.home.defense, match.away.defense],
    ["Set pieces", match.home.setPieces, match.away.setPieces],
  ] as const;

  return (
    <div className="comparison-card">
      <div className="section-heading">
        <UsersRound size={18} />
        <span>{t.compareTeams}</span>
      </div>
      <div className="team-comparison-header">
        <TeamBadge team={match.home} />
        <TeamBadge team={match.away} />
      </div>
      <div className="comparison-rows">
        {rows.map(([label, home, away]) => (
          <div className="comparison-row" key={label}>
            <strong>{home}</strong>
            <div>
              <span>{label}</span>
              <div className="split-meter">
                <span style={{ width: `${home}%`, background: match.home.color }} />
                <span style={{ width: `${away}%`, background: match.away.color }} />
              </div>
            </div>
            <strong>{away}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlayersView({ match, t }: { match: Match; t: Record<string, string> }) {
  return (
    <div className="players-grid">
      <div className="section-heading full">
        <Zap size={18} />
        <span>{t.comparePlayers}</span>
      </div>
      {match.players.map((player) => (
        <article className="player-card" key={player.name}>
          <div>
            <span className="player-team">{player.team}</span>
            <h3>{player.name}</h3>
            <p>{player.role} · {player.club}</p>
          </div>
          <div className="spark-score">
            <Sparkles size={16} />
            {player.spark}
          </div>
          <div className="player-meta">
            <span>{player.league}</span>
            <span>{player.note}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function WeatherView({
  match,
  t,
  language,
}: {
  match: Match;
  t: Record<string, string>;
  language: Language;
}) {
  return (
    <div className="weather-grid">
      <div className="weather-card">
        <CloudSun size={22} />
        <span>Temp</span>
        <strong>{match.weather.temp}</strong>
      </div>
      <div className="weather-card">
        <Wind size={22} />
        <span>Wind</span>
        <strong>{match.weather.wind}</strong>
      </div>
      <div className="weather-card wide">
        <RefreshCcw size={22} />
        <span>{t.weather}</span>
        <strong>{match.weather.mood[language]}</strong>
      </div>
      <div className="weather-card wide">
        <Trophy size={22} />
        <span>{t.referee}</span>
        <strong>{match.referee.name} · {match.referee.cardRisk}</strong>
      </div>
    </div>
  );
}
