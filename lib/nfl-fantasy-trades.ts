export type FantasyTradePosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type FantasyTradeScoringFormat = "standard" | "halfPpr" | "fullPpr";

export type FantasyTradeLens = "redraft" | "dynasty";

export type FantasyTradePlayer = {
  id: string;
  name: string;
  nflTeam?: string;
  position: FantasyTradePosition | string;
  projection: number;
  floor: number;
  ceiling: number;
  roleSecurity?: number;
  dynastyValue?: number;
  risk?: number;
  starter?: boolean;
};

export type FantasyTradeTeam = {
  id: string;
  name: string;
  manager?: string;
  players: FantasyTradePlayer[];
};

export type FantasyTradePackageTier = "safe" | "fair" | "aggressive";

export type FantasyTradeTeamImpact = {
  teamName: string;
  starterProjectionBefore: number;
  starterProjectionAfter: number;
  starterProjectionDelta: number;
  benchDepthBefore: number;
  benchDepthAfter: number;
  benchDepthDelta: number;
  dynastyValueBefore: number;
  dynastyValueAfter: number;
  dynastyValueDelta: number;
  strongestPositionBefore: FantasyTradePosition;
  strongestPositionAfter: FantasyTradePosition;
  weakestPositionBefore: FantasyTradePosition;
  weakestPositionAfter: FantasyTradePosition;
};

export type FantasyTradeImpactPreview = {
  myTeam: FantasyTradeTeamImpact;
  partnerTeam: FantasyTradeTeamImpact;
  verdict: string;
  overpayWarning: string;
  counterOffer: string;
  regretCheck: string;
};

export type FantasyTradePackage = {
  tier: FantasyTradePackageTier;
  title: string;
  partnerTeamId: string;
  partnerTeam: string;
  target: FantasyTradePlayer;
  offerPlayers: FantasyTradePlayer[];
  receiveValue: number;
  offerValue: number;
  valueGap: number;
  fairnessScore: number;
  walkAwayValue: number;
  walkAwayLine: string;
  whyItHelpsMe: string;
  whyTheyMightAccept: string;
  risk: string;
  doNotInclude: FantasyTradePlayer[];
  impact: FantasyTradeImpactPreview;
};

export type FantasyTradeBuilderResult = {
  teamName: string;
  needPosition: FantasyTradePosition;
  surplusPosition: FantasyTradePosition;
  summary: string;
  packages: FantasyTradePackage[];
  doNotInclude: FantasyTradePlayer[];
};

export type FantasyTradeBuilderInput = {
  activeTeamId: string;
  teams: FantasyTradeTeam[];
  scoringFormat: FantasyTradeScoringFormat;
  lens: FantasyTradeLens;
};

const tradePositions: FantasyTradePosition[] = ["QB", "RB", "WR", "TE", "K", "DST"];
const coreTradePositions: FantasyTradePosition[] = ["QB", "RB", "WR", "TE"];

const starterNeeds: Record<FantasyTradePosition, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

const tierConfig: Record<
  FantasyTradePackageTier,
  { label: string; minRatio: number; maxRatio: number; targetIndex: number }
> = {
  safe: { label: "Safe offer", minRatio: 0.72, maxRatio: 1.1, targetIndex: 2 },
  fair: { label: "Fair offer", minRatio: 0.88, maxRatio: 1.2, targetIndex: 1 },
  aggressive: { label: "Aggressive offer", minRatio: 0.98, maxRatio: 1.32, targetIndex: 0 },
};

export function buildFantasyTradePackages({
  activeTeamId,
  teams,
  scoringFormat,
  lens,
}: FantasyTradeBuilderInput): FantasyTradeBuilderResult {
  const normalizedTeams = teams.map(normalizeTradeTeam);
  const active =
    normalizedTeams.find((team) => team.id === activeTeamId) ?? normalizedTeams[0];

  if (!active) {
    return emptyTradeBuilderResult();
  }

  const leagueAverages = leaguePositionAverages(normalizedTeams, scoringFormat, lens);
  const needs = teamPositionProfiles(active, leagueAverages, scoringFormat, lens);
  const needPosition = pickNeedPosition(needs);
  const surplusPosition = pickSurplusPosition(needs, needPosition);
  const doNotInclude = pickDoNotInclude(active, needPosition, lens, scoringFormat);
  const packages = buildPackages({
    active,
    doNotInclude,
    lens,
    needPosition,
    scoringFormat,
    surplusPosition,
    teams: normalizedTeams,
  });

  return {
    doNotInclude,
    needPosition,
    packages,
    surplusPosition,
    summary:
      packages.length > 0
        ? `${active.name} should shop ${positionLabel(surplusPosition)} depth for ${positionLabel(needPosition)} help. Start with the safe offer and only climb if the other manager is close.`
        : `${active.name} has no clean trade package yet. Hold the core and re-check after waivers, injuries, or projections refresh.`,
    teamName: active.name,
  };
}

export function fantasyTradePlayerValue(
  player: FantasyTradePlayer,
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
) {
  const position = normalizeTradePosition(player.position);
  const scoringBoost = scoringPositionMultiplier(position, scoringFormat);
  const dynastyBoost =
    lens === "dynasty" ? ((player.dynastyValue ?? player.roleSecurity ?? 70) - 60) * 0.18 : 0;
  const role = (player.roleSecurity ?? 72) * 0.035;
  const riskPenalty = (player.risk ?? 50) * 0.022;
  const starterBoost = player.starter ? 0.8 : 0;

  return round1(
    (player.projection * 5.4 + player.floor * 2.2 + player.ceiling * 0.9) *
      scoringBoost +
      role +
      dynastyBoost +
      starterBoost -
      riskPenalty,
  );
}

function buildPackages({
  active,
  doNotInclude,
  lens,
  needPosition,
  scoringFormat,
  surplusPosition,
  teams,
}: {
  active: FantasyTradeTeam;
  doNotInclude: FantasyTradePlayer[];
  lens: FantasyTradeLens;
  needPosition: FantasyTradePosition;
  scoringFormat: FantasyTradeScoringFormat;
  surplusPosition: FantasyTradePosition;
  teams: FantasyTradeTeam[];
}) {
  const untouchableIds = new Set(doNotInclude.map((player) => player.id));
  const targetPool = teams
    .filter((team) => team.id !== active.id)
    .flatMap((team) =>
      team.players.map((player) => ({
        player,
        team,
      })),
    )
    .filter(({ player }) => normalizeTradePosition(player.position) === needPosition)
    .sort(
      (left, right) =>
        fantasyTradePlayerValue(right.player, scoringFormat, lens) -
          fantasyTradePlayerValue(left.player, scoringFormat, lens) ||
        right.player.projection - left.player.projection,
    );
  const fallbackTargets =
    targetPool.length > 0
      ? targetPool
      : teams
          .filter((team) => team.id !== active.id)
          .flatMap((team) => team.players.map((player) => ({ player, team })))
          .filter(({ player }) => coreTradePositions.includes(normalizeTradePosition(player.position)))
          .sort(
            (left, right) =>
              fantasyTradePlayerValue(right.player, scoringFormat, lens) -
              fantasyTradePlayerValue(left.player, scoringFormat, lens),
          );
  const offerPool = active.players
    .filter((player) => !untouchableIds.has(player.id))
    .sort(
      (left, right) =>
        offerFitScore(right, surplusPosition, scoringFormat, lens) -
        offerFitScore(left, surplusPosition, scoringFormat, lens),
    );
  const packages: FantasyTradePackage[] = [];

  for (const tier of ["safe", "fair", "aggressive"] as FantasyTradePackageTier[]) {
    const config = tierConfig[tier];
    const target =
      fallbackTargets[Math.min(config.targetIndex, fallbackTargets.length - 1)] ??
      fallbackTargets[0];

    if (!target) {
      continue;
    }

    const receiveValue = fantasyTradePlayerValue(target.player, scoringFormat, lens);
    const offerPlayers = pickOfferPlayers({
      maxRatio: config.maxRatio,
      minRatio: config.minRatio,
      receiveValue,
      scoringFormat,
      lens,
      offerPool,
      surplusPosition,
    });

    if (offerPlayers.length === 0) {
      continue;
    }

    const offerValue = round1(
      sum(offerPlayers.map((player) => fantasyTradePlayerValue(player, scoringFormat, lens))),
    );
    const valueGap = round1(offerValue - receiveValue);
    const walkAwayValue = round1(receiveValue * config.maxRatio);
    const impact = buildTradeImpactPreview({
      active,
      lens,
      offerPlayers,
      partner: target.team,
      receiveValue,
      scoringFormat,
      target: target.player,
      tier,
      offerValue,
    });

    packages.push({
      doNotInclude,
      fairnessScore: clampScore(
        Math.round(100 - Math.abs(offerValue / Math.max(1, receiveValue) - 1) * 100),
      ),
      impact,
      offerPlayers,
      offerValue,
      partnerTeamId: target.team.id,
      partnerTeam: target.team.name,
      receiveValue,
      risk: tradePackageRisk(tier, target.player, offerPlayers, lens),
      target: target.player,
      tier,
      title: config.label,
      valueGap,
      walkAwayLine: `Do not go past ${walkAwayValue.toFixed(1)} trade value or add ${doNotInclude[0]?.name ?? "a core starter"}.`,
      walkAwayValue,
      whyItHelpsMe: tradeHelpsMeCopy(target.player, needPosition, scoringFormat, lens),
      whyTheyMightAccept: tradeAcceptCopy(offerPlayers, surplusPosition, target.team),
    });
  }

  return dedupePackages(packages);
}

function buildTradeImpactPreview({
  active,
  lens,
  offerPlayers,
  offerValue,
  partner,
  receiveValue,
  scoringFormat,
  target,
  tier,
}: {
  active: FantasyTradeTeam;
  lens: FantasyTradeLens;
  offerPlayers: FantasyTradePlayer[];
  offerValue: number;
  partner: FantasyTradeTeam;
  receiveValue: number;
  scoringFormat: FantasyTradeScoringFormat;
  target: FantasyTradePlayer;
  tier: FantasyTradePackageTier;
}): FantasyTradeImpactPreview {
  const offerIds = new Set(offerPlayers.map((player) => player.id));
  const activeAfter = tradeTeamWithMoves(active, {
    add: [target],
    removeIds: offerIds,
  });
  const partnerAfter = tradeTeamWithMoves(partner, {
    add: offerPlayers,
    removeIds: new Set([target.id]),
  });
  const myTeam = teamImpact(active, activeAfter, scoringFormat, lens);
  const partnerTeam = teamImpact(partner, partnerAfter, scoringFormat, lens);
  const overpayRatio = offerValue / Math.max(1, receiveValue);
  const overpayWarning =
    overpayRatio > 1.16
      ? `This is getting expensive: you are paying ${round1((overpayRatio - 1) * 100)}% above the target value.`
      : myTeam.starterProjectionDelta < -0.6
        ? "This costs weekly lineup points, so only do it if the target fixes a fragile position."
        : "No major overpay flag. The package protects your core and keeps the roster shape playable.";
  const verdict =
    myTeam.starterProjectionDelta >= 1
      ? `Do this if ${target.name} becomes your weekly starter.`
      : myTeam.starterProjectionDelta >= 0
        ? `This is playable if you need ${positionLabel(normalizeTradePosition(target.position))} stability.`
        : `Only do this if you trust ${target.name}'s role more than the raw projection.`;
  const extraAskLimit =
    tier === "aggressive"
      ? "Do not add another starter."
      : "If they ask for more, add a small bench piece only.";
  const counterOffer =
    overpayRatio > 1.12
      ? `Counter lower: remove ${offerPlayers[offerPlayers.length - 1]?.name ?? "the extra piece"} before adding anything else.`
      : `${extraAskLimit} Keep the walk-away line intact.`;
  const regretCheck =
    lens === "dynasty" && myTeam.dynastyValueDelta < -2
      ? "Dynasty regret risk is real: you are giving up future value for a current-week patch."
      : myTeam.benchDepthDelta < -3
        ? "Depth gets thinner. Make sure waivers can cover the bye/injury weeks."
        : "Regret risk is manageable because the bench and core stay intact.";

  return {
    counterOffer,
    myTeam,
    overpayWarning,
    partnerTeam,
    regretCheck,
    verdict,
  };
}

function tradeTeamWithMoves(
  team: FantasyTradeTeam,
  {
    add,
    removeIds,
  }: {
    add: FantasyTradePlayer[];
    removeIds: Set<string>;
  },
): FantasyTradeTeam {
  const remaining = team.players.filter((player) => !removeIds.has(player.id));
  const existingIds = new Set(remaining.map((player) => player.id));
  const additions = add
    .filter((player) => !existingIds.has(player.id))
    .map((player) => ({ ...player, starter: false }));

  return {
    ...team,
    players: [...remaining, ...additions],
  };
}

function teamImpact(
  before: FantasyTradeTeam,
  after: FantasyTradeTeam,
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
): FantasyTradeTeamImpact {
  const beforeSnapshot = tradeTeamSnapshot(before, scoringFormat, lens);
  const afterSnapshot = tradeTeamSnapshot(after, scoringFormat, lens);

  return {
    benchDepthAfter: afterSnapshot.benchDepth,
    benchDepthBefore: beforeSnapshot.benchDepth,
    benchDepthDelta: round1(afterSnapshot.benchDepth - beforeSnapshot.benchDepth),
    dynastyValueAfter: afterSnapshot.dynastyValue,
    dynastyValueBefore: beforeSnapshot.dynastyValue,
    dynastyValueDelta: round1(afterSnapshot.dynastyValue - beforeSnapshot.dynastyValue),
    starterProjectionAfter: afterSnapshot.starterProjection,
    starterProjectionBefore: beforeSnapshot.starterProjection,
    starterProjectionDelta: round1(
      afterSnapshot.starterProjection - beforeSnapshot.starterProjection,
    ),
    strongestPositionAfter: afterSnapshot.strongestPosition,
    strongestPositionBefore: beforeSnapshot.strongestPosition,
    teamName: before.name,
    weakestPositionAfter: afterSnapshot.weakestPosition,
    weakestPositionBefore: beforeSnapshot.weakestPosition,
  };
}

function tradeTeamSnapshot(
  team: FantasyTradeTeam,
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
) {
  const usedIds = new Set<string>();
  const positionRows = tradePositions.map((position) => {
    const starters = team.players
      .filter((player) => normalizeTradePosition(player.position) === position)
      .sort(
        (left, right) =>
          fantasyTradePlayerValue(right, scoringFormat, lens) -
          fantasyTradePlayerValue(left, scoringFormat, lens),
      )
      .slice(0, starterNeeds[position]);

    starters.forEach((player) => usedIds.add(player.id));

    return {
      position,
      projection: round1(sum(starters.map((player) => player.projection))),
    };
  });
  const benchPlayers = team.players
    .filter((player) => !usedIds.has(player.id))
    .sort((left, right) => right.projection - left.projection);
  const coreRows = positionRows.filter((row) =>
    coreTradePositions.includes(row.position),
  );
  const strongestPosition =
    [...coreRows].sort((left, right) => right.projection - left.projection)[0]
      ?.position ?? "WR";
  const weakestPosition =
    [...coreRows].sort((left, right) => left.projection - right.projection)[0]
      ?.position ?? "WR";
  const dynastyPlayers = [...team.players]
    .sort(
      (left, right) =>
        (right.dynastyValue ?? right.roleSecurity ?? 70) -
        (left.dynastyValue ?? left.roleSecurity ?? 70),
    )
    .slice(0, 10);

  return {
    benchDepth: round1(sum(benchPlayers.slice(0, 5).map((player) => player.projection))),
    dynastyValue: round1(
      average(
        dynastyPlayers.map(
          (player) => player.dynastyValue ?? player.roleSecurity ?? 70,
        ),
      ),
    ),
    starterProjection: round1(sum(positionRows.map((row) => row.projection))),
    strongestPosition,
    weakestPosition,
  };
}

function pickOfferPlayers({
  maxRatio,
  minRatio,
  receiveValue,
  scoringFormat,
  lens,
  offerPool,
  surplusPosition,
}: {
  maxRatio: number;
  minRatio: number;
  receiveValue: number;
  scoringFormat: FantasyTradeScoringFormat;
  lens: FantasyTradeLens;
  offerPool: FantasyTradePlayer[];
  surplusPosition: FantasyTradePosition;
}) {
  const minValue = receiveValue * minRatio;
  const maxValue = receiveValue * maxRatio;
  const preferred = offerPool.filter(
    (player) => normalizeTradePosition(player.position) === surplusPosition,
  );
  const candidates = [...preferred, ...offerPool.filter((player) => !preferred.includes(player))];
  const selected: FantasyTradePlayer[] = [];
  let value = 0;

  for (const player of candidates) {
    const playerValue = fantasyTradePlayerValue(player, scoringFormat, lens);

    if (value + playerValue > maxValue && selected.length > 0) {
      continue;
    }

    selected.push(player);
    value += playerValue;

    if (value >= minValue || selected.length >= 2) {
      break;
    }
  }

  return value <= maxValue || selected.length === 1 ? selected.slice(0, 2) : [];
}

function normalizeTradeTeam(team: FantasyTradeTeam): FantasyTradeTeam {
  return {
    ...team,
    players: team.players
      .map((player) => ({
        ...player,
        position: normalizeTradePosition(player.position),
      }))
      .filter((player) => Number.isFinite(player.projection)),
  };
}

function normalizeTradePosition(position: string): FantasyTradePosition {
  const normalized = position.toUpperCase();

  if (normalized === "DEF" || normalized === "D") {
    return "DST";
  }

  return tradePositions.includes(normalized as FantasyTradePosition)
    ? (normalized as FantasyTradePosition)
    : "WR";
}

function leaguePositionAverages(
  teams: FantasyTradeTeam[],
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
) {
  return tradePositions.reduce<Record<FantasyTradePosition, number>>(
    (averages, position) => {
      averages[position] = round1(
        average(
          teams.map((team) =>
            positionValue(team.players, position, scoringFormat, lens).starterValue,
          ),
        ),
      );

      return averages;
    },
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );
}

function teamPositionProfiles(
  team: FantasyTradeTeam,
  averages: Record<FantasyTradePosition, number>,
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
) {
  return tradePositions.map((position) => {
    const value = positionValue(team.players, position, scoringFormat, lens);
    const averageValue = averages[position] ?? 0;
    const gap = round1(value.starterValue - averageValue);
    const benchValue = value.benchValue;

    return {
      averageValue,
      benchValue,
      depthCount: value.players.length,
      gap,
      position,
      starterValue: value.starterValue,
      surplusScore: round1(gap + benchValue * 0.34 + Math.max(0, value.players.length - starterNeeds[position]) * 4),
    };
  });
}

function positionValue(
  players: FantasyTradePlayer[],
  position: FantasyTradePosition,
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
) {
  const positionPlayers = players
    .filter((player) => normalizeTradePosition(player.position) === position)
    .sort(
      (left, right) =>
        fantasyTradePlayerValue(right, scoringFormat, lens) -
        fantasyTradePlayerValue(left, scoringFormat, lens),
    );
  const starters = positionPlayers.slice(0, starterNeeds[position]);
  const bench = positionPlayers.slice(starterNeeds[position]);

  return {
    benchValue: round1(sum(bench.slice(0, 3).map((player) => fantasyTradePlayerValue(player, scoringFormat, lens)))),
    players: positionPlayers,
    starterValue: round1(sum(starters.map((player) => fantasyTradePlayerValue(player, scoringFormat, lens)))),
  };
}

function pickNeedPosition(
  profiles: ReturnType<typeof teamPositionProfiles>,
): FantasyTradePosition {
  const coreNeeds = profiles.filter((profile) => coreTradePositions.includes(profile.position));

  return (
    [...coreNeeds].sort(
      (left, right) =>
        left.gap - right.gap ||
        left.starterValue - right.starterValue ||
        left.depthCount - right.depthCount,
    )[0]?.position ??
    [...profiles].sort((left, right) => left.gap - right.gap)[0]?.position ??
    "WR"
  );
}

function pickSurplusPosition(
  profiles: ReturnType<typeof teamPositionProfiles>,
  needPosition: FantasyTradePosition,
): FantasyTradePosition {
  const coreSurplus = profiles.filter(
    (profile) => profile.position !== needPosition && coreTradePositions.includes(profile.position),
  );

  return (
    [...coreSurplus].sort(
      (left, right) =>
        right.surplusScore - left.surplusScore ||
        right.depthCount - left.depthCount ||
        right.benchValue - left.benchValue,
    )[0]?.position ??
    profiles.find((profile) => profile.position !== needPosition)?.position ??
    "RB"
  );
}

function pickDoNotInclude(
  team: FantasyTradeTeam,
  needPosition: FantasyTradePosition,
  lens: FantasyTradeLens,
  scoringFormat: FantasyTradeScoringFormat,
) {
  return [...team.players]
    .sort((left, right) => {
      const leftCore =
        normalizeTradePosition(left.position) === needPosition ? 20 : left.starter ? 8 : 0;
      const rightCore =
        normalizeTradePosition(right.position) === needPosition ? 20 : right.starter ? 8 : 0;

      return (
        fantasyTradePlayerValue(right, scoringFormat, lens) +
          rightCore -
          (fantasyTradePlayerValue(left, scoringFormat, lens) + leftCore)
      );
    })
    .slice(0, 3);
}

function offerFitScore(
  player: FantasyTradePlayer,
  surplusPosition: FantasyTradePosition,
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
) {
  const position = normalizeTradePosition(player.position);

  return (
    fantasyTradePlayerValue(player, scoringFormat, lens) +
    (position === surplusPosition ? 14 : 0) +
    (player.starter ? -8 : 4) -
    (lens === "dynasty" ? (player.dynastyValue ?? 70) * 0.06 : 0)
  );
}

function tradeHelpsMeCopy(
  target: FantasyTradePlayer,
  needPosition: FantasyTradePosition,
  scoringFormat: FantasyTradeScoringFormat,
  lens: FantasyTradeLens,
) {
  const position = positionLabel(needPosition);
  const scoringCopy =
    scoringFormat === "fullPpr" && (needPosition === "WR" || needPosition === "TE" || needPosition === "RB")
      ? " The scoring format rewards this kind of steady receiving profile."
      : scoringFormat === "standard"
        ? " The value is more about weekly role and touchdown path than receptions."
        : "";
  const dynastyCopy =
    lens === "dynasty" && (target.dynastyValue ?? 0) >= 76
      ? " He also keeps value beyond this week."
      : "";

  return `${target.name} upgrades the ${position} lane without needing you to rebuild the whole roster.${scoringCopy}${dynastyCopy}`;
}

function tradeAcceptCopy(
  offerPlayers: FantasyTradePlayer[],
  surplusPosition: FantasyTradePosition,
  partnerTeam: FantasyTradeTeam,
) {
  const offerNames = offerPlayers.map((player) => player.name).join(" plus ");

  return `${partnerTeam.name} gets ${offerNames}, which turns your ${positionLabel(surplusPosition)} surplus into something that can help their lineup or bench immediately.`;
}

function tradePackageRisk(
  tier: FantasyTradePackageTier,
  target: FantasyTradePlayer,
  offerPlayers: FantasyTradePlayer[],
  lens: FantasyTradeLens,
) {
  if (tier === "aggressive") {
    return `Higher risk: you are paying for ${target.name}'s ceiling, so stop if the ask adds another core starter.`;
  }

  if (lens === "dynasty" && offerPlayers.some((player) => (player.dynastyValue ?? 0) >= 78)) {
    return "Dynasty watch: this is fair only if you are not giving away a young long-term piece too cheaply.";
  }

  if ((target.risk ?? 50) >= 64) {
    return "Role/variance risk: the target can help, but the weekly range is not perfectly clean.";
  }

  return "Clean risk: the offer protects your core and does not force an overpay.";
}

function dedupePackages(packages: FantasyTradePackage[]) {
  const seen = new Set<string>();

  return packages.filter((tradePackage) => {
    const key = `${tradePackage.tier}:${tradePackage.target.id}:${tradePackage.offerPlayers
      .map((player) => player.id)
      .join(",")}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function scoringPositionMultiplier(
  position: FantasyTradePosition,
  scoringFormat: FantasyTradeScoringFormat,
) {
  if (scoringFormat === "fullPpr") {
    return position === "WR" || position === "TE" ? 1.08 : position === "RB" ? 1.04 : 1;
  }

  if (scoringFormat === "halfPpr") {
    return position === "WR" || position === "TE" ? 1.04 : position === "RB" ? 1.02 : 1;
  }

  return position === "RB" ? 1.03 : position === "WR" || position === "TE" ? 0.98 : 1;
}

function positionLabel(position: FantasyTradePosition) {
  return position === "DST" ? "DEF" : position;
}

function emptyTradeBuilderResult(): FantasyTradeBuilderResult {
  return {
    doNotInclude: [],
    needPosition: "WR",
    packages: [],
    summary: "Connect or import a league to build realistic trade packages.",
    surplusPosition: "RB",
    teamName: "My team",
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function average(values: number[]) {
  return values.length > 0 ? sum(values) / values.length : 0;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
