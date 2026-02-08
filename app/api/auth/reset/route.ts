import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Hard reset cookies (if any) to help recover from bad auth/cookie states.
// Safe: does NOT touch Supabase auth storage (localStorage) on client.
export async function GET() {
  const res = NextResponse.redirect(new URL('/dang-nhap?reset=1', 'https://tsbio.life'));

  // Attempt to clear common cookies (even if not present).
  const cookiesToClear = [
    'tsbio_session',
    'tsbio_auth',
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
  ];

  for (const name of cookiesToClear) {
    res.cookies.set({ name, value: '', path: '/', maxAge: 0 });
  }

  return res;
}
