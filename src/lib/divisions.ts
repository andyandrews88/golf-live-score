// Single source of truth for division display labels.
// The underlying database values stay "men" | "silver" | "bronze".

export const DIVISION_ORDER = ["men", "silver", "bronze"] as const;

export type DivisionKey = (typeof DIVISION_ORDER)[number];

export const DIVISION_LABELS: Record<string, string> = {
  men: "Men's Championship",
  silver: "Ladies Championship",
  bronze: "Ladies Bronze Cup",
};

export function divisionLabel(division: string): string {
  return DIVISION_LABELS[division] ?? division;
}

export const DIVISION_TABS = DIVISION_ORDER.map((key) => ({
  key,
  label: DIVISION_LABELS[key]!,
}));

export const ALL_DIVISION_TABS = [
  { key: "all", label: "All Divisions" },
  ...DIVISION_TABS,
];

/** e.g. "Men's Championship, Ladies Championship and Ladies Bronze Cup" */
export const DIVISION_LIST_TEXT = `${DIVISION_LABELS["men"]}, ${DIVISION_LABELS["silver"]} and ${DIVISION_LABELS["bronze"]}`;

/** Round filter options per division (labels match matches.round values). */
export const DIVISION_ROUNDS: Record<string, string[]> = {
  men: ["Round of 16", "Quarter-Final", "Semi-Final", "Final"],
  silver: ["Quarter-Final", "Semi-Final", "Final"],
  bronze: ["Quarter-Final", "Semi-Final", "Final"],
};
