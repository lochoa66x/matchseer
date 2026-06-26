export function normalizeMatchPhase(
  stage: string | null | undefined,
  groupName: string | null | undefined,
) {
  const normalizedGroup = normalizeGroupName(groupName);
  const stageLabel = normalizeStageLabel(stage);
  const stageIsGroup = !stageLabel || stageLabel === "Group stage";

  if (normalizedGroup && isGroupLabel(normalizedGroup) && stageIsGroup) {
    return normalizedGroup;
  }

  return stageLabel ?? normalizeStageLabel(groupName) ?? normalizedGroup ?? "Group stage";
}

export function normalizeGroupName(groupName: string | null | undefined) {
  if (!groupName) {
    return null;
  }

  const normalized = groupName
    .replace(/^GROUP[_\s-]+/i, "Group ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

export function normalizeStageLabel(stage: string | null | undefined) {
  if (!stage) {
    return null;
  }

  const key = stage
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const exact = stageLabels[key];

  if (exact) {
    return exact;
  }

  const roundMatch = key.match(/^(?:LAST|ROUND_OF|R)_?(\d+)$/);

  if (roundMatch) {
    return `Round of ${roundMatch[1]}`;
  }

  return normalizeGroupName(stage);
}

export function isKnownPlaceholderTeamName(name: string | null | undefined) {
  if (!name) {
    return true;
  }

  const normalized = name.trim().toLowerCase();

  return [
    "",
    "tba",
    "tbd",
    "to be decided",
    "to be determined",
    "to be defined",
    "unknown",
    "n/a",
  ].includes(normalized);
}

function isGroupLabel(value: string) {
  return /^Group(?:\s+[A-Z0-9]+)?$/i.test(value) || value === "Group Stage";
}

const stageLabels: Record<string, string> = {
  GROUP: "Group stage",
  GROUPS: "Group stage",
  GROUP_STAGE: "Group stage",
  REGULAR_SEASON: "Group stage",
  LAST_64: "Round of 64",
  ROUND_OF_64: "Round of 64",
  R64: "Round of 64",
  LAST_32: "Round of 32",
  ROUND_OF_32: "Round of 32",
  R32: "Round of 32",
  LAST_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  R16: "Round of 16",
  EIGHTH_FINALS: "Round of 16",
  QUARTER_FINAL: "Quarter-finals",
  QUARTER_FINALS: "Quarter-finals",
  QUARTERFINALS: "Quarter-finals",
  SEMI_FINAL: "Semi-finals",
  SEMI_FINALS: "Semi-finals",
  SEMIFINALS: "Semi-finals",
  THIRD_PLACE: "Third place",
  THIRD_PLACE_PLAYOFF: "Third place",
  PLAY_OFF_FOR_THIRD_PLACE: "Third place",
  FINAL: "Final",
};
