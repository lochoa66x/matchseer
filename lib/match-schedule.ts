import type { MatchSummary } from "./domain";
import { isKnockoutPhase, normalizeStageLabel } from "./match-stage";

const tournamentTimeZone = "America/Toronto";
const dateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "2-digit",
  timeZone: tournamentTimeZone,
  year: "numeric",
});

type MatchScheduleLike = Pick<
  MatchSummary,
  "startsAt" | "status" | "time" | "venue" | "home" | "away"
>;
type ExplorerMatchLike = MatchScheduleLike & Pick<MatchSummary, "group">;

const unknownFutureTime = Number.POSITIVE_INFINITY;
const unknownPastTime = Number.NEGATIVE_INFINITY;

export function toMatchDateKey(date: Date) {
  const parts = dateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function isMatchOnDate(match: MatchScheduleLike, dateKey: string) {
  if (!dateKey) {
    return false;
  }

  if (match.status === "Live" && !match.startsAt) {
    return true;
  }

  return matchScheduleDateKeys(match).has(dateKey);
}

export function isDateOnlySchedulePlaceholder(match: MatchScheduleLike) {
  if (!match.startsAt || match.status === "Final") {
    return false;
  }

  return (
    isMidnightUtc(match.startsAt) &&
    (match.home.isPlaceholder ||
      match.away.isPlaceholder ||
      match.venue.toLowerCase().includes("tbd"))
  );
}

export function rawScheduleDateKey(value: string | null | undefined) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

export function sortMatchesForExplorer<TMatch extends ExplorerMatchLike>(
  matches: TMatch[],
  todayKey: string,
) {
  const buckets = buildExplorerRoundBuckets(matches, todayKey);

  return [...matches].sort((first, second) => compareExplorerMatches(first, second, buckets));
}

export function sortRoundLabelsForExplorer<TMatch extends ExplorerMatchLike>(
  matches: TMatch[],
  todayKey: string,
) {
  const buckets = buildExplorerRoundBuckets(matches, todayKey);

  return Array.from(buckets.keys()).sort((first, second) =>
    compareExplorerRoundBuckets(buckets.get(first), buckets.get(second)),
  );
}

function matchScheduleDateKeys(match: MatchScheduleLike) {
  const keys = new Set<string>();

  if (match.startsAt) {
    const kickoff = new Date(match.startsAt);

    if (!Number.isNaN(kickoff.getTime())) {
      keys.add(toMatchDateKey(kickoff));
    }

    if (isDateOnlySchedulePlaceholder(match)) {
      const rawKey = rawScheduleDateKey(match.startsAt);

      if (rawKey) {
        keys.add(rawKey);
      }
    }
  }

  const labelDateKey = dateKeyFromScheduleLabel(match.time);

  if (labelDateKey) {
    keys.add(labelDateKey);
  }

  return keys;
}

function dateKeyFromScheduleLabel(value: string) {
  const schedule = value.trim();

  if (!/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(schedule)) {
    return null;
  }

  const year = rawScheduleDateKey(new Date().toISOString())?.slice(0, 4);
  const parsed = new Date(`${schedule}, ${year}`);

  return Number.isNaN(parsed.getTime()) ? null : toMatchDateKey(parsed);
}

function isMidnightUtc(value: string) {
  return /(?:T00:00:00(?:\.000)?Z|^\d{4}-\d{2}-\d{2}$)/.test(value);
}

type ExplorerRoundBucket = {
  label: string;
  phaseRank: number;
  earliestLiveOrFuture: number;
  latestFinished: number;
  stageRank: number;
};

function compareExplorerMatches(
  first: ExplorerMatchLike,
  second: ExplorerMatchLike,
  buckets: Map<string, ExplorerRoundBucket>,
) {
  const bucketOrder = compareExplorerRoundBuckets(
    buckets.get(first.group),
    buckets.get(second.group),
  );

  if (bucketOrder !== 0) {
    return bucketOrder;
  }

  return compareWithinRound(first, second);
}

function compareExplorerRoundBuckets(
  first: ExplorerRoundBucket | undefined,
  second: ExplorerRoundBucket | undefined,
) {
  if (!first || !second) {
    return first ? -1 : second ? 1 : 0;
  }

  if (first.phaseRank !== second.phaseRank) {
    return first.phaseRank - second.phaseRank;
  }

  if (first.phaseRank <= 2) {
    const timeOrder = first.earliestLiveOrFuture - second.earliestLiveOrFuture;

    if (timeOrder !== 0) {
      return timeOrder;
    }
  } else {
    const recencyOrder = second.latestFinished - first.latestFinished;

    if (recencyOrder !== 0) {
      return recencyOrder;
    }
  }

  if (first.stageRank !== second.stageRank) {
    return first.stageRank - second.stageRank;
  }

  return first.label.localeCompare(second.label, undefined, { numeric: true });
}

function buildExplorerRoundBuckets(
  matches: ExplorerMatchLike[],
  todayKey: string,
) {
  return Array.from(new Set(matches.map((match) => match.group))).reduce(
    (buckets, label) => buckets.set(label, buildExplorerRoundBucket(label, matches, todayKey)),
    new Map<string, ExplorerRoundBucket>(),
  );
}

function buildExplorerRoundBucket(
  label: string,
  matches: ExplorerMatchLike[],
  todayKey: string,
): ExplorerRoundBucket {
  const roundMatches = matches.filter((match) => match.group === label);
  const liveOrFutureMatches = roundMatches.filter(
    (match) => match.status === "Live" || match.status === "Upcoming",
  );
  const finishedMatches = roundMatches.filter((match) => match.status === "Final");
  const phaseRank = getExplorerPhaseRank(label, roundMatches, todayKey);

  return {
    label,
    phaseRank,
    earliestLiveOrFuture: liveOrFutureMatches.reduce(
      (earliest, match) => Math.min(earliest, matchSortTime(match, "future")),
      unknownFutureTime,
    ),
    latestFinished: finishedMatches.reduce(
      (latest, match) => Math.max(latest, matchSortTime(match, "past")),
      unknownPastTime,
    ),
    stageRank: getStageRank(label),
  };
}

function getExplorerPhaseRank(
  label: string,
  matches: ExplorerMatchLike[],
  todayKey: string,
) {
  if (matches.some((match) => match.status === "Live")) {
    return 0;
  }

  if (matches.some((match) => match.status === "Upcoming" && isMatchOnDate(match, todayKey))) {
    return 1;
  }

  if (matches.some((match) => match.status === "Upcoming")) {
    return 2;
  }

  return isKnockoutPhase(label) ? 3 : 4;
}

function compareWithinRound(first: ExplorerMatchLike, second: ExplorerMatchLike) {
  const firstStatusRank = getMatchStatusRank(first);
  const secondStatusRank = getMatchStatusRank(second);

  if (firstStatusRank !== secondStatusRank) {
    return firstStatusRank - secondStatusRank;
  }

  if (first.status === "Final" && second.status === "Final") {
    return matchSortTime(second, "past") - matchSortTime(first, "past");
  }

  return matchSortTime(first, "future") - matchSortTime(second, "future");
}

function getMatchStatusRank(match: ExplorerMatchLike) {
  if (match.status === "Live") {
    return 0;
  }

  if (match.status === "Upcoming") {
    return 1;
  }

  return 2;
}

function matchSortTime(match: ExplorerMatchLike, direction: "future" | "past") {
  if (!match.startsAt) {
    return direction === "future" ? unknownFutureTime : unknownPastTime;
  }

  const parsed = new Date(match.startsAt).getTime();

  return Number.isNaN(parsed)
    ? direction === "future"
      ? unknownFutureTime
      : unknownPastTime
    : parsed;
}

function getStageRank(label: string) {
  const normalized = normalizeStageLabel(label) ?? label;
  const roundMatch = normalized.match(/^Round of (\d+)$/i);

  if (roundMatch) {
    return Number.parseInt(roundMatch[1], 10);
  }

  if (normalized === "Quarter-finals") {
    return 8;
  }

  if (normalized === "Semi-finals") {
    return 4;
  }

  if (normalized === "Third place") {
    return 3;
  }

  if (normalized === "Final") {
    return 2;
  }

  const groupMatch = normalized.match(/^Group\s+([A-Z0-9]+)$/i);

  if (groupMatch) {
    return 100 + groupMatch[1].charCodeAt(0);
  }

  return 200;
}
