// Team dependency and bench-depth priors.
// Higher dependency means a key player matters more; higher depth softens the hit.

export type TeamDependencyProfile = {
  dependency: number;
  benchDepth: number;
  note: string;
};

export const DEFAULT_TEAM_DEPENDENCY: TeamDependencyProfile = {
  dependency: 0.58,
  benchDepth: 0.58,
  note: "balanced squad dependency",
};

export const teamDependencyProfiles: Record<string, TeamDependencyProfile> = {
  ARG: {
    dependency: 0.92,
    benchDepth: 0.72,
    note: "Messi gravity changes the room more than a normal absence",
  },
  POR: {
    dependency: 0.86,
    benchDepth: 0.7,
    note: "Ronaldo still bends defensive attention and finishing lanes",
  },
  FRA: {
    dependency: 0.82,
    benchDepth: 0.9,
    note: "Mbappe is a huge lever, but France have elite cover",
  },
  BRA: {
    dependency: 0.74,
    benchDepth: 0.88,
    note: "star power matters, but Brazil carry several match-winners",
  },
  CAN: {
    dependency: 0.78,
    benchDepth: 0.6,
    note: "Davies has outsized lane-changing value",
  },
  KOR: {
    dependency: 0.84,
    benchDepth: 0.56,
    note: "Son is a high-share transition and finishing outlet",
  },
  JPN: {
    dependency: 0.58,
    benchDepth: 0.76,
    note: "Japan distribute creation across a deeper technical group",
  },
  ENG: {
    dependency: 0.64,
    benchDepth: 0.9,
    note: "England have strong cover across the front six",
  },
  ESP: {
    dependency: 0.62,
    benchDepth: 0.86,
    note: "Spain's system can absorb one creator wobble better than most",
  },
  GER: {
    dependency: 0.64,
    benchDepth: 0.82,
    note: "Germany have several structure players behind the headline creator",
  },
  RSA: {
    dependency: 0.42,
    benchDepth: 0.54,
    note: "South Africa's profile is more collective than one-star dependent",
  },
  NZL: {
    dependency: 0.46,
    benchDepth: 0.48,
    note: "New Zealand are more system-limited than one-player dependent",
  },
  CUW: {
    dependency: 0.5,
    benchDepth: 0.46,
    note: "Curacao have less replacement depth, but no single global gravity player",
  },
  QAT: {
    dependency: 0.52,
    benchDepth: 0.5,
    note: "Qatar's swing is more collective than superstar-led",
  },
};
