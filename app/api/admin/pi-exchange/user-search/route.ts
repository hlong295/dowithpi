export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/require-user";

const ROOT_ADMIN_USERNAMES = ["hlong295"];

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normStr(v: any) {
  return String(v || "").trim().toLowerCase();
}

async function isRootAdmin(sb: any, userId: string) {
  try {
    const { data: u } = await sb.from("users").select("*").eq("id", userId).maybeSingle();
    const role = normStr((u as any)?.user_role);
    const uname = normStr((u as any)?.pi_username || (u as any)?.username);
    if (role === "root_admin" || ROOT_ADMIN_USERNAMES.includes(uname)) return true;
  } catch {}
  try {
    const { data: p } = await sb.from("pi_users").select("*").eq("id", userId).maybeSingle();
    const role = normStr((p as any)?.user_role);
    const uname = normStr((p as any)?.pi_username || (p as any)?.username);
    if (role === "root_admin" || ROOT_ADMIN_USERNAMES.includes(uname)) return true;
  } catch {}
  return false;
}

export async function GET(req: Request) {
  try {
    const sb = getSupabaseAdminClient();
    const requesterId = await getAuthenticatedUserId(req);
    if (!requesterId) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });

    const masterRequesterId = isUuid(requesterId) ? requesterId : (await resolveMasterUserId(requesterId)) || requesterId;

    if (!(await isRootAdmin(sb, masterRequesterId))) {
      return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Chỉ Root Admin mới được tìm kiếm." }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ ok: true, users: [] });

    // Search user candidates from public.users and public.pi_users (best-effort).
    const qq = q.toLowerCase();
    const results: any[] = [];
    try {
      const { data: u1 } = await sb
        .from("users")
        .select("id,email,pi_username,username,user_role")
        .or(`email.ilike.%${qq}%,pi_username.ilike.%${qq}%,username.ilike.%${qq}%`)
        .limit(10);
      (u1 || []).forEach((r: any) => results.push(r));
    } catch {}

    try {
      const { data: p1 } = await sb
        .from("pi_users")
        .select("id,pi_username,username,user_role")
        .or(`pi_username.ilike.%${qq}%,username.ilike.%${qq}%`)
        .limit(10);
      (p1 || []).forEach((r: any) => results.push({ ...r, email: null }));
    } catch {}

    const seen = new Set<string>();
    const merged = results.filter((r: any) => {
      const id = String(r.id || "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const users = (merged || []).map((u: any) => ({
      id: String(u.id),
      label: u.pi_username || u.username || u.email || String(u.id),
      email: u.email || null,
      pi_username: u.pi_username || u.username || null,
      user_role: u.user_role || null,
    }));

    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json({ ok: false, code: "ERROR", message: String(e?.message || e) }, { status: 500 });
  }
}