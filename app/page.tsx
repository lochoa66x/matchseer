"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
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
type ForecastSide = "home" | "draw" | "away";
type ForecastReceiptOutcome = "exact" | "hit" | "miss" | "live" | "pending";
type ForecastReceipt = {
  match: Match;
  outcome: ForecastReceiptOutcome;
  predictedSide: ForecastSide;
  actualSide?: ForecastSide;
  predictedLabel: string;
  modelLabel: string;
  actualLabel?: string;
  finalScore?: string;
  projectedOptions: string[];
  summary: string;
  shortLabel: string;
};
type SeerScoreboard = {
  reviewed: number;
  published: number;
  awaiting: number;
  winnerHits: number;
  exactHits: number;
  survivalRate: number;
  receipts: ForecastReceipt[];
};
type OracleResponse = {
  source: "openai" | "seeded-fallback";
  reason?: string;
  model?: string;
  audited?: boolean;
  interpretation: ForecastInterpretation;
};

const collapsedReceiptCount = 4;
const liveRefreshIntervalMs = 12_000;

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
    supportingDetails: "Match intelligence",
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
    seerScoreboard: "Model receipts",
    seerScoreboardTitle: "Did the model survive the whistle?",
    seerScoreboardIntro: "Every final score gets a receipt: the model forecast, what happened, and whether the call held up. Live matches stay open and do not count yet.",
    reviewedMatches: "Reviewed matches",
    winnerCalls: "Direction hits",
    exactScores: "Exact scores",
    publishedReads: "Published reads",
    modelSurvival: "Model hit rate",
    latestReceipts: "All receipts",
    waitingForFinals: "Waiting for final whistles",
    called: "Model forecast",
    finished: "Finished",
    seerHit: "Direction hit",
    seerMiss: "Model missed",
    exactHit: "Exact score",
    liveReview: "Live check",
    awaitingResult: "Awaiting result",
    scoreboardEmpty: "Receipts wake up as soon as final scores arrive.",
    showAllReceipts: "Show all receipts",
    hideReceipts: "Show fewer receipts",
    quickRead: "Quick read",
    seerLean: "Seer lean",
    tightRead: "Tight read",
    chaosWatch: "Chaos watch",
    strongSignal: "Strong signal",
    liveSwing: "Live swing",
    finalRead: "Final read",
    forecast: "Match read",
    teams: "Teams",
    players: "Players",
    weather: "Weather",
    confidence: "Confidence",
    chaos: "Chaos",
    projected: "Projected",
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
    seededRead: "Early signal",
    savedRead: "Saved read",
    finalReceipt: "Final receipt locked",
    noReplay: "Completed games cannot be re-read.",
    actual: "Actual",
    matchContext: "Match context",
    oracleError: "The Seer blinked. Try again.",
    pendingMode: "Live data pending",
    fallbackMode: "Live data pending",
    noDemoFixtures: "No demo data",
    noPlayerData: "Verified player data is not connected yet.",
    connected: "Connected",
    mapping: "Mapping underway",
    pending: "Pending",
    refereePending: "Assignment pending",
    cupSeer: "Weekly Cup Seer",
    cupSeerTitle: "Who is in the final-six lane?",
    cupSeerIntro: "Pre-round pulse: the Seer treats every group match as unplayed, forecasts each team path, and ranks the six strongest cup lanes.",
    cupPulse: "Weekly pulse",
    cupLeader: "Top signal",
    cupOpen: "Open weekly cup pulse",
    cupClose: "Hide weekly cup pulse",
    cupSignal: "Finalist signal",
    seerVerdict: "Seer verdict",
    riskCloud: "Risk cloud",
    signalNotes: "Signal notes",
    hideNotes: "Hide notes",
    seerEdge: "Edge",
    seerPath: "Path",
    seerWatch: "Watch",
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
    supportingDetails: "Inteligencia del partido",
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
    seerScoreboard: "Recibos del modelo",
    seerScoreboardTitle: "¿El modelo sobrevivió al silbatazo?",
    seerScoreboardIntro: "Cada marcador final deja recibo: el pronóstico del modelo, lo que pasó y si la dirección aguantó. Los partidos en vivo quedan abiertos y aún no cuentan.",
    reviewedMatches: "Partidos revisados",
    winnerCalls: "Direcciones correctas",
    exactScores: "Marcadores exactos",
    publishedReads: "Lecturas publicadas",
    modelSurvival: "Acierto del modelo",
    latestReceipts: "Todos los recibos",
    waitingForFinals: "Esperando finales",
    called: "Pronóstico del modelo",
    finished: "Terminó",
    seerHit: "Dirección bien",
    seerMiss: "Falló el modelo",
    exactHit: "Marcador exacto",
    liveReview: "Chequeo en vivo",
    awaitingResult: "Esperando resultado",
    scoreboardEmpty: "Los recibos despiertan cuando llegan marcadores finales.",
    showAllReceipts: "Ver todos los recibos",
    hideReceipts: "Ver menos recibos",
    quickRead: "Lectura rápida",
    seerLean: "Señal vidente",
    tightRead: "Lectura cerrada",
    chaosWatch: "Ojo al caos",
    strongSignal: "Señal fuerte",
    liveSwing: "Giro en vivo",
    finalRead: "Lectura final",
    forecast: "Lectura",
    teams: "Equipos",
    players: "Jugadores",
    weather: "Clima",
    confidence: "Confianza",
    chaos: "Caos",
    projected: "Proyectado",
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
    seededRead: "Señal inicial",
    savedRead: "Lectura guardada",
    finalReceipt: "Recibo final fijo",
    noReplay: "Los partidos terminados no se pueden volver a leer.",
    actual: "Real",
    matchContext: "Contexto del partido",
    oracleError: "El Vidente parpadeó. Intenta otra vez.",
    pendingMode: "Datos reales pendientes",
    fallbackMode: "Datos reales pendientes",
    noDemoFixtures: "Sin datos demo",
    noPlayerData: "Todavía no conectamos datos verificados de jugadores.",
    connected: "Conectado",
    mapping: "Mapeo en curso",
    pending: "Pendiente",
    refereePending: "Asignación pendiente",
    cupSeer: "Vidente semanal de la copa",
    cupSeerTitle: "¿Quién entra en la vía de los seis finalistas?",
    cupSeerIntro: "Pulso previo: el Vidente trata cada partido de grupo como no jugado, proyecta el camino de cada equipo y ordena las seis rutas más fuertes.",
    cupPulse: "Pulso semanal",
    cupLeader: "Señal líder",
    cupOpen: "Abrir pulso semanal",
    cupClose: "Ocultar pulso semanal",
    cupSignal: "Señal finalista",
    seerVerdict: "Veredicto vidente",
    riskCloud: "Nube de riesgo",
    signalNotes: "Notas de señal",
    hideNotes: "Ocultar notas",
    seerEdge: "Ventaja",
    seerPath: "Ruta",
    seerWatch: "Vigilar",
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
    supportingDetails: "Lecture du match",
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
    seerScoreboard: "Reçus du modèle",
    seerScoreboardTitle: "Le modèle a-t-il survécu au coup de sifflet ?",
    seerScoreboardIntro: "Chaque score final reçoit un reçu : la prévision du modèle, ce qui s’est passé, et si la direction a tenu. Les matchs en direct restent ouverts et ne comptent pas encore.",
    reviewedMatches: "Matchs revus",
    winnerCalls: "Directions justes",
    exactScores: "Scores exacts",
    publishedReads: "Lectures publiées",
    modelSurvival: "Taux du modèle",
    latestReceipts: "Tous les reçus",
    waitingForFinals: "En attente des scores finaux",
    called: "Prévision du modèle",
    finished: "Terminé",
    seerHit: "Direction juste",
    seerMiss: "Modèle raté",
    exactHit: "Score exact",
    liveReview: "Contrôle en direct",
    awaitingResult: "Résultat attendu",
    scoreboardEmpty: "Les reçus s’activent dès que les scores finaux arrivent.",
    showAllReceipts: "Voir tous les reçus",
    hideReceipts: "Voir moins de reçus",
    quickRead: "Lecture rapide",
    seerLean: "Signal voyant",
    tightRead: "Lecture serrée",
    chaosWatch: "Alerte chaos",
    strongSignal: "Signal fort",
    liveSwing: "Virage en direct",
    finalRead: "Lecture finale",
    forecast: "Lecture",
    teams: "Équipes",
    players: "Joueurs",
    weather: "Météo",
    confidence: "Confiance",
    chaos: "Chaos",
    projected: "Projeté",
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
    seededRead: "Signal précoce",
    savedRead: "Lecture enregistrée",
    finalReceipt: "Reçu final verrouillé",
    noReplay: "Les matchs terminés ne peuvent pas être relus.",
    actual: "Réel",
    matchContext: "Contexte du match",
    oracleError: "Le voyant a cligné. Réessaie.",
    pendingMode: "Données réelles en attente",
    fallbackMode: "Données réelles en attente",
    noDemoFixtures: "Aucune donnée démo",
    noPlayerData: "Les données joueurs vérifiées ne sont pas encore connectées.",
    connected: "Connecté",
    mapping: "Mappage en cours",
    pending: "En attente",
    refereePending: "Affectation en attente",
    cupSeer: "Voyant hebdo de la coupe",
    cupSeerTitle: "Qui entre dans la voie des six finalistes ?",
    cupSeerIntro: "Pulse d’avant-tour : le voyant traite chaque match de groupe comme non joué, projette le chemin de chaque équipe et classe les six routes les plus fortes.",
    cupPulse: "Pulse hebdo",
    cupLeader: "Signal leader",
    cupOpen: "Ouvrir le pulse hebdo",
    cupClose: "Masquer le pulse hebdo",
    cupSignal: "Signal finaliste",
    seerVerdict: "Verdict du voyant",
    riskCloud: "Nuage de risque",
    signalNotes: "Notes du signal",
    hideNotes: "Masquer",
    seerEdge: "Atout",
    seerPath: "Parcours",
    seerWatch: "À surveiller",
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
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("next");
  const [groupFilter, setGroupFilter] = useState("all");
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
    trackPageTraffic(language);
  }, []);

  useEffect(() => {
    let ignore = false;
    let loadingMatches = false;

    async function loadMatches(refreshLiveData = false) {
      if (loadingMatches) {
        return;
      }

      loadingMatches = true;

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
          setMatches([]);
          setActiveMatchId("");
        }
      } finally {
        loadingMatches = false;
      }
    }

    void loadMatches(true);
    const liveRefresh = window.setInterval(() => {
      void loadMatches(true);
    }, liveRefreshIntervalMs);
    const refreshOnFocus = () => {
      if (!document.hidden) {
        void loadMatches(true);
      }
    };

    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      ignore = true;
      window.clearInterval(liveRefresh);
      document.removeEventListener("visibilitychange", refreshOnFocus);
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
  const seerScoreboard = useMemo(
    () => buildSeerScoreboard(matches, language, t),
    [language, matches, t],
  );
  useEffect(() => {
    if (
      visibleMatches.length > 0 &&
      !visibleMatches.some((match) => match.id === activeMatchId)
    ) {
      setActiveMatchId(visibleMatches[0].id);
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
              <img
                className="brand-mark-image"
                src="/brand/matchseer-app-icon.svg"
                alt=""
                aria-hidden="true"
              />
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
  const activeMatchIsFinal = activeMatch.status === "Final";

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="MatchSeer header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <img
              className="brand-mark-image"
              src="/brand/matchseer-app-icon.svg"
              alt=""
              aria-hidden="true"
            />
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
              const lean = getMatchLean(match, accents);
              const cardReason = getMatchCardReason(match, language);
              const receipt = buildForecastReceipt(match, language, t);

              return (
                <button
                  className={cx("hero-match-card", activeMatch.id === match.id && "selected")}
                  key={match.id}
                  onClick={() => setActiveMatchId(match.id)}
                  type="button"
                >
                  <div className="hero-card-status">
                    <span className={cx("status-dot", match.status.toLowerCase())} />
                    <span>{getMatchCardMood(match, t)}</span>
                    {receipt.outcome !== "pending" && (
                      <em className={cx("receipt-chip", receipt.outcome)}>
                        {receipt.shortLabel}
                      </em>
                    )}
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
                  <div className="hero-card-signal">
                    <span>{t.seerLean}</span>
                    <strong style={{ color: lean.color }}>
                      {lean.label} {lean.value}%
                    </strong>
                  </div>
                  <div className="hero-card-probabilities" aria-hidden="true">
                    <span style={{ width: `${match.forecast.home}%`, background: accents.home }} />
                    <span style={{ width: `${match.forecast.draw}%`, background: "#8fa2c4" }} />
                    <span style={{ width: `${match.forecast.away}%`, background: accents.away }} />
                  </div>
                  <p className="hero-card-reason">{cardReason}</p>
                  <div className="hero-card-footer">
                    <span>{match.group}</span>
                    <span>{match.venue}</span>
                    <span>{t.confidence}: {match.forecast.confidence}%</span>
                    <span>{t.chaos}: {match.forecast.chaos}%</span>
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

          <ForecastView
            match={activeMatch}
            t={t}
            language={language}
            oracleRead={activeOracleRead}
            oracleStatus={activeOracleStatus}
            onAskSeer={() => {
              void requestOracleRead(activeMatch.id, language);
            }}
            showAsk={!activeMatchIsFinal}
            compact
          />

          <div className="seer-share-row">
            <button className="share-button seer-share-button" onClick={() => shareMatch(activeMatch)} type="button">
              {shareStatus === "copied" ? <Check size={17} /> : <Share2 size={17} />}
              {shareStatus === "copied" && t.copied}
              {shareStatus === "error" && t.shareError}
              {shareStatus === "idle" && t.share}
            </button>
          </div>
        </div>
      </section>

      <SeerScoreboardBoard
        scoreboard={seerScoreboard}
        t={t}
        onSelectMatch={(matchId) => setActiveMatchId(matchId)}
      />

      {activeMatch.players.length > 0 && (
        <section className="content-grid content-grid-support player-detail-only">
          <section className="detail-panel">
            <div className="detail-support-header">
              <div className="section-heading">
                <Zap size={18} />
                <span>{t.comparePlayers}</span>
              </div>
              <p>{activeMatch.venue} · {activeMatch.city} · {formatMatchSchedule(activeMatch)}</p>
            </div>
            <PlayersView match={activeMatch} t={t} />
          </section>
        </section>
      )}

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
          }
        }}
        pulseLabel={cupPulseLabel}
        t={t}
      />

      <SeerLensStrip t={t} />
    </main>
  );
}

function trackPageTraffic(fallbackLanguage: Language) {
  const params = new URLSearchParams(window.location.search);
  const linkedLanguage = params.get("lang");
  const payload = {
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer,
    language: isLanguageOption(linkedLanguage) ? linkedLanguage : fallbackLanguage,
    matchId: params.get("match"),
    visitorId: getTrafficVisitorId(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const queued = navigator.sendBeacon(
      "/api/traffic",
      new Blob([body], { type: "application/json" }),
    );

    if (queued) {
      return;
    }
  }

  void fetch("/api/traffic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Traffic collection should never interrupt the page experience.
  });
}

function getTrafficVisitorId() {
  const storageKey = "matchseer-traffic-visitor";

  try {
    const stored = window.localStorage.getItem(storageKey);

    if (stored) {
      return stored;
    }

    const id =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    window.localStorage.setItem(storageKey, id);

    return id;
  } catch {
    return "storage-unavailable";
  }
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
  const [primaryTrait, secondaryTrait] = cupTraits(team, pathSignal);
  const bestTrait = primaryTrait?.toLowerCase() ?? "balance";
  const supportTrait = secondaryTrait?.toLowerCase() ?? "depth";
  const expectedText = pointsPerMatch.toFixed(1);

  if (language === "es") {
    if (bestTrait === "attack") {
      return `El filo está arriba: ${signal}% de señal, ${expectedText} xPts por partido y ${supportTrait} sosteniendo la lectura.`;
    }
    if (bestTrait === "control") {
      return `La señal viene del mando: control del ritmo, ${expectedText} xPts por partido y ${supportTrait} como segunda capa.`;
    }
    if (bestTrait === "defense") {
      return `La lectura es de blindaje: ${signal}% de señal, defensa como ancla y ${supportTrait} para sobrevivir noches cerradas.`;
    }
    if (bestTrait === "set pieces") {
      return `El balón quieto abre la puerta: ${signal}% de señal y una ruta donde cada falta cerca del área pesa.`;
    }
    return `La ruta es el argumento: ${signal}% de señal y ${expectedText} xPts si el cuadro no se vuelve raro demasiado pronto.`;
  }

  if (language === "fr") {
    if (bestTrait === "attack") {
      return `Le tranchant est devant : ${signal} % de signal, ${expectedText} xPts par match et ${supportTrait} en soutien.`;
    }
    if (bestTrait === "control") {
      return `Le signal vient du contrôle : rythme maîtrisé, ${expectedText} xPts par match et ${supportTrait} comme seconde couche.`;
    }
    if (bestTrait === "defense") {
      return `Lecture de verrou : ${signal} % de signal, défense en ancre et ${supportTrait} pour survivre aux matchs fermés.`;
    }
    if (bestTrait === "set pieces") {
      return `Les coups de pied arrêtés ouvrent la porte : ${signal} % de signal et une route où chaque faute proche de la surface compte.`;
    }
    return `Le parcours porte la lecture : ${signal} % de signal et ${expectedText} xPts si le tableau ne devient pas trop étrange trop tôt.`;
  }

  if (bestTrait === "attack") {
    return `Chance creation is the loud signal: ${signal}% with ${expectedText} xPts per match, while ${supportTrait} keeps the read from feeling one-note.`;
  }
  if (bestTrait === "control") {
    return `The lane runs through control: tempo, ball security, ${expectedText} xPts per match, and ${supportTrait} as the second signal.`;
  }
  if (bestTrait === "defense") {
    return `The shield is doing the talking: ${signal}% signal, defense as the anchor, and ${supportTrait} helping them survive tight nights.`;
  }
  if (bestTrait === "set pieces") {
    return `Set pieces are the hidden doorway: ${signal}% signal and enough dead-ball pressure to bend a close bracket.`;
  }
  return `The path is the argument: ${signal}% signal and ${expectedText} xPts if the bracket does not get weird too early.`;
}

function cupRisk(
  team: Team,
  chaos: number,
  pathSignal: number,
  language: Language,
) {
  const isDefensiveWeakness = team.defense + 4 < team.attack;
  const isChanceLight = team.attack < 74;
  const isSetPieceReliant = team.setPieces > team.attack + 4;
  const cleanPath = pathSignal > 76;
  const highChaos = chaos > 60;
  const veryHighChaos = chaos > 75;

  if (language === "es") {
    if (veryHighChaos && isDefensiveWeakness) {
      return `Demasiado ida y vuelta: ${chaos.toFixed(0)}% de caos y una espalda que puede quedar expuesta.`;
    }
    if (isChanceLight) {
      return `La creación puede secarse; si no golpean pronto, la ruta se vuelve pesada.`;
    }
    if (isSetPieceReliant) {
      return `Mucho depende del balón parado. Si el árbitro deja jugar, se apaga una ruta clave.`;
    }
    if (highChaos && !cleanPath) {
      return `Ruta con tráfico y ${chaos.toFixed(0)}% de caos: una noche rara cambia el cuadro.`;
    }
    if (!cleanPath) {
      return `El talento está, pero el carril no es limpio. Un empate incómodo cambia el pulso.`;
    }
    return `Señal alta, riesgo simple: gestionar piernas, rotaciones y exceso de confianza.`;
  }

  if (language === "fr") {
    if (veryHighChaos && isDefensiveWeakness) {
      return `Trop de transitions : ${chaos.toFixed(0)} % de chaos et un dos qui peut s'exposer.`;
    }
    if (isChanceLight) {
      return `La création peut sécher; sans but tôt, la route devient lourde.`;
    }
    if (isSetPieceReliant) {
      return `Beaucoup dépend des coups de pied arrêtés. Si l'arbitre laisse jouer, une route clé s'éteint.`;
    }
    if (highChaos && !cleanPath) {
      return `Route chargée et ${chaos.toFixed(0)} % de chaos : une soirée étrange peut déplacer le tableau.`;
    }
    if (!cleanPath) {
      return `Le talent est là, mais le couloir n'est pas net. Un nul gênant change le pulse.`;
    }
    return `Gros signal, risque simple : gérer les jambes, les rotations et l'excès de confiance.`;
  }

  if (veryHighChaos && isDefensiveWeakness) {
    return `Too much transition weather: ${chaos.toFixed(0)}% chaos and a back line that can get stretched.`;
  }
  if (isChanceLight) {
    return `Chance creation can dry up; if the first goal does not arrive early, the lane gets heavy.`;
  }
  if (isSetPieceReliant) {
    return `A lot rides on dead balls. If the referee lets contact go, one key route gets quieter.`;
  }
  if (highChaos && !cleanPath) {
    return `Traffic in the lane plus ${chaos.toFixed(0)}% chaos: one strange night can reshuffle the bracket.`;
  }
  if (!cleanPath) {
    return `The talent is there, but the lane is not clean. One awkward draw changes the pulse.`;
  }
  return `Big signal, simple risk: manage legs, rotations, and the temptation to cruise.`;
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

  if (awayIndex === homeIndex || paletteColorsAreTooClose(homeIndex, awayIndex)) {
    awayIndex = mostContrastingPaletteIndex(homeIndex);
  }

  return {
    home: teamAccentPalette[homeIndex],
    away: teamAccentPalette[awayIndex],
  };
}

function paletteColorsAreTooClose(leftIndex: number, rightIndex: number) {
  return colorDistance(teamAccentPalette[leftIndex], teamAccentPalette[rightIndex]) < 120;
}

function mostContrastingPaletteIndex(anchorIndex: number) {
  return teamAccentPalette
    .map((color, index) => ({
      index,
      distance: index === anchorIndex
        ? -1
        : colorDistance(teamAccentPalette[anchorIndex], color),
    }))
    .sort((left, right) => right.distance - left.distance)[0].index;
}

function colorDistance(leftHex: string, rightHex: string) {
  const left = hexToRgb(leftHex);
  const right = hexToRgb(rightHex);

  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
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

function getMatchLean(match: Match, accents: ReturnType<typeof matchAccentColors>) {
  return [
    {
      label: match.home.code,
      value: match.forecast.home,
      color: accents.home,
    },
    {
      label: "DRAW",
      value: match.forecast.draw,
      color: "#8fa2c4",
    },
    {
      label: match.away.code,
      value: match.forecast.away,
      color: accents.away,
    },
  ].sort((left, right) => right.value - left.value)[0];
}

function getMatchCardMood(match: Match, t: Record<string, string>) {
  if (match.status === "Live") {
    return t.liveSwing;
  }

  if (match.status === "Final") {
    return t.finalRead;
  }

  const spread = Math.max(match.forecast.home, match.forecast.draw, match.forecast.away) -
    Math.min(match.forecast.home, match.forecast.draw, match.forecast.away);

  if (match.forecast.chaos >= 64) {
    return t.chaosWatch;
  }

  if (match.forecast.confidence >= 70 && spread >= 14) {
    return t.strongSignal;
  }

  return t.tightRead;
}

function getMatchCardReason(match: Match, language: Language) {
  const reason =
    match.forecast.reasons[language]?.[0] ??
    match.forecast.tone[language] ??
    "";

  if (reason.length <= 112) {
    return reason;
  }

  return `${reason.slice(0, 109).trim()}...`;
}

function buildSeerScoreboard(
  matches: Match[],
  language: Language,
  t: Record<string, string>,
): SeerScoreboard {
  const receipts = matches
    .filter((match) => match.status === "Final" && Boolean(parseScoreline(match.score)))
    .map((match) => buildForecastReceipt(match, language, t))
    .sort((left, right) => receiptSortTime(right.match) - receiptSortTime(left.match));
  const reviewedReceipts = receipts.filter((receipt) =>
    receipt.outcome === "exact" || receipt.outcome === "hit" || receipt.outcome === "miss",
  );
  const winnerHits = reviewedReceipts.filter((receipt) =>
    receipt.outcome === "exact" || receipt.outcome === "hit",
  ).length;
  const exactHits = reviewedReceipts.filter((receipt) => receipt.outcome === "exact").length;
  const reviewed = reviewedReceipts.length;

  return {
    reviewed,
    published: matches.length,
    awaiting: Math.max(matches.length - reviewed, 0),
    winnerHits,
    exactHits,
    survivalRate: reviewed > 0 ? Math.round((winnerHits / reviewed) * 100) : 0,
    receipts: reviewedReceipts,
  };
}

function buildForecastReceipt(
  match: Match,
  language: Language,
  t: Record<string, string>,
): ForecastReceipt {
  const projectedOptions = parseProjectedScores(match.forecast.projected);
  const primaryPredictedSide = getProjectedForecastSide(match);
  const projectedSides = projectedOptions.map((score) => {
    const scoreline = parseScoreline(score);
    return scoreline ? getScoreSide(scoreline.home, scoreline.away) : null;
  });
  const forecastSignals = uniqueForecastSides(projectedSides);
  const judgedForecastSignals =
    forecastSignals.length > 0 ? forecastSignals : [primaryPredictedSide];
  const initialModelLabel = modelForecastLabel(
    match,
    primaryPredictedSide,
    projectedOptions,
  );
  const initialPredictedLabel = sideLabel(match, primaryPredictedSide);

  if (match.status === "Live") {
    return {
      match,
      outcome: "live",
      predictedSide: primaryPredictedSide,
      predictedLabel: initialPredictedLabel,
      modelLabel: initialModelLabel,
      projectedOptions,
      summary: receiptSummary("live", match, language, primaryPredictedSide),
      shortLabel: t.liveReview,
    };
  }

  const finalScore = parseScoreline(match.score);

  if (match.status !== "Final" || !finalScore) {
    return {
      match,
      outcome: "pending",
      predictedSide: primaryPredictedSide,
      predictedLabel: initialPredictedLabel,
      modelLabel: initialModelLabel,
      projectedOptions,
      summary: receiptSummary("pending", match, language, primaryPredictedSide),
      shortLabel: t.awaitingResult,
    };
  }

  const actualSide = getScoreSide(finalScore.home, finalScore.away);
  const exactScore = `${finalScore.home}-${finalScore.away}`;
  const exact = projectedOptions.includes(exactScore);
  const winnerHit = judgedForecastSignals.includes(actualSide);
  const outcome: ForecastReceiptOutcome = exact ? "exact" : winnerHit ? "hit" : "miss";
  const predictedSide = winnerHit ? actualSide : primaryPredictedSide;
  const predictedLabel = sideLabel(match, predictedSide);
  const modelLabel = modelForecastLabel(match, predictedSide, projectedOptions);

  return {
    match,
    outcome,
    predictedSide,
    actualSide,
    predictedLabel,
    modelLabel,
    actualLabel: sideLabel(match, actualSide),
    finalScore: exactScore,
    projectedOptions,
    summary: receiptSummary(outcome, match, language, predictedSide),
    shortLabel: outcome === "exact" ? t.exactHit : outcome === "hit" ? t.seerHit : t.seerMiss,
  };
}

function getProjectedForecastSide(match: Match): ForecastSide {
  const primaryProjectedScore = parsePrimaryProjectedScore(match.forecast.projected);

  return primaryProjectedScore
    ? getScoreSide(primaryProjectedScore.home, primaryProjectedScore.away)
    : getForecastSide(match);
}

function getForecastSide(match: Match): ForecastSide {
  return [
    { side: "home" as const, value: match.forecast.home },
    { side: "draw" as const, value: match.forecast.draw },
    { side: "away" as const, value: match.forecast.away },
  ].sort((left, right) => right.value - left.value)[0].side;
}

function uniqueForecastSides(sides: Array<ForecastSide | null>) {
  const unique: ForecastSide[] = [];

  for (const side of sides) {
    if (side && !unique.includes(side)) {
      unique.push(side);
    }
  }

  return unique;
}

function sideLabel(match: Match, side: ForecastSide) {
  if (side === "home") {
    return match.home.code;
  }

  if (side === "away") {
    return match.away.code;
  }

  return "DRAW";
}

function modelForecastLabel(
  match: Match,
  side: ForecastSide,
  projectedOptions: string[],
) {
  const label = sideLabel(match, side);
  const score =
    projectedOptions.find((option) => {
      const scoreSide = parseScoreline(option);

      return scoreSide && getScoreSide(scoreSide.home, scoreSide.away) === side;
    }) ?? projectedOptions[0];

  if (!score) {
    return label;
  }

  const scoreSide = parseScoreline(score);

  return scoreSide && getScoreSide(scoreSide.home, scoreSide.away) === side
    ? `${label} ${score}`
    : label;
}

function sideName(match: Match, side: ForecastSide, language: Language) {
  if (side === "home") {
    return match.home.name;
  }

  if (side === "away") {
    return match.away.name;
  }

  if (language === "es") {
    return "el empate";
  }

  if (language === "fr") {
    return "le nul";
  }

  return "the draw";
}

function getScoreSide(home: number, away: number): ForecastSide {
  if (home > away) {
    return "home";
  }

  if (away > home) {
    return "away";
  }

  return "draw";
}

function parseScoreline(value?: string) {
  const match = value?.match(/(\d+)\s*[-–]\s*(\d+)/);

  if (!match) {
    return null;
  }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

function parseProjectedScores(value: string) {
  return value
    .split(/[\/|,]/)
    .map((part) => parseScoreline(part.trim()))
    .filter((score): score is { home: number; away: number } => Boolean(score))
    .map((score) => `${score.home}-${score.away}`);
}

function parsePrimaryProjectedScore(value: string) {
  for (const part of value.split(/[\/|,]/)) {
    const score = parseScoreline(part.trim());

    if (score) {
      return score;
    }
  }

  return null;
}

function receiptSortTime(match: Match) {
  if (match.startsAt) {
    return new Date(match.startsAt).getTime();
  }

  return match.status === "Final" ? 1 : 0;
}

function receiptSummary(
  outcome: ForecastReceiptOutcome,
  match: Match,
  language: Language,
  predictedOverride?: ForecastSide,
) {
  const score = parseScoreline(match.score);
  const predicted = predictedOverride ?? getProjectedForecastSide(match);
  const actual = score ? getScoreSide(score.home, score.away) : undefined;
  const predictedName = sideName(match, predicted, language);
  const actualName = actual ? sideName(match, actual, language) : "";
  const spoiler =
    predicted === "home"
      ? match.away.name
      : predicted === "away"
        ? match.home.name
        : actualName;
  const fixture = `${match.home.name} vs ${match.away.name}`;

  if (language === "es") {
    if (outcome === "exact") {
      return "El pronóstico del modelo clavó el marcador exacto. Recibo limpio.";
    }

    if (outcome === "hit") {
      if (predicted === "draw") {
        return "El modelo leyó empate. El marcador cambió, pero la dirección aguantó.";
      }

      return `${predictedName} cumplió aunque el marcador se movió. La dirección del modelo aguantó.`;
    }

    if (outcome === "miss") {
      if (actual === "draw" && predicted !== "draw") {
        return `El modelo se inclinó por ${predictedName}, pero ${spoiler} sostuvo la línea. Falló la dirección; sobrevivió el empate.`;
      }

      if (predicted === "draw" && actual) {
        return `El modelo vio una ruta de empate, pero ${actualName} la rompió. Falló la dirección; recibo guardado.`;
      }

      return `El modelo se inclinó por ${predictedName}, pero ${actualName} se llevó el recibo. Falló la dirección; toca tomar nota.`;
    }

    if (outcome === "live") {
      return `${fixture} está en vivo. El recibo del modelo sigue abierto hasta el silbatazo.`;
    }

    return "Esperando el marcador final para calificar el pronóstico del modelo.";
  }

  if (language === "fr") {
    if (outcome === "exact") {
      return "La prévision du modèle a trouvé le score exact. Reçu propre.";
    }

    if (outcome === "hit") {
      if (predicted === "draw") {
        return "Le modèle a vu le nul. Le score a bougé, mais la direction a tenu.";
      }

      return `${predictedName} est passé malgré un score différent. La direction du modèle a tenu.`;
    }

    if (outcome === "miss") {
      if (actual === "draw" && predicted !== "draw") {
        return `Le modèle penchait pour ${predictedName}, mais ${spoiler} a tenu la ligne. Direction manquée ; le nul a survécu.`;
      }

      if (predicted === "draw" && actual) {
        return `Le modèle voyait une voie vers le nul, mais ${actualName} l’a ouverte autrement. Direction manquée ; reçu classé.`;
      }

      return `Le modèle penchait pour ${predictedName}, mais ${actualName} prend le reçu. Direction manquée ; note prise.`;
    }

    if (outcome === "live") {
      return `${fixture} est en direct. Le reçu du modèle reste ouvert jusqu’au coup de sifflet.`;
    }

    return "En attente du score final pour noter la prévision du modèle.";
  }

  if (outcome === "exact") {
    return "The model forecast landed on the exact score. Clean receipt.";
  }

  if (outcome === "hit") {
    if (predicted === "draw") {
      return "The model called the draw. The scoreline moved, but the direction held.";
    }

    return `${predictedName} came through even if the scoreline moved. The model direction held.`;
  }

  if (outcome === "miss") {
    if (actual === "draw" && predicted !== "draw") {
      return `The model leaned ${predictedName}, but ${spoiler} held the line. Direction missed; draw survived.`;
    }

    if (predicted === "draw" && actual) {
      return `The model saw a draw lane, but ${actualName} broke it open. Direction missed; receipt filed.`;
    }

    return `The model leaned ${predictedName}, but ${actualName} took the receipt. Direction missed; model takes the note.`;
  }

  if (outcome === "live") {
    return `${fixture} is live. The model receipt stays open until the final whistle.`;
  }

  return "Waiting for the final score to grade the model forecast.";
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

function SeerScoreboardBoard({
  scoreboard,
  onSelectMatch,
  t,
}: {
  scoreboard: SeerScoreboard;
  onSelectMatch: (matchId: string) => void;
  t: Record<string, string>;
}) {
  const [showAllReceipts, setShowAllReceipts] = useState(false);
  const [showMobileReceipts, setShowMobileReceipts] = useState(false);
  const visibleReceipts = showAllReceipts
    ? scoreboard.receipts
    : scoreboard.receipts.slice(0, collapsedReceiptCount);
  const hiddenReceiptCount = Math.max(
    scoreboard.receipts.length - visibleReceipts.length,
    0,
  );
  const metrics = [
    {
      label: t.reviewedMatches,
      value: `${scoreboard.reviewed}`,
      detail: `${scoreboard.awaiting} ${t.waitingForFinals.toLowerCase()}`,
    },
    {
      label: t.winnerCalls,
      value: `${scoreboard.winnerHits}/${scoreboard.reviewed}`,
      detail: t.modelSurvival,
    },
    {
      label: t.exactScores,
      value: `${scoreboard.exactHits}`,
      detail: t.latestReceipts,
    },
    {
      label: t.modelSurvival,
      value: scoreboard.reviewed > 0 ? `${scoreboard.survivalRate}%` : "0%",
      detail: `${scoreboard.published} ${t.publishedReads.toLowerCase()}`,
    },
  ];

  return (
    <section
      className={cx("seer-scoreboard", showMobileReceipts && "mobile-expanded")}
      aria-label={t.seerScoreboard}
    >
      <div className="seer-scoreboard-header">
        <div>
          <div className="section-heading">
            <Check size={18} />
            <span>{t.seerScoreboard}</span>
          </div>
          <h2>{t.seerScoreboardTitle}</h2>
          <p>{t.seerScoreboardIntro}</p>
        </div>
        <div className="scoreboard-metrics" aria-label={t.modelSurvival}>
          {metrics.map((metric) => (
            <div className="scoreboard-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          ))}
        </div>
      </div>

      <button
        aria-expanded={showMobileReceipts}
        className="scoreboard-mobile-toggle"
        onClick={() => setShowMobileReceipts((current) => !current)}
        type="button"
      >
        <span>{showMobileReceipts ? t.hideReceipts : t.showAllReceipts}</span>
        <strong>{scoreboard.receipts.length}</strong>
        <ChevronDown size={16} />
      </button>

      <div className="receipt-list" aria-label={t.latestReceipts}>
        {scoreboard.receipts.length === 0 && (
          <div className="receipt-empty">{t.scoreboardEmpty}</div>
        )}
        {visibleReceipts.map((receipt) => (
          <button
            className={cx("receipt-card", receipt.outcome)}
            key={receipt.match.id}
            onClick={() => onSelectMatch(receipt.match.id)}
            type="button"
          >
            <div className="receipt-card-top">
              <span className={cx("receipt-pill", receipt.outcome)}>
                {receipt.shortLabel}
              </span>
              <span>{receipt.match.group}</span>
            </div>
            <div className="receipt-teams">
              <span>
                <TeamFlag team={receipt.match.home} compact />
                {receipt.match.home.code}
              </span>
              <strong>{receipt.finalScore ?? receipt.match.score ?? receipt.match.minute ?? receipt.match.time}</strong>
              <span>
                <TeamFlag team={receipt.match.away} compact />
                {receipt.match.away.code}
              </span>
            </div>
            <div className="receipt-call-row">
              <span>
                {t.called}: <strong>{receipt.modelLabel}</strong>
              </span>
              {receipt.actualLabel && (
                <span>
                  {t.finished}: <strong>{receipt.actualLabel}</strong>
                </span>
              )}
            </div>
            <p>{receipt.summary}</p>
          </button>
        ))}
        {scoreboard.receipts.length > collapsedReceiptCount && (
          <button
            aria-expanded={showAllReceipts}
            className="receipt-expand-button"
            onClick={() => setShowAllReceipts((current) => !current)}
            type="button"
          >
            {showAllReceipts ? t.hideReceipts : t.showAllReceipts}
            {!showAllReceipts && hiddenReceiptCount > 0 && (
              <span>{hiddenReceiptCount}</span>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

function CupCandidateCard({
  candidate,
  expanded,
  index,
  language,
  onToggleAnalysis,
  onSelectTeam,
  t,
}: {
  candidate: CupCandidate;
  expanded: boolean;
  index: number;
  language: Language;
  onToggleAnalysis: () => void;
  onSelectTeam: (teamName: string) => void;
  t: Record<string, string>;
}) {
  const pathNote =
    language === "es"
      ? `${candidate.expectedPoints.toFixed(1)} xPts en ${candidate.matches} partidos; la ruta pesa tanto como el talento.`
      : language === "fr"
        ? `${candidate.expectedPoints.toFixed(1)} xPts sur ${candidate.matches} matchs; le parcours compte autant que le talent.`
        : `${candidate.expectedPoints.toFixed(1)} xPts across ${candidate.matches} matches; the route matters as much as the talent.`;

  return (
    <div
      className="cup-candidate-card"
      onClick={() => onSelectTeam(candidate.team.name)}
      style={{ "--team-color": candidate.team.color } as React.CSSProperties}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelectTeam(candidate.team.name);
      }}
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
        <span>{candidate.traits.join(" \u00b7 ")}</span>
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
      <button
        className="cup-analysis-toggle"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleAnalysis();
        }}
        aria-expanded={expanded}
        aria-label={`${expanded ? t.hideNotes : t.signalNotes}: ${candidate.team.name}`}
      >
        <span>{expanded ? t.hideNotes : t.signalNotes}</span>
        <span className="cup-analysis-caret" aria-hidden="true">
          {"\u25be"}
        </span>
      </button>
      {expanded && (
        <div className="cup-analysis-panel">
          <div className="cup-analysis-row">
            <span>{t.seerEdge}</span>
            <strong>{candidate.verdict}</strong>
          </div>
          <div className="cup-analysis-row">
            <span>{t.seerPath}</span>
            <strong>{pathNote}</strong>
          </div>
          <div className="cup-analysis-row">
            <span>{t.seerWatch}</span>
            <strong>{candidate.risk}</strong>
          </div>
        </div>
      )}
    </div>
  );
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
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
  const leader = candidates[0];

  const toggleCupSeer = () => {
    navigator.vibrate?.(12);
    setIsOpen((current) => {
      const next = !current;
      if (!next) {
        setExpandedCandidate(null);
      }
      return next;
    });
  };

  return (
    <section
      className={cx("cup-seer-board", !isOpen && "is-collapsed")}
      id="cup-seer"
      aria-label={t.cupSeer}
    >
      <div className="cup-seer-summary">
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
        <div className="cup-seer-actions">
          {leader && (
            <div className="cup-seer-snapshot" aria-label={`${t.cupLeader}: ${leader.team.name}`}>
              <span>{t.cupLeader}</span>
              <div>
                <TeamFlag team={leader.team} compact />
                <strong>{leader.team.name}</strong>
                <b>{leader.signal}%</b>
              </div>
            </div>
          )}
          <button
            aria-controls="cup-seer-candidates"
            aria-expanded={isOpen}
            className="cup-seer-toggle"
            onClick={toggleCupSeer}
            type="button"
          >
            <span>{isOpen ? t.cupClose : t.cupOpen}</span>
            <span aria-hidden="true" className="cup-seer-toggle-icon">
              {isOpen ? "-" : "+"}
            </span>
          </button>
        </div>
      </div>
      <div className="cup-candidate-grid" hidden={!isOpen} id="cup-seer-candidates">
        {candidates.length === 0 && (
          <div className="empty-match-state">{t.noCupCandidates}</div>
        )}
        {candidates.map((candidate, index) => (
          <CupCandidateCard
            key={candidate.team.name}
            candidate={candidate}
            expanded={expandedCandidate === candidate.team.name}
            index={index}
            language={language}
            onToggleAnalysis={() =>
              setExpandedCandidate((current) =>
                current === candidate.team.name ? null : candidate.team.name,
              )
            }
            onSelectTeam={onSelectTeam}
            t={t}
          />
        ))}
      </div>
      {isOpen && (
        <p className="disclaimer cup-disclaimer">
          {language === "en" && "Cup signals are playful tournament analysis, not betting advice or certainty."}
          {language === "es" && "Las señales de copa son análisis deportivo divertido, no consejos de apuestas ni certezas."}
          {language === "fr" && "Les signaux coupe sont une analyse sportive ludique, pas des conseils de pari ni des certitudes."}
        </p>
      )}
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
  CUW: "cw",
  CZE: "cz",
  DEN: "dk",
  ECU: "ec",
  ENG: "gb-eng",
  ESP: "es",
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
  SWE: "se",
  TUN: "tn",
  TUR: "tr",
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
  curacao: "cw",
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
  sweden: "se",
  switzerland: "ch",
  tunisia: "tn",
  turkey: "tr",
  turkiye: "tr",
  türkiye: "tr",
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
  const [showSupportDetails, setShowSupportDetails] = useState(false);
  const interpretation = oracleRead?.interpretation;
  const signalCopy = interpretation?.summary ?? match.forecast.tone[language];
  const isFinal = match.status === "Final";
  const receipt = isFinal ? buildForecastReceipt(match, language, t) : null;
  const readLabel = isFinal
    ? t.savedRead
    : oracleRead?.source === "openai"
      ? t.freshRead
      : t.seededRead;

  return (
    <div className={cx("forecast-layout", compact && "compact")}>
      <div className="forecast-card primary-card">
        <div className="forecast-card-head">
          <div className="section-heading">
            <Sparkles size={18} />
            <span>{t.signal}</span>
          </div>
          <div className="oracle-actions">
            <span
              className={cx(
                "oracle-source",
                oracleRead?.source === "openai" && "fresh",
                isFinal && "locked",
              )}
            >
              {readLabel}
            </span>
            {showAsk && !isFinal && (
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
        {receipt && (
          <div className="final-receipt-panel" role="status">
            <div className="final-receipt-grid">
              <span>
                <small>{t.called}</small>
                <strong>{receipt.modelLabel}</strong>
              </span>
              <span>
                <small>{t.actual}</small>
                <strong>{receipt.finalScore ?? match.score ?? t.final}</strong>
              </span>
              <em className={cx("receipt-chip", receipt.outcome)}>{receipt.shortLabel}</em>
            </div>
            <p>{receipt.summary}</p>
            <small>{t.noReplay}</small>
          </div>
        )}
        {oracleStatus === "error" && <p className="oracle-error">{t.oracleError}</p>}
        <div className="metric-row">
          <Meter label={t.confidence} value={match.forecast.confidence} />
          <Meter label={t.chaos} value={match.forecast.chaos} hot />
        </div>
        <p className="disclaimer forecast-disclaimer">{interpretation?.disclaimer ?? t.review}</p>
      </div>
      <div className={cx("match-insight-stack", showSupportDetails && "mobile-expanded")}>
        <button
          aria-expanded={showSupportDetails}
          className="mobile-support-toggle"
          onClick={() => setShowSupportDetails((current) => !current)}
          type="button"
        >
          <span>
            <UsersRound size={16} />
            {t.teams} & {t.weather}
          </span>
          <strong>
            {match.home.code} vs {match.away.code} · {match.weather.temp}
          </strong>
          <ChevronDown size={16} />
        </button>
        <div className="match-insight-body">
          <TeamsView match={match} t={t} />
          <WeatherView match={match} t={t} language={language} />
        </div>
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
      {match.players.length === 0 ? (
        <div className="empty-match-state player-empty-state">{t.noPlayerData}</div>
      ) : (
        match.players.map((player) => (
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
        ))
      )}
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
  const hasCardRisk = match.referee.cardRisk !== "Pending";
  const refereeSummary = hasCardRisk
    ? `${match.referee.name} · ${match.referee.cardRisk}`
    : match.referee.name;

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
      {hasRefereeAssignment && (
        <div className="weather-card wide">
          <Trophy size={22} />
          <span>{t.referee}</span>
          <strong>{refereeSummary}</strong>
        </div>
      )}
    </div>
  );
}
