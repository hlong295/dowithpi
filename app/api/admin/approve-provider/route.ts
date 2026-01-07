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
    const requesterId = String(body?.requesterId || "");
    const targetUserId = String(body?.targetUserId || "");
    const approved = Boolean((body as any)?.approved ?? (body as any)?.approve);

    if (!requesterId || !targetUserId) {
      return NextResponse.json({ error: "Missing requesterId/targetUserId" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY missing on server" },
        { status: 500 }
      );
    }

    const requesterMaster = await resolveMasterUserId(supabase, requesterId);
    const targetMaster = await resolveMasterUserId(supabase, targetUserId);

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
      user_role: nextRole,
      updated_at: new Date().toISOString(),
    };

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
        user_role: nextRole,
        updated_at: new Date().toISOString(),
      })
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
