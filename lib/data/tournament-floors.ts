// MatchSeer tournament floor profiles (extracted from database.ts).

export const tournamentFloorProfilesByCode: Record<string, { power: number; tax: number }> = {
  CUW: { power: 49, tax: 0.42 },
  HAI: { power: 52, tax: 0.26 },
  NZL: { power: 50, tax: 0.52 },
  QAT: { power: 54, tax: 0.22 },
};

export const tournamentFloorProfilesByName: Record<string, { power: number; tax: number }> = {
  curacao: tournamentFloorProfilesByCode.CUW,
  "new zealand": tournamentFloorProfilesByCode.NZL,
  haiti: tournamentFloorProfilesByCode.HAI,
  qatar: tournamentFloorProfilesByCode.QAT,
};
