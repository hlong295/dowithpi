import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const h = req.headers;
  const payload = {
    ok: true,
    ts: new Date().toISOString(),
    url: req.url,
    host: h.get('host'),
    forwardedHost: h.get('x-forwarded-host'),
    forwardedProto: h.get('x-forwarded-proto'),
    forwardedFor: h.get('x-forwarded-for'),
    vercelId: h.get('x-vercel-id'),
    userAgent: h.get('user-agent'),
  };
  return NextResponse.json(payload, { status: 200 });
}
