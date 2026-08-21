import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { computeMatchScore } from "@/lib/match-score";
import { DIVISION_LABELS, DIVISION_ORDER } from "@/lib/divisions";
import {
  PlayerAvatar,
  PlayerProfileProvider,
  usePlayerProfile,
  initialsOf,
} from "@/components/player-profile";
import crest from "@/assets/crest.png";
import { useCoursePhotos } from "@/lib/course-photos";
import { useRefetchOnVisible } from "@/lib/use-refetch-on-visible";
import { fetchStimp, fetchWeather } from "@/lib/weather";

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
  quick_thru: number | null;
  quick_diff: number | null;
  quick_updated_at: string | null;
  winner: string | null;
  result_text: string | null;
  updated_at: string | null;
};

type HoleResult = {
  match_id: string;
  hole_number: number;
  result: string;
  created_at: string;
};


const PAGE_SIZE = 4;
const LIVE_MS = 15000;
const CARD_MS = 6000;
const BREATHER_MS = 15000;
const PHOTO_MS = 20000;

async function fetchData() {
  const [matchesRes, holesRes] = await Promise.all([
    supabase
      .from("matches")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("hole_results")
      .select("match_id, hole_number, result, created_at")
      .order("hole_number", { ascending: true }),
  ]);
  if (matchesRes.error) throw matchesRes.error;
  if (holesRes.error) throw holesRes.error;
  return {
    matches: (matchesRes.data ?? []) as Match[],
    holes: (holesRes.data ?? []) as HoleResult[],
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
  const profile = usePlayerProfile();
  if (!name) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={() => profile?.open(name)}
        className="flex min-w-0 items-center gap-3 text-left"
      >
        <PlayerAvatar name={name} size="lg" tone="dark" />
        <span
          className={cn(
            "truncate font-headline text-3xl leading-tight xl:text-4xl",
            leading ? "font-bold text-secondary" : "font-medium text-primary-foreground",
          )}
        >
          {name}
        </span>
      </button>
      <span className="shrink-0 text-base text-primary-foreground/70">
        {seed != null && <>#{seed}</>}
        {seed != null && hcp != null && " · "}
        {hcp != null && <>Hcp {hcp}</>}
      </span>
    </div>
  );
}

function TvCard({ match, holes }: { match: Match; holes: HoleResult[] }) {
  const score = computeMatchScore(holes, {
    thru: match.quick_thru,
    diff: match.quick_diff,
    updatedAt: match.quick_updated_at,
  });
  return (
    <article className="flex flex-col rounded-2xl border border-primary-foreground/20 bg-primary/85 p-6 shadow-2xl backdrop-blur-[2px]">
      <p className="font-headline text-lg uppercase tracking-widest text-secondary">
        {match.round} · {DIVISION_LABELS[match.division] ?? match.division}
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

      {score.source === "holes" && holes.length > 0 && (
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

function colomboToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function WinnerSpotlight({ match }: { match: Match }) {
  const profile = usePlayerProfile();
  const winnerName = (match.winner === "p1" ? match.p1_name : match.p2_name) ?? "TBD";
  const loserName = (match.winner === "p1" ? match.p2_name : match.p1_name) ?? "TBD";
  const photo = profile?.photos.get(winnerName);

  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="size-56 overflow-hidden rounded-full border-4 border-secondary bg-primary/85 shadow-2xl xl:size-72">
        {photo ? (
          <img
            src={photo}
            alt={winnerName}
            width={300}
            height={300}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center font-headline text-6xl font-bold text-primary-foreground xl:text-7xl">
            {initialsOf(winnerName)}
          </span>
        )}
      </div>

      <p className="mt-8 font-headline text-6xl font-bold text-primary-foreground xl:text-7xl">
        {winnerName}
      </p>
      <p className="mt-3 font-headline text-5xl font-bold uppercase tracking-wide text-secondary xl:text-6xl">
        Won {match.result_text ?? ""}
      </p>
      <p className="mt-3 text-2xl text-primary-foreground/85 xl:text-3xl">def. {loserName}</p>
      <p className="mt-2 font-headline text-xl uppercase tracking-[0.3em] text-secondary/90">
        {match.round} · {DIVISION_LABELS[match.division] ?? match.division}
      </p>
    </section>
  );
}


function PendingSpotlight({ match }: { match: Match }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="font-headline text-xl uppercase tracking-[0.4em] text-secondary">Coming Up</p>
      <div className="mt-8 rounded-2xl border border-primary-foreground/20 bg-primary/85 px-12 py-10 shadow-2xl backdrop-blur-[2px]">
        <p className="font-headline text-5xl font-bold text-primary-foreground xl:text-6xl">
          {match.p1_name ?? "TBD"} <span className="text-secondary">vs</span>{" "}
          {match.p2_name ?? "TBD"}
        </p>
        <p className="mt-5 font-headline text-2xl uppercase tracking-widest text-secondary">
          {match.round} · {DIVISION_LABELS[match.division] ?? match.division}
        </p>
        <p className="mt-2 text-xl text-primary-foreground/80">
          {match.date_label} · {match.tee_time}
        </p>
      </div>
    </section>
  );
}

function WeatherLine({ className }: { className?: string }) {
  const { data: weather } = useQuery({
    queryKey: ["colombo-weather"],
    queryFn: fetchWeather,
    retry: false,
    staleTime: 1000 * 60 * 30,
  });
  const { data: stimp } = useQuery({
    queryKey: ["course-stimp"],
    queryFn: fetchStimp,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  if (!weather) return null;

  const parts: string[] = [
    `${weather.high}° / ${weather.low}°`,
    weather.label,
  ];
  if (weather.wind !== null) parts.push(`${Math.round(weather.wind)} km/h wind`);
  if (weather.humidity !== null) parts.push(`${Math.round(weather.humidity)}% humidity`);
  if (stimp) parts.push(`Stimp: ${stimp}`);

  return (
    <p className={className}>{parts.join(" · ")}</p>
  );
}

function IdleWeather() {
  return <WeatherLine className="mt-4 text-2xl text-primary-foreground/85" />;
}

function IdleScreen({
  next,
  photoIndex,
}: {
  next: Match | undefined;
  photoIndex: number;
}) {
  const { data: photos } = useCoursePhotos();
  const current = photos?.[photoIndex];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-safe text-center">
      <p className="font-headline text-3xl uppercase tracking-[0.4em] text-secondary">Next Up</p>
      <IdleWeather />
      {next ? (
        <>
          <p className="mt-6 font-headline text-6xl font-bold text-primary-foreground xl:text-7xl">
            {next.p1_name ?? "TBD"} <span className="text-secondary">vs</span>{" "}
            {next.p2_name ?? "TBD"}
          </p>
          <p className="mt-4 text-2xl text-primary-foreground/85">
            {next.round} · {DIVISION_LABELS[next.division] ?? next.division}
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
      {current?.caption && (
        <p className="absolute bottom-8 left-0 right-0 px-safe text-lg text-primary-foreground/70">
          {current.caption}
        </p>
      )}
    </div>
  );
}

function PhotoBackdrop({
  onIndexChange,
  scrim = "light",
}: {
  onIndexChange?: (index: number) => void;
  scrim?: "none" | "light" | "heavy";
}) {
  const { data: photos } = useCoursePhotos();
  const slides = photos ?? [];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) {
      setI(0);
      return;
    }
    const id = setInterval(() => setI((n) => (n + 1) % slides.length), PHOTO_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  useEffect(() => {
    onIndexChange?.(i);
  }, [i, onIndexChange]);

  return (
    <div className="absolute inset-0">
      {slides.map((photo, idx) => (
        <img
          key={photo.id}
          src={photo.photo_url}
          alt=""
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-1000",
            idx === i ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          scrim === "none" && "opacity-0 bg-primary/28",
          scrim === "light" && "bg-primary/28",
          scrim === "heavy" && "bg-primary/70",
        )}
      />
    </div>
  );
}

function TvPage() {
  return (
    <PlayerProfileProvider>
      <TvBoard />
    </PlayerProfileProvider>
  );
}

function TvBoard() {
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt } = useQuery({ queryKey: ["tv-board"], queryFn: fetchData });
  useRefetchOnVisible(["tv-board"]);
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
            (DIVISION_LABELS[div] ?? div) + (total > 1 ? ` · ${p + 1} of ${total}` : ""),
          matches: inDiv.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE),
        });
      }
    }
    return out;
  }, [live]);

  // Winner spotlights: matches completed today (Colombo), most recent first.
  const spotlights = useMemo(() => {
    const today = colomboToday();
    return (data?.matches ?? [])
      .filter(
        (m) =>
          m.status === "completed" &&
          m.winner != null &&
          String(m.match_date).slice(0, 10) === today,
      )
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  }, [data]);

  // Today's pending (not yet started) matches, in schedule order.
  const pending = useMemo(() => {
    const today = colomboToday();
    return (data?.matches ?? []).filter(
      (m) => m.status === "upcoming" && String(m.match_date).slice(0, 10) === today,
    );
  }, [data]);

  type Step =
    | { kind: "live"; ms: number; pageIndex: number }
    | { kind: "spotlight"; ms: number; match: Match }
    | { kind: "pending"; ms: number; match: Match }
    | { kind: "breather"; ms: number };

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    if (live.length > 0) {
      pages.forEach((_, i) => out.push({ kind: "live", ms: LIVE_MS, pageIndex: i }));
    }
    for (const m of spotlights) out.push({ kind: "spotlight", ms: CARD_MS, match: m });
    for (const m of pending) out.push({ kind: "pending", ms: CARD_MS, match: m });
    if (out.length > 0) out.push({ kind: "breather", ms: BREATHER_MS });
    return out;
  }, [live, pages, spotlights, pending]);

  const [stepIndex, setStepIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const hasContent = steps.length > 0;
  const stepCount = steps.length;

  useEffect(() => {
    setStepIndex(0);
  }, [stepCount]);

  const safeStep = hasContent ? Math.min(stepIndex, stepCount - 1) : 0;
  const currentStep = steps[safeStep];
  const currentMs = currentStep?.ms ?? LIVE_MS;

  useEffect(() => {
    if (stepCount <= 1) return;
    const id = setTimeout(() => setStepIndex((i) => (i + 1) % stepCount), currentMs);
    return () => clearTimeout(id);
  }, [stepCount, safeStep, currentMs]);

  const isBreather = currentStep?.kind === "breather";
  const showLivePage = currentStep?.kind === "live";
  const spotlight = currentStep?.kind === "spotlight" ? currentStep.match : undefined;
  const pendingMatch = currentStep?.kind === "pending" ? currentStep.match : undefined;
  const pageIndex = currentStep?.kind === "live" ? currentStep.pageIndex : 0;
  const page = pages[Math.min(pageIndex, Math.max(pages.length - 1, 0))];
  const secondsAgo = dataUpdatedAt ? Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000)) : null;

  return (
    <main className="relative min-h-screen overflow-hidden text-primary-foreground">
      <PhotoBackdrop
        onIndexChange={setPhotoIndex}
        scrim={hasContent ? (isBreather ? "none" : "light") : "heavy"}
      />
      {!hasContent && <IdleScreen next={nextUp} photoIndex={photoIndex} />}


      <div className="relative flex min-h-screen flex-col">
        <header
          className="flex items-center justify-between gap-6 px-safe py-6"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0, 96, 57, 0.95) 0%, rgba(0, 96, 57, 0) 220px)",
          }}
        >
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
            <p className="text-base text-primary-foreground/80">
              {secondsAgo == null ? "Connecting…" : `Updated ${secondsAgo}s ago`}
            </p>
          </div>
        </header>

        <div className="relative flex flex-1 flex-col">
          <div
            className={cn(
              "flex flex-1 flex-col px-safe pb-6 transition-opacity duration-500",
              isBreather && "pointer-events-none opacity-0",
            )}
          >
            {showLivePage && page && (
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

            {spotlight && <WinnerSpotlight key={spotlight.id} match={spotlight} />}
          </div>


          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-500",
              !isBreather && "pointer-events-none opacity-0",
            )}
          >
            <WeatherLine className="text-2xl text-primary-foreground/85" />
          </div>
        </div>
      </div>
    </main>
  );
}
