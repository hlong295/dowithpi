// Single source of truth for Lottery (Xổ số may mắn) schema/types.
// Keep this file aligned with Supabase tables:
// - public.lottery_events
// - public.lottery_registrations
// - public.lottery_prizes

export type LotteryRewardCurrency = "PI" | "PITD" | "BOTH";
export type LotteryPrizeType = "PI" | "PITD";

export type LotteryEventStatus =
  | "draft"
  | "open"
  | "closed"
  | "drawing"
  | "completed"
  | "cancelled"
  | string;

export type LotteryEventRow = {
  id: string;
  title: string;
  description: string;
  open_at: string;
  close_at: string;
  draw_at: string;
  status: LotteryEventStatus;
  max_participants: number | null;
  close_when_full: boolean;
  requires_pioneer: boolean;
  reward_currency: LotteryRewardCurrency | string | null;
  meta: any;
};

export type LotteryPrizeRow = {
  id?: string;
  event_id: string;
  rank: number;
  prize_type: LotteryPrizeType | string;
  amount: number;
  label?: string | null;
};

export type LotteryRegistrationRow = {
  id: string;
  event_id: string;
  user_id: string;
  username: string;
  chosen_number: number;
  created_at: string;
};

export const DEFAULT_PRIZES: Array<{ rank: number; label: string; amount: number }> = [
  { rank: 1, label: "Giải nhất", amount: 100 },
  { rank: 2, label: "Giải nhì", amount: 50 },
  { rank: 3, label: "Giải ba", amount: 10 },
];

export function normalizeRewardCurrency(input: any): LotteryRewardCurrency {
  const v = String(input || "").toUpperCase();
  if (v === "PI") return "PI";
  if (v === "BOTH") return "BOTH";
  return "PITD";
}
