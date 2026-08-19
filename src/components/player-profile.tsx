import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const DIVISION_LABELS: Record<string, string> = {
  men: "Men's Championship",
  silver: "Ladies Silver",
  bronze: "Ladies Bronze Cup",
};

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export type PlayerPhoto = { player_name: string; photo_url: string };

export function usePlayerPhotos() {
  return useQuery({
    queryKey: ["player-photos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_photos")
        .select("player_name, photo_url");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data ?? []) as PlayerPhoto[]) {
        if (row.photo_url) map.set(row.player_name, row.photo_url);
      }
      return map;
    },
    staleTime: 60_000,
  });
}

type Ctx = { open: (name: string) => void; photos: Map<string, string> };
const PlayerProfileContext = createContext<Ctx | null>(null);

export function usePlayerProfile() {
  return useContext(PlayerProfileContext);
}

type MatchRow = {
  id: string;
  division: string;
  round: string;
  status: string;
  date_label: string | null;
  tee_time: string | null;
  sort_order: number | null;
  p1_name: string | null;
  p1_seed: number | null;
  p1_hcp: number | null;
  p2_name: string | null;
  p2_seed: number | null;
  p2_hcp: number | null;
  result_text: string | null;
  winner: string | null;
};

function statusLabel(status: string) {
  return status === "live" ? "Live" : status === "completed" ? "Completed" : "Upcoming";
}

function ProfileDialog({
  name,
  photo,
  onClose,
}: {
  name: string | null;
  photo: string | undefined;
  onClose: () => void;
}) {
  const { data: matches } = useQuery({
    queryKey: ["player-profile-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, division, round, status, date_label, tee_time, sort_order, p1_name, p1_seed, p1_hcp, p2_name, p2_seed, p2_hcp, result_text, winner",
        )
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MatchRow[];
    },
    enabled: Boolean(name),
  });

  const mine = useMemo(
    () => (matches ?? []).filter((m) => m.p1_name === name || m.p2_name === name),
    [matches, name],
  );

  const info = useMemo(() => {
    for (const m of mine) {
      if (m.p1_name === name && (m.p1_seed != null || m.p1_hcp != null))
        return { seed: m.p1_seed, hcp: m.p1_hcp };
      if (m.p2_name === name && (m.p2_seed != null || m.p2_hcp != null))
        return { seed: m.p2_seed, hcp: m.p2_hcp };
    }
    return { seed: null as number | null, hcp: null as number | null };
  }, [mine, name]);

  return (
    <Dialog open={Boolean(name)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 size-24 overflow-hidden rounded-full border-2 border-secondary bg-primary">
            {photo ? (
              <img
                src={photo}
                alt={name ?? ""}
                className="size-full object-cover"
                width={300}
                height={300}
              />
            ) : (
              <span className="flex size-full items-center justify-center font-headline text-3xl font-bold text-primary-foreground">
                {name ? initialsOf(name) : "?"}
              </span>
            )}
          </div>
          <DialogTitle className="font-headline text-2xl text-primary">{name}</DialogTitle>
          <DialogDescription>
            {info.seed != null && <>Seed #{info.seed}</>}
            {info.seed != null && info.hcp != null && " · "}
            {info.hcp != null && <>Handicap {info.hcp}</>}
            {info.seed == null && info.hcp == null && "Player profile"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {mine.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">No matches found.</p>
          )}
          {mine.map((m) => {
            const opponent = (m.p1_name === name ? m.p2_name : m.p1_name) ?? "TBD";
            const playerSlot = m.p1_name === name ? "p1" : m.p2_name === name ? "p2" : null;
            const outcome =
              m.status === "completed" && playerSlot && m.winner
                ? m.winner === playerSlot
                  ? "Won"
                  : "Lost"
                : null;
            return (
              <div key={m.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline text-sm font-semibold uppercase tracking-wide text-primary">
                    {m.round} · {DIVISION_LABELS[m.division] ?? m.division}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold uppercase",
                      m.status === "live" && "bg-secondary text-secondary-foreground",
                      m.status === "completed" && "bg-primary text-primary-foreground",
                      m.status !== "live" && m.status !== "completed" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {statusLabel(m.status)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground">vs {opponent}</p>
                <p className="text-xs text-muted-foreground">
                  {[m.date_label, m.tee_time].filter(Boolean).join(" · ")}
                  {m.status === "completed" && (
                    <>
                      {" · "}
                      {outcome ? `${outcome} · ` : ""}
                      {m.result_text ?? "Completed"}
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  const { data: photos } = usePlayerPhotos();
  const map = photos ?? new Map<string, string>();

  const value = useMemo<Ctx>(() => ({ open: setName, photos: map }), [map]);

  return (
    <PlayerProfileContext.Provider value={value}>
      {children}
      <ProfileDialog
        name={name}
        photo={name ? map.get(name) : undefined}
        onClose={() => setName(null)}
      />
    </PlayerProfileContext.Provider>
  );
}

export function PlayerAvatar({
  name,
  size = "md",
  tone = "light",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark";
  className?: string;
}) {
  const ctx = usePlayerProfile();
  const photo = ctx?.photos.get(name);
  const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border",
        tone === "dark"
          ? "border-secondary/60 bg-primary-foreground/10 text-secondary"
          : "border-primary/20 bg-primary text-primary-foreground",
        sizes[size],
        className,
      )}
    >
      {photo ? (
        <img src={photo} alt={name} className="size-full object-cover" width={300} height={300} />
      ) : (
        <span className="font-headline font-bold">{initialsOf(name)}</span>
      )}
    </span>
  );
}
