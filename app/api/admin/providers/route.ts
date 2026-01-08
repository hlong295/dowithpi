export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

// Root admin allowlist (case-insensitive) to avoid lockout.
const ROOT_ADMIN_USERNAMES = ["hlong295"];

function normalizeId(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const candidate = (v as any)?.id ?? (v as any)?.userId ?? (v as any)?.uid ?? (v as any)?.value;
    return typeof candidate === "string" ? candidate : candidate ? String(candidate) : "";
  }
  return String(v);
}

async function requireAdmin(supabase: any, requesterIdRaw: any) {
  const requesterId = normalizeId(requesterIdRaw);
  if (!requesterId) {
    return { ok: false as const, status: 400, error: "Missing requesterId" };
  }

  const { userId: requesterMaster } = await resolveMasterUserId(supabase as any, requesterId);
  const { data: requester, error: requesterErr } = await supabase
    .from("users")
    .select("id,user_role,pi_username,email")
    .eq("id", requesterMaster)
    .maybeSingle();

  if (requesterErr) {
    return { ok: false as const, status: 500, error: requesterErr.message };
  }

  const requesterName = String(requester?.pi_username || requester?.email || "").toLowerCase();
  const isRoot = ROOT_ADMIN_USERNAMES.includes(requesterName);
  const isAdmin = isRoot || requester?.user_role === "admin" || requester?.user_role === "root_admin";
  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, requesterMaster };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requesterId = url.searchParams.get("requesterId");

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing on server" }, { status: 500 });
    }

    const adminCheck = await requireAdmin(supabase as any, requesterId);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const baseSelect =
      "id,email,full_name,phone,pi_username,user_type,user_role,provider_approved,provider_approved_at,provider_business_name,provider_description,created_at";

    const { data: pending, error: pendingErr } = await supabase
      .from("users")
      .select(baseSelect)
      .eq("user_role", "provider")
      .eq("provider_approved", false)
      .order("created_at", { ascending: false });

    if (pendingErr) {
      return NextResponse.json({ error: pendingErr.message }, { status: 500 });
    }

    const { data: approved, error: approvedErr } = await supabase
      .from("users")
      .select(baseSelect)
      .eq("user_role", "provider")
      .eq("provider_approved", true)
      .order("provider_approved_at", { ascending: false });

    if (approvedErr) {
      return NextResponse.json({ error: approvedErr.message }, { status: 500 });
    }

    return NextResponse.json({ pending: pending || [], approved: approved || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
