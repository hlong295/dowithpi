import { NextResponse } from "next/server";

import { getHomeHeroSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const hero = await getHomeHeroSettings();
  return NextResponse.json({
    hero,
  });
}
