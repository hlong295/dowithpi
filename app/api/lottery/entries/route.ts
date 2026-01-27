import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedUserIdWithName } from "@/lib/pitd/require-user";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id") || "";
  if (!eventId) return json(400, { ok: false, error: "MISSING_EVENT_ID" });

  // Only logged-in users can view the list (both member and admin).
  try {
    await getAuthenticatedUserIdWithName(req);
  } catch {
    return json(401, { ok: false, error: "UNAUTHORIZED" });
  }

  let sb: any;
  try {
    sb = getSupabaseAdminClient();
  } catch {
    const authz = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: authz ? { headers: { Authorization: authz } } : undefined,
    });
  }

  // Fetch entries
  const { data: rows, error } = await sb
    .from("lottery_entries")
    .select("user_id,chosen_number,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) return json(500, { ok: false, error: error.message });
  const entries = Array.isArray(rows) ? rows : [];

  // Build display names
  const userIds = Array.from(new Set(entries.map((e: any) => String(e.user_id || "")).filter(Boolean)));
  const displayById: Record<string, string> = {};

  if (userIds.length) {
    try {
      const { data: piUsers } = await sb
        .from("pi_users")
        .select("id,pi_username")
        .in("id", userIds);
      (piUsers || []).forEach((r: any) => {
        if (r?.id && r?.pi_username) displayById[String(r.id)] = String(r.pi_username);
      });
    } catch {
      // ignore
    }

    try {
      const { data: users } = await sb.from("users").select("id,email").in("id", userIds);
      (users || []).forEach((r: any) => {
        if (r?.id && r?.email && !displayById[String(r.id)]) displayById[String(r.id)] = String(r.email);
      });
    } catch {
      // ignore
    }
  }

  const out = entries.map((e: any) => {
    const uid = String(e.user_id || "");
    const display = displayById[uid] || (uid ? `${uid.slice(0, 8)}...` : "");
    return {
      user_id: uid,
      chosen_number: Number(e.chosen_number),
      created_at: e.created_at,
      user_display: display,
    };
  });

  return json(200, { ok: true, entries: out });
}
