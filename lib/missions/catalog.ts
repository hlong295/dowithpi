// Shared mission catalog (client + server)
// NOTE: No secrets. Safe to import in client components.

export type MissionKind = "claim" | "link" | "bonus";

export type MissionCatalogItem = {
  key: string;
  title: string;
  description: string;
  kind: MissionKind;
  default_reward_pitd: number; // 0 allowed (e.g., link-only)
};

export const MISSION_CATALOG: Record<
  "daily_checkin" | "view_exchange" | "post_exchange" | "lucky_spin" | "bonus_all",
  MissionCatalogItem
> = {
  daily_checkin: {
    key: "daily_checkin",
    title: "Check-in hôm nay",
    description: "Mở app mỗi ngày",
    kind: "claim",
    default_reward_pitd: 1,
  },
  view_exchange: {
    key: "view_exchange",
    title: "Xem trao đổi",
    description: "Xem trang Trao đổi",
    kind: "claim",
    default_reward_pitd: 1,
  },
  post_exchange: {
    key: "post_exchange",
    title: "Đăng bài trao đổi",
    description: "Đăng 1 bài mới",
    kind: "claim",
    default_reward_pitd: 2,
  },
  lucky_spin: {
    key: "lucky_spin",
    title: "Quay số may mắn",
    description: "Đi đến trang quay số",
    kind: "link",
    default_reward_pitd: 0,
  },
  bonus_all: {
    key: "bonus_all",
    title: "Mở quà thưởng",
    description: "Hoàn thành tất cả nhiệm vụ",
    kind: "bonus",
    default_reward_pitd: 1,
  },
};

export const ALL_MISSION_KEYS = Object.keys(MISSION_CATALOG) as Array<
  keyof typeof MISSION_CATALOG
>;
