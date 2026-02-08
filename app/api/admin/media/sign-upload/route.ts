import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdminRole } from "@/lib/admin/require-role";
import { writeAuditLog } from "@/lib/admin/audit";
import { slugify } from "@/lib/slug";

const BUCKET = "media";

export async function POST(req: Request) {
  const guard = await requireAdminRole(req, ["editor"]);
  const body = await req.json().catch(() => null);
  const filename = (body?.filename || "").toString();
  if (!filename) return NextResponse.json({ error: "VALIDATION_ERROR", detail: "filename required" }, { status: 400 });

  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const base = filename.includes(".") ? filename.slice(0, filename.lastIndexOf(".")) : filename;
  const safe = slugify(base).slice(0, 80);

  const date = new Date();
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  const random = Math.random().toString(36).slice(2, 10);
  const path = `uploads/${y}${m}${d}/${safe}-${random}.${ext}`;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "SIGNED_UPLOAD_FAILED", detail: error?.message || null }, { status: 500 });
  }

  await writeAuditLog({
    actor_profile_id: guard.userId,
    action: "media.sign_upload",
    target_table: "storage",
    target_id: path,
    meta: { bucket: BUCKET },
  });

  return NextResponse.json({ bucket: BUCKET, path, signedUrl: data.signedUrl, token: data.token });
}
