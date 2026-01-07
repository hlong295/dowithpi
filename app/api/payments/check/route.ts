import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUserId } from "@/lib/pitd/require-user"

const PI_API_BASE = "https://api.minepi.com/v2"

function getPiApiKey() {
  const key = process.env.PI_API_KEY
  return key && key.trim().length > 0 ? key.trim() : null
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json()
    if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 })

    const userId = getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const apiKey = getPiApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing PI_API_KEY on server (set in hosting env)" },
        { status: 500 },
      )
    }

    const url = `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`
    const resp = await fetch(url, {
      method: "GET",
      headers: {
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
        { error: data?.error || data?.message || "Pi check failed", status: resp.status, details: data },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, paymentId, pi: data })
  } catch (error: any) {
    console.error("[payments/check] error:", error)
    return NextResponse.json({ error: error?.message || "Failed to check payment" }, { status: 500 })
  }
}
