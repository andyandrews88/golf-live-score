import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Leaderboard — RCGC 105th Championship" },
      {
        name: "description",
        content:
          "Live match play leaderboard for the RCGC 105th Championship — follow every match as it happens.",
      },
      { property: "og:title", content: "Live Leaderboard — RCGC 105th Championship" },
      {
        property: "og:description",
        content:
          "Follow every match live across the Men's Championship, Ladies Silver and Ladies Bronze Cup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

type Match = {
  id: string;
  division: string;
  round: string;
  match_date: string;
  date_label: string;
  tee_time: string;
  is_bye: boolean;
  p1_name: string | null;
  p1_seed: number | null;
  p1_hcp: number | null;
  p2_name: string | null;
  p2_seed: number | null;
  p2_hcp: number | null;
  status: string;
  result_text: string | null;
  winner: string | null;
};

type HoleResult = { match_id: string; result: string };

const DIVISIONS = [
  { key: "all", label: "All Divisions" },
  { key: "men", label: "Men's Championship" },
  { key: "silver", label: "Ladies Silver" },
  { key: "bronze", label: "Ladies Bronze Cup" },
] as const;

const ROUND_ORDER = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];

async function fetchData() {
  const [matchesRes, holesRes] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true })
      .order("tee_time", { ascending: true }),
    supabase.from("hole_results").select("match_id, result"),
  ]);
  if (matchesRes.error) throw matchesRes.error;
  if (holesRes.error) throw holesRes.error;
  return {
    matches: (matchesRes.data ?? []) as Match[],
    holes: (holesRes.data ?? []) as HoleResult[],
  };
}

function useLiveData() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["live-board"], queryFn: fetchData });

  useEffect(() => {
    const channel = supabase
      .channel("live-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-board"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "hole_results" }, () => {
        queryClient.invalidateQueries({ queryKey: ["live-board"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

type Score = {
  thru: number;
  diff: number;
  text: string;
  leader: 1 | 2 | null;
};

function computeScore(holes: HoleResult[]): Score {
  const p1 = holes.filter((h) => h.result === "p1").length;
  const p2 = holes.filter((h) => h.result === "p2").length;
  const thru = holes.length;
  const diff = p1 - p2;
  if (thru === 0) return { thru, diff, text: "LIVE", leader: null };
  if (diff === 0) return { thru, diff, text: `ALL SQUARE THRU ${thru}`, leader: null };
  return {
    thru,
    diff,
    text: `${Math.abs(diff)} UP THRU ${thru}`,
    leader: diff > 0 ? 1 : 2,
  };
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "live" ? "Live" : status === "completed" ? "Completed" : "Upcoming";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        status === "live" && "bg-secondary text-secondary-foreground",
        status === "completed" && "bg-primary text-primary-foreground",
        status !== "live" && status !== "completed" && "bg-muted text-muted-foreground",
      )}
    >
      {status === "live" && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {label}
    </span>
  );
}

function PlayerRow({
  name,
  seed,
  hcp,
  highlighted,
}: {
  name: string;
  seed: number | null;
  hcp: number | null;
  highlighted: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5",
        highlighted && "bg-secondary/40",
      )}
    >
      <span
        className={cn(
          "font-headline text-lg leading-tight",
          highlighted ? "font-bold text-primary" : "font-medium text-foreground",
        )}
      >
        {name}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {seed != null && <>#{seed}</>}
        {seed != null && hcp != null && " · "}
        {hcp != null && <>Hcp {hcp}</>}
      </span>
    </div>
  );
}

function MatchCard({ match, holes }: { match: Match; holes: HoleResult[] }) {
  const score = computeScore(holes);
  const isCompleted = match.status === "completed";
  const isLive = match.status === "live";

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-headline text-sm font-semibold uppercase tracking-wide text-primary">
          {match.round}
        </h3>
        <StatusPill status={match.status} />
      </div>

      <div className="space-y-1">
        {match.p1_name && (
          <PlayerRow
            name={match.p1_name}
            seed={match.p1_seed}
            hcp={match.p1_hcp}
            highlighted={
              isLive
                ? score.leader === 1
                : isCompleted && match.winner === match.p1_name
            }
          />
        )}
        {match.p2_name && (
          <PlayerRow
            name={match.p2_name}
            seed={match.p2_seed}
            hcp={match.p2_hcp}
            highlighted={
              isLive
                ? score.leader === 2
                : isCompleted && match.winner === match.p2_name
            }
          />
        )}
        {!match.p1_name && !match.p2_name && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Awaiting bracket</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          {match.date_label} · {match.tee_time}
        </span>
        <span className="font-headline text-base font-bold tracking-wide text-foreground">
          {isCompleted
            ? (match.result_text ?? "Completed")
            : isLive
              ? score.text
              : match.is_bye
                ? "BYE"
                : "—"}
        </span>
      </div>
    </article>
  );
}

function LivePage() {
  const [division, setDivision] = useState<string>("all");
  const { data, isLoading, error } = useLiveData();

  const holesByMatch = useMemo(() => {
    const map = new Map<string, HoleResult[]>();
    for (const h of data?.holes ?? []) {
      const arr = map.get(h.match_id);
      if (arr) arr.push(h);
      else map.set(h.match_id, [h]);
    }
    return map;
  }, [data]);

  const matches = useMemo(
    () =>
      (data?.matches ?? []).filter((m) => division === "all" || m.division === division),
    [data, division],
  );

  const liveMatches = matches.filter((m) => m.status === "live");

  const rounds = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of matches) {
      const arr = groups.get(m.round);
      if (arr) arr.push(m);
      else groups.set(m.round, [m]);
    }
    return [...groups.entries()].sort((a, b) => {
      const ai = ROUND_ORDER.indexOf(a[0]);
      const bi = ROUND_ORDER.indexOf(b[0]);
      if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return a[0].localeCompare(b[0]);
    });
  }, [matches]);

  return (
    <main className="min-h-screen bg-background px-safe pb-16">
      <header className="mx-auto max-w-3xl pt-8 pb-4">
        <h1 className="font-headline text-3xl font-bold text-primary">
          RCGC 105th Championship
        </h1>
        <p className="text-sm text-muted-foreground">Live leaderboard</p>
      </header>

      <div className="mx-auto max-w-3xl">
        <Tabs value={division} onValueChange={setDivision}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted">
            {DIVISIONS.map((d) => (
              <TabsTrigger key={d.key} value={d.key} className="text-xs sm:text-sm">
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading matches…</p>
        )}
        {error && (
          <p className="py-10 text-center text-sm text-destructive">
            Could not load the leaderboard.
          </p>
        )}

        {liveMatches.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 flex items-center gap-2 font-headline text-xl font-bold text-foreground">
              <span className="size-2 animate-pulse rounded-full bg-secondary" aria-hidden />
              Live Now
            </h2>
            <div className="grid gap-3">
              {liveMatches.map((m) => (
                <MatchCard key={m.id} match={m} holes={holesByMatch.get(m.id) ?? []} />
              ))}
            </div>
          </section>
        )}

        {rounds.map(([round, roundMatches]) => (
          <section key={round} className="mt-8">
            <h2 className="mb-3 font-headline text-xl font-bold text-foreground">{round}</h2>
            <div className="grid gap-3">
              {roundMatches.map((m) => (
                <MatchCard key={m.id} match={m} holes={holesByMatch.get(m.id) ?? []} />
              ))}
            </div>
          </section>
        ))}

        {!isLoading && !error && matches.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No matches in this division yet.
          </p>
        )}
      </div>
    </main>
  );
}
