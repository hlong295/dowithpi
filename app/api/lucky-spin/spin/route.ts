export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/pitd/require-user";
import { checkRateLimit } from "@/lib/lucky-spin/rate-limit";
import { getOrCreateUserDailyLimit, incrementUserDailySpin } from "@/lib/lucky-spin/daily-limit";
import { pickReward } from "@/lib/lucky-spin/pick-reward";
import { creditPitdForSpin } from "@/lib/lucky-spin/pitd-credit";

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

function getIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    ""
  );
}

export async function POST(req: Request) {
  const dbg = wantsDbg(req);
  const requesterId = await getAuthenticatedUserId(req);
  if (!requesterId) return jsonErr(401, "UNAUTHORIZED");

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const idempotencyKey = String(body?.idempotency_key || body?.idempotencyKey || "").trim();
  if (!idempotencyKey) return jsonErr(400, "MISSING_IDEMPOTENCY_KEY");

  const clientFingerprint = String(body?.client_fingerprint || body?.clientFingerprint || "").trim() || null;

  // Rate-limit (best effort)
  const ip = getIp(req);
  const rlKey = `spin:${requesterId}:${ip || "noip"}`;
  const rl = checkRateLimit(rlKey, { windowMs: 10_000, max: 8 });
  if (!rl.ok) {
    return jsonErr(429, "RATE_LIMIT", dbg ? { resetAt: rl.resetAt } : undefined);
  }

  const admin = getSupabaseAdminClient();

  try {
    // Idempotency: if a log already exists for this (user, idempotency_key), return it.
    const { data: existing, error: exErr } = await admin
      .from("spin_logs")
      .select("*")
      .eq("user_id", requesterId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (exErr) {
      return jsonErr(500, "IDEMPOTENCY_LOOKUP_ERROR", dbg ? { message: exErr.message } : undefined);
    }
    if (existing?.id) {
      return jsonOk({ reused: true, log: existing });
    }

    // Daily limit
    const daily = await getOrCreateUserDailyLimit(admin, requesterId);
    if (daily.spins_used >= daily.max_spins) {
      return jsonErr(403, "DAILY_LIMIT_REACHED", {
        spins_used: daily.spins_used,
        max_spins: daily.max_spins,
      });
    }

    // Optional anti-refresh: block if last spin < 3 seconds
    if (daily.last_spin_at) {
      const last = new Date(String(daily.last_spin_at)).getTime();
      if (Number.isFinite(last) && Date.now() - last < 3000) {
        return jsonErr(429, "TOO_FAST", { hint: "wait_a_moment" });
      }
    }

    // Load rewards
    const { data: rewards, error: rErr } = await admin
      .from("spin_rewards")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (rErr) return jsonErr(500, "FAILED_TO_LOAD_REWARDS", dbg ? { message: rErr.message } : undefined);

    const reward = pickReward(Array.isArray(rewards) ? (rewards as any) : []);
    if (!reward) return jsonErr(500, "NO_ACTIVE_REWARDS");

    // Create log row first (idempotency key is unique)
    const baseLog: any = {
      user_id: requesterId,
      reward_id: reward.id,
      reward_snapshot: reward,
      status: "created",
      pitd_amount: reward.reward_type === "PITD" ? reward.pitd_amount ?? null : null,
      pi_amount: reward.reward_type === "PI" ? reward.pi_amount ?? null : null,
      idempotency_key: idempotencyKey,
      client_fingerprint: clientFingerprint,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await admin
      .from("spin_logs")
      .insert(baseLog)
      .select("*")
      .maybeSingle();

    if (insErr) {
      // If a race created it, return the existing one
      const msg = String(insErr.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        const { data: again } = await admin
          .from("spin_logs")
          .select("*")
          .eq("user_id", requesterId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (again?.id) return jsonOk({ reused: true, log: again });
      }
      return jsonErr(500, "FAILED_TO_CREATE_LOG", dbg ? { message: insErr.message } : undefined);
    }

    const logId = String((inserted as any)?.id);

    // Apply reward
    let finalStatus: string = "none";
    let applied: any = null;
    const rt = String((reward as any).reward_type || "").toUpperCase();

    if (rt === "PITD") {
      const amt = (reward as any).pitd_amount ?? 0;
      const credit = await creditPitdForSpin(admin, requesterId, amt, {
        referenceId: logId,
        rewardTitle: (reward as any).title,
        metadata: { source: "lucky_spin" },
      });
      finalStatus = "applied";
      applied = { kind: "PITD", amount: credit.amount, new_balance: credit.newBalance };
    } else if (rt === "PI") {
      finalStatus = "pending_contact";
      applied = { kind: "PI", amount: Number((reward as any).pi_amount ?? 0) || 0 };
    } else if (rt === "VOUCHER") {
      finalStatus = "pending_contact";
      applied = { kind: "VOUCHER", label: (reward as any).voucher_label ?? "" };
    } else {
      finalStatus = "none";
      applied = { kind: "NONE" };
    }

    // Update log status
    const { data: updated, error: upErr } = await admin
      .from("spin_logs")
      .update({ status: finalStatus })
      .eq("id", logId)
      .select("*")
      .maybeSingle();
    if (upErr) {
      return jsonErr(500, "FAILED_TO_UPDATE_LOG", dbg ? { message: upErr.message, logId } : undefined);
    }

    // Increment daily usage last (best effort)
    await incrementUserDailySpin(admin, daily.id, daily.spins_used + 1);

    return jsonOk({
      reused: false,
      applied,
      log: updated || inserted,
      spins_used: daily.spins_used + 1,
      max_spins: daily.max_spins,
      ...(dbg ? { dbg: { rl_remaining: rl.remaining, ip: ip || null } } : {}),
    });
  } catch (e: any) {
    return jsonErr(500, "SPIN_ERROR", dbg ? { message: e?.message || String(e) } : undefined);
  }
}
