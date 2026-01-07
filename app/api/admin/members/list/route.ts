export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Root admin allowlist (case-insensitive) to avoid lockout in edge cases.
const ROOT_ADMIN_USERNAMES = ["hlong295"];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isRequesterAdmin(supabaseAdmin: any, requesterId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,user_role,pi_username")
    .eq("id", requesterId)
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: false, reason: "requester_not_found" };

  const role = (data.user_role || "").toLowerCase();
  const uname = (data.pi_username || "").toLowerCase();
  const isRoot = ROOT_ADMIN_USERNAMES.includes(uname);

  if (role === "admin" || isRoot) return { ok: true };
  return { ok: false, reason: "not_admin" };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requesterId = url.searchParams.get("requesterId") || "";
    const q = (url.searchParams.get("q") || "").trim();

    if (!UUID_RE.test(requesterId)) {
      return NextResponse.json(
        { error: "invalid_requester_id" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "missing_service_role_key" },
        { status: 500 }
      );
    }

    const adminCheck = await isRequesterAdmin(supabaseAdmin, requesterId);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: "forbidden", reason: adminCheck.reason },
        { status: 403 }
      );
    }

    // Pull members from the master table (public.users). We also join pi_users
    // only to enrich Pi fields when they exist.
    let query = supabaseAdmin
      .from("users")
      .select(
        [
          "id",
          "created_at",
          "user_role",
          "user_type",
          "is_banned",
          "ban_until",
          "trust_label",
          "provider_label",
          "provider_approved",
          "provider_approved_at",
          "provider_verified",
          "full_name",
          "email",
          "phone",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (q) {
      // Do a broad search across common identifiers.
      // Note: "or" expects a CSV-like filter string.
      const safe = q.replace(/[,]/g, " ");
      query = query.or(
        [
          `full_name.ilike.%${safe}%`,
          `email.ilike.%${safe}%`,
          `pi_username.ilike.%${safe}%`,
          `phone.ilike.%${safe}%`,
        ].join(",")
      );
    }

    const { data: users, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "query_failed", detail: error.message },
        { status: 500 }
      );
    }

    const normalize = (u: any) => {
      const pu = Array.isArray(u.pi_users) ? u.pi_users[0] : null;
      const pi_username = u.pi_username ?? pu?.pi_username ?? null;
      const pi_uid =
        (u as any).pi_uid ??
        (u as any).pi_user_id ??
        pu?.pi_uid ??
        pu?.pi_user_id ??
        null;

      const isPi =
        (u.user_type || "").toLowerCase() === "pi" ||
        !!(pi_uid || pi_username);

      return {
        id: u.id,
        created_at: u.created_at,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        pi_username,
        pi_uid,
        user_role: u.user_role,
        user_type: isPi ? "pi" : "email",
        is_banned: !!u.is_banned,
        ban_until: u.ban_until,
        trust_label: u.trust_label || "normal",
        provider_label: u.provider_label || "unverified",
        provider_approved: !!u.provider_approved,
        provider_approved_at: u.provider_approved_at,
        provider_verified: !!u.provider_verified,
      };
    };

    const normalized = (users || []).map(normalize);
    const piMembers = normalized.filter((m: any) => m.user_type === "pi");
    const emailMembers = normalized.filter((m: any) => m.user_type === "email");
    const providers = normalized.filter((m: any) => m.provider_approved);

    return NextResponse.json({
      ok: true,
      counts: {
        total: normalized.length,
        pi: piMembers.length,
        email: emailMembers.length,
        providersApproved: providers.length,
        providersTotal: normalized.filter((m: any) => m.user_type === "pi" || m.user_type === "email").length,
      },
      piMembers,
      emailMembers,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "unexpected", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
