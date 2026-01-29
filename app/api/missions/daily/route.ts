import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/lottery/auth";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { requireAdmin } from "@/lib/pitd/require-user";
import { ALL_MISSION_KEYS, MISSION_CATALOG } from "@/lib/missions/catalog";

export const dynamic = "force-dynamic";

function todayKey(d = new Date()) {
  // YYYY-MM-DD in UTC to avoid timezone abuse
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type DailyMissionConfigItem = {
  key: string;
  reward_pitd: number;
};

async function getConfigForDay(admin: ReturnType<typeof getSupabaseAdminClient>, day: string) {
  // Table might not exist yet; treat as "not configured".
  const { data, error } = await admin
    .from("daily_mission_configs")
    .select("missions")
    .eq("mission_date", day)
    .maybeSingle();

  if (error) {
    const msg = String(error?.message || "");
    const missing = msg.toLowerCase().includes("does not exist");
    if (!missing) throw error;
    return null;
  }
  return data?.missions ?? null;
}

function normalizeConfig(raw: any): DailyMissionConfigItem[] {
  const fallback = ALL_MISSION_KEYS.map((k) => ({
    key: k,
    reward_pitd: Number(MISSION_CATALOG[k].default_reward_pitd || 0),
  }));

  if (!Array.isArray(raw)) return fallback;

  const out: DailyMissionConfigItem[] = [];
  for (const item of raw) {
    const key = String(item?.key || item?.mission_key || "");
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(MISSION_CATALOG, key)) continue;
    const reward = Number(item?.reward_pitd ?? item?.reward ?? item?.amount ?? MISSION_CATALOG[key as keyof typeof MISSION_CATALOG].default_reward_pitd ?? 0);
    out.push({ key, reward_pitd: Number.isFinite(reward) ? reward : 0 });
  }

  // If admin configured nothing (empty list), fallback to default.
  return out.length ? out : fallback;
}

export async function GET(req: Request) {
  try {
    const admin = getSupabaseAdminClient();
    const u = await getUserFromRequest(req);

    // Missions require an authenticated internal user id (uuid) so we can
    // safely read/write PITD and claim ledgers server-side.
    if (!u || !u.userId) {
      return NextResponse.json({ ok: true, logged_in: false });
    }

    const resolved = await resolveMasterUserId(
      admin,
      u.userId,
      null,
      u.piUsername ?? null,
    );

    const day = todayKey();

    const rawConfig = await getConfigForDay(admin, day);
    const config = normalizeConfig(rawConfig);

    // Read claims
    const { data: claims, error: claimsErr } = await admin
      .from("user_mission_claims")
      .select("mission_key")
      .eq("user_id", resolved.userId)
      .eq("claim_date", day);
    if (claimsErr) {
      return NextResponse.json(
        { error: "MISSIONS_LOAD_FAILED", detail: claimsErr.message },
        { status: 500 },
      );
    }
    const claimed = new Set((claims ?? []).map((c: any) => c.mission_key));

    // Wallet snapshot (server-only, but safe to show balance)
    const { data: wallet, error: wErr } = await admin
      .from("pitd_wallets")
      .select("balance")
      .eq("user_id", resolved.userId)
      .maybeSingle();
    if (wErr) {
      return NextResponse.json(
        { error: "MISSIONS_WALLET_LOAD_FAILED", detail: wErr.message },
        { status: 500 },
      );
    }

    const wallet_balance = Number(wallet?.balance ?? 0) || 0;

    const missions = config.map((m) => {
      const cat = MISSION_CATALOG[m.key as keyof typeof MISSION_CATALOG];
      return {
        key: m.key,
        title: cat.title,
        description: cat.description,
        kind: cat.kind,
        reward_pitd: Number(m.reward_pitd ?? 0) || 0,
        completed: claimed.has(m.key),
      };
    });

    let admin_config: any = null;
    try {
      // Only include config editor state when user is admin
      await requireAdmin(resolved.userId);
      const all = ALL_MISSION_KEYS.map((k) => {
        const found = config.find((x) => x.key === k);
        return {
          key: k,
          enabled: Boolean(found),
          reward_pitd: found ? found.reward_pitd : Number(MISSION_CATALOG[k].default_reward_pitd || 0),
        };
      });
      admin_config = { day, missions: all };
    } catch {
      admin_config = null;
    }

    return NextResponse.json({
      ok: true,
      logged_in: true,
      day,
      wallet_balance,
      missions,
      claimed: Array.from(claimed),
      admin_config,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "MISSIONS_LOAD_FAILED", detail: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
