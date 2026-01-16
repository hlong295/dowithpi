import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// IMPORTANT:
// - Public lottery reads (event, prizes, history) must NOT require service role.
// - Some deployments (eg. PiNet) do not provide SUPABASE_SERVICE_ROLE_KEY.

function getLotteryReadClient(): SupabaseClient {
  // Use ANON for public read paths. This is safe because data is read-only.
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Admin client for privileged write operations.
 * Note: This will throw if service role is not configured.
 */
export function getLotteryAdminClient(): SupabaseClient {
  return getSupabaseAdminClient();
}

// Backwards-compatible export names (used by some API routes)
export function getLotterySupabaseAdmin(): SupabaseClient {
  return getLotteryAdminClient();
}

export async function fetchCurrentLotteryEvent() {
  const sb = getLotteryReadClient();
  const { data, error } = await sb
    .from("lottery_events")
    .select("*")
    .in("status", ["open", "closed", "drawing", "completed"])
    .order("open_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function fetchEventPrizes(eventId: string) {
  const sb = getLotteryReadClient();
  const { data, error } = await sb
    .from("lottery_prizes")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_active", true)
    .order("rank", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEventParticipantCount(eventId: string) {
  const sb = getLotteryReadClient();
  const { count, error } = await sb
    .from("lottery_entries")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchMyEntry(eventId: string, userId: string) {
  // This query may be protected by RLS in the future. For now we read with ANON,
  // but we only ever call this when the client provides requesterId.
  const sb = getLotteryReadClient();
  const { data, error } = await sb
    .from("lottery_entries")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchHistory(limit = 20) {
  const sb = getLotteryReadClient();
  const { data, error } = await sb
    .from("lottery_events")
    .select("*")
    .eq("status", "completed")
    .order("draw_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// History items for a specific event (used by /api/lottery/history)
// We return winner rows if the table exists; otherwise fall back to entries.
export async function fetchHistoryForEvent(eventId: string) {
  const sb = getLotteryReadClient();

  // Prefer winners table when available.
  try {
    const { data, error } = await sb
      .from("lottery_winners")
      .select("id,rank,user_id,prize_type,amount,payout_status,created_at,updated_at")
      .eq("event_id", eventId)
      .order("rank", { ascending: true });
    if (!error) return data ?? [];
  } catch {
    // ignore
  }

  // Fallback: show registrations/entries summary (best-effort)
  const { data, error } = await sb
    .from("lottery_entries")
    .select("id,user_id,chosen_number,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
