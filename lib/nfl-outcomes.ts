import type { ForecastOutcome } from "./calibration";

export type NflResultLane = ForecastOutcome;

export const nflCloseGameMargin = 7;

export function nflResultLaneFromScore({
  awayScore,
  closeMargin = nflCloseGameMargin,
  homeScore,
}: {
  awayScore: number;
  closeMargin?: number;
  homeScore: number;
}): NflResultLane {
  const margin = homeScore - awayScore;

  if (Math.abs(margin) <= closeMargin) {
    return "draw";
  }

  return margin > 0 ? "home" : "away";
}

export function nflResultLaneLabel(lane: NflResultLane) {
  if (lane === "draw") {
    return "Close game";
  }

  return lane === "home" ? "Home by 8+" : "Away by 8+";
}

