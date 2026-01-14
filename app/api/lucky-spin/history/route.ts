export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";

function jsonOk(data: any, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

function jsonErr(status: number, error: string, extra?: any) {
  return NextResponse.json({ ok: false, error, ...(extra ? { extra } : {}) }, { status });
}

export async function GET(req: Request) {
  const requesterId = await getAuthenticatedUserId(req);
  if (!requesterId) return jsonErr(401, "UNAUTHORIZED");

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("spin_logs")
    .select("*")
    .eq("user_id", requesterId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return jsonErr(500, "HISTORY_ERROR", { message: error.message });
  return jsonOk({ logs: Array.isArray(data) ? data : [] });
}
