// MatchSeer curated world-standing priors (extracted from database.ts).
// Interim curated map — replace later with a live FIFA ranking / Elo.

export const WORLD_STANDING_BY_NAME: Record<string, number> = {
  algeria: 63, argentina: 93, australia: 61, austria: 70, belgium: 82,
  bolivia: 55, brazil: 91, canada: 66, "cape verde": 54, chile: 67,
  colombia: 80, "costa rica": 62, "cote d ivoire": 71, croatia: 80,
  curacao: 49, czechia: 69, denmark: 76, ecuador: 72, egypt: 68, england: 90,
  france: 94, germany: 88, ghana: 66, greece: 69, hungary: 70, iran: 67,
  italy: 84, "ivory coast": 71, jamaica: 59, japan: 75, jordan: 52,
  korea: 71, "korea republic": 71, mexico: 73, morocco: 78, netherlands: 87,
  "new zealand": 50, nigeria: 72, norway: 75, panama: 59, paraguay: 66,
  peru: 65, poland: 70, portugal: 88, qatar: 58, romania: 66,
  "saudi arabia": 59, scotland: 68, senegal: 76, serbia: 72,
  "south africa": 61, spain: 92, sweden: 74, switzerland: 75, tunisia: 62,
  turkey: 72, turkiye: 72, ukraine: 74, uruguay: 82, usa: 75,
  "united states": 75, uzbekistan: 57, venezuela: 63,
};

export const WORLD_STANDING_BY_CODE: Record<string, number> = {
  ARG: 93, BRA: 91, ENG: 90, ESP: 92, FRA: 94, GER: 88, NED: 87, POR: 88,
  SWE: 74, NZL: 50,
};

export const DEFAULT_WORLD_STANDING = 58;
