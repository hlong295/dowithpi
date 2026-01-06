export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const PI_API_BASE = "https://api.minepi.com/v2"

// Pi Wallet waits only a short time for server approval.
// Fail fast (and return diagnostics) instead of hanging until the wallet expires.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 3500) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

function getPiApiKey() {
  // Support multiple env var names to avoid mis-config on Vercel/hosting
  const raw =
    process.env.PI_API_KEY ||
    process.env.PI_PLATFORM_API_KEY ||
    process.env.PI_APP_API_KEY ||
    process.env.PI_SERVER_API_KEY ||
    process.env.PI_DEV_API_KEY ||
    ""
  return raw.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json()

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId" }, { status: 400 })
    }

    // Keep existing auth guard (do NOT change login flows)
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("pitodo_user")
    if (!userCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const apiKey = getPiApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing PI_API_KEY on server (set in hosting env)" },
        { status: 500 },
      )
    }

    // Approve payment on Pi servers
    const url = `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`
    const resp = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        // IMPORTANT: Pi Platform expects Authorization: Key <API_KEY>
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    const text = await resp.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }

    if (!resp.ok) {
      return NextResponse.json(
        {
          error: data?.error || data?.message || "Pi approve failed",
          status: resp.status,
          details: data,
        },
        { status: 502 },
      )
    }

    // IMPORTANT:
    // Pi Wallet waits for your server to approve quickly.
    // DO NOT do any DB writes here. Only approve with Pi API and return fast.
    // All DB writes will be done in /api/payments/complete (after user approves in wallet).
    return NextResponse.json({
      success: true,
      paymentId,
      pi: data,
    })
  } catch (error: any) {
    console.error("Payment approval error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to approve payment" },
      { status: 500 },
    )
  }
}
