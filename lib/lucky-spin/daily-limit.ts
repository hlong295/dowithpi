import "server-only";

type SupabaseAdmin = any;

function isoDate(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function getGlobalMaxSpins(admin: SupabaseAdmin): Promise<number> {
  const { data, error } = await admin
    .from("spin_daily_limits")
    .select("max_spins")
    .is("user_id", null)
    .is("limit_date", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const n = Number((data as any)?.max_spins ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function upsertGlobalMaxSpins(
  admin: SupabaseAdmin,
  maxSpins: number,
  updatedBy?: string | null,
) {
  const val = Math.min(Math.max(Number(maxSpins || 1), 1), 100);
  const payload: any = {
    user_id: null,
    limit_date: null,
    spins_used: 0,
    max_spins: val,
    updated_at: new Date().toISOString(),
  };
  if (updatedBy) payload.updated_by = updatedBy;

  // Upsert by unique global index; in Supabase, we can emulate with select+insert/update.
  const { data: existing, error: readErr } = await admin
    .from("spin_daily_limits")
    .select("id")
    .is("user_id", null)
    .is("limit_date", null)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (existing?.id) {
    const { error: updErr } = await admin
      .from("spin_daily_limits")
      .update(payload)
      .eq("id", existing.id);
    if (updErr) throw new Error(updErr.message);
    return;
  }
  const { error: insErr } = await admin.from("spin_daily_limits").insert(payload);
  if (insErr) throw new Error(insErr.message);
}

export async function getOrCreateUserDailyLimit(
  admin: SupabaseAdmin,
  userId: string,
): Promise<{ id: string; spins_used: number; max_spins: number; limit_date: string; last_spin_at: any }>
{
  const d = isoDate(new Date());
  const globalMax = await getGlobalMaxSpins(admin);

  const { data, error } = await admin
    .from("spin_daily_limits")
    .select("id,spins_used,max_spins,limit_date,last_spin_at")
    .eq("user_id", userId)
    .eq("limit_date", d)
    .maybeSingle();
  if (error && String(error.message || "").length) {
    // If row doesn't exist, Supabase returns null data without error when using maybeSingle.
    throw new Error(error.message);
  }
  if (data?.id) {
    return {
      id: String((data as any).id),
      spins_used: Number((data as any).spins_used ?? 0) || 0,
      max_spins: Number((data as any).max_spins ?? globalMax) || globalMax,
      limit_date: String((data as any).limit_date || d),
      last_spin_at: (data as any).last_spin_at ?? null,
    };
  }

  const payload: any = {
    user_id: userId,
    limit_date: d,
    spins_used: 0,
    max_spins: globalMax,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data: inserted, error: insErr } = await admin
    .from("spin_daily_limits")
    .insert(payload)
    .select("id,spins_used,max_spins,limit_date,last_spin_at")
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);
  if (!inserted?.id) {
    // In rare race conditions, another request may have created it.
    return await getOrCreateUserDailyLimit(admin, userId);
  }
  return {
    id: String((inserted as any).id),
    spins_used: Number((inserted as any).spins_used ?? 0) || 0,
    max_spins: Number((inserted as any).max_spins ?? globalMax) || globalMax,
    limit_date: String((inserted as any).limit_date || d),
    last_spin_at: (inserted as any).last_spin_at ?? null,
  };
}

export async function incrementUserDailySpin(
  admin: SupabaseAdmin,
  dailyId: string,
  nextUsed: number,
) {
  const payload: any = {
    spins_used: nextUsed,
    last_spin_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("spin_daily_limits").update(payload).eq("id", dailyId);
  if (error) throw new Error(error.message);
}
