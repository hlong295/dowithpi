import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type LotteryEventRow = {
  id: string;
  title: string;
  description: string | null;
  open_at: string;
  close_at: string;
  draw_at: string;
  max_participants: number | null;
  close_when_full: boolean;
  status: string;
  requires_pioneer: boolean;
  meta: any;
  created_at: string;
  updated_at: string;
};

export async function fetchCurrentLotteryEvent(): Promise<LotteryEventRow | null> {
  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from("lottery_events")
    .select(
      "id,title,description,open_at,close_at,draw_at,max_participants,close_when_full,status,requires_pioneer,meta,created_at,updated_at"
    )
    .not("status", "in", "(draft,cancelled)")
    .order("open_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as any) || null;
}
