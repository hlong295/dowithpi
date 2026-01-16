import { NextResponse } from "next/server";
import { getAuthenticatedUserIdWithName } from "@/lib/pitd/require-user";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sha256Hex, randomSeedHex } from "@/lib/lottery/crypto";
import { generatePitdAddress } from "@/lib/system-wallets";
import { insertPitdTransaction } from "@/lib/pitd/ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAdminOrRoot(sb: any, userId: string, requesterName?: string | null) {
  if (requesterName && requesterName.toLowerCase() === "hlong295") return true;
  const { data } = await sb.from("pi_users").select("user_role").eq("id", userId).maybeSingle();
  const role = (data?.user_role || "").toLowerCase();
  return role === "admin" || role === "root";
}

async function ensurePitdWallet(sb: any, userId: string) {
  const { data: wallet, error } = await sb
    .from("pitd_wallets")
    .select("id,user_id,balance,locked_balance,total_spent,address")
    .eq("user_id", userId)
    .maybeSingle();
  if (!error && wallet) return wallet;

  const address = generatePitdAddress("PITD", 24);
  const { data: created, error: insErr } = await sb
    .from("pitd_wallets")
    .insert({ user_id: userId, balance: 0, locked_balance: 0, total_spent: 0, address })
    .select("id,user_id,balance,locked_balance,total_spent,address")
    .single();
  if (insErr) throw insErr;
  return created;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const dbg = url.searchParams.get("dbg") === "1";
  let sb: ReturnType<typeof getSupabaseAdminClient>;
  try {
    sb = getSupabaseAdminClient();
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "SUPABASE_ADMIN_CLIENT_ERROR",
        message: e?.message || String(e),
        dbg: dbg ? { where: WHERE, raw: String(e) } : undefined,
      },
      { status: 500 }
    );
  }

  const auth = await getAuthenticatedUserIdWithName(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  // resolveMasterUserId returns { userId, created }
  const { userId: masterUserId } = await resolveMasterUserId(sb as any, auth.userId);
  const adminOk = await isAdminOrRoot(sb, masterUserId, auth.requesterName);
  if (!adminOk) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const eventId = body?.event_id as string | undefined;
  if (!eventId) return NextResponse.json({ ok: false, error: "MISSING_EVENT_ID" }, { status: 400 });

  try {
    // Basic throttle per admin
    const { count } = await sb
      .from("lottery_api_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", masterUserId)
      .eq("route", "admin_start_draw")
      .gte("created_at", new Date(Date.now() - 10_000).toISOString());
    if ((count || 0) >= 5) {
      return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
    }
    await sb.from("lottery_api_requests").insert({ user_id: masterUserId, route: "admin_start_draw" });

    const { data: event, error: eErr } = await sb.from("lottery_events").select("*").eq("id", eventId).maybeSingle();
    if (eErr) throw eErr;
    if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

    if (!["open", "closed", "drawing"].includes(event.status)) {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT_STATUS", status: event.status }, { status: 400 });
    }

    // Commit + reveal (single-step) for now
    const seedReveal = randomSeedHex(32);
    const seedHash = sha256Hex(seedReveal);

    // Store seed + mark drawing
    await sb.from("lottery_events").update({ status: "drawing", updated_at: new Date().toISOString() }).eq("id", eventId);
    await sb
      .from("lottery_draws")
      .upsert(
        {
          event_id: eventId,
          seed_hash: seedHash,
          seed_reveal: seedReveal,
          algorithm_version: "v1",
          draw_started_at: new Date().toISOString(),
        },
        { onConflict: "event_id" }
      );

    const { data: prizes, error: pErr } = await sb
      .from("lottery_prizes")
      .select("id,rank,prize_type,amount,label,is_active")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("rank", { ascending: true });
    if (pErr) throw pErr;

    const { data: entries, error: enErr } = await sb
      .from("lottery_entries")
      .select("id,user_id,chosen_number")
      .eq("event_id", eventId);
    if (enErr) throw enErr;
    if (!entries || entries.length === 0) {
      return NextResponse.json({ ok: false, error: "NO_ENTRIES" }, { status: 400 });
    }

    // Deterministic scoring
    const scored = entries
      .map((e: any) => {
        const score = sha256Hex(`${seedReveal}|${eventId}|${e.chosen_number}`);
        return { ...e, score };
      })
      .sort((a: any, b: any) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0));

    const winners: any[] = [];
    const usedUsers = new Set<string>();
    const usedNumbers = new Set<number>();

    for (const prize of prizes || []) {
      const pick = scored.find((s: any) => !usedUsers.has(s.user_id) && !usedNumbers.has(s.chosen_number));
      if (!pick) break;
      usedUsers.add(pick.user_id);
      usedNumbers.add(pick.chosen_number);

      let payoutStatus = "pending_contact";
      let pitdTxId: string | null = null;
      if ((prize.prize_type || "").toUpperCase() === "PITD") {
        // Auto-credit PITD via server
        const wallet = await ensurePitdWallet(sb, pick.user_id);
        const amount = Number(prize.amount || 0);
        if (amount > 0) {
          const newBalance = Number(wallet.balance || 0) + amount;
          const { error: uErr } = await sb.from("pitd_wallets").update({ balance: newBalance }).eq("id", wallet.id);
          if (uErr) throw uErr;

          const tx = await insertPitdTransaction(sb, {
            walletId: wallet.id,
            type: "lottery_reward",
            amount,
            balanceAfter: newBalance,
            referenceId: eventId,
            referenceType: "lottery_event",
            description: `Lottery reward rank ${prize.rank}`,
            metadata: { event_id: eventId, rank: prize.rank, chosen_number: pick.chosen_number },
          });
          pitdTxId = tx?.id || null;
        }
        payoutStatus = "auto_paid";
      }

      winners.push({
        event_id: eventId,
        rank: prize.rank,
        user_id: pick.user_id,
        chosen_number: pick.chosen_number,
        prize_type: prize.prize_type,
        amount: prize.amount,
        payout_status: payoutStatus,
        payout_ref: pitdTxId,
      });
    }

    if (winners.length === 0) return NextResponse.json({ ok: false, error: "NO_WINNERS" }, { status: 400 });

    // Insert winners (idempotent-ish)
    for (const w of winners) {
      await sb
        .from("lottery_winners")
        .upsert(
          {
            event_id: w.event_id,
            rank: w.rank,
            user_id: w.user_id,
            chosen_number: w.chosen_number,
            prize_type: w.prize_type,
            amount: w.amount,
            payout_status: w.payout_status,
            payout_ref: w.payout_ref,
          },
          { onConflict: "event_id,rank" }
        );
    }

    await sb
      .from("lottery_events")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", eventId);

    await sb
      .from("lottery_draws")
      .update({ draw_completed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return NextResponse.json({ ok: true, seed_hash: seedHash, seed_reveal: seedReveal, winners, dbg: dbg ? { admin: masterUserId } : undefined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "START_DRAW_ERROR" }, { status: 500 });
  }
}
