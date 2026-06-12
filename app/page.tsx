"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  CloudSun,
  Languages,
  LoaderCircle,
  MapPin,
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
type MatchFilter = "next" | "today" | "upcoming" | "completed" | "all";
type OracleStatus = "idle" | "loading" | "error";
type ShareStatus = "idle" | "copied" | "error";
type CupCandidate = {
  team: Team;
  score: number;
  signal: number;
  matches: number;
  expectedPoints: number;
  pathSignal: number;
  traits: string[];
  verdict: string;
  risk: string;
};
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
    mission: "Pick a match, ask the Seer, then explore the teams, players, venue, and weather behind the read.",
    heroExplorerTitle: "Find the match signal",
    heroExplorerCopy: "Filter by timing or group, pick a fixture, and send it to the Seer for the full read.",
    noBetting: "No betting energy",
    realStats: "Real stats",
    seerHub: "Seer command center",
    supportingDetails: "Supporting details",
    today: "Today",
    next: "Next",
    all: "All",
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
    pending: "Pending",
    refereePending: "Assignment pending",
    aiLayer: "AI layer",
    aiReady: "Ready on demand",
    cupSeer: "Weekly Cup Seer",
    cupSeerTitle: "Who is in the final-six lane?",
    cupSeerIntro: "Pre-round pulse: the Seer treats every group match as unplayed, forecasts each team path, and ranks the six strongest cup lanes.",
    cupPulse: "Weekly pulse",
    cupSignal: "Finalist signal",
    seerVerdict: "Seer verdict",
    riskCloud: "Risk cloud",
    noCupCandidates: "The cup lens needs real synced teams before it can wake up.",
    seerLenses: "How the Seer thinks",
    seerLensesDetail: "Five lenses. One smarter match read.",
    lensForm: "Form",
    lensFormCopy: "Recent results, team rhythm, and tournament temperature.",
    lensMomentum: "Momentum",
    lensMomentumCopy: "Confidence shifts, late pressure, and chaos control.",
    lensVenue: "Venue",
    lensVenueCopy: "Home edge, altitude, travel, surface, and crowd signal.",
    lensWeather: "Weather",
    lensWeatherCopy: "Temperature, wind, humidity, and how the match might bite.",
    lensRisk: "Upset risk",
    lensRiskCopy: "Style clashes, volatility, and the weird little doors in a fixture.",
    navHow: "How it works",
    navForecasts: "Forecasts",
    navSeer: "Ask the Seer",
    navCup: "Cup Seer",
  },
  es: {
    matchday: "Pronóstico del día",
    subtitle: "Estadísticas reales, lecturas divertidas, cero energía de apuestas.",
    mission: "Elige un partido, pregunta al Vidente y explora equipos, jugadores, estadio y clima detrás de la lectura.",
    heroExplorerTitle: "Encuentra la señal del partido",
    heroExplorerCopy: "Filtra por horario o grupo, elige un partido y mándalo al Vidente para la lectura completa.",
    noBetting: "Cero energía de apuestas",
    realStats: "Datos reales",
    seerHub: "Centro del Vidente",
    supportingDetails: "Detalles de apoyo",
    today: "Hoy",
    next: "Siguiente",
    all: "Todos",
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
    pending: "Pendiente",
    refereePending: "Asignación pendiente",
    aiLayer: "Capa IA",
    aiReady: "Lista al pedir",
    cupSeer: "Vidente semanal de la copa",
    cupSeerTitle: "¿Quién entra en la vía de los seis finalistas?",
    cupSeerIntro: "Pulso previo: el Vidente trata cada partido de grupo como no jugado, proyecta el camino de cada equipo y ordena las seis rutas más fuertes.",
    cupPulse: "Pulso semanal",
    cupSignal: "Señal finalista",
    seerVerdict: "Veredicto vidente",
    riskCloud: "Nube de riesgo",
    noCupCandidates: "La lente de copa necesita equipos reales sincronizados para despertar.",
    seerLenses: "Cómo piensa el Vidente",
    seerLensesDetail: "Cinco lentes. Una lectura más inteligente.",
    lensForm: "Forma",
    lensFormCopy: "Resultados recientes, ritmo del equipo y temperatura del torneo.",
    lensMomentum: "Impulso",
    lensMomentumCopy: "Cambios de confianza, presión final y control del caos.",
    lensVenue: "Estadio",
    lensVenueCopy: "Localía, altitud, viaje, superficie y señal de ambiente.",
    lensWeather: "Clima",
    lensWeatherCopy: "Temperatura, viento, humedad y cómo puede morder el partido.",
    lensRisk: "Riesgo sorpresa",
    lensRiskCopy: "Choques de estilo, volatilidad y puertas raras del partido.",
    navHow: "Cómo funciona",
    navForecasts: "Pronósticos",
    navSeer: "Preguntar",
    navCup: "Copa",
  },
  fr: {
    matchday: "Prévision du jour",
    subtitle: "Vraies stats, lectures ludiques, zéro énergie pari.",
    mission: "Choisis un match, demande au voyant, puis explore les équipes, joueurs, stade et météo derrière la lecture.",
    heroExplorerTitle: "Trouve le signal du match",
    heroExplorerCopy: "Filtre par moment ou groupe, choisis une affiche et envoie-la au voyant pour la lecture complète.",
    noBetting: "Zéro énergie pari",
    realStats: "Vraies stats",
    seerHub: "Centre du voyant",
    supportingDetails: "Détails d’appui",
    today: "Aujourd’hui",
    next: "Prochain",
    all: "Tous",
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
    pending: "En attente",
    refereePending: "Affectation en attente",
    aiLayer: "Couche IA",
    aiReady: "Prête à la demande",
    cupSeer: "Voyant hebdo de la coupe",
    cupSeerTitle: "Qui entre dans la voie des six finalistes ?",
    cupSeerIntro: "Pulse d’avant-tour : le voyant traite chaque match de groupe comme non joué, projette le chemin de chaque équipe et classe les six routes les plus fortes.",
    cupPulse: "Pulse hebdo",
    cupSignal: "Signal finaliste",
    seerVerdict: "Verdict du voyant",
    riskCloud: "Nuage de risque",
    noCupCandidates: "La lentille coupe a besoin d’équipes réelles synchronisées pour se réveiller.",
    seerLenses: "Comment pense le voyant",
    seerLensesDetail: "Cinq lentilles. Une lecture plus intelligente.",
    lensForm: "Forme",
    lensFormCopy: "Résultats récents, rythme d’équipe et température du tournoi.",
    lensMomentum: "Momentum",
    lensMomentumCopy: "Glissements de confiance, pression tardive et contrôle du chaos.",
    lensVenue: "Stade",
    lensVenueCopy: "Avantage local, altitude, voyage, surface et signal du public.",
    lensWeather: "Météo",
    lensWeatherCopy: "Température, vent, humidité et la façon dont le match peut mordre.",
    lensRisk: "Risque surprise",
    lensRiskCopy: "Styles opposés, volatilité et petites portes étranges du match.",
    navHow: "Mode d’emploi",
    navForecasts: "Prévisions",
    navSeer: "Demander",
    navCup: "Coupe",
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
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("next");
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

    async function loadMatches(refreshLiveData = false) {
      try {
        const response = await fetch(
          refreshLiveData ? "/api/matches?refresh=live" : "/api/matches",
          { cache: "no-store" },
        );

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
    const liveRefresh = window.setInterval(() => {
      void loadMatches(true);
    }, 60_000);

    return () => {
      ignore = true;
      window.clearInterval(liveRefresh);
    };
  }, []);

  const activeMatch = useMemo(
    () => matches.find((match) => match.id === activeMatchId) ?? matches[0] ?? null,
    [activeMatchId, matches],
  );
  const t = copy[language];
  const oracleKey = activeMatch ? oracleReadKey(activeMatch, language) : "";
  const activeOracleRead = activeMatch ? oracleReads[oracleKey] : undefined;
  const activeOracleStatus = activeMatch ? oracleStatus[oracleKey] ?? "idle" : "idle";
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const groups = useMemo(
    () => Array.from(new Set(matches.map((match) => match.group))).sort(),
    [matches],
  );
  const visibleMatches = useMemo(() => {
    const groupMatches = matches.filter(
      (match) => groupFilter === "all" || match.group === groupFilter,
    );

    if (matchFilter === "all") {
      return groupMatches;
    }

    if (matchFilter === "next") {
      const nextMatch =
        groupMatches.find((match) => match.status === "Live") ??
        groupMatches.find((match) => match.status === "Upcoming") ??
        groupMatches[0];

      return nextMatch ? [nextMatch] : [];
    }

    if (matchFilter === "today") {
      return groupMatches.filter((match) => isTodayMatch(match, todayKey));
    }

    if (matchFilter === "completed") {
      return groupMatches.filter((match) => match.status === "Final");
    }

    return groupMatches.filter(
      (match) => match.status === "Upcoming" || match.status === "Live",
    );
  }, [groupFilter, matchFilter, matches, todayKey]);
  const cupCandidates = useMemo(() => buildCupCandidates(matches, language), [matches, language]);
  const cupPulseLabel = useMemo(() => getCupPulseLabel(language), [language]);
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
    const match = matches.find((item) => item.id === matchId);
    const key = match
      ? oracleReadKey(match, selectedLanguage)
      : `${matchId}:${selectedLanguage}`;
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
              <h1>{t.subtitle}</h1>
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
                {(["next", "today", "upcoming", "completed", "all"] as MatchFilter[]).map((filter) => (
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

  const activeAccents = matchAccentColors(activeMatch);

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="MatchSeer header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <span className="brand-ball" aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">MatchSeer</p>
            <h1>{t.subtitle}</h1>
          </div>
        </div>
        <nav className="main-nav" aria-label="Primary navigation">
          <a href="#seer-lenses">{t.navHow}</a>
          <a href="#forecast-board">{t.navForecasts}</a>
          <a href="#ask-seer">{t.navSeer}</a>
          <a href="#cup-seer">{t.navCup}</a>
        </nav>
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

      <section className="hero-grid hero-matchroom" id="forecast-board">
        <div className="hero-match-board">
          <div className="hero-match-board-header">
            <div className="hero-board-copy">
              <div className="section-heading">
                <CalendarDays size={18} />
                <span>{t.matchExplorer}</span>
              </div>
              <h2>{t.heroExplorerTitle}</h2>
              <p>{t.heroExplorerCopy}</p>
            </div>
            <div className="hero-board-count">
              <strong>{visibleMatches.length}</strong>
              <span>/ {matches.length} {t.matches}</span>
            </div>
          </div>

          <div className="match-filter-panel hero-match-filters">
            <div className="match-filter-tabs" aria-label="Match filters">
              {(["next", "today", "upcoming", "completed", "all"] as MatchFilter[]).map((filter) => (
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
          </div>

          <div className="hero-match-list">
            {visibleMatches.length === 0 && (
              <div className="empty-match-state">{t.noMatches}</div>
            )}
            {visibleMatches.map((match) => {
              const accents = matchAccentColors(match);

              return (
                <button
                  className={cx("hero-match-card", activeMatch.id === match.id && "selected")}
                  key={match.id}
                  onClick={() => {
                    setActiveMatchId(match.id);
                    setActiveTab("forecast");
                  }}
                  type="button"
                >
                  <div className="hero-card-status">
                    <span className={cx("status-dot", match.status.toLowerCase())} />
                    <span>{t[match.status.toLowerCase() as "live" | "upcoming" | "final"]}</span>
                    <strong>{formatMatchSchedule(match)}</strong>
                  </div>
                  <div className="hero-card-teams">
                    <div className="hero-card-team">
                      <TeamFlag accentColor={accents.home} team={match.home} />
                      <strong>{match.home.name}</strong>
                      {match.score && <span>{match.score.split(" - ")[0]}</span>}
                    </div>
                    <div className="hero-card-team">
                      <TeamFlag accentColor={accents.away} team={match.away} />
                      <strong>{match.away.name}</strong>
                      {match.score && <span>{match.score.split(" - ")[1]}</span>}
                    </div>
                  </div>
                  <div className="hero-card-footer">
                    <span>{match.group}</span>
                    <span>{match.venue}</span>
                    <span>{t.projected}: {match.forecast.projected}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="seer-access-panel seer-command-panel hero-selected-panel" id="ask-seer">
          <div className="seer-panel-header">
            <div>
              <p className="eyebrow">{t.seerHub}</p>
              <h2 className="seer-panel-title">{t.matchday}</h2>
              <div className="seer-teams">
                <div className="seer-team-name">
                  <TeamFlag accentColor={activeAccents.home} team={activeMatch.home} />
                  <strong>{activeMatch.home.name}</strong>
                </div>
                <span>vs</span>
                <div className="seer-team-name">
                  <TeamFlag accentColor={activeAccents.away} team={activeMatch.away} />
                  <strong>{activeMatch.away.name}</strong>
                </div>
              </div>
              <div className="seer-context">
                <span>{activeMatch.group}</span>
                <span>{formatMatchSchedule(activeMatch)}</span>
                <span>{activeMatch.venue}</span>
                <span>{activeMatch.weather.temp}</span>
              </div>
            </div>
            <div className="match-score-card seer-score-card">
              <span>{t[activeMatch.status.toLowerCase() as "live" | "upcoming" | "final"]}</span>
              <strong>{activeMatch.score ?? activeMatch.time}</strong>
              <small>{t.projected}: {activeMatch.forecast.projected}</small>
            </div>
          </div>

          <div className="seer-action-row">
            <button
              className="seer-primary-button"
              disabled={activeOracleStatus === "loading"}
              onClick={() => {
                setActiveTab("forecast");
                void requestOracleRead(activeMatch.id, language);
              }}
              type="button"
            >
              {activeOracleStatus === "loading" ? (
                <LoaderCircle className="spin-icon" size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {activeOracleStatus === "loading" ? t.reading : t.askSeer}
            </button>
            <button className="share-button seer-share-button" onClick={() => shareMatch(activeMatch)} type="button">
              {shareStatus === "copied" ? <Check size={17} /> : <Share2 size={17} />}
              {shareStatus === "copied" && t.copied}
              {shareStatus === "error" && t.shareError}
              {shareStatus === "idle" && t.share}
            </button>
          </div>

          <div className="hero-selected-metrics">
            <span>
              <small>{t.confidence}</small>
              <strong>{activeMatch.forecast.confidence}%</strong>
            </span>
            <span>
              <small>{t.weather}</small>
              <strong>{activeMatch.weather.temp}</strong>
            </span>
            <span>
              <small>{t.projected}</small>
              <strong>{activeMatch.forecast.projected}</strong>
            </span>
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

      <section className="content-grid content-grid-support">
        <section className="detail-panel">
          <div className="detail-support-header">
            <div className="section-heading">
              <BarChart3 size={18} />
              <span>{t.supportingDetails}</span>
            </div>
            <p>{activeMatch.venue} · {activeMatch.city} · {formatMatchSchedule(activeMatch)}</p>
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

      <CupSeerBoard
        candidates={cupCandidates}
        language={language}
        onSelectTeam={(teamName) => {
          const candidateMatch = matches.find(
            (match) =>
              match.home.name === teamName || match.away.name === teamName,
          );

          if (candidateMatch) {
            setActiveMatchId(candidateMatch.id);
            setActiveTab("forecast");
          }
        }}
        pulseLabel={cupPulseLabel}
        t={t}
      />

      <SeerLensStrip t={t} />
    </main>
  );
}

function oracleReadKey(match: Match, language: Language) {
  return `${match.id}:${match.status}:${match.score ?? match.time}:${language}`;
}

function buildCupCandidates(matches: Match[], language: Language): CupCandidate[] {
  const teamMap = new Map<
    string,
    {
      team: Team;
      forecastSignals: number[];
      chaosSignals: number[];
      expectedPoints: number;
      pathSignals: number[];
      matches: number;
    }
  >();

  for (const match of matches) {
    const projection = projectFixturePath(match.home, match.away, match.forecast.chaos);

    addCupTeam(teamMap, {
      team: match.home,
      forecastSignal: projection.homeWin,
      chaosSignal: match.forecast.chaos,
      expectedPoints: projection.homeExpectedPoints,
      pathSignal: projection.homePathSignal,
    });
    addCupTeam(teamMap, {
      team: match.away,
      forecastSignal: projection.awayWin,
      chaosSignal: match.forecast.chaos,
      expectedPoints: projection.awayExpectedPoints,
      pathSignal: projection.awayPathSignal,
    });
  }

  return Array.from(teamMap.values())
    .map((entry) => {
      const teamCore = teamTournamentPower(entry.team);
      const averageForecast = average(entry.forecastSignals);
      const averageChaos = average(entry.chaosSignals);
      const pathSignal = average(entry.pathSignals);
      const pointsPerMatch = entry.expectedPoints / Math.max(entry.matches, 1);
      const signal = clamp(
        Math.round(
          teamCore * 0.58 +
            pathSignal * 0.22 +
            averageForecast * 0.12 +
            pointsPerMatch * 5 -
            averageChaos * 0.04,
        ),
        1,
        99,
      );

      return {
        team: entry.team,
        score: signal,
        signal,
        matches: entry.matches,
        expectedPoints: entry.expectedPoints,
        pathSignal,
        traits: cupTraits(entry.team, pathSignal),
        verdict: cupVerdict(entry.team, signal, pointsPerMatch, pathSignal, language),
        risk: cupRisk(entry.team, averageChaos, pathSignal, language),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

function addCupTeam(
  teamMap: Map<
    string,
    {
      team: Team;
      forecastSignals: number[];
      chaosSignals: number[];
      expectedPoints: number;
      pathSignals: number[];
      matches: number;
    }
  >,
  update: {
    team: Team;
    forecastSignal: number;
    chaosSignal: number;
    expectedPoints: number;
    pathSignal: number;
  },
) {
  const current =
    teamMap.get(update.team.name) ??
    {
      team: update.team,
      forecastSignals: [],
      chaosSignals: [],
      expectedPoints: 0,
      pathSignals: [],
      matches: 0,
    };

  current.forecastSignals.push(update.forecastSignal);
  current.chaosSignals.push(update.chaosSignal);
  current.expectedPoints += update.expectedPoints;
  current.pathSignals.push(update.pathSignal);
  current.matches += 1;
  teamMap.set(update.team.name, current);
}

function projectFixturePath(home: Team, away: Team, chaos: number) {
  const homePower = teamTournamentPower(home);
  const awayPower = teamTournamentPower(away);
  const powerGap = homePower - awayPower;
  const draw = clamp(Math.round(26 + chaos * 0.04 - Math.abs(powerGap) * 0.12), 18, 31);
  const nonDrawPool = 100 - draw;
  const homeShare = 1 / (1 + Math.exp(-powerGap / 13));
  const homeWin = clamp(Math.round(nonDrawPool * homeShare), 8, 84);
  const awayWin = clamp(100 - draw - homeWin, 8, 84);

  return {
    homeWin,
    awayWin,
    homeExpectedPoints: (homeWin * 3 + draw) / 100,
    awayExpectedPoints: (awayWin * 3 + draw) / 100,
    homePathSignal: clamp(Math.round(homePower * 0.72 + homeWin * 0.28), 1, 99),
    awayPathSignal: clamp(Math.round(awayPower * 0.72 + awayWin * 0.28), 1, 99),
  };
}

function teamTournamentPower(team: Team) {
  const prior = teamPowerPrior(team);
  const ratings =
    team.attack * 0.27 +
    team.control * 0.25 +
    team.defense * 0.25 +
    team.setPieces * 0.13 +
    formScore(team.form) * 0.1;

  return clamp(Math.round(prior * 0.72 + ratings * 0.28), 1, 99);
}

function teamPowerPrior(team: Team) {
  const key = normalizeTeamKey(team.name);
  const code = team.code.toUpperCase();
  const knownPower =
    tournamentPowerByName[key] ??
    tournamentPowerByCode[code] ??
    58;

  return knownPower;
}

const tournamentPowerByName: Record<string, number> = {
  algeria: 63,
  argentina: 93,
  australia: 61,
  austria: 70,
  belgium: 82,
  brazil: 91,
  canada: 66,
  chile: 67,
  colombia: 80,
  croatia: 80,
  czechia: 69,
  denmark: 76,
  ecuador: 72,
  england: 90,
  france: 94,
  germany: 88,
  ghana: 66,
  italy: 84,
  japan: 75,
  korea: 71,
  "korea republic": 71,
  mexico: 73,
  morocco: 78,
  netherlands: 87,
  nigeria: 72,
  paraguay: 66,
  poland: 70,
  portugal: 88,
  qatar: 58,
  scotland: 68,
  senegal: 76,
  serbia: 72,
  spain: 92,
  switzerland: 75,
  tunisia: 62,
  uruguay: 82,
  usa: 75,
  "united states": 75,
};

const tournamentPowerByCode: Record<string, number> = {
  ARG: 93,
  BRA: 91,
  ENG: 90,
  FRA: 94,
  GER: 88,
  NED: 87,
  POR: 88,
  ESP: 92,
};

function normalizeTeamKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cupTraits(team: Team, pathSignal: number) {
  const traits: Array<[string, number]> = [
    ["Attack", team.attack],
    ["Control", team.control],
    ["Defense", team.defense],
    ["Set pieces", team.setPieces],
    ["Path", pathSignal],
  ];

  return traits
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label]) => label);
}

function cupVerdict(
  team: Team,
  signal: number,
  pointsPerMatch: number,
  pathSignal: number,
  language: Language,
) {
  const bestTrait = cupTraits(team, pathSignal)[0]?.toLowerCase() ?? "balance";
  const expectedText = pointsPerMatch.toFixed(1);

  if (language === "es") {
    return `${team.name} sí parece carril finalista: ${signal}% de señal, ${bestTrait} como punto fuerte, ${expectedText} puntos esperados por partido y peso para sobrevivir el ruido inicial.`;
  }

  if (language === "fr") {
    return `${team.name} ressemble à une voie finaliste : signal à ${signal} %, point fort ${bestTrait}, ${expectedText} points attendus par match et assez de poids pour traverser le bruit initial.`;
  }

  return `${team.name} looks like a finalist lane: ${signal}% signal, ${bestTrait} as the sharp edge, ${expectedText} expected points per match, and enough weight to survive the opening fog.`;
}

function cupRisk(
  team: Team,
  chaos: number,
  pathSignal: number,
  language: Language,
) {
  const pressurePoint =
    team.defense < team.attack ? "defensive weather" : "chance creation fog";
  const pathText = pathSignal > 76 ? "cleaner group lane" : "knotted group lane";
  const chaosText = chaos > 60 ? "loud volatility" : "manageable volatility";

  if (language === "es") {
    return `${pathText === "cleaner group lane" ? "Ruta más limpia" : "Ruta enredada"}; ${chaosText === "loud volatility" ? "volatilidad alta" : "volatilidad manejable"}; cuidado con ${pressurePoint === "defensive weather" ? "el clima defensivo" : "la niebla creativa"}.`;
  }

  if (language === "fr") {
    return `${pathText === "cleaner group lane" ? "Route plus claire" : "Route nouée"} ; ${chaosText === "loud volatility" ? "volatilité forte" : "volatilité maîtrisable"} ; attention à ${pressurePoint === "defensive weather" ? "la météo défensive" : "la brume créative"}.`;
  }

  return `${pathText}; ${chaosText}; watch the ${pressurePoint}.`;
}

function formScore(form: string[]) {
  if (form.length === 0) {
    return 50;
  }

  const points = form.reduce((total, result) => {
    if (result === "W") {
      return total + 100;
    }

    if (result === "D") {
      return total + 58;
    }

    return total + 28;
  }, 0);

  return points / form.length;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 50;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const teamAccentPalette = [
  "#f7c948",
  "#ff7043",
  "#8fa2c4",
  "#4ea5d9",
  "#34d399",
  "#a78bfa",
  "#ef5b5b",
  "#2dd4bf",
];

function teamAccentIndex(team: Team) {
  const seed = `${team.code}-${team.name}`;

  return Array.from(seed).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  ) % teamAccentPalette.length;
}

function teamAccentColor(team: Team) {
  return teamAccentPalette[teamAccentIndex(team)];
}

function matchAccentColors(match: Match) {
  const homeIndex = teamAccentIndex(match.home);
  let awayIndex = teamAccentIndex(match.away);

  if (awayIndex === homeIndex) {
    awayIndex = (awayIndex + 3) % teamAccentPalette.length;
  }

  return {
    home: teamAccentPalette[homeIndex],
    away: teamAccentPalette[awayIndex],
  };
}

function splitMeterShares(home: number, away: number) {
  const total = Math.max(1, home + away);
  const homeShare = clamp((home / total) * 100, 8, 92);

  return {
    home: homeShare,
    away: 100 - homeShare,
  };
}

function getCupPulseLabel(language: Language) {
  const weekStart = startOfWeek(new Date());

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : language, {
    day: "numeric",
    month: "short",
    timeZone: "America/Toronto",
  }).format(weekStart);
}

function startOfWeek(date: Date) {
  const torontoDate = new Date(date);
  const day = torontoDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  torontoDate.setDate(torontoDate.getDate() + diff);
  return torontoDate;
}

function CupSeerBoard({
  candidates,
  language,
  onSelectTeam,
  pulseLabel,
  t,
}: {
  candidates: CupCandidate[];
  language: Language;
  onSelectTeam: (teamName: string) => void;
  pulseLabel: string;
  t: Record<string, string>;
}) {
  return (
    <section className="cup-seer-board" id="cup-seer" aria-label={t.cupSeer}>
      <div className="cup-seer-copy">
        <div className="cup-seer-heading-row">
          <div className="section-heading">
            <Trophy size={18} />
            <span>{t.cupSeer}</span>
          </div>
          <span className="cup-pulse-chip">
            {t.cupPulse} · {pulseLabel}
          </span>
        </div>
        <h2>{t.cupSeerTitle}</h2>
        <p>{t.cupSeerIntro}</p>
      </div>
      <div className="cup-candidate-grid">
        {candidates.length === 0 && (
          <div className="empty-match-state">{t.noCupCandidates}</div>
        )}
        {candidates.map((candidate, index) => (
          <button
            className="cup-candidate-card"
            key={candidate.team.name}
            onClick={() => onSelectTeam(candidate.team.name)}
            style={{ "--team-color": candidate.team.color } as React.CSSProperties}
            type="button"
          >
            <div className="cup-candidate-top">
              <div className="cup-candidate-aura">
                <span className="candidate-rank">#{index + 1}</span>
                <TeamFlag team={candidate.team} />
              </div>
              <div className="cup-candidate-name">
                <span
                  className="team-code"
                  style={{ background: candidate.team.color }}
                >
                  {candidate.team.code}
                </span>
                <strong>{candidate.team.name}</strong>
              </div>
            </div>
            <div className="cup-oracle-line">
              <Sparkles size={15} />
              <span>{candidate.traits.join(" · ")}</span>
            </div>
            <div className="cup-signal-row">
              <span>{t.cupSignal}</span>
              <strong>{candidate.signal}%</strong>
            </div>
            <div className="cup-signal-track">
              <span
                style={{
                  background: candidate.team.color,
                  width: `${candidate.signal}%`,
                }}
              />
            </div>
            <div className="cup-path-meta">
              <span>
                {candidate.matches} {t.matches}
              </span>
              <span>{candidate.expectedPoints.toFixed(1)} xPts</span>
            </div>
            <p>
              <strong>{t.seerVerdict}: </strong>
              {candidate.verdict}
            </p>
            <small>
              {t.riskCloud}: {candidate.risk}
            </small>
          </button>
        ))}
      </div>
      <p className="disclaimer cup-disclaimer">
        {language === "en" && "Cup signals are playful tournament analysis, not betting advice or certainty."}
        {language === "es" && "Las señales de copa son análisis deportivo divertido, no consejos de apuestas ni certezas."}
        {language === "fr" && "Les signaux coupe sont une analyse sportive ludique, pas des conseils de pari ni des certitudes."}
      </p>
    </section>
  );
}

function SeerLensStrip({ t }: { t: Record<string, string> }) {
  const lenses = [
    {
      icon: <BarChart3 size={20} />,
      label: t.lensForm,
      copy: t.lensFormCopy,
    },
    {
      icon: <Activity size={20} />,
      label: t.lensMomentum,
      copy: t.lensMomentumCopy,
    },
    {
      icon: <MapPin size={20} />,
      label: t.lensVenue,
      copy: t.lensVenueCopy,
    },
    {
      icon: <CloudSun size={20} />,
      label: t.lensWeather,
      copy: t.lensWeatherCopy,
    },
    {
      icon: <ShieldCheck size={20} />,
      label: t.lensRisk,
      copy: t.lensRiskCopy,
    },
  ];

  return (
    <section className="seer-lens-strip" id="seer-lenses" aria-label={t.seerLenses}>
      <div className="seer-lens-copy">
        <div className="section-heading">
          <Sparkles size={18} />
          <span>{t.seerLenses}</span>
        </div>
        <p>{t.seerLensesDetail}</p>
      </div>
      <div className="seer-lens-grid">
        {lenses.map((lens) => (
          <article className="seer-lens-card" key={lens.label}>
            <div className="lens-icon">{lens.icon}</div>
            <h3>{lens.label}</h3>
            <p>{lens.copy}</p>
          </article>
        ))}
      </div>
    </section>
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

function TeamBadge({ team, accentColor }: { team: Team; accentColor?: string }) {
  const displayColor = accentColor ?? teamAccentColor(team);

  return (
    <div className="team-badge">
      <TeamFlag accentColor={displayColor} team={team} />
      <span className="team-code" style={{ background: displayColor }}>{team.code}</span>
      <strong>{team.name}</strong>
    </div>
  );
}

function TeamFlag({
  team,
  compact = false,
  accentColor,
}: {
  team: Team;
  compact?: boolean;
  accentColor?: string;
}) {
  const flagCode = flagCodeForTeam(team);
  const [failed, setFailed] = useState(!flagCode);
  const displayColor = accentColor ?? teamAccentColor(team);

  return (
    <span
      aria-label={`${team.name} flag`}
      className={cx("team-flag", compact && "compact")}
      style={{ "--team-color": displayColor } as React.CSSProperties}
      title={team.name}
    >
      {flagCode && !failed ? (
        <img
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          src={`https://flagcdn.com/${flagCode}.svg`}
        />
      ) : (
        <span>{team.code}</span>
      )}
    </span>
  );
}

function flagCodeForTeam(team: Team) {
  const code = team.code.toUpperCase();
  const nameKey = normalizeTeamKey(team.name);

  return fifaCodeToFlagCode[code] ?? teamNameToFlagCode[nameKey] ?? "";
}

const fifaCodeToFlagCode: Record<string, string> = {
  ALB: "al",
  ALG: "dz",
  ARG: "ar",
  AUS: "au",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  BRA: "br",
  CAN: "ca",
  CHI: "cl",
  COL: "co",
  CRC: "cr",
  CRO: "hr",
  CZE: "cz",
  DEN: "dk",
  ECU: "ec",
  ENG: "gb-eng",
  FRA: "fr",
  GER: "de",
  GHA: "gh",
  HAI: "ht",
  ITA: "it",
  JPN: "jp",
  KOR: "kr",
  MAR: "ma",
  MEX: "mx",
  NED: "nl",
  NGA: "ng",
  PAR: "py",
  POL: "pl",
  POR: "pt",
  QAT: "qa",
  RSA: "za",
  SCO: "gb-sct",
  SEN: "sn",
  SRB: "rs",
  SUI: "ch",
  TUN: "tn",
  URU: "uy",
  USA: "us",
  WAL: "gb-wls",
};

const teamNameToFlagCode: Record<string, string> = {
  algeria: "dz",
  argentina: "ar",
  australia: "au",
  austria: "at",
  belgium: "be",
  "bosnia h": "ba",
  "bosnia and herzegovina": "ba",
  brazil: "br",
  canada: "ca",
  chile: "cl",
  colombia: "co",
  "costa rica": "cr",
  croatia: "hr",
  czechia: "cz",
  denmark: "dk",
  ecuador: "ec",
  england: "gb-eng",
  france: "fr",
  germany: "de",
  ghana: "gh",
  haiti: "ht",
  italy: "it",
  japan: "jp",
  korea: "kr",
  "korea republic": "kr",
  mexico: "mx",
  morocco: "ma",
  netherlands: "nl",
  nigeria: "ng",
  paraguay: "py",
  poland: "pl",
  portugal: "pt",
  qatar: "qa",
  scotland: "gb-sct",
  senegal: "sn",
  serbia: "rs",
  "south africa": "za",
  spain: "es",
  switzerland: "ch",
  tunisia: "tn",
  uruguay: "uy",
  usa: "us",
  "united states": "us",
  wales: "gb-wls",
};

function ForecastView({
  match,
  t,
  language,
  oracleRead,
  oracleStatus,
  onAskSeer,
  showAsk = true,
  compact = false,
}: {
  match: Match;
  t: Record<string, string>;
  language: Language;
  oracleRead?: OracleResponse;
  oracleStatus: OracleStatus;
  onAskSeer: () => void;
  showAsk?: boolean;
  compact?: boolean;
}) {
  const interpretation = oracleRead?.interpretation;
  const signalCopy = interpretation?.summary ?? match.forecast.tone[language];
  const reasons =
    interpretation?.keyFactors.map((factor) => factor.explanation) ??
    match.forecast.reasons[language];
  const readLabel = oracleRead?.source === "openai" ? t.freshRead : t.seededRead;
  const accents = matchAccentColors(match);

  return (
    <div className={cx("forecast-layout", compact && "compact")}>
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
            {showAsk && (
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
            )}
          </div>
        </div>
        {interpretation?.headline && <p className="oracle-headline">{interpretation.headline}</p>}
        <p className="seer-line">{signalCopy}</p>
        {oracleStatus === "error" && <p className="oracle-error">{t.oracleError}</p>}
        <div className="probability-grid">
          <Probability team={match.home} label={match.home.code} value={match.forecast.home} color={accents.home} />
          <Probability label="DRAW" value={match.forecast.draw} color="#8b8f98" />
          <Probability team={match.away} label={match.away.code} value={match.forecast.away} color={accents.away} />
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

function Probability({ label, value, color, team }: { label: string; value: number; color: string; team?: Team }) {
  return (
    <div className="probability">
      <div className="probability-ring" style={{ "--ring-color": color, "--ring-value": `${value * 3.6}deg` } as React.CSSProperties}>
        <span>{value}%</span>
      </div>
      <strong>
        {team && <TeamFlag accentColor={color} team={team} compact />}
        {label}
      </strong>
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
  const accents = matchAccentColors(match);
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
        <TeamBadge accentColor={accents.home} team={match.home} />
        <TeamBadge accentColor={accents.away} team={match.away} />
      </div>
      <div className="comparison-rows">
        {rows.map(([label, home, away]) => {
          const shares = splitMeterShares(home, away);

          return (
            <div className="comparison-row" key={label}>
              <strong>{home}</strong>
              <div>
                <span>{label}</span>
                <div className="split-meter">
                  <span style={{ flexGrow: shares.home, background: accents.home }} />
                  <span style={{ flexGrow: shares.away, background: accents.away }} />
                </div>
              </div>
              <strong>{away}</strong>
            </div>
          );
        })}
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
  const hasRefereeAssignment =
    match.referee.name !== "TBD" &&
    match.referee.name !== "Assignment pending";
  const refereeName = hasRefereeAssignment ? match.referee.name : t.refereePending;
  const cardRisk =
    match.referee.cardRisk === "Pending" ? t.pending : match.referee.cardRisk;

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
        <strong>{refereeName} · {cardRisk}</strong>
      </div>
    </div>
  );
}
