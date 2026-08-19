import { createServerFn } from "@tanstack/react-start";

const BUCKET = "course-photos";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

async function assertPasscode(passcode: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "scorer_passcode")
    .maybeSingle();
  if (error) throw error;
  const expected = typeof row?.value === "string" ? row.value : null;
  if (!expected || passcode.trim() !== expected) throw new Error("Unauthorized");
  return supabaseAdmin;
}

export const uploadCoursePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; caption: string; dataUrl: string }) => {
    const dataUrl = String(data?.dataUrl ?? "");
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw new Error("Invalid image");
    if (dataUrl.length > 4_000_000) throw new Error("Image too large");
    return {
      passcode: String(data?.passcode ?? ""),
      caption: String(data?.caption ?? "").slice(0, 160),
      dataUrl,
    };
  })
  .handler(async ({ data }) => {
    const supabaseAdmin = await assertPasscode(data.passcode);

    const base64 = data.dataUrl.split(",")[1] ?? "";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `course-${Date.now()}.jpg`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) throw upErr;

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, TEN_YEARS);
    if (signErr) throw signErr;

    const { data: last } = await supabaseAdmin
      .from("course_photos")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: dbErr } = await supabaseAdmin.from("course_photos").insert({
      photo_url: signed.signedUrl,
      caption: data.caption,
      display_order: (last?.display_order ?? 0) + 1,
    });
    if (dbErr) throw dbErr;

    return { ok: true as const, photoUrl: signed.signedUrl };
  });

export const registerCoursePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: {
    passcode: string;
    path: string;
    caption: string;
    displayOrder: number;
  }) => ({
    passcode: String(data?.passcode ?? ""),
    path: String(data?.path ?? ""),
    caption: String(data?.caption ?? "").slice(0, 160),
    displayOrder: Number(data?.displayOrder ?? 0),
  }))
  .handler(async ({ data }) => {
    const supabaseAdmin = await assertPasscode(data.passcode);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, TEN_YEARS);
    if (signErr) throw signErr;
    const { error } = await supabaseAdmin.from("course_photos").insert({
      photo_url: signed.signedUrl,
      caption: data.caption,
      display_order: data.displayOrder,
    });
    if (error) throw error;
    return { ok: true as const };
  });

export const updateCoursePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; id: string; caption?: string; displayOrder?: number }) => ({
    passcode: String(data?.passcode ?? ""),
    id: String(data?.id ?? ""),
    caption: data?.caption === undefined ? undefined : String(data.caption).slice(0, 160),
    displayOrder: data?.displayOrder === undefined ? undefined : Number(data.displayOrder),
  }))
  .handler(async ({ data }) => {
    const supabaseAdmin = await assertPasscode(data.passcode);
    const patch: { caption?: string; display_order?: number } = {};
    if (data.caption !== undefined) patch.caption = data.caption;
    if (data.displayOrder !== undefined) patch.display_order = data.displayOrder;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await supabaseAdmin.from("course_photos").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteCoursePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string; id: string }) => ({
    passcode: String(data?.passcode ?? ""),
    id: String(data?.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const supabaseAdmin = await assertPasscode(data.passcode);
    const { data: row } = await supabaseAdmin
      .from("course_photos")
      .select("photo_url")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("course_photos").delete().eq("id", data.id);
    if (error) throw error;

    const url = row?.photo_url ?? "";
    const match = url.match(/\/course-photos\/([^?]+)/);
    if (match?.[1]) {
      await supabaseAdmin.storage.from(BUCKET).remove([decodeURIComponent(match[1])]);
    }
    return { ok: true as const };
  });
