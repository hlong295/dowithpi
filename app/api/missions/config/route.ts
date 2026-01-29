import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/lottery/auth";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { requireAdmin } from "@/lib/pitd/require-user";
import { ALL_MISSION_KEYS, MISSION_CATALOG } from "@/lib/missions/catalog";

export const dynamic = "force-dynamic";

function todayKey(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isDateKey(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export async function POST(req: Request) {
  try {
    const admin = getSupabaseAdminClient();

    const u = await getUserFromRequest(req);
    if (!u || !u.userId) {
      return NextResponse.json({ error: "NOT_LOGGED_IN" }, { status: 401 });
    }

    const resolved = await resolveMasterUserId(
      admin,
      u.userId,
      null,
      u.piUsername ?? null,
    );

    await requireAdmin(resolved.userId);

    const body = await req.json().catch(() => ({}));
    const day = isDateKey(String(body?.day || "")) ? String(body.day) : todayKey();

    const raw = Array.isArray(body?.missions) ? body.missions : [];
    const missions: Array<{ key: string; reward_pitd: number }> = [];

    for (const item of raw) {
      const key = String(item?.key || "").trim();
      if (!key) continue;
      if (!Object.prototype.hasOwnProperty.call(MISSION_CATALOG, key)) continue;

      const enabled = Boolean(item?.enabled);
      if (!enabled) continue;

      const rewardRaw = item?.reward_pitd ?? item?.reward ?? (MISSION_CATALOG as any)[key]?.default_reward_pitd ?? 0;
      const reward = Number(rewardRaw);
      missions.push({
        key,
        reward_pitd: Number.isFinite(reward) ? Math.max(0, Math.round(reward * 1_000_000) / 1_000_000) : 0,
      });
    }

    // If admin disables everything, we still store an empty list.
    // Daily GET will then fallback to defaults.
    const payload = {
      mission_date: day,
      missions,
      updated_by: resolved.userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin
      .from("daily_mission_configs")
      .upsert(payload, { onConflict: "mission_date" });
    if (error) {
      return NextResponse.json({ error: "MISSION_CONFIG_SAVE_FAILED", detail: error.message }, { status: 500 });
    }

    // Return a normalized full view for UI re-sync.
    const all = ALL_MISSION_KEYS.map((k) => {
      const found = missions.find((x) => x.key === k);
      return {
        key: String(k),
        enabled: Boolean(found),
        reward_pitd: found ? found.reward_pitd : Number((MISSION_CATALOG as any)[k]?.default_reward_pitd ?? 0) || 0,
      };
    });

    return NextResponse.json({ ok: true, day, missions: all });
  } catch (e: any) {
    return NextResponse.json({ error: "MISSION_CONFIG_SAVE_FAILED", detail: e?.message ?? String(e) }, { status: 500 });
  }
}
