import { createServerFn } from "@tanstack/react-start";

export const verifyScorerPasscode = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => ({
    passcode: String(data?.passcode ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "scorer_passcode")
      .maybeSingle();

    if (error) throw error;

    const expected = typeof row?.value === "string" ? row.value : null;
    if (!expected) return { ok: false as const };

    const input = data.passcode.trim();
    if (input.length !== expected.length) return { ok: false as const };

    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= input.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return { ok: mismatch === 0 };
  });
