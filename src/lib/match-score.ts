export type ScoreHole = { result: string; created_at?: string | null };

export type QuickScore = {
  thru: number | null;
  diff: number | null;
  updatedAt: string | null;
};

export type MatchScore = {
  /** Which data source is authoritative for the displayed score. */
  source: "holes" | "quick";
  thru: number;
  diff: number;
  margin: number;
  leader: 1 | 2 | null;
  text: string;
};

function formatScore(thru: number, diff: number) {
  if (thru === 0) return "LIVE";
  if (diff === 0) return `ALL SQUARE THRU ${thru}`;
  return `${Math.abs(diff)} UP THRU ${thru}`;
}

function build(source: "holes" | "quick", thru: number, diff: number): MatchScore {
  return {
    source,
    thru,
    diff,
    margin: Math.abs(diff),
    leader: diff > 0 ? 1 : diff < 0 ? 2 : null,
    text: formatScore(thru, diff),
  };
}

/**
 * Single source of truth for match-play score display across the app.
 * Uses whichever is more recent: the last hole_results row, or a quick update.
 */
export function computeMatchScore(holes: ScoreHole[], quick?: QuickScore | null): MatchScore {
  const p1 = holes.filter((h) => h.result === "p1").length;
  const p2 = holes.filter((h) => h.result === "p2").length;
  const holeScore = build("holes", holes.length, p1 - p2);

  if (!quick?.updatedAt || quick.thru == null || quick.diff == null) return holeScore;

  let lastHoleAt = 0;
  for (const h of holes) {
    const t = h.created_at ? Date.parse(h.created_at) : NaN;
    if (!Number.isNaN(t) && t > lastHoleAt) lastHoleAt = t;
  }
  const quickAt = Date.parse(quick.updatedAt);
  if (Number.isNaN(quickAt) || quickAt <= lastHoleAt) return holeScore;

  return build("quick", quick.thru, quick.diff);
}
