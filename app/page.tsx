"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CloudSun,
  Languages,
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
import { useMemo, useState } from "react";
import type {
  Language,
  MatchSummary as Match,
  PlayerSpark as Player,
  TeamRating as Team,
} from "../lib/domain";

type Tab = "forecast" | "teams" | "players" | "weather";

const copy = {
  en: {
    matchday: "Matchday forecast",
    subtitle: "Real stats, playful readouts, zero betting energy.",
    today: "Today",
    live: "Live",
    upcoming: "Upcoming",
    final: "Final",
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
    review: "Forecasts are for entertainment and sports analysis only. No betting advice.",
    ad: "Sponsor space",
    adCopy: "Future ad slot. No sportsbooks, no weird subscription mambo jumbo.",
    signal: "Oracle signal",
  },
  es: {
    matchday: "Pronóstico del día",
    subtitle: "Estadísticas reales, lectura divertida y cero vibra de apuestas.",
    today: "Hoy",
    live: "En vivo",
    upcoming: "Próximo",
    final: "Final",
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
    review: "Pronósticos solo para entretenimiento y análisis deportivo. No son consejos de apuestas.",
    ad: "Espacio patrocinado",
    adCopy: "Futuro espacio publicitario. Sin casas de apuestas ni suscripciones raras.",
    signal: "Señal del oráculo",
  },
  fr: {
    matchday: "Prévision du jour",
    subtitle: "Des stats réelles, une lecture légère, aucune vibe pari sportif.",
    today: "Aujourd’hui",
    live: "En direct",
    upcoming: "À venir",
    final: "Terminé",
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
    review: "Prévisions à des fins de divertissement et d’analyse sportive seulement. Aucun conseil de pari.",
    ad: "Espace sponsor",
    adCopy: "Futur espace publicitaire. Pas de paris sportifs, pas d’abonnement bizarre.",
    signal: "Signal oracle",
  },
} satisfies Record<Language, Record<string, string>>;

const matches: Match[] = [
  {
    id: "mx-fr",
    status: "Live",
    minute: "62'",
    group: "Group A",
    time: "Now",
    venue: "Estadio Azteca",
    city: "Mexico City",
    score: "1 - 1",
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
      name: "France",
      code: "FRA",
      color: "#3157ff",
      record: "4W 1D 0L",
      form: ["W", "W", "D", "W", "W"],
      attack: 88,
      control: 84,
      defense: 81,
      setPieces: 73,
    },
    forecast: {
      home: 29,
      draw: 27,
      away: 44,
      confidence: 68,
      chaos: 61,
      projected: "1-2 / 2-2",
      tone: {
        en: "France carry the brighter signal, but Mexico have the altitude spark and a loud-stadium weather system.",
        es: "Francia trae la señal más fuerte, pero México tiene chispa de altura y un estadio que empuja como tormenta.",
        fr: "La France garde le signal le plus net, mais le Mexique a l’altitude et un stade qui peut tourner le vent.",
      },
      reasons: {
        en: ["France own the cleaner attack profile.", "Mexico improve at altitude and on set pieces.", "The live score keeps draw weather very alive."],
        es: ["Francia tiene el perfil ofensivo más claro.", "México mejora con altura y balón parado.", "El marcador en vivo mantiene muy vivo el empate."],
        fr: ["La France possède le profil offensif le plus net.", "Le Mexique gagne en altitude et sur phases arrêtées.", "Le score en direct garde le nul très présent."],
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
      { name: "Kylian Mbappé", team: "France", role: "Forward", club: "Real Madrid", league: "La Liga", spark: 94, note: "Open-field storm" },
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

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [activeMatchId, setActiveMatchId] = useState(matches[0].id);
  const [activeTab, setActiveTab] = useState<Tab>("forecast");

  const activeMatch = useMemo(
    () => matches.find((match) => match.id === activeMatchId) ?? matches[0],
    [activeMatchId],
  );
  const t = copy[language];

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
          <div className="status-chip">
            <Radio size={15} />
            {t.today}
          </div>
          <h2>{t.subtitle}</h2>
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

      <section className="content-grid">
        <aside className="match-rail" aria-label="Match list">
          <div className="section-heading">
            <CalendarDays size={18} />
            <span>{t.today}</span>
          </div>
          <div className="match-list">
            {matches.map((match) => (
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
                  <span>{match.minute ?? match.time}</span>
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
            <button className="share-button" type="button">
              <Share2 size={17} />
              {t.share}
            </button>
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

          {activeTab === "forecast" && <ForecastView match={activeMatch} t={t} language={language} />}
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
}: {
  match: Match;
  t: Record<string, string>;
  language: Language;
}) {
  return (
    <div className="forecast-layout">
      <div className="forecast-card primary-card">
        <div className="section-heading">
          <Sparkles size={18} />
          <span>{t.signal}</span>
        </div>
        <p className="seer-line">{match.forecast.tone[language]}</p>
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
          {match.forecast.reasons[language].map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p className="disclaimer">{t.review}</p>
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
