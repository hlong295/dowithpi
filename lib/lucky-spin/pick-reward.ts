import "server-only";

import { randomBytes } from "crypto";

export type SpinReward = {
  id: string;
  title: string;
  reward_type: string;
  pitd_amount?: any;
  pi_amount?: any;
  voucher_label?: string;
  weight: any;
  is_active?: boolean;
  display_order?: number;
  meta?: any;
};

function toNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Crypto-safe random float in [0,1)
function rand01() {
  const buf = randomBytes(6); // 48-bit
  const x = buf.readUIntBE(0, 6);
  return x / 281474976710656; // 2^48
}

export function pickReward(rewards: SpinReward[]) {
  const active = (rewards || []).filter((r) => {
    const w = toNumber((r as any).weight, 0);
    const ok = (r as any).is_active !== false;
    return ok && w > 0;
  });
  if (active.length === 0) return null;

  const total = active.reduce((sum, r) => sum + toNumber((r as any).weight, 0), 0);
  if (total <= 0) return null;

  const roll = rand01() * total;
  let acc = 0;
  for (const r of active) {
    acc += toNumber((r as any).weight, 0);
    if (roll <= acc) return r;
  }
  return active[active.length - 1];
}
