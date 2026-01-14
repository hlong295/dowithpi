import "server-only";

import { randomBytes } from "crypto";
import { resolveMasterUserId } from "@/lib/pitd/require-user";
import {
  insertPitdTransaction,
  normalizePitdAmount,
  selectWalletByUserIds,
  updateWalletBalance,
} from "@/lib/pitd/ledger";

type SupabaseAdmin = any;

function genPitdAddress() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(32);
  let core = "";
  for (let i = 0; i < 20; i++) core += chars[bytes[i] % chars.length];
  return `PITD${core}`;
}

async function ensureWallet(admin: SupabaseAdmin, userId: string) {
  const resolved = await resolveMasterUserId(admin, userId);
  const masterUserId = (resolved as any)?.userId || userId;
  const candidateUserIds = Array.from(new Set([masterUserId, userId].filter(Boolean)));

  let wallet = await selectWalletByUserIds(admin, candidateUserIds);
  if (wallet?.id) return { wallet, masterUserId, candidateUserIds };

  // Create wallet if missing
  const payload: any = {
    user_id: masterUserId,
    balance: 0,
    locked_balance: 0,
    total_spent: 0,
    address: genPitdAddress(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await admin
    .from("pitd_wallets")
    .insert(payload)
    .select("id,user_id,balance,locked_balance,total_spent,address,created_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("PITD_WALLET_CREATE_FAILED");

  wallet = data;
  return { wallet, masterUserId, candidateUserIds };
}

export async function creditPitdForSpin(
  admin: SupabaseAdmin,
  userId: string,
  amountInput: any,
  args?: { referenceId?: string | null; rewardTitle?: string | null; metadata?: any },
) {
  const amount = normalizePitdAmount(amountInput);
  const { wallet } = await ensureWallet(admin, userId);

  const current = Number((wallet as any).balance ?? 0) || 0;
  const next = Math.round((current + amount) * 1_000_000) / 1_000_000;

  await updateWalletBalance(admin, String((wallet as any).id), next);
  await insertPitdTransaction(admin, {
    walletId: String((wallet as any).id),
    transactionType: "spin_reward",
    amount,
    balanceAfter: next,
    description: args?.rewardTitle ? `Lucky Spin: ${args.rewardTitle}` : "Lucky Spin reward",
    referenceId: args?.referenceId ?? null,
    referenceType: "spin_log",
    metadata: args?.metadata ?? null,
  });

  return { walletId: String((wallet as any).id), newBalance: next, amount };
}
