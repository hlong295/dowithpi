import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireRootAdmin } from "@/lib/admin/require-root";
import { writeAuditLog } from "@/lib/admin/audit";
import { applyTsbTransaction } from "@/lib/tsb/engine";

export async function POST(req: Request) {
  const root = await requireRootAdmin(req);
  if (!root.ok) {
    return NextResponse.json({ error: root.error, detail: root.detail }, { status: root.status });
  }

  const body = (await req.json().catch(() => ({}))) as { tx_id?: string };
  const txId = (body?.tx_id || "").trim();
  if (!txId) {
    return NextResponse.json({ error: "MISSING_TX_ID" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Find the original tx + profile
  const { data: tx, error: txErr } = await admin
    .from("tsb_transactions")
    .select("id, wallet_id, amount")
    .eq("id", txId)
    .maybeSingle();

  if (txErr) {
    return NextResponse.json({ error: "TX_LOOKUP_FAILED", detail: txErr.message }, { status: 500 });
  }
  if (!tx?.id) {
    return NextResponse.json({ error: "TX_NOT_FOUND" }, { status: 404 });
  }

  const { data: wallet, error: wErr } = await admin
    .from("tsb_wallets")
    .select("profile_id")
    .eq("id", tx.wallet_id)
    .maybeSingle();

  if (wErr) {
    return NextResponse.json({ error: "WALLET_LOOKUP_FAILED", detail: wErr.message }, { status: 500 });
  }
  if (!wallet?.profile_id) {
    return NextResponse.json({ error: "WALLET_PROFILE_NOT_FOUND" }, { status: 500 });
  }

  // Compensating transaction
  try {
    const result = await applyTsbTransaction({
      profile_id: wallet.profile_id,
      amount: Number(tx.amount) * -1,
      type: "rollback",
      reference_type: "rollback_of",
      reference_id: tx.id,
      metadata: { by: root.userId },
    });

    await writeAuditLog({
      actorId: root.userId,
      action: "admin.ledger.rollback",
      target: { type: "tsb_transactions", id: tx.id },
      meta: { compensating: result },
    }).catch(() => null);

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: "ROLLBACK_FAILED", detail: e?.message || String(e) }, { status: 500 });
  }
}
