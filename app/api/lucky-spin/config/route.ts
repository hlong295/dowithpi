export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId, requireAdmin } from "@/lib/pitd/require-user";
import { getGlobalMaxSpins, upsertGlobalMaxSpins } from "@/lib/lucky-spin/daily-limit";

function jsonOk(data: any, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

function jsonErr(status: number, error: string, extra?: any) {
  return NextResponse.json({ ok: false, error, ...(extra ? { extra } : {}) }, { status });
}

function wantsDbg(req: Request) {
  try {
    const u = new URL(req.url);
    return u.searchParams.get("dbg") === "1";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const dbg = wantsDbg(req);
  const admin = getSupabaseAdminClient();
  let requesterId: string | null = null;
  try {
    requesterId = await getAuthenticatedUserId(req);
  } catch {
    requesterId = null;
  }

  let canManage = false;
  if (requesterId) {
    try {
      await requireAdmin(requesterId);
      canManage = true;
    } catch {
      canManage = false;
    }
  }

  try {
    const { data: rewards, error: rErr } = await admin
      .from("spin_rewards")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (rErr) return jsonErr(500, "FAILED_TO_LOAD_REWARDS", dbg ? { message: rErr.message } : undefined);

    const maxSpins = await getGlobalMaxSpins(admin);

    // Public payload: still includes rewards (needed to render wheel), but no sensitive admin-only bits.
    return jsonOk(
      {
        can_manage: canManage,
        max_spins_per_day: maxSpins,
        rewards: Array.isArray(rewards) ? rewards : [],
        requester_id: dbg ? requesterId : undefined,
      },
      200,
    );
  } catch (e: any) {
    return jsonErr(500, "CONFIG_ERROR", dbg ? { message: e?.message || String(e) } : undefined);
  }
}

export async function POST(req: Request) {
  const dbg = wantsDbg(req);
  const requesterId = await getAuthenticatedUserId(req);
  if (!requesterId) return jsonErr(401, "UNAUTHORIZED", dbg ? { hint: "missing user" } : undefined);

  try {
    await requireAdmin(requesterId);
  } catch (e: any) {
    return jsonErr(403, "FORBIDDEN_NOT_ADMIN", dbg ? { message: e?.message || String(e) } : undefined);
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") return jsonErr(400, "INVALID_JSON");

  const admin = getSupabaseAdminClient();
  const maxSpins = Number(body?.max_spins_per_day ?? body?.maxSpins ?? 1);
  const rewards = Array.isArray(body?.rewards) ? body.rewards : [];

  try {
    await upsertGlobalMaxSpins(admin, maxSpins, requesterId);

    // Upsert rewards (by id when provided; else insert new)
    // Keep schema-tolerant: only use known columns.
    const upserts: any[] = [];
    for (const r of rewards) {
      if (!r) continue;
      const payload: any = {
        id: r.id || undefined,
        title: String(r.title ?? r.label ?? "").trim() || "(no title)",
        reward_type: String(r.reward_type ?? r.type ?? "PITD").trim() || "PITD",
        pitd_amount: r.pitd_amount ?? null,
        pi_amount: r.pi_amount ?? null,
        voucher_label: r.voucher_label ?? null,
        weight: r.weight ?? 1,
        is_active: r.is_active !== false,
        display_order: Number(r.display_order ?? 0) || 0,
        meta: r.meta ?? null,
        updated_at: new Date().toISOString(),
      };
      if (!payload.id) delete payload.id;
      upserts.push(payload);
    }

    if (upserts.length > 0) {
      const { error: upErr } = await admin.from("spin_rewards").upsert(upserts, { onConflict: "id" });
      if (upErr) return jsonErr(500, "FAILED_TO_SAVE_REWARDS", dbg ? { message: upErr.message } : undefined);
    }

    return jsonOk({ saved: true });
  } catch (e: any) {
    return jsonErr(500, "SAVE_CONFIG_ERROR", dbg ? { message: e?.message || String(e) } : undefined);
  }
}
