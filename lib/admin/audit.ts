import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type AuditTarget = {
  type: string;
  id?: string | null;
};

export async function writeAuditLog(params: {
  actorId: string;
  action: string;
  target?: AuditTarget;
  meta?: Record<string, any>;
}) {
  const admin = getSupabaseAdmin();
  const { actorId, action, target, meta } = params;
  await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: target?.type || null,
    target_id: target?.id || null,
    meta: meta || {},
  });
}
