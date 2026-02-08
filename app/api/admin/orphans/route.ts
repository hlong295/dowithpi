import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireRootAdmin } from "@/lib/admin/require-root";
import { writeAuditLog } from "@/lib/admin/audit";

// Orphan checker (public-only): detects inconsistencies across profiles, identities, tsb_wallets.
// Note: cannot reliably scan auth.users from public schema; this checks the Identity Core tables.

export async function GET(req: Request) {
  const root = await requireRootAdmin(req);
  if (!root.ok) {
    return NextResponse.json({ error: root.error, detail: root.detail }, { status: root.status });
  }

  const admin = getSupabaseAdmin();

  // 1) profiles without wallet (2-pass; safe for early stage)
  const { data: pAll } = await admin.from("profiles").select("id").limit(5000);
  const { data: wAll } = await admin.from("tsb_wallets").select("profile_id").limit(5000);
  const wSet = new Set((wAll || []).map((x: any) => x.profile_id));
  const profilesWithoutWallet: string[] = (pAll || [])
    .map((x: any) => x.id)
    .filter((id: string) => !wSet.has(id));

  // 2) profiles without email identity
  const { data: identEmail } = await admin
    .from("identities")
    .select("profile_id")
    .eq("provider", "email")
    .limit(2000);
  const emailSet = new Set((identEmail || []).map((x: any) => x.profile_id));

  const { data: pAll2 } = await admin.from("profiles").select("id").limit(5000);
  const profilesWithoutEmailIdentity = (pAll2 || [])
    .map((x: any) => x.id)
    .filter((id: string) => !emailSet.has(id));

  // 3) wallets without profile
  const pSet = new Set((pAll2 || []).map((x: any) => x.id));
  const { data: wAll2 } = await admin.from("tsb_wallets").select("id, profile_id").limit(5000);
  const walletsWithoutProfile = (wAll2 || [])
    .filter((w: any) => !w.profile_id || !pSet.has(w.profile_id))
    .map((w: any) => ({ id: w.id, profile_id: w.profile_id }));

  await writeAuditLog({
    actorId: root.userId,
    action: "admin.orphans.check",
    meta: {
      profilesWithoutWallet: profilesWithoutWallet.length,
      profilesWithoutEmailIdentity: profilesWithoutEmailIdentity.length,
      walletsWithoutProfile: walletsWithoutProfile.length,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    profilesWithoutWallet,
    profilesWithoutEmailIdentity,
    walletsWithoutProfile,
    note: "This checker scans public tables only (profiles/identities/tsb_wallets).",
  });
}
