import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Undo2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { computeMatchScore } from "@/lib/match-score";
import crest from "@/assets/crest.png";
import { divisionLabel } from "@/lib/divisions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getScorerPasscode } from "@/lib/scorer-session";
import {
  PlayerAvatar,
  PlayerProfileProvider,
  usePlayerProfile,
} from "@/components/player-profile";
import {
  completeMatch,
  recordHole,
  resetMatchToUpcoming,
  saveMatchComment,
  saveQuickScore,
  startMatch,
  undoLastHole,
  undoMatchCompletion,
} from "@/lib/scorer.functions";

export const Route = createFileRoute("/scorer_/$matchId")({
  head: () => ({
    meta: [
      { title: "Scoring Screen — RCGC 105th Championship" },
      {
        name: "description",
        content: "Hole-by-hole scoring screen for RCGC 105th Championship officials.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Scoring Screen — RCGC 105th Championship" },
      {
        property: "og:description",
        content: "Hole-by-hole scoring screen for RCGC 105th Championship officials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScoringPage,
});

type Match = {
  id: string;
  division: string;
  round: string;
  date_label: string;
  tee_time: string;
  p1_name: string | null;
  p2_name: string | null;
  status: string;
  winner: string | null;
  result_text: string | null;
  comment: string | null;
  feeds_into_match_id: string | null;
  feeds_into_slot: number | null;
  quick_thru: number | null;
  quick_diff: number | null;
  quick_updated_at: string | null;
};

type Hole = { id: number; hole_number: number; result: string; created_at: string };

async function fetchMatch(matchId: string) {
  const [matchRes, holesRes] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, division, round, date_label, tee_time, p1_name, p2_name, status, winner, result_text, comment, feeds_into_match_id, feeds_into_slot, quick_thru, quick_diff, quick_updated_at",
      )
      .eq("id", matchId)
      .maybeSingle(),
    supabase
      .from("hole_results")
      .select("id, hole_number, result, created_at")
      .eq("match_id", matchId)
      .order("hole_number", { ascending: true }),
  ]);
  if (matchRes.error) throw matchRes.error;
  if (holesRes.error) throw holesRes.error;

  const match = matchRes.data as Match | null;
  let nextLocked = false;
  if (match?.status === "completed" && match.feeds_into_match_id) {
    const [nextRes, nextHolesRes] = await Promise.all([
      supabase
        .from("matches")
        .select("id, status")
        .eq("id", match.feeds_into_match_id)
        .maybeSingle(),
      supabase
        .from("hole_results")
        .select("id", { count: "exact", head: true })
        .eq("match_id", match.feeds_into_match_id),
    ]);
    const nextStatus = nextRes.data?.status ?? null;
    nextLocked = nextStatus !== "upcoming" || (nextHolesRes.count ?? 0) > 0;
  }

  return {
    match,
    holes: (holesRes.data ?? []) as Hole[],
    nextLocked,
  };
}


function ScoringPage() {
  const { matchId } = Route.useParams();
  const [passcode, setPasscode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPasscode(getScorerPasscode());
    setReady(true);
  }, []);

  if (!ready) return <main className="min-h-screen bg-background" />;
  if (!passcode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-safe">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Your scorer session has ended.</p>
          <Link to="/scorer" className="mt-2 inline-block font-semibold text-primary underline">
            Enter passcode again
          </Link>
        </div>
      </main>
    );
  }

  return (
    <PlayerProfileProvider>
      <Scoring matchId={matchId} passcode={passcode} />
    </PlayerProfileProvider>
  );
}

function Scoring({ matchId, passcode }: { matchId: string; passcode: string }) {
  const profile = usePlayerProfile();
  const queryClient = useQueryClient();
  const queryKey = ["scorer-match", matchId];
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => fetchMatch(matchId) });

  const record = useServerFn(recordHole);
  const undo = useServerFn(undoLastHole);
  const start = useServerFn(startMatch);
  const complete = useServerFn(completeMatch);
  const saveComment = useServerFn(saveMatchComment);
  const saveQuick = useServerFn(saveQuickScore);
  const resetToUpcoming = useServerFn(resetMatchToUpcoming);
  const undoCompletion = useServerFn(undoMatchCompletion);

  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<{ winner: "p1" | "p2"; label: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [undoCompleteOpen, setUndoCompleteOpen] = useState(false);
  const [manualWinner, setManualWinner] = useState<"p1" | "p2">("p1");
  const [manualLabel, setManualLabel] = useState("");
  const [comment, setComment] = useState<string | null>(null);
  const [quickThru, setQuickThru] = useState("");
  const [quickSide, setQuickSide] = useState<"p1" | "square" | "p2">("square");
  const [quickMargin, setQuickMargin] = useState("");
  const [quickStatus, setQuickStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const match = data?.match ?? null;
  const holes = data?.holes ?? [];

  useEffect(() => {
    if (match && comment === null) setComment(match.comment ?? "");
  }, [match, comment]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey });
  }

  const p1Wins = holes.filter((h) => h.result === "p1").length;
  const p2Wins = holes.filter((h) => h.result === "p2").length;
  const score = computeMatchScore(holes, {
    thru: match?.quick_thru ?? null,
    diff: match?.quick_diff ?? null,
    updatedAt: match?.quick_updated_at ?? null,
  });
  const holesActive = score.source === "holes";
  const thru = score.thru;
  const diff = score.diff;
  const leader: "p1" | "p2" | null =
    score.leader === 1 ? "p1" : score.leader === 2 ? "p2" : null;
  const scoreLine = score.text;

  async function onRecord(result: "p1" | "p2" | "half") {
    if (busy) return;
    setBusy(true);
    try {
      await record({ data: { passcode, matchId, result } });
      const nextP1 = p1Wins + (result === "p1" ? 1 : 0);
      const nextP2 = p2Wins + (result === "p2" ? 1 : 0);
      const nextThru = thru + 1;
      const nextDiff = nextP1 - nextP2;
      checkDecided(nextThru, nextDiff);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function checkDecided(nextThru: number, nextDiff: number) {
    const nextMargin = Math.abs(nextDiff);
    const nextLeft = 18 - nextThru;
    if (nextMargin > nextLeft && nextMargin > 0) {
      setDecided({
        winner: nextDiff > 0 ? "p1" : "p2",
        label: nextLeft === 0 ? `${nextMargin} UP` : `${nextMargin}&${nextLeft}`,
      });
    }
  }

  async function onQuickSave() {
    if (busy) return;
    const t = Number(quickThru);
    if (!Number.isInteger(t) || t < 0 || t > 18) {
      setQuickStatus("error");
      return;
    }
    const m = quickSide === "square" ? 0 : Number(quickMargin);
    if (!Number.isInteger(m) || m < 0 || m > t) {
      setQuickStatus("error");
      return;
    }
    const nextDiff = quickSide === "p1" ? m : quickSide === "p2" ? -m : 0;
    setBusy(true);
    setQuickStatus("saving");
    try {
      await saveQuick({ data: { passcode, matchId, thru: t, diff: nextDiff } });
      setQuickStatus("saved");
      window.setTimeout(() => setQuickStatus("idle"), 2000);
      checkDecided(t, nextDiff);
      await refresh();
    } catch {
      setQuickStatus("error");
    } finally {
      setBusy(false);
    }
  }

  async function onUndo() {
    if (busy) return;
    setBusy(true);
    try {
      await undo({ data: { passcode, matchId } });
      setDecided(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onStart() {
    setBusy(true);
    try {
      await start({ data: { passcode, matchId } });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (busy) return;
    setBusy(true);
    try {
      await resetToUpcoming({ data: { passcode, matchId } });
      setResetOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onUndoCompletion() {
    if (busy) return;
    setBusy(true);
    try {
      await undoCompletion({ data: { passcode, matchId } });
      setUndoCompleteOpen(false);
      setDecided(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onComplete(winner: "p1" | "p2", resultText: string) {
    setBusy(true);
    try {
      await complete({ data: { passcode, matchId, winner, resultText } });
      setDecided(null);
      setManualOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-safe pt-10 text-center text-sm text-muted-foreground">
        Loading match…
      </main>
    );
  }
  if (error || !match) {
    return (
      <main className="min-h-screen bg-background px-safe pt-10 text-center text-sm text-destructive">
        Could not load this match.
      </main>
    );
  }

  const p1 = match.p1_name ?? "Player 1";
  const p2 = match.p2_name ?? "Player 2";
  const completed = match.status === "completed";
  const nextLocked = data?.nextLocked ?? false;

  return (
    <main className="min-h-screen bg-background px-safe pb-20">
      <header className="mx-auto max-w-xl pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={crest}
              alt="Royal Colombo Golf Club crest"
              className="size-10 shrink-0 object-contain"
            />
            <p className="font-headline text-xl font-bold leading-tight text-primary">
              RCGC 105th Championship
            </p>
          </div>
          <Link to="/scorer" className="text-sm text-muted-foreground underline">
            ← All matches
          </Link>
        </div>
        <p className="mt-3 font-headline text-sm font-semibold uppercase tracking-wide text-primary">
          {match.round} ·{" "}
{divisionLabel(match.division)}
        </p>
        <h1 className="flex flex-wrap items-center gap-3 font-headline text-3xl font-bold text-foreground">
          <button
            type="button"
            onClick={() => profile?.open(p1)}
            className="flex items-center gap-2 rounded-md px-1 hover:bg-muted"
          >
            <PlayerAvatar name={p1} size="md" />
            {p1}
          </button>
          <span className="text-muted-foreground">vs</span>
          <button
            type="button"
            onClick={() => profile?.open(p2)}
            className="flex items-center gap-2 rounded-md px-1 hover:bg-muted"
          >
            <PlayerAvatar name={p2} size="md" />
            {p2}
          </button>
        </h1>
      </header>

      <section className="mx-auto mt-6 max-w-xl rounded-xl border border-border bg-card p-5 text-center shadow-sm">
        {completed ? (
          <>
            <p className="font-headline text-3xl font-bold text-primary">
              {match.result_text ?? "Completed"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Winner: {match.winner === "p1" ? p1 : match.winner === "p2" ? p2 : "—"}
            </p>
          </>
        ) : (
          <>
            <p className="font-headline text-3xl font-bold text-primary">{scoreLine}</p>
            {leader && (
              <p className="mt-1 text-sm font-semibold text-foreground">
                {leader === "p1" ? p1 : p2} leads
              </p>
            )}
          </>
        )}

        {holesActive && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {holes.map((h) => (
            <span
              key={h.id}
              title={`Hole ${h.hole_number}`}
              className={cn(
                "size-4 rounded-full border border-border",
                h.result === "p1" && "bg-primary",
                h.result === "p2" && "bg-secondary",
                h.result === "half" && "bg-muted",
              )}
            />
          ))}
          {holes.length === 0 && (
            <span className="text-xs text-muted-foreground">No holes recorded</span>
          )}
        </div>
        )}
        {!holesActive && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the latest direct score update.
          </p>
        )}
        {holesActive && holes.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="inline-block size-2 rounded-full bg-primary align-middle" /> {p1} ·{" "}
            <span className="inline-block size-2 rounded-full bg-secondary align-middle" /> {p2} ·{" "}
            <span className="inline-block size-2 rounded-full bg-muted align-middle" /> halved
          </p>
        )}
      </section>

      {completed && (
        <div className="mx-auto mt-6 max-w-xl text-center">
          {nextLocked ? (
            <p className="text-xs text-muted-foreground">
              Can't undo — the next match has already begun.
            </p>
          ) : undoCompleteOpen ? (
            <div className="rounded-lg border border-border bg-card p-4 text-left">
              <p className="text-sm text-foreground">
                Undo completion and put this match back to Live? Recorded holes are kept.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={onUndoCompletion}
                >
                  Yes, undo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setUndoCompleteOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setUndoCompleteOpen(true)}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
            >
              Undo completion
            </button>
          )}
        </div>
      )}

      {!completed && match.status === "upcoming" ? (

        <div className="mx-auto mt-6 max-w-xl">
          <Button size="lg" className="h-16 w-full text-lg" disabled={busy} onClick={onStart}>
            Start Match
          </Button>
        </div>
      ) : !completed ? (
        <div className="mx-auto mt-6 grid max-w-xl gap-3">
          <Button
            size="lg"
            className="h-20 w-full text-lg"
            disabled={busy || holes.length >= 18}
            onClick={() => onRecord("p1")}
          >
            {p1} wins hole
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-20 w-full text-lg"
            disabled={busy || holes.length >= 18}
            onClick={() => onRecord("p2")}
          >
            {p2} wins hole
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 w-full text-lg"
            disabled={busy || holes.length >= 18}
            onClick={() => onRecord("half")}
          >
            Hole halved
          </Button>
          {holesActive && (
            <Button
              variant="ghost"
              className="w-full"
              disabled={busy || holes.length === 0}
              onClick={onUndo}
            >
              <Undo2 className="mr-2 size-4" aria-hidden />
              Undo last hole
            </Button>
          )}
          {match.status === "live" && holes.length === 0 && !match.quick_updated_at && (
            <div className="text-center">
              {resetOpen ? (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-foreground">Reset this match back to Upcoming?</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" disabled={busy} onClick={onReset}>
                      Yes, reset
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1" onClick={() => setResetOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setResetOpen(true)}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                >
                  Reset to Upcoming
                </button>
              )}
            </div>
          )}
        </div>
      ) : null}

      {decided && !completed && (
        <div className="mx-auto mt-6 max-w-xl rounded-xl border-2 border-primary bg-card p-5 shadow-sm">
          <p className="font-headline text-lg font-bold text-foreground">
            Match decided — record as {decided.label}?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Winner: {decided.winner === "p1" ? p1 : p2}
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              className="flex-1"
              disabled={busy}
              onClick={() => onComplete(decided.winner, decided.label)}
            >
              Confirm
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setDecided(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!completed && match.status !== "upcoming" && (
        <section className="mx-auto mt-6 max-w-xl rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-foreground">
            Update score directly
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            For check-ins — this replaces the hole-by-hole score until the next hole is recorded.
          </p>

          <label htmlFor="quick-thru" className="mt-4 block text-sm font-medium text-foreground">
            Holes played
          </label>
          <Input
            id="quick-thru"
            inputMode="numeric"
            className="mt-1"
            value={quickThru}
            onChange={(e) => setQuickThru(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 7"
          />

          <p className="mt-4 text-sm font-medium text-foreground">Who's ahead?</p>
          <div className="mt-1 grid gap-2">
            <Button
              variant={quickSide === "p1" ? "default" : "outline"}
              onClick={() => setQuickSide("p1")}
            >
              {p1}
            </Button>
            <Button
              variant={quickSide === "square" ? "default" : "outline"}
              onClick={() => setQuickSide("square")}
            >
              All Square
            </Button>
            <Button
              variant={quickSide === "p2" ? "default" : "outline"}
              onClick={() => setQuickSide("p2")}
            >
              {p2}
            </Button>
          </div>

          {quickSide !== "square" && (
            <>
              <label
                htmlFor="quick-margin"
                className="mt-4 block text-sm font-medium text-foreground"
              >
                Up by how many holes?
              </label>
              <Input
                id="quick-margin"
                inputMode="numeric"
                className="mt-1"
                value={quickMargin}
                onChange={(e) => setQuickMargin(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 2"
              />
            </>
          )}

          <Button className="mt-4 w-full" disabled={busy} onClick={onQuickSave}>
            Save score update
          </Button>
          <p
            className={cn(
              "mt-1 text-xs",
              quickStatus === "error" ? "font-medium text-destructive" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {quickStatus === "saving" && "Saving…"}
            {quickStatus === "saved" && "Saved"}
            {quickStatus === "error" && "Couldn't save — check the numbers and try again"}
            {quickStatus === "idle" && "\u00A0"}
          </p>
        </section>
      )}

      {!completed && (
        <div className="mx-auto mt-6 max-w-xl">
          {manualOpen ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="font-headline text-lg font-bold text-foreground">End match now</p>
              <div className="mt-3 grid gap-2">
                <Button
                  variant={manualWinner === "p1" ? "default" : "outline"}
                  onClick={() => setManualWinner("p1")}
                >
                  {p1} wins
                </Button>
                <Button
                  variant={manualWinner === "p2" ? "default" : "outline"}
                  onClick={() => setManualWinner("p2")}
                >
                  {p2} wins
                </Button>
              </div>
              <Input
                className="mt-3"
                maxLength={40}
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                placeholder="Result label (e.g. 3&2, Conceded, W/O)"
                aria-label="Result label"
              />
              <div className="mt-4 flex gap-3">
                <Button
                  className="flex-1"
                  disabled={busy || !manualLabel.trim()}
                  onClick={() => onComplete(manualWinner, manualLabel.trim())}
                >
                  Save result
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setManualOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setManualOpen(true)}>
              End match now
            </Button>
          )}
        </div>
      )}

      <section className="mx-auto mt-8 max-w-xl">
        <label
          htmlFor="live-note"
          className="font-headline text-sm font-semibold uppercase tracking-wide text-primary"
        >
          Live note — shown to everyone watching
        </label>
        <Textarea
          id="live-note"
          maxLength={140}
          value={comment ?? ""}
          onChange={(e) => setComment(e.target.value)}
          onBlur={async () => {
            if ((comment ?? "") === (match.comment ?? "")) return;
            setSaveStatus("saving");
            try {
              await saveComment({ data: { passcode, matchId, comment: comment ?? "" } });
              await refresh();
              setSaveStatus("saved");
              window.setTimeout(() => setSaveStatus("idle"), 2000);
            } catch {
              setSaveStatus("error");
            }
          }}
          className="mt-2"
          placeholder="e.g. Long putt on 7 to halve the hole"
        />
        <div className="mt-1 flex items-center justify-between text-xs">
          <span
            className={cn(
              saveStatus === "saved" && "text-primary",
              saveStatus === "error" && "text-destructive font-medium",
              saveStatus === "idle" && "text-muted-foreground",
              saveStatus === "saving" && "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Couldn't save — try again"}
            {saveStatus === "idle" && "\u00A0"}
          </span>
          <span className="text-muted-foreground">{(comment ?? "").length}/140</span>
        </div>
      </section>
    </main>
  );
}
