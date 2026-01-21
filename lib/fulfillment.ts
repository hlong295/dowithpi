import crypto from "crypto";

export type VoucherFulfillment = {
  kind: "voucher";
  redeem_code: string;
  issued_at: string;
  used_at?: string;
  used_by?: string;
};

// Keep it short for mobile copy/paste, avoid confusing chars.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I,L,O,0,1

export function generateRedeemCode(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function buildVoucherFulfillment(nowIso: string, code?: string): VoucherFulfillment {
  return {
    kind: "voucher",
    redeem_code: code ?? generateRedeemCode(10),
    issued_at: nowIso,
  };
}
