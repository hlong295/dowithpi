import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/lottery/auth";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { requireUserExists } from "@/lib/pitd/require-user";
import { ALL_MISSION_KEYS, MISSION_CATALOG } from "@/lib/missions/catalog";
import { insertPitdTransaction, updateWalletBalance } from "@/lib/pitd/ledger";

export const dynamic = "force-dynamic";

function todayKey(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type DailyMissionConfigItem = { key: string; reward_pitd: number };

async function getConfigForDay(admin: any, day: string) {
  const { data, error } = await admin
    .from("daily_mission_configs")
    .select("missions")
    .eq("mission_date", day)
    .maybeSingle();

  if (error) {
    const msg = String(error?.message || "");
    // Treat missing table as "no config".
    if (msg.toLowerCase().includes("does not exist")) return null;
    throw error;
  }
  return data?.missions ?? null;
}

function normalizeConfig(raw: any): DailyMissionConfigItem[] {
  const fallback: DailyMissionConfigItem[] = ALL_MISSION_KEYS.map((k) => ({
    key: String(k),
    reward_pitd: Number((MISSION_CATALOG as any)[k]?.default_reward_pitd ?? 0) || 0,
  }));

  if (!Array.isArray(raw)) return fallback;

  const out: DailyMissionConfigItem[] = [];
  for (const item of raw) {
    const key = String(item?.key ?? item?.mission_key ?? "").trim();
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(MISSION_CATALOG, key)) continue;
    const reward = Number(item?.reward_pitd ?? item?.reward ?? item?.amount ?? 0);
    out.push({ key, reward_pitd: Number.isFinite(reward) ? reward : 0 });
  }
  return out.length ? out : fallback;
}

async function hasReviewToday(admin: any, userId: string, day: string) {
  // Use UTC day boundaries to match todayKey() which is UTC-based.
  const start = new Date(`${day}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  // Prefer product_reviews if present, fallback to reviews.
  const tables = ["product_reviews", "reviews"]
  for (const table of tables) {
    const { count, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())

    if (error) {
      const msg = String(error?.message || "")
      // If table does not exist, try next.
      if (msg.toLowerCase().includes("does not exist")) continue
      throw new Error(`REVIEW_CHECK_FAILED(${table}): ${msg}`)
    }
    if (typeof count === "number" && count > 0) return true
  }
  // No table found or no rows today.
  return false
}

async function ensureWallet(admin: any, userId: string) {
  const { data: wallet, error } = await admin
    .from("pitd_wallets")
    .select("id,balance,locked_balance,total_spent")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`WALLET_LOOKUP_FAILED: ${error.message}`);
  if (wallet?.id) return wallet;

  const { data: created, error: cErr } = await admin
    .from("pitd_wallets")
    .insert({
      user_id: userId,
      balance: 0,
      locked_balance: 0,
      total_spent: 0,
      address: `PITD-${String(userId).slice(0, 8)}`,
    })
    .select("id,balance,locked_balance,total_spent")
    .single();
  if (cErr) throw new Error(`WALLET_CREATE_FAILED: ${cErr.message}`);
  return created;
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdminClient();

    const u = await getUserFromRequest(req);
    if (!u || !u.userId) {
      return NextResponse.json(
        { error: "NOT_LOGGED_IN", detail: "Missing authenticated user id" },
        { status: 401 },
      );
    }

    // Defensive: ensure user exists (and also gives nicer errors on broken ids)
    await requireUserExists(u.userId);

    const resolved = await resolveMasterUserId(
      admin,
      u.userId,
      null,
      u.piUsername ?? null,
    );

    const body = await req.json().catch(() => ({}));
    const missionKey = String(body?.mission_key ?? "").trim();
    if (!missionKey) {
      return NextResponse.json({ error: "INVALID_MISSION" }, { status: 400 });
    }
    if (!Object.prototype.hasOwnProperty.call(MISSION_CATALOG, missionKey)) {
      return NextResponse.json({ error: "INVALID_MISSION" }, { status: 400 });
    }

    const day = todayKey();
    const rawConfig = await getConfigForDay(admin, day);
    const config = normalizeConfig(rawConfig);

    const cfgItem = config.find((x) => x.key === missionKey);
    if (!cfgItem) {
      return NextResponse.json({ error: "MISSION_NOT_ENABLED_TODAY" }, { status: 400 });
    }

    // Eligibility guard: product review mission requires at least one review today.
    if (missionKey === "product_review") {
      const ok = await hasReviewToday(admin, resolved.userId, day)
      if (!ok) {
        return NextResponse.json(
          { error: "REVIEW_REQUIRED", detail: "Bạn cần đánh giá ít nhất 1 sản phẩm hôm nay trước khi nhận PITD." },
          { status: 400 },
        )
      }
    }

    // Bonus eligibility guard
    if (missionKey === "bonus_all") {
      const requiredKeys = config
        .map((c) => c.key)
        .filter((k) => k !== "bonus_all");
      const { data: claims, error: cErr } = await admin
        .from("user_mission_claims")
        .select("mission_key")
        .eq("user_id", resolved.userId)
        .eq("claim_date", day);
      if (cErr) {
        return NextResponse.json(
          { error: "MISSION_CLAIMS_LOAD_FAILED", detail: cErr.message },
          { status: 500 },
        );
      }
      const claimed = new Set((claims ?? []).map((x: any) => x.mission_key));
      const ok = requiredKeys.every((k) => claimed.has(k));
      if (!ok) {
        return NextResponse.json({ error: "BONUS_NOT_ELIGIBLE" }, { status: 400 });
      }
    }

    // Ensure wallet exists first so we can always return balance.
    const wallet = await ensureWallet(admin, resolved.userId);
    const currentBalance = Number(wallet?.balance ?? 0) || 0;

    // Anti-abuse: one claim per mission per day.
    const { data: claimRow, error: claimErr } = await admin
      .from("user_mission_claims")
      .insert({
        user_id: resolved.userId,
        mission_key: missionKey,
        claim_date: day,
      })
      .select("id")
      .maybeSingle();

    if (claimErr) {
      if ((claimErr as any)?.code === "23505") {
        return NextResponse.json(
          {
            ok: true,
            already_claimed: true,
            mission_key: missionKey,
            day,
            wallet_balance: currentBalance,
          },
          { status: 200 },
        );
      }
      return NextResponse.json(
        { error: "MISSION_CLAIM_FAILED", detail: claimErr.message },
        { status: 500 },
      );
    }

    const reward = Number(cfgItem.reward_pitd ?? 0) || 0;
    if (reward <= 0) {
      // Still considered claimed; no ledger insert.
      return NextResponse.json(
        {
          ok: true,
          mission_key: missionKey,
          day,
          reward_pitd: 0,
          wallet_balance: currentBalance,
        },
        { status: 200 },
      );
    }

    const newBalance = Math.round((currentBalance + reward) * 1_000_000) / 1_000_000;
    const updatedWallet = await updateWalletBalance(admin, wallet.id, newBalance);

    const refId = `${day}:${missionKey}`;
    const tx = await insertPitdTransaction(admin, {
      wallet_id: wallet.id,
      transaction_type: "earn",
      amount: reward,
      balance_after: newBalance,
      reference_type: "mission",
      reference_id: refId,
      description: `Mission reward: ${missionKey}`,
      metadata: { mission_key: missionKey, day, source: "missions" },
    });

    // Best-effort: link tx back to claim row
    if (tx?.id && claimRow?.id) {
      await admin
        .from("user_mission_claims")
        .update({ pitd_tx_id: tx.id })
        .eq("id", claimRow.id);
    }

    return NextResponse.json(
      {
        ok: true,
        mission_key: missionKey,
        day,
        reward_pitd: reward,
        wallet_balance: Number((updatedWallet as any)?.balance ?? newBalance) || newBalance,
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "MISSION_CLAIM_FAILED", detail: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
