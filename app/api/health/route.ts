import { NextResponse } from "next/server";

// Minimal health endpoint used to diagnose edge/proxy issues without any auth.
// Must never redirect.

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() }, { status: 200 });
}
