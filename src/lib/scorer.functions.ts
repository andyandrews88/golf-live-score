import { createServerFn } from "@tanstack/react-start";

async function checkPasscode(passcode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "scorer_passcode")
    .maybeSingle();

  if (error) throw error;

  const expected = typeof row?.value === "string" ? row.value : null;
  if (!expected) return false;

  const input = passcode.trim();
  if (input.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

async function requireScorer(passcode: string) {
  const ok = await checkPasscode(passcode);
  if (!ok) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const verifyScorerPasscode = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => ({
    passcode: String(data?.passcode ?? ""),
  }))
  .handler(async ({ data }) => ({ ok: await checkPasscode(data.passcode) }));

export const recordHole = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; matchId: string; result: string }) => {
    const result = String(data?.result ?? "");
    if (!["p1", "p2", "half"].includes(result)) throw new Error("Invalid result");
    return {
      passcode: String(data?.passcode ?? ""),
      matchId: String(data?.matchId ?? ""),
      result,
    };
  })
  .handler(async ({ data }) => {
    const db = await requireScorer(data.passcode);
    const { data: last, error: lastErr } = await db
      .from("hole_results")
      .select("hole_number")
      .eq("match_id", data.matchId)
      .order("hole_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw lastErr;

    const holeNumber = (last?.hole_number ?? 0) + 1;
    if (holeNumber > 18) throw new Error("All 18 holes recorded");

    const { error } = await db
      .from("hole_results")
      .insert({ match_id: data.matchId, hole_number: holeNumber, result: data.result });
    if (error) throw error;
    return { ok: true as const, holeNumber };
  });

export const undoLastHole = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; matchId: string }) => ({
    passcode: String(data?.passcode ?? ""),
    matchId: String(data?.matchId ?? ""),
  }))
  .handler(async ({ data }) => {
    const db = await requireScorer(data.passcode);
    const { data: last, error: lastErr } = await db
      .from("hole_results")
      .select("id")
      .eq("match_id", data.matchId)
      .order("hole_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw lastErr;
    if (!last) return { ok: true as const, removed: false };

    const { error } = await db.from("hole_results").delete().eq("id", last.id);
    if (error) throw error;
    return { ok: true as const, removed: true };
  });

export const startMatch = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; matchId: string }) => ({
    passcode: String(data?.passcode ?? ""),
    matchId: String(data?.matchId ?? ""),
  }))
  .handler(async ({ data }) => {
    const db = await requireScorer(data.passcode);
    const { error } = await db
      .from("matches")
      .update({ status: "live", updated_at: new Date().toISOString() })
      .eq("id", data.matchId);
    if (error) throw error;
    return { ok: true as const };
  });

export const resetMatchToUpcoming = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; matchId: string }) => ({
    passcode: String(data?.passcode ?? ""),
    matchId: String(data?.matchId ?? ""),
  }))
  .handler(async ({ data }) => {
    const db = await requireScorer(data.passcode);
    const { count, error: countErr } = await db
      .from("hole_results")
      .select("id", { count: "exact", head: true })
      .eq("match_id", data.matchId);
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) throw new Error("Holes already recorded");

    const { error } = await db
      .from("matches")
      .update({
        status: "upcoming",
        winner: null,
        result_text: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.matchId)
      .eq("status", "live");
    if (error) throw error;
    return { ok: true as const };
  });

export const completeMatch = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { passcode: string; matchId: string; winner: string; resultText: string }) => {
      const winner = String(data?.winner ?? "");
      if (!["p1", "p2"].includes(winner)) throw new Error("Invalid winner");
      return {
        passcode: String(data?.passcode ?? ""),
        matchId: String(data?.matchId ?? ""),
        winner,
        resultText: String(data?.resultText ?? "").slice(0, 40),
      };
    },
  )
  .handler(async ({ data }) => {
    const db = await requireScorer(data.passcode);
    const { error } = await db
      .from("matches")
      .update({
        status: "completed",
        winner: data.winner,
        result_text: data.resultText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.matchId);
    if (error) throw error;
    return { ok: true as const };
  });

export const undoMatchCompletion = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; matchId: string }) => ({
    passcode: String(data?.passcode ?? ""),
    matchId: String(data?.matchId ?? ""),
  }))
  .handler(async ({ data }) => {
    const db = await requireScorer(data.passcode);

    const { data: match, error: matchErr } = await db
      .from("matches")
      .select("id, status, winner, feeds_into_match_id, feeds_into_slot")
      .eq("id", data.matchId)
      .maybeSingle();
    if (matchErr) throw matchErr;
    if (!match) throw new Error("Match not found");
    if (match.status !== "completed") throw new Error("Match is not completed");

    if (match.feeds_into_match_id) {
      const { data: next, error: nextErr } = await db
        .from("matches")
        .select("id, status")
        .eq("id", match.feeds_into_match_id)
        .maybeSingle();
      if (nextErr) throw nextErr;

      const { count, error: countErr } = await db
        .from("hole_results")
        .select("id", { count: "exact", head: true })
        .eq("match_id", match.feeds_into_match_id);
      if (countErr) throw countErr;

      if (!next || next.status !== "upcoming" || (count ?? 0) > 0) {
        throw new Error("Next match has already begun");
      }

      if (match.feeds_into_slot === 1 || match.feeds_into_slot === 2) {
        const slot = match.feeds_into_slot;
        const { error: clearErr } = await db
          .from("matches")
          .update({
            [`p${slot}_name`]: null,
            [`p${slot}_seed`]: null,
            [`p${slot}_hcp`]: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.feeds_into_match_id);
        if (clearErr) throw clearErr;
      }
    }

    const { error } = await db
      .from("matches")
      .update({
        status: "live",
        winner: null,
        result_text: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.matchId);
    if (error) throw error;
    return { ok: true as const };
  });

export const saveMatchComment = createServerFn({ method: "POST" })

  .inputValidator((data: { passcode: string; matchId: string; comment: string }) => ({
    passcode: String(data?.passcode ?? ""),
    matchId: String(data?.matchId ?? ""),
    comment: String(data?.comment ?? "").slice(0, 140),
  }))
  .handler(async ({ data }) => {
    const db = await requireScorer(data.passcode);
    const { error } = await db
      .from("matches")
      .update({ comment: data.comment, updated_at: new Date().toISOString() })
      .eq("id", data.matchId);
    if (error) throw error;
    return { ok: true as const };
  });
