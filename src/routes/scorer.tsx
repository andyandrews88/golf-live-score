import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Lock, Trash2, Upload } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import crest from "@/assets/crest.png";
import { divisionLabel } from "@/lib/divisions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { verifyScorerPasscode } from "@/lib/scorer.functions";
import { uploadPlayerPhoto } from "@/lib/player-photos.functions";
import {
  deleteCoursePhoto,
  updateCoursePhoto,
  uploadCoursePhoto,
} from "@/lib/course-photos.functions";
import { useCoursePhotos } from "@/lib/course-photos";
import { getScorerPasscode, setScorerPasscode } from "@/lib/scorer-session";
import {
import { useRefetchOnVisible } from "@/lib/use-refetch-on-visible";
  PlayerAvatar,
  PlayerProfileProvider,
  usePlayerProfile,
} from "@/components/player-profile";

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
  sort_order: number | null;
  p1_name: string | null;
  p2_name: string | null;
  status: string;
  result_text: string | null;
  winner: string | null;
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
        setScorerPasscode(passcode);
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
        <div className="flex items-center gap-3">
          <img
            src={crest}
            alt="Royal Colombo Golf Club crest"
            className="size-12 shrink-0 object-contain"
          />
          <div>
            <h1 className="font-headline text-2xl font-bold text-primary">
              RCGC 105th Championship
            </h1>
            <p className="text-sm text-muted-foreground">Scorer Tools</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
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
    .select(
      "id, division, round, date_label, tee_time, match_date, sort_order, p1_name, p2_name, status, result_text, winner",
    )
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Match[];
}

function winnerName(match: Match) {
  if (match.winner === "p1") return match.p1_name;
  if (match.winner === "p2") return match.p2_name;
  return null;
}

function PlayerChip({ name }: { name: string | null }) {
  const profile = usePlayerProfile();
  if (!name) {
    return <span className="font-headline text-lg font-medium text-muted-foreground">TBD</span>;
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        profile?.open(name);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          profile?.open(name);
        }
      }}
      className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted"
    >
      <PlayerAvatar name={name} size="sm" />
      <span className="font-headline text-lg font-medium text-foreground">{name}</span>
    </span>
  );
}

function useScorerMatchesRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("scorer-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        queryClient.invalidateQueries({ queryKey: ["scorer-matches"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "hole_results" }, () => {
        queryClient.invalidateQueries({ queryKey: ["scorer-matches"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

function MatchList() {
  const navigate = useNavigate();
  useScorerMatchesRealtime();
  useRefetchOnVisible(["scorer-matches"]);
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
    <div>
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
              return (
                <div
                  key={m.id}
                  role={ready ? "button" : undefined}
                  tabIndex={ready ? 0 : undefined}
                  aria-disabled={ready ? undefined : "true"}
                  onClick={
                    ready
                      ? () => navigate({ to: "/scorer/$matchId", params: { matchId: m.id } })
                      : undefined
                  }
                  onKeyDown={
                    ready
                      ? (e) => {
                          if (e.key === "Enter") {
                            navigate({ to: "/scorer/$matchId", params: { matchId: m.id } });
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "rounded-xl border border-border p-4 text-left shadow-sm transition-colors",
                    ready
                      ? "cursor-pointer bg-card hover:border-primary"
                      : "bg-muted/40 opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-headline text-sm font-semibold uppercase tracking-wide text-primary">
                      {divisionLabel(m.division)}
                    </span>
                    <StatusPill status={m.status} />
                  </div>
                  {m.status === "completed" && (
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {winnerName(m) ? `${winnerName(m)} won` : "Match completed"}
                      {m.result_text ? ` · ${m.result_text}` : ""}
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    <div>
                      <PlayerChip name={m.p1_name} />
                    </div>
                    <div>
                      <PlayerChip name={m.p2_name} />
                    </div>
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
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

async function resizeToSquare(file: File, size = 300): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function resizeToMax(file: File, max = 1200): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function CoursePhotosSection({ passcode }: { passcode: string }) {
  const queryClient = useQueryClient();
  const { data: photos } = useCoursePhotos();
  const upload = useServerFn(uploadCoursePhoto);
  const update = useServerFn(updateCoursePhoto);
  const remove = useServerFn(deleteCoursePhoto);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = photos ?? [];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["course-photos"] });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await resizeToMax(file);
      await upload({ data: { passcode, caption: caption.trim(), dataUrl } });
      setCaption("");
      await refresh();
    } catch {
      setError("Upload failed — try again");
    } finally {
      setBusy(false);
    }
  }

  async function swap(indexA: number, indexB: number) {
    const a = list[indexA];
    const b = list[indexB];
    if (!a || !b) return;
    setBusy(true);
    try {
      await update({ data: { passcode, id: a.id, displayOrder: b.display_order } });
      await update({ data: { passcode, id: b.id, displayOrder: a.display_order } });
      await refresh();
    } catch {
      setError("Could not reorder — try again");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await remove({ data: { passcode, id } });
      await refresh();
    } catch {
      setError("Could not remove — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-headline text-xl font-bold text-foreground">Course Photos</h2>
      <p className="text-sm text-muted-foreground">
        Shown in the home page carousel and the TV idle screen. Images are resized to 1200px.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)"
          aria-label="Course photo caption"
          maxLength={160}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
          aria-label="Choose course photo"
        />
        <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" aria-hidden />
          {busy ? "Working…" : "Add photo"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-4 grid gap-2">
        {list.map((photo, i) => (
          <div
            key={photo.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <img
              src={photo.photo_url}
              alt={photo.caption || "Course photo"}
              className="size-16 rounded-md object-cover"
            />
            <p className="min-w-0 flex-1 truncate text-sm text-foreground">
              {photo.caption || "No caption"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move up"
              disabled={busy || i === 0}
              onClick={() => swap(i, i - 1)}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move down"
              disabled={busy || i === list.length - 1}
              onClick={() => swap(i, i + 1)}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove photo"
              disabled={busy}
              onClick={() => onDelete(photo.id)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No course photos yet.</p>
        )}
      </div>
    </section>
  );
}

function PhotosTab({ passcode }: { passcode: string }) {
  const queryClient = useQueryClient();
  const profile = usePlayerProfile();
  const upload = useServerFn(uploadPlayerPhoto);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ name: string; text: string; error: boolean } | null>(
    null,
  );

  const { data: matches } = useQuery({ queryKey: ["scorer-matches"], queryFn: fetchMatches });

  const players = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches ?? []) {
      if (m.p1_name) set.add(m.p1_name);
      if (m.p2_name) set.add(m.p2_name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [matches]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const name = target;
    e.target.value = "";
    if (!file || !name) return;
    setBusy(name);
    setMessage(null);
    try {
      const dataUrl = await resizeToSquare(file);
      await upload({ data: { passcode, playerName: name, dataUrl } });
      await queryClient.invalidateQueries({ queryKey: ["player-photos"] });
      setMessage({ name, text: "Photo saved", error: false });
    } catch {
      setMessage({ name, text: "Upload failed — try again", error: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        Tap a player to upload a photo. Images are cropped to a square automatically.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
        aria-label="Choose player photo"
      />
      <div className="mt-4 grid gap-2">
        {players.map((name) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <button type="button" onClick={() => profile?.open(name)} aria-label={`View ${name}`}>
              <PlayerAvatar name={name} size="md" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-headline text-lg font-medium text-foreground">{name}</p>
              {message?.name === name && (
                <p
                  className={cn(
                    "text-xs",
                    message.error ? "text-destructive" : "text-primary",
                  )}
                >
                  {message.text}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy === name}
              onClick={() => {
                setTarget(name);
                inputRef.current?.click();
              }}
            >
              <Upload className="size-4" aria-hidden />
              {busy === name ? "Uploading…" : "Upload"}
            </Button>
          </div>
        ))}
        {players.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No players yet.</p>
        )}
      </div>
      <CoursePhotosSection passcode={passcode} />
    </div>
  );
}

function ScorerHome({ passcode }: { passcode: string }) {
  return (
    <PlayerProfileProvider>
      <main className="min-h-screen bg-background px-safe pb-16">
        <header className="mx-auto flex max-w-3xl items-center gap-3 pt-8 pb-4">
          <img
            src={crest}
            alt="Royal Colombo Golf Club crest"
            className="size-12 shrink-0 object-contain sm:size-14"
          />
          <div>
            <h1 className="font-headline text-3xl font-bold text-primary">
              RCGC 105th Championship
            </h1>
            <p className="text-sm text-muted-foreground">Scorer Tools · select a match</p>
          </div>
        </header>

        <div className="mx-auto max-w-3xl">
          <Tabs defaultValue="matches">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="matches">Matches</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
            </TabsList>
            <TabsContent value="matches">
              <MatchList />
            </TabsContent>
            <TabsContent value="photos">
              <PhotosTab passcode={passcode} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </PlayerProfileProvider>
  );
}

function ScorerPage() {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPasscode(getScorerPasscode());
    setReady(true);
  }, []);

  if (!ready) return <main className="min-h-screen bg-background" />;
  if (!passcode)
    return <PasscodeGate onUnlock={() => setPasscode(getScorerPasscode())} />;
  return <ScorerHome passcode={passcode} />;
}
