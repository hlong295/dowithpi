export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

// Root admin allowlist (case-insensitive) to avoid lockout.
const ROOT_ADMIN_USERNAMES = ["hlong295"];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Some clients may accidentally send ids as objects (e.g. { id: 'uuid' }).
    // If we String() them, Postgres will receive "[object Object]" and throw invalid UUID.
    const normalizeId = (v: any): string => {
      if (!v) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number") return String(v);
      if (typeof v === "object") {
        const candidate = (v as any)?.id ?? (v as any)?.userId ?? (v as any)?.uid ?? (v as any)?.value;
        return typeof candidate === "string" ? candidate : candidate ? String(candidate) : "";
      }
      return String(v);
    };

    const requesterId = normalizeId(body?.requesterId);
    const targetUserId = normalizeId(body?.targetUserId);
    const approved = Boolean((body as any)?.approved ?? (body as any)?.approve);

    if (!requesterId || !targetUserId) {
      return NextResponse.json(
        {
          error: "Missing requesterId/targetUserId",
          debug: {
            requesterIdType: typeof body?.requesterId,
            targetUserIdType: typeof body?.targetUserId,
            requesterId,
            targetUserId,
          },
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY missing on server" },
        { status: 500 }
      );
    }

    // NOTE: resolveMasterUserId returns { userId, created }
    const { userId: requesterMaster } = await resolveMasterUserId(supabase as any, requesterId);
    const { userId: targetMaster } = await resolveMasterUserId(supabase as any, targetUserId);

    // Verify requester is admin
    const { data: requester, error: requesterErr } = await supabase
      .from("users")
      .select("id,user_role,pi_username,email")
      .eq("id", requesterMaster)
      .maybeSingle();

    if (requesterErr) {
      return NextResponse.json({ error: requesterErr.message }, { status: 500 });
    }

    const requesterName = String(
      requester?.pi_username || requester?.email || ""
    ).toLowerCase();
    const isRoot = ROOT_ADMIN_USERNAMES.includes(requesterName);
    const isAdmin = isRoot || requester?.user_role === "admin" || requester?.user_role === "root_admin";

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Read current target role to avoid clobbering admin roles.
    const { data: target, error: targetErr } = await supabase
      .from("users")
      .select("id,user_role")
      .eq("id", targetMaster)
      .maybeSingle();
    if (targetErr) {
      return NextResponse.json({ error: targetErr.message }, { status: 500 });
    }

    const isTargetAdmin =
      target?.user_role === "admin" || target?.user_role === "root_admin";

    const nextRole = isTargetAdmin ? target?.user_role : approved ? "provider" : "redeemer";

    const updatePayload: Record<string, any> = {
      provider_approved: approved,
      provider_approved_at: approved ? new Date().toISOString() : null,
      provider_approved_by: requesterMaster,
      user_role: nextRole,    };

    const { error: updErr } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", targetMaster);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Mirror (best-effort) into pi_users if row exists.
    await supabase
      .from("pi_users")
      .update({
        provider_approved: approved,
        provider_approved_at: approved ? new Date().toISOString() : null,
        provider_approved_by: requesterMaster,
        user_role: nextRole,      })
      .eq("id", targetMaster);

    // Audit trail
    await supabase.from("provider_approvals").insert({
      provider_id: targetMaster,
      approved_by: requesterMaster,
      action: approved ? "approve" : "revoke",
      reason: approved ? "" : "",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
