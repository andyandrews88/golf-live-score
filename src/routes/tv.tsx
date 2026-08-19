import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import crest from "@/assets/crest.png";
import course1 from "@/assets/course-1.jpg";
import course2 from "@/assets/course-2.jpg";
import course3 from "@/assets/course-3.jpg";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "TV Display — RCGC 105th Championship" },
      {
        name: "description",
        content:
          "Full-screen live scoreboard for the RCGC 105th Championship, updating in real time.",
      },
      { property: "og:title", content: "TV Display — RCGC 105th Championship" },
      {
        property: "og:description",
        content: "Big-screen live match play board for the RCGC 105th Championship.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TvPage,
});

type Match = {
  id: string;
  division: string;
  round: string;
  match_date: string;
  date_label: string;
  tee_time: string;
  p1_name: string | null;
  p1_seed: number | null;
  p1_hcp: number | null;
  p2_name: string | null;
  p2_seed: number | null;
  p2_hcp: number | null;
  status: string;
  comment: string | null;
};

type HoleResult = { match_id: string; hole_number: number; result: string };

const DIVISION_ORDER = ["men", "silver", "bronze"] as const;
const DIVISION_LABEL: Record<string, string> = {
  men: "Men's Championship",
  silver: "Ladies Silver",
  bronze: "Ladies Bronze Cup",
};

const COURSE_PHOTOS = [course1, course2, course3];
const PAGE_SIZE = 4;
const PAGE_MS = 15000;
const PHOTO_MS = 20000;

async function fetchData() {
  const [matchesRes, holesRes] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true })
      .order("tee_time", { ascending: true }),
    supabase
      .from("hole_results")
      .select("match_id, hole_number, result")
      .order("hole_number", { ascending: true }),
  ]);
  if (matchesRes.error) throw matchesRes.error;
  if (holesRes.error) throw holesRes.error;
  return {
    matches: (matchesRes.data ?? []) as Match[],
    holes: (holesRes.data ?? []) as HoleResult[],
  };
}

function computeScore(holes: HoleResult[]) {
  const p1 = holes.filter((h) => h.result === "p1").length;
  const p2 = holes.filter((h) => h.result === "p2").length;
  const thru = holes.length;
  const diff = p1 - p2;
  if (thru === 0) return { text: "LIVE", leader: null as 1 | 2 | null };
  if (diff === 0) return { text: `ALL SQUARE THRU ${thru}`, leader: null as 1 | 2 | null };
  return {
    text: `${Math.abs(diff)} UP THRU ${thru}`,
    leader: (diff > 0 ? 1 : 2) as 1 | 2,
  };
}

function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function PlayerLine({
  name,
  seed,
  hcp,
  leading,
}: {
  name: string | null;
  seed: number | null;
  hcp: number | null;
  leading: boolean;
}) {
  if (!name) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span
        className={cn(
          "font-headline text-3xl leading-tight xl:text-4xl",
          leading ? "font-bold text-secondary" : "font-medium text-primary-foreground",
        )}
      >
        {name}
      </span>
      <span className="shrink-0 text-base text-primary-foreground/70">
        {seed != null && <>#{seed}</>}
        {seed != null && hcp != null && " · "}
        {hcp != null && <>Hcp {hcp}</>}
      </span>
    </div>
  );
}

function TvCard({ match, holes }: { match: Match; holes: HoleResult[] }) {
  const score = computeScore(holes);
  return (
    <article className="flex flex-col rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6">
      <p className="font-headline text-lg uppercase tracking-widest text-secondary">
        {match.round} · {DIVISION_LABEL[match.division] ?? match.division}
      </p>

      <div className="mt-4 space-y-2">
        <PlayerLine
          name={match.p1_name}
          seed={match.p1_seed}
          hcp={match.p1_hcp}
          leading={score.leader === 1}
        />
        <PlayerLine
          name={match.p2_name}
          seed={match.p2_seed}
          hcp={match.p2_hcp}
          leading={score.leader === 2}
        />
      </div>

      <p className="mt-4 font-headline text-2xl font-bold tracking-wide text-primary-foreground xl:text-3xl">
        {score.text}
      </p>

      {holes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {holes.map((h) => (
            <span
              key={h.hole_number}
              className={cn(
                "size-3 rounded-full",
                h.result === "p1" && "bg-secondary",
                h.result === "p2" && "bg-primary-foreground",
                h.result === "half" && "bg-primary-foreground/30",
              )}
              aria-hidden
            />
          ))}
        </div>
      )}

      {match.comment && (
        <p className="mt-4 text-lg italic text-primary-foreground/80">{match.comment}</p>
      )}
    </article>
  );
}

function IdleScreen({ next }: { next: Match | undefined }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % COURSE_PHOTOS.length), PHOTO_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0">
      {COURSE_PHOTOS.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt=""
          width={1920}
          height={1080}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-1000",
            idx === i ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-primary/70" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-safe text-center">
        <p className="font-headline text-3xl uppercase tracking-[0.4em] text-secondary">Next Up</p>
        {next ? (
          <>
            <p className="mt-6 font-headline text-6xl font-bold text-primary-foreground xl:text-7xl">
              {next.p1_name ?? "TBD"} <span className="text-secondary">vs</span>{" "}
              {next.p2_name ?? "TBD"}
            </p>
            <p className="mt-4 text-2xl text-primary-foreground/85">
              {next.round} · {DIVISION_LABEL[next.division] ?? next.division}
            </p>
            <p className="mt-2 text-xl text-primary-foreground/70">
              {next.date_label} · {next.tee_time}
            </p>
          </>
        ) : (
          <p className="mt-6 font-headline text-5xl text-primary-foreground">
            No matches scheduled
          </p>
        )}
      </div>
    </div>
  );
}

function TvPage() {
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt } = useQuery({ queryKey: ["tv-board"], queryFn: fetchData });
  useTick(1000);

  useEffect(() => {
    const channel = supabase
      .channel("tv-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tv-board"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "hole_results" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tv-board"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const holesByMatch = useMemo(() => {
    const map = new Map<string, HoleResult[]>();
    for (const h of data?.holes ?? []) {
      const arr = map.get(h.match_id);
      if (arr) arr.push(h);
      else map.set(h.match_id, [h]);
    }
    return map;
  }, [data]);

  const live = useMemo(
    () => (data?.matches ?? []).filter((m) => m.status === "live"),
    [data],
  );

  const nextUp = useMemo(
    () => (data?.matches ?? []).find((m) => m.status === "upcoming"),
    [data],
  );

  // Pages: one entry per division page when more than 4 live matches.
  const pages = useMemo(() => {
    if (live.length <= PAGE_SIZE) return [{ heading: null as string | null, matches: live }];
    const out: { heading: string; matches: Match[] }[] = [];
    for (const div of DIVISION_ORDER) {
      const inDiv = live.filter((m) => m.division === div);
      if (inDiv.length === 0) continue;
      const total = Math.ceil(inDiv.length / PAGE_SIZE);
      for (let p = 0; p < total; p++) {
        out.push({
          heading:
            (DIVISION_LABEL[div] ?? div) + (total > 1 ? ` · ${p + 1} of ${total}` : ""),
          matches: inDiv.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE),
        });
      }
    }
    return out;
  }, [live]);

  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    if (pages.length <= 1) {
      setPageIndex(0);
      return;
    }
    const id = setInterval(() => setPageIndex((i) => (i + 1) % pages.length), PAGE_MS);
    return () => clearInterval(id);
  }, [pages.length]);

  const page = pages[Math.min(pageIndex, pages.length - 1)];
  const secondsAgo = dataUpdatedAt ? Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000)) : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-primary text-primary-foreground">
      {live.length === 0 && <IdleScreen next={nextUp} />}

      <div className="relative flex min-h-screen flex-col px-safe py-6">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img src={crest} alt="" width={512} height={512} className="size-16 xl:size-20" />
            <h1 className="font-headline text-3xl font-bold tracking-wide xl:text-4xl">
              RCGC 105th Championship
            </h1>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-2 font-headline text-xl text-secondary">
              <span className="size-3 animate-pulse rounded-full bg-secondary" aria-hidden />
              Live Coverage
            </p>
            <p className="text-base text-primary-foreground/70">
              {secondsAgo == null ? "Connecting…" : `Updated ${secondsAgo}s ago`}
            </p>
          </div>
        </header>

        {live.length > 0 && page && (
          <section className="mt-6 flex flex-1 flex-col">
            {page.heading && (
              <h2 className="mb-4 font-headline text-2xl font-bold uppercase tracking-widest text-secondary">
                {page.heading}
              </h2>
            )}
            <div
              className={cn(
                "grid flex-1 gap-5",
                page.matches.length > 1 ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              {page.matches.map((m) => (
                <TvCard key={m.id} match={m} holes={holesByMatch.get(m.id) ?? []} />
              ))}
            </div>

            {pages.length > 1 && (
              <div className="mt-5 flex justify-center gap-2">
                {pages.map((p, i) => (
                  <span
                    key={p.heading ?? i}
                    className={cn(
                      "size-3 rounded-full",
                      i === pageIndex ? "bg-secondary" : "bg-primary-foreground/30",
                    )}
                    aria-hidden
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
