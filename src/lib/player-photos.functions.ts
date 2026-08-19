import { createServerFn } from "@tanstack/react-start";

const BUCKET = "player-photos";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "player"
  );
}

export const uploadPlayerPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; playerName: string; dataUrl: string }) => {
    const dataUrl = String(data?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw new Error("Invalid image");
    if (dataUrl.length > 2_000_000) throw new Error("Image too large");
    const playerName = String(data?.playerName ?? "").trim();
    if (!playerName) throw new Error("Missing player");
    return { passcode: String(data?.passcode ?? ""), playerName, dataUrl };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: cfgErr } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", "scorer_passcode")
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    const expected = typeof row?.value === "string" ? row.value : null;
    if (!expected || data.passcode.trim() !== expected) throw new Error("Unauthorized");

    const base64 = data.dataUrl.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${slugify(data.playerName)}-${Date.now()}.jpg`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, TEN_YEARS);
    if (signErr) throw signErr;

    const { error: dbErr } = await supabaseAdmin
      .from("player_photos")
      .upsert(
        {
          player_name: data.playerName,
          photo_url: signed.signedUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "player_name" },
      );
    if (dbErr) throw dbErr;

    return { ok: true as const, photoUrl: signed.signedUrl };
  });
