import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest, isRootAdmin } from "@/lib/lottery/auth";

/**
 * POST /api/settings/avatar
 * Body: { fileBase64, mimeType, userId? }
 * - userId omitted => update own avatar
 * - root admin can update others by providing userId
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: requesterId, username } = await getUserFromRequest(request);
    const requesterIsRoot = isRootAdmin({ username });

    const body = await request.json();
    const fileBase64 = body?.fileBase64 as string | undefined;
    const mimeType = (body?.mimeType as string | undefined) || "image/png";
    const targetUserId = (body?.userId as string | undefined) || requesterId;

    if (targetUserId !== requesterId && !requesterIsRoot) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (!fileBase64 || typeof fileBase64 !== "string") {
      return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
    }

    // Decode base64 (supports data URL too)
    const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
    const buffer = Buffer.from(base64Data, "base64");

    const supabaseAdmin = getSupabaseAdminClient();

    const ext = mimeType.includes("jpeg") ? "jpg" : mimeType.includes("png") ? "png" : "bin";
    const filename = `${targetUserId}/${Date.now()}-${randomUUID()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("user-uploads")
      .upload(filename, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "UPLOAD_FAILED", detail: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from("user-uploads").getPublicUrl(filename);
    const avatarUrl = publicUrlData?.publicUrl || null;

    // Update avatar_url in public.users (pi_users does NOT have avatar_url in current schema)
    const { error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", targetUserId);

    if (updateErr) {
      return NextResponse.json(
        { ok: false, error: "DB_UPDATE_FAILED", detail: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, avatar_url: avatarUrl, userId: targetUserId });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "AVATAR_UPDATE_FAILED", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
