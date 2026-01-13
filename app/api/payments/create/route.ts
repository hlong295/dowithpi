import { type NextRequest, NextResponse } from "next/server"

// NOTE: In this app, Pi payments are created client-side via Pi.createPayment (Pi SDK).
// This endpoint is kept for compatibility and future use, but is not required for checklist step 10.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    return NextResponse.json({ success: true, message: "Use Pi.createPayment on client", received: body })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 })
  }
}
