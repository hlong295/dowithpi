import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";

// P5.1 — Profile summary (server-only)
// - Do NOT change login flow.
// - Accept x-user-id / x-pi-user-id from client (Pi & Email flows).
// - Use service role to read public tables (RLS-safe).

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request) {
  const supabase = getSupabaseAdminClient();

  const headerUserId = (req.headers.get("x-user-id") || req.headers.get("x-userid") || "").trim();
  const headerPiUserId = (req.headers.get("x-pi-user-id") || "").trim();
  const candidate = headerUserId || headerPiUserId;

  const dbg: any = {
    ok: false,
    mode: "",
    candidate: candidate ? String(candidate).slice(0, 36) : "",
  };

  if (!candidate) {
    dbg.mode = "no-headers";
    return NextResponse.json({ ok: true, loggedIn: false, debug: dbg });
  }

  // Resolve to master user id (public.users.id). In current baseline, users.id is master.
  let userId: string | null = null;
  try {
    if (isUuid(candidate)) {
      const r = await resolveMasterUserId(supabase, candidate);
      userId = r.userId || candidate;
      dbg.mode = r.userId ? "resolved" : "uuid";
    } else {
      // Non-uuid: try to resolve by pi_username or pi_uid
      const { data: pu } = await supabase
        .from("pi_users")
        .select("id")
        .or(`pi_username.ilike.${candidate},pi_uid.eq.${candidate}`)
        .maybeSingle();
      if (pu?.id) {
        const r = await resolveMasterUserId(supabase, pu.id);
        userId = r.userId || pu.id;
        dbg.mode = "pi_lookup";
      }
    }
  } catch (e: any) {
    dbg.mode = "resolve_failed";
    dbg.error = String(e?.message || e);
  }

  if (!userId) {
    dbg.mode = dbg.mode || "unresolved";
    return NextResponse.json({ ok: true, loggedIn: false, debug: dbg });
  }

  // 1) Base profile info (pi_users)
  const { data: piUser, error: puErr } = await supabase
    .from("pi_users")
    .select(
      [
        "id",
        "pi_username",
        "pi_uid",
        "full_name",
        "user_role",
        "verification_status",
        "provider_approved",
        "provider_business_name",
        "provider_description",
        "created_at",
      ].join(",")
    )
    .eq("id", userId)
    .maybeSingle();

  // 2) PITD wallet summary
  const { data: wallet, error: wErr } = await supabase
    .from("pitd_wallets")
    .select("id,user_id,balance,locked_balance,total_spent,address,created_at,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  // 3) Optional stats (keep minimal; best-effort)
  let productsCount: number | null = null;
  let reviewsCount: number | null = null;
  try {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", userId);
    if (typeof count === "number") productsCount = count;
  } catch {
    // ignore
  }
  try {
    const { count } = await supabase
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (typeof count === "number") reviewsCount = count;
  } catch {
    // ignore
  }

  // Derive totals without relying on non-existent columns.
  const bal = wallet ? Number((wallet as any).balance || 0) : 0;
  const locked = wallet ? Number((wallet as any).locked_balance || 0) : 0;
  const spent = wallet ? Number((wallet as any).total_spent || 0) : 0;
  const totalBalance = bal + locked;
  const totalEarned = totalBalance + spent;

  dbg.ok = true;
  dbg.userId = userId;
  if (puErr) dbg.piUserError = puErr.message;
  if (wErr) dbg.walletError = wErr.message;

  return NextResponse.json({
    ok: true,
    loggedIn: true,
    userId,
    profile: piUser || null,
    wallet: wallet
      ? {
          ...(wallet as any),
          balance: bal,
          locked_balance: locked,
          total_spent: spent,
          total_balance: totalBalance,
          total_earned: totalEarned,
        }
      : null,
    stats: {
      productsCount,
      reviewsCount,
    },
    debug: dbg,
  });
}
