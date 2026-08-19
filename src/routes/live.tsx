import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Instagram } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { computeMatchScore } from "@/lib/match-score";
import crest from "@/assets/crest.png";
import { ALL_DIVISION_TABS, DIVISION_LIST_TEXT, DIVISION_ROUNDS } from "@/lib/divisions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlayerAvatar,
  PlayerProfileProvider,
  usePlayerProfile,
} from "@/components/player-profile";

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
          `Follow every match live across ${DIVISION_LIST_TEXT}.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    const d = String(search["division"] ?? "all");
    return {
      division: ["all", "men", "silver", "bronze"].includes(d) ? d : "all",
    };
  },
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
  comment: string | null;
  quick_thru: number | null;
  quick_diff: number | null;
  quick_updated_at: string | null;
};

type HoleResult = {
  match_id: string;
  hole_number: number;
  result: string;
  created_at: string;
};

const DIVISIONS = ALL_DIVISION_TABS;

const ROUND_ORDER = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];

async function fetchData() {
  const [matchesRes, holesRes] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase.from("hole_results").select("match_id, hole_number, result, created_at"),
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
  const profile = usePlayerProfile();
  return (
    <button
      type="button"
      onClick={() => profile?.open(name)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
        highlighted && "bg-secondary/40 hover:bg-secondary/50",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <PlayerAvatar name={name} size="sm" />
        <span
          className={cn(
            "truncate font-headline text-lg leading-tight",
            highlighted ? "font-bold text-primary" : "font-medium text-foreground",
          )}
        >
          {name}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {seed != null && <>#{seed}</>}
        {seed != null && hcp != null && " · "}
        {hcp != null && <>Hcp {hcp}</>}
      </span>
    </button>
  );

}

function MatchCard({ match, holes }: { match: Match; holes: HoleResult[] }) {
  const score = computeMatchScore(holes, {
    thru: match.quick_thru,
    diff: match.quick_diff,
    updatedAt: match.quick_updated_at,
  });
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
                : isCompleted && match.winner === "p1"
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
                : isCompleted && match.winner === "p2"
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

      {isLive && score.source === "holes" && holes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {holes.map((h) => (
            <span
              key={h.hole_number}
              className={cn(
                "size-2 rounded-full",
                h.result === "p1" && "bg-primary",
                h.result === "p2" && "bg-black",
                h.result === "half" && "bg-muted",
              )}
              aria-hidden
            />
          ))}
        </div>
      )}

      {match.comment && (
        <p className="mt-2 text-sm italic text-muted-foreground">{match.comment}</p>
      )}
    </article>
  );
}

function LivePage() {
  return (
    <PlayerProfileProvider>
      <LiveBoard />
    </PlayerProfileProvider>
  );
}

function LiveBoard() {
  const search = Route.useSearch();
  const [division, setDivision] = useState<string>(search.division);
  const [round, setRound] = useState<string>("all");

  useEffect(() => {
    setDivision(search.division);
    setRound("all");
  }, [search.division]);

  const changeDivision = (d: string) => {
    setDivision(d);
    setRound("all");
  };

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

  const roundTabs = division === "all" ? [] : (DIVISION_ROUNDS[division] ?? ROUND_ORDER);

  const filtered = useMemo(
    () => (round === "all" ? matches : matches.filter((m) => m.round === round)),
    [matches, round],
  );

  const rounds = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of filtered) {
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
  }, [filtered]);


  return (
    <main className="min-h-screen bg-background px-safe pb-16">
      <header className="mx-auto flex max-w-3xl items-start justify-between gap-3 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <img
            src={crest}
            alt="Royal Colombo Golf Club crest"
            className="size-12 shrink-0 object-contain sm:size-14"
          />
          <div>
            <h1 className="font-headline text-3xl font-bold text-primary">
              RCGC 105th Championship
            </h1>
            <p className="text-sm text-muted-foreground">Live leaderboard</p>
          </div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-headline text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Home
        </Link>
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

        {!isLoading && !error && matches.length > 0 && (
          <footer className="mt-10 flex items-center justify-center gap-2 border-t border-border pt-6">
            <a
              href="https://www.instagram.com/royalcolombogolfclub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <Instagram className="size-5" aria-hidden />
              <span className="font-medium">Follow us on Instagram</span>
            </a>
          </footer>
        )}
      </div>
    </main>
  );
}
