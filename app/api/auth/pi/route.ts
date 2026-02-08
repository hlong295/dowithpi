import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const accessToken = body?.accessToken;
    const user = body?.user;

    if (!accessToken || !user?.uid || !user?.username) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "Missing accessToken or user fields." },
        { status: 400 }
      );
    }

    // Minimal auth “sync” for v0:
    // - Trust Pi SDK in Pi Browser (client already authenticated).
    // - IMPORTANT (TSBIO Constitution): do NOT hardcode root/admin by UID in code.
    //   Role resolution will be DB-driven later (profiles.role via identities mapping).
    const role = "user";

    return NextResponse.json({
      uid: user.uid,
      username: user.username,
      accessToken,
      role,
      createdAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "PI_LOGIN_FAILED", message: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
