"use client";

import {
  Activity,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
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
    sampleMode: "Sample mode",
    fallbackMode: "Fallback mode",
    dataDepth: "Data depth",
    realFixtures: "Real fixture feed",
    sampleFixtures: "Demo matchday",
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
    sampleMode: "Modo demo",
    fallbackMode: "Respaldo",
    dataDepth: "Nivel de datos",
    realFixtures: "Calendario real",
    sampleFixtures: "Jornada demo",
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
    sampleMode: "Mode démo",
    fallbackMode: "Repli",
    dataDepth: "Niveau données",
    realFixtures: "Calendrier réel",
    sampleFixtures: "Journée démo",
    venueWeather: "Stade + météo",
    connected: "Connecté",
    mapping: "Mappage en cours",
    aiLayer: "Couche IA",
    aiReady: "Prête à la demande",
  },
} satisfies Record<Language, Record<string, string>>;

const fallbackMatches: Match[] = [
  {
    id: "mx-rsa",
    status: "Final",
    group: "Group A",
    time: "Final",
    venue: "Estadio Azteca",
    city: "Mexico City",
    score: "2 - 0",
    home: {
      name: "Mexico",
      code: "MEX",
      color: "#11a36a",
      record: "2W 1D 2L",
      form: ["W", "D", "L", "W", "L"],
      attack: 74,
      control: 71,
      defense: 69,
      setPieces: 78,
    },
    away: {
      name: "South Africa",
      code: "RSA",
      color: "#f5c542",
      record: "3W 1D 1L",
      form: ["W", "W", "D", "W", "L"],
      attack: 72,
      control: 70,
      defense: 74,
      setPieces: 76,
    },
    forecast: {
      home: 57,
      draw: 24,
      away: 19,
      confidence: 74,
      chaos: 52,
      projected: "2-0",
      tone: {
        en: "Mexico carry the host spark at Azteca, while South Africa bring transition danger and a loud opening-match memory.",
        es: "México trae la chispa local en el Azteca, mientras Sudáfrica amenaza en transiciones y memoria de partido inaugural.",
        fr: "Le Mexique porte l’élan local à l’Azteca, tandis que l’Afrique du Sud garde du danger en transition.",
      },
      reasons: {
        en: ["Mexico carry the host rhythm and cleaner territory control.", "South Africa can still flash through midfield transitions.", "The Azteca altitude keeps late legs in the story."],
        es: ["México trae ritmo local y mejor control territorial.", "Sudáfrica puede activar transiciones peligrosas.", "La altura del Azteca mantiene las piernas finales en la historia."],
        fr: ["Le Mexique porte le rythme local et contrôle mieux le terrain.", "L’Afrique du Sud peut encore frapper en transition.", "L’altitude de l’Azteca garde les jambes tardives au centre du récit."],
      },
    },
    weather: {
      temp: "23°C",
      wind: "11 km/h",
      mood: {
        en: "Thin air, fast counters, late legs.",
        es: "Aire ligero, contragolpes rápidos, piernas pesadas al final.",
        fr: "Air fin, contres rapides, jambes lourdes en fin de match.",
      },
    },
    referee: { name: "A. Marciniak", cardRisk: "Medium-high" },
    players: [
      { name: "Santiago Giménez", team: "Mexico", role: "Forward", club: "Feyenoord", league: "Eredivisie", spark: 76, note: "Box gravity" },
      { name: "Teboho Mokoena", team: "South Africa", role: "Midfielder", club: "Mamelodi Sundowns", league: "South African Premiership", spark: 82, note: "Long-range spark" },
      { name: "Edson Álvarez", team: "Mexico", role: "Midfielder", club: "West Ham", league: "Premier League", spark: 80, note: "Duel anchor" },
    ],
  },
  {
    id: "br-jp",
    status: "Upcoming",
    group: "Group C",
    time: "5:00 PM",
    venue: "MetLife Stadium",
    city: "New Jersey",
    home: {
      name: "Brazil",
      code: "BRA",
      color: "#f5c542",
      record: "3W 1D 1L",
      form: ["W", "W", "L", "D", "W"],
      attack: 91,
      control: 86,
      defense: 77,
      setPieces: 72,
    },
    away: {
      name: "Japan",
      code: "JPN",
      color: "#e83d52",
      record: "4W 0D 1L",
      form: ["W", "W", "W", "L", "W"],
      attack: 79,
      control: 82,
      defense: 80,
      setPieces: 69,
    },
    forecast: {
      home: 53,
      draw: 23,
      away: 24,
      confidence: 72,
      chaos: 47,
      projected: "2-1",
      tone: {
        en: "Brazil glow in attack, but Japan keep enough transition static to make the Seer sit forward.",
        es: "Brasil brilla en ataque, pero Japón tiene suficiente electricidad en transición para incomodar al Vidente.",
        fr: "Le Brésil brille devant, mais le Japon garde assez d’électricité en transition pour réveiller le voyant.",
      },
      reasons: {
        en: ["Brazil lead in shot creation and individual spark.", "Japan narrow the midfield gap with tempo.", "Weather looks clean enough for a technical match."],
        es: ["Brasil lidera en creación y talento individual.", "Japón reduce la distancia con ritmo en medio campo.", "El clima favorece un partido técnico."],
        fr: ["Le Brésil domine la création et l’étincelle individuelle.", "Le Japon réduit l’écart avec son rythme au milieu.", "La météo favorise un match technique."],
      },
    },
    weather: {
      temp: "26°C",
      wind: "8 km/h",
      mood: {
        en: "Warm, clean, friendly to first touch.",
        es: "Cálido, limpio, amable para el primer toque.",
        fr: "Doux, clair, favorable au premier contrôle.",
      },
    },
    referee: { name: "M. Oliver", cardRisk: "Medium" },
    players: [
      { name: "Vinícius Júnior", team: "Brazil", role: "Winger", club: "Real Madrid", league: "La Liga", spark: 92, note: "Left-lane lightning" },
      { name: "Takefusa Kubo", team: "Japan", role: "Creator", club: "Real Sociedad", league: "La Liga", spark: 84, note: "Pocket mischief" },
      { name: "Bruno Guimarães", team: "Brazil", role: "Midfielder", club: "Newcastle", league: "Premier League", spark: 86, note: "Tempo switch" },
    ],
  },
  {
    id: "ca-ma",
    status: "Upcoming",
    group: "Group F",
    time: "8:00 PM",
    venue: "BMO Field",
    city: "Toronto",
    home: {
      name: "Canada",
      code: "CAN",
      color: "#e1251b",
      record: "2W 2D 1L",
      form: ["D", "W", "W", "L", "D"],
      attack: 77,
      control: 73,
      defense: 72,
      setPieces: 75,
    },
    away: {
      name: "Morocco",
      code: "MAR",
      color: "#c1272d",
      record: "3W 1D 1L",
      form: ["W", "D", "W", "W", "L"],
      attack: 78,
      control: 79,
      defense: 86,
      setPieces: 80,
    },
    forecast: {
      home: 31,
      draw: 30,
      away: 39,
      confidence: 59,
      chaos: 66,
      projected: "1-1 / 1-2",
      tone: {
        en: "Morocco bring the steadier defensive moon, but Canada have enough pace to make this forecast wobble.",
        es: "Marruecos trae una luna defensiva más estable, pero Canadá tiene velocidad suficiente para mover el pronóstico.",
        fr: "Le Maroc apporte une lune défensive plus stable, mais le Canada a assez de vitesse pour faire trembler la prévision.",
      },
      reasons: {
        en: ["Morocco rate higher in defensive structure.", "Canada’s wide pace lifts upset risk.", "The draw lane is unusually open."],
        es: ["Marruecos puntúa mejor en estructura defensiva.", "La velocidad por fuera de Canadá sube el riesgo de sorpresa.", "El camino del empate está muy abierto."],
        fr: ["Le Maroc est plus solide dans sa structure défensive.", "La vitesse canadienne sur les côtés augmente le risque de surprise.", "La voie du nul reste très ouverte."],
      },
    },
    weather: {
      temp: "18°C",
      wind: "17 km/h",
      mood: {
        en: "Cool breeze, cross-heavy, set-piece friendly.",
        es: "Brisa fresca, muchos centros, buen clima para balón parado.",
        fr: "Brise fraîche, beaucoup de centres, phases arrêtées favorisées.",
      },
    },
    referee: { name: "S. Frappart", cardRisk: "Medium-low" },
    players: [
      { name: "Alphonso Davies", team: "Canada", role: "Wingback", club: "Bayern Munich", league: "Bundesliga", spark: 90, note: "Left-side ignition" },
      { name: "Achraf Hakimi", team: "Morocco", role: "Fullback", club: "PSG", league: "Ligue 1", spark: 88, note: "Two-way engine" },
      { name: "Youssef En-Nesyri", team: "Morocco", role: "Forward", club: "Fenerbahçe", league: "Süper Lig", spark: 81, note: "Air traffic" },
    ],
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isLanguageOption(value: string | null): value is Language {
  return value === "en" || value === "es" || value === "fr";
}

type MatchesResponse = {
  source: "sample" | "database" | "database-unavailable";
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
  const [matches, setMatches] = useState(fallbackMatches);
  const [activeMatchId, setActiveMatchId] = useState(fallbackMatches[0].id);
  const [activeTab, setActiveTab] = useState<Tab>("forecast");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("today");
  const [groupFilter, setGroupFilter] = useState("all");
  const [dataInfo, setDataInfo] = useState<Pick<MatchesResponse, "source" | "reason" | "database">>({
    source: "sample",
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

        if (!ignore && payload.matches.length > 0) {
          setDataInfo({
            source: payload.source,
            reason: payload.reason,
            database: payload.database,
          });
          setMatches(payload.matches);
          setActiveMatchId((current) =>
            payload.matches.some((match) => match.id === current)
              ? current
              : payload.matches[0].id,
          );
        }
      } catch {
        // The sample matchday stays visible if the API is unavailable.
      }
    }

    void loadMatches();

    return () => {
      ignore = true;
    };
  }, []);

  const activeMatch = useMemo(
    () => matches.find((match) => match.id === activeMatchId) ?? matches[0],
    [activeMatchId, matches],
  );
  const t = copy[language];
  const oracleKey = `${activeMatch.id}:${language}`;
  const activeOracleRead = oracleReads[oracleKey];
  const activeOracleStatus = oracleStatus[oracleKey] ?? "idle";
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
    activeMatch.weather.temp === "Pending" ||
    activeMatch.weather.wind === "Pending" ||
    activeMatch.weather.mood[language].toLowerCase().includes("pending");
  const dataSourceLabel =
    dataInfo.source === "database"
      ? t.liveDatabase
      : dataInfo.source === "sample"
        ? t.sampleMode
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

        <div className="pitch-visual" aria-hidden="true">
          <div className="pitch-lines" />
          <div className="pitch-orbit orbit-one" />
          <div className="pitch-orbit orbit-two" />
          <div className="pulse-ball" />
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
          value={dataInfo.source === "database" ? t.realFixtures : t.sampleFixtures}
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
            <span>{t.today}</span>
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
            <label className="group-filter">
              <span>{t.groups}</span>
              <select
                onChange={(event) => setGroupFilter(event.target.value)}
                value={groupFilter}
              >
                <option value="all">{t.allGroups}</option>
                {groups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
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
                  <ChevronRight size={17} />
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
