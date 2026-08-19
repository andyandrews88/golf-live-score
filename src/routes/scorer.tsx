import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyScorerPasscode } from "@/lib/scorer.functions";
import { getScorerPasscode, setScorerPasscode } from "@/lib/scorer-session";

export const Route = createFileRoute("/scorer")({
  head: () => ({
    meta: [
      { title: "Scorer Tools — RCGC 105th Championship" },
      {
        name: "description",
        content: "Passcode-protected scoring tools for RCGC 105th Championship officials.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Scorer Tools — RCGC 105th Championship" },
      {
        property: "og:description",
        content: "Passcode-protected scoring tools for RCGC 105th Championship officials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScorerPage,
});


const ROUND_ORDER = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];

type Match = {
  id: string;
  division: string;
  round: string;
  date_label: string;
  tee_time: string;
  match_date: string;
  p1_name: string | null;
  p2_name: string | null;
  status: string;
};

function StatusPill({ status }: { status: string }) {
  const label = status === "live" ? "Live" : status === "completed" ? "Completed" : "Upcoming";
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

function PasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const verify = useServerFn(verifyScorerPasscode);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(false);
    try {
      const { ok } = await verify({ data: { passcode } });
      if (ok) {
        sessionStorage.setItem(SESSION_KEY, "1");
        onUnlock();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-safe">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="font-headline text-2xl font-bold text-primary">Scorer Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the scorer passcode to continue.
        </p>
        <Input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          autoComplete="off"
          className="mt-4"
          aria-label="Scorer passcode"
        />
        {error && <p className="mt-2 text-sm text-destructive">Incorrect passcode.</p>}
        <Button type="submit" disabled={pending || !passcode} className="mt-4 w-full">
          {pending ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}

async function fetchMatches() {
  const { data, error } = await supabase
    .from("matches")
    .select("id, division, round, date_label, tee_time, match_date, p1_name, p2_name, status")
    .order("match_date", { ascending: true })
    .order("tee_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Match[];
}

function MatchList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["scorer-matches"],
    queryFn: fetchMatches,
  });

  const rounds = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of data ?? []) {
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
  }, [data]);

  return (
    <main className="min-h-screen bg-background px-safe pb-16">
      <header className="mx-auto max-w-3xl pt-8 pb-4">
        <h1 className="font-headline text-3xl font-bold text-primary">Scorer Tools</h1>
        <p className="text-sm text-muted-foreground">Select a match to score</p>
      </header>

      <div className="mx-auto max-w-3xl">
        {isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading matches…</p>
        )}
        {error && (
          <p className="py-10 text-center text-sm text-destructive">Could not load matches.</p>
        )}

        {rounds.map(([round, matches]) => (
          <section key={round} className="mt-6">
            <h2 className="mb-3 font-headline text-xl font-bold text-foreground">{round}</h2>
            <div className="grid gap-3">
              {matches.map((m) => {
                const ready = Boolean(m.p1_name && m.p2_name);
                const body = (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-headline text-sm font-semibold uppercase tracking-wide text-primary">
                        {m.division === "men"
                          ? "Men's Championship"
                          : m.division === "silver"
                            ? "Ladies Silver"
                            : m.division === "bronze"
                              ? "Ladies Bronze Cup"
                              : m.division}
                      </span>
                      <StatusPill status={m.status} />
                    </div>
                    <div className="mt-2 space-y-0.5">
                      <p className="font-headline text-lg font-medium text-foreground">
                        {m.p1_name ?? "TBD"}
                      </p>
                      <p className="font-headline text-lg font-medium text-foreground">
                        {m.p2_name ?? "TBD"}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {m.date_label} · {m.tee_time}
                      </span>
                      {!ready && (
                        <span className="inline-flex items-center gap-1">
                          <Lock className="size-3" aria-hidden />
                          Locked
                        </span>
                      )}
                    </div>
                  </>
                );

                return ready ? (
                  <Link
                    key={m.id}
                    to="/scorer/$matchId"
                    params={{ matchId: m.id }}
                    className="block rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary"
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={m.id}
                    aria-disabled="true"
                    className="rounded-xl border border-border bg-muted/40 p-4 opacity-60"
                  >
                    {body}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function ScorerPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
    setReady(true);
  }, []);

  if (!ready) return <main className="min-h-screen bg-background" />;
  if (!unlocked) return <PasscodeGate onUnlock={() => setUnlocked(true)} />;
  return <MatchList />;
}
