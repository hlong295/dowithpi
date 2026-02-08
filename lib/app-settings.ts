import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type HomeHeroSettings = {
  headlineTop: string;
  headlineBottom: string;
};

const DEFAULT_HERO: HomeHeroSettings = {
  headlineTop: "TSBIO - ĐỒNG HÀNH CỨU VƯỜN",
  headlineBottom: "HƠN 10.000 NHÀ VƯỜN\nPHỤC HỒI VƯỜN THÀNH CÔNG",
};

async function safeReadSetting(key: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      // Common case before DB migration: table missing.
      return null;
    }
    return data?.value ?? null;
  } catch {
    return null;
  }
}

export async function getHomeHeroSettings(): Promise<HomeHeroSettings> {
  const [top, bottom] = await Promise.all([
    safeReadSetting("home.hero.headline_top"),
    safeReadSetting("home.hero.headline_bottom"),
  ]);

  return {
    headlineTop: top ?? DEFAULT_HERO.headlineTop,
    headlineBottom: bottom ?? DEFAULT_HERO.headlineBottom,
  };
}
