import { NextRequest } from "next/server";
import { errJson, okJson } from "@/lib/api/json";
import { authenticateAdmin } from "@/lib/pitd/authenticate-admin";
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user";
import { adminSupabase } from "@/lib/pitd/admin-supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await authenticateAdmin(req);
  if (!admin.ok) return errJson(admin.status, admin.error, admin.debug);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return errJson(400, "Missing userId");

  // A1: public.users is master. Resolve candidate into a master users.id
  let masterUserId = userId;
  try {
    const resolved = await resolveMasterUserId(adminSupabase as any, userId);
    masterUserId = (resolved as any).userId || userId;
  } catch (e: any) {
    // Best-effort: don't hard-fail wallet read
    masterUserId = userId;
  }

  const { data: wallet, error } = await adminSupabase
    .from("pitd_wallets")
    .select("id, user_id, balance, locked_balance, total_spent, address, created_at, updated_at")
    .eq("user_id", masterUserId)
    .maybeSingle();

  if (error) return errJson(500, "DB error", { error: error.message });

  return okJson({
    wallet: wallet
      ? {
          ...wallet,
          total_balance: Number(wallet.balance ?? 0) + Number(wallet.locked_balance ?? 0),
        }
      : null,
  });
}

function makePitdAddress(): string {
  // Required format: "PITD" + 20 random chars (A-Za-z0-9) => 24 total.
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const n = 20;
  let out = "";
  // Node runtime: use crypto when available.
  try {
    const { randomBytes } = require("crypto");
    const buf: Buffer = randomBytes(n);
    for (let i = 0; i < n; i++) out += chars[buf[i] % chars.length];
  } catch {
    for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PITD${out}`;
}

export async function POST(req: NextRequest) {
  const admin = await authenticateAdmin(req);
  if (!admin.ok) return errJson(admin.status, admin.error, admin.debug);

  const body: any = await req.json().catch(() => ({}));
  const targetUserId = String(body?.targetUserId || "").trim();
  if (!targetUserId) return errJson(400, "Missing targetUserId");

  // Resolve into a master users.id
  let masterUserId = targetUserId;
  try {
    const resolved = await resolveMasterUserId(adminSupabase as any, targetUserId);
    masterUserId = (resolved as any).userId || targetUserId;
  } catch {
    masterUserId = targetUserId;
  }

  // Create wallet only if missing.
  const { data: existing, error: readErr } = await adminSupabase
    .from("pitd_wallets")
    .select("id, user_id, balance, locked_balance, total_spent, address, created_at, updated_at")
    .eq("user_id", masterUserId)
    .maybeSingle();

  if (readErr) return errJson(500, "DB error", { error: readErr.message });
  if (existing?.id) {
    return okJson({ wallet: { ...existing, total_balance: Number(existing.balance ?? 0) + Number(existing.locked_balance ?? 0) }, created: false });
  }

  const address = makePitdAddress();
  const { data: created, error: createErr } = await adminSupabase
    .from("pitd_wallets")
    .insert({ user_id: masterUserId, balance: 0, locked_balance: 0, total_spent: 0, address })
    .select("id, user_id, balance, locked_balance, total_spent, address, created_at, updated_at")
    .single();

  if (createErr) return errJson(500, "DB error", { error: createErr.message });

  return okJson({ wallet: { ...created, total_balance: Number(created.balance ?? 0) + Number(created.locked_balance ?? 0) }, created: true });
}
