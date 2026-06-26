import type { Language, MatchSummary as Match, TeamRating as Team } from "./domain";

export type CupCandidate = {
  team: Team;
  score: number;
  signal: number;
  advanceProbability: number;
  matches: number;
  expectedPoints: number;
  pathSignal: number;
  traits: string[];
  verdict: string;
  risk: string;
};

export type CupSnapshotCandidate = {
  rank: number;
  team: {
    name: string;
    code: string;
    color: string;
  };
  signal: number;
  advanceProbability: number;
  expectedPoints: number;
  matches: number;
  pathSignal: number;
  traits: string[];
};

export function buildCupCandidates(
  matches: Match[],
  language: Language,
  limit = 8,
): CupCandidate[] {
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
    if (
      match.forecast.isPending ||
      match.home.isPlaceholder ||
      match.away.isPlaceholder
    ) {
      continue;
    }

    const projection = projectFixturePath(match);

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
          teamCore * 0.56 +
            pathSignal * 0.2 +
            averageForecast * 0.1 +
            pointsPerMatch * 6 -
            averageChaos * 0.035,
        ),
        1,
        99,
      );
      const advanceProbability = clamp(
        Math.round(
          teamCore * 0.28 +
            pathSignal * 0.24 +
            averageForecast * 0.12 +
            pointsPerMatch * 15 -
            averageChaos * 0.03,
        ),
        5,
        98,
      );

      return {
        team: entry.team,
        score: signal,
        signal,
        advanceProbability,
        matches: entry.matches,
        expectedPoints: entry.expectedPoints,
        pathSignal,
        traits: cupTraits(entry.team, pathSignal),
        verdict: cupVerdict(
          entry.team,
          signal,
          advanceProbability,
          pointsPerMatch,
          pathSignal,
          language,
        ),
        risk: cupRisk(entry.team, averageChaos, pathSignal, language),
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.advanceProbability - left.advanceProbability;
    })
    .slice(0, limit);
}

export function toCupSnapshotCandidates(
  candidates: CupCandidate[],
): CupSnapshotCandidate[] {
  return candidates.map((candidate, index) => ({
    rank: index + 1,
    team: {
      name: candidate.team.name,
      code: candidate.team.code,
      color: candidate.team.color,
    },
    signal: candidate.signal,
    advanceProbability: candidate.advanceProbability,
    expectedPoints: Math.round(candidate.expectedPoints * 10) / 10,
    matches: candidate.matches,
    pathSignal: Math.round(candidate.pathSignal),
    traits: candidate.traits,
  }));
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

function projectFixturePath(match: Match) {
  const homePower = teamTournamentPower(match.home);
  const awayPower = teamTournamentPower(match.away);
  const powerGap = homePower - awayPower;
  const score = scoreParts(match.score);

  if (match.status === "Final" && score) {
    const homeWin = score.home > score.away ? 90 : score.home === score.away ? 34 : 8;
    const awayWin = score.away > score.home ? 90 : score.home === score.away ? 34 : 8;
    const draw = score.home === score.away ? 50 : 2;

    return {
      homeWin,
      awayWin,
      homeExpectedPoints: score.home > score.away ? 3 : score.home === score.away ? 1 : 0,
      awayExpectedPoints: score.away > score.home ? 3 : score.home === score.away ? 1 : 0,
      homePathSignal: clamp(Math.round(homePower * 0.58 + homeWin * 0.42), 1, 99),
      awayPathSignal: clamp(Math.round(awayPower * 0.58 + awayWin * 0.42), 1, 99),
      draw,
    };
  }

  const draw = clamp(
    Math.round(26 + match.forecast.chaos * 0.04 - Math.abs(powerGap) * 0.12),
    18,
    31,
  );
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
    draw,
  };
}

function scoreParts(score: string | undefined) {
  const match = score?.match(/(\d+)\s*[-:–]\s*(\d+)/);

  if (!match) {
    return null;
  }

  const home = Number(match[1]);
  const away = Number(match[2]);

  return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
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

  return tournamentPowerByName[key] ?? tournamentPowerByCode[code] ?? 58;
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
  curacao: 49,
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
  "new zealand": 50,
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
  NZL: 50,
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
  advanceProbability: number,
  pointsPerMatch: number,
  pathSignal: number,
  language: Language,
) {
  const [primaryTrait, secondaryTrait] = cupTraits(team, pathSignal);
  const bestTrait = primaryTrait?.toLowerCase() ?? "balance";
  const supportTrait = secondaryTrait?.toLowerCase() ?? "depth";
  const expectedText = pointsPerMatch.toFixed(1);

  if (language === "es") {
    return `Carril de segunda ronda al ${advanceProbability}%; ${bestTrait} marca el pulso, ${expectedText} xPts por partido y ${supportTrait} sostiene la lectura.`;
  }

  if (language === "fr") {
    return `Couloir deuxième tour à ${advanceProbability} %; ${bestTrait} donne le ton, ${expectedText} xPts par match et ${supportTrait} soutient la lecture.`;
  }

  if (bestTrait === "attack") {
    return `The second-round lane sits at ${advanceProbability}%; chance creation is loud, with ${expectedText} xPts per match and ${supportTrait} keeping the read from feeling one-note.`;
  }
  if (bestTrait === "control") {
    return `The second-round lane sits at ${advanceProbability}%; tempo and ball security carry the pulse, with ${expectedText} xPts per match.`;
  }
  if (bestTrait === "defense") {
    return `The second-round lane sits at ${advanceProbability}%; the shield is doing the talking, and ${supportTrait} helps them survive tight nights.`;
  }
  if (bestTrait === "set pieces") {
    return `The second-round lane sits at ${advanceProbability}%; set pieces are the hidden doorway in this path.`;
  }

  return `The second-round lane sits at ${advanceProbability}%; the path is the argument with ${signal}% signal and ${expectedText} xPts.`;
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
      return "La creación puede secarse; si no golpean pronto, la ruta se vuelve pesada.";
    }
    if (isSetPieceReliant) {
      return "Mucho depende del balón parado. Si el árbitro deja jugar, se apaga una ruta clave.";
    }
    if (highChaos && !cleanPath) {
      return `Ruta con tráfico y ${chaos.toFixed(0)}% de caos: una noche rara cambia el cuadro.`;
    }
    if (!cleanPath) {
      return "El talento está, pero el carril no es limpio. Un empate incómodo cambia el pulso.";
    }
    return "Señal alta, riesgo simple: gestionar piernas, rotaciones y exceso de confianza.";
  }

  if (language === "fr") {
    if (veryHighChaos && isDefensiveWeakness) {
      return `Trop de transitions : ${chaos.toFixed(0)} % de chaos et un dos qui peut s'exposer.`;
    }
    if (isChanceLight) {
      return "La création peut sécher; sans but tôt, la route devient lourde.";
    }
    if (isSetPieceReliant) {
      return "Beaucoup dépend des coups de pied arrêtés. Si l'arbitre laisse jouer, une route clé s'éteint.";
    }
    if (highChaos && !cleanPath) {
      return `Route chargée et ${chaos.toFixed(0)} % de chaos : une soirée étrange peut déplacer le tableau.`;
    }
    if (!cleanPath) {
      return "Le talent est là, mais le couloir n'est pas net. Un nul gênant change le pulse.";
    }
    return "Gros signal, risque simple : gérer les jambes, les rotations et l'excès de confiance.";
  }

  if (veryHighChaos && isDefensiveWeakness) {
    return `Too much transition weather: ${chaos.toFixed(0)}% chaos and a back line that can get stretched.`;
  }
  if (isChanceLight) {
    return "Chance creation can dry up; if the first goal does not arrive early, the lane gets heavy.";
  }
  if (isSetPieceReliant) {
    return "A lot rides on dead balls. If the referee lets contact go, one key route gets quieter.";
  }
  if (highChaos && !cleanPath) {
    return `Traffic in the lane plus ${chaos.toFixed(0)}% chaos: one strange night can reshuffle the bracket.`;
  }
  if (!cleanPath) {
    return "The talent is there, but the lane is not clean. One awkward draw changes the pulse.";
  }
  return "Big signal, simple risk: manage legs, rotations, and the temptation to cruise.";
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
