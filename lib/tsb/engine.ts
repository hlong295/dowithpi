import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ApplyTxInput = {
  profile_id: string;
  amount: number; // positive credit, negative debit
  type: string;
  reference_type?: string | null;
  reference_id?: string | null;
  metadata?: Record<string, any> | null;
};

export async function applyTsbTransaction(input: ApplyTxInput) {
  const admin = getSupabaseAdmin();

  // Prefer DB function for atomicity.
  // Requires db/stageA/sql/A2_1_tsb_apply_tx.sql to be applied.
  const { data, error } = await admin.rpc("tsb_apply_tx", {
    p_profile_id: input.profile_id,
    p_amount: input.amount,
    p_type: input.type,
    p_reference_type: input.reference_type ?? null,
    p_reference_id: input.reference_id ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    // Provide a clear error so operator knows the missing SQL.
    throw new Error(`TSB_APPLY_TX_FAILED: ${error.message}`);
  }
  return data as any;
}
