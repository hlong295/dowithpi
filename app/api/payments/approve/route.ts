import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const PI_API_BASE = "https://api.minepi.com/v2"

function getPiApiKey() {
  const key = process.env.PI_API_KEY
  return key && key.trim().length > 0 ? key.trim() : null
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId, productId, quantity, amount } = await request.json()

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
    const resp = await fetch(url, {
      method: "POST",
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
        {
          error: data?.error || data?.message || "Pi approve failed",
          status: resp.status,
          details: data,
        },
        { status: 502 },
      )
    }

    // ----------------------------
    // DB writes (server-only) – bám đúng schema user gửi.
    // IMPORTANT: Pi wallet waits for server approval; if we take too long here,
    // the user will see "Thanh toán đã hết hạn" after ~60s.
    // So we timebox DB work to keep approval fast.
    // ----------------------------
    const APP_WALLET_ADDRESS = process.env.PI_APP_WALLET_ADDRESS?.trim() || null

    const dbWork = async () => {
      let dbDebug: any = null
      try {
        const user = JSON.parse(userCookie.value)
        const supabaseAdmin = getSupabaseAdminClient()

        const q = Number(quantity || 1)
        const totalAmount = Number(amount || 0)
        if (!productId || !totalAmount || Number.isNaN(totalAmount) || totalAmount <= 0) {
          dbDebug = { skipped: true, reason: "MISSING_PRODUCT_OR_AMOUNT" }
          return dbDebug
        }

        // Fetch product to resolve provider_id (orders requires provider_id NOT NULL)
        const { data: pRow, error: pErr } = await supabaseAdmin
          .from("products")
          .select("*")
          .eq("id", productId)
          .maybeSingle()

        if (pErr || !pRow) {
          dbDebug = { step: "FETCH_PRODUCT", error: pErr?.message || "PRODUCT_NOT_FOUND" }
          return dbDebug
        }

        const providerId =
          (pRow as any).provider_id || (pRow as any).seller_id || (pRow as any).providerId || null
        if (!providerId) {
          dbDebug = { step: "RESOLVE_PROVIDER", error: "MISSING_PROVIDER_ID_ON_PRODUCT" }
          return dbDebug
        }

        // 1) Create order (pending)
        const { data: orderRow, error: orderErr } = await supabaseAdmin
          .from("orders")
          .insert({
            redeemer_id: user.id,
            provider_id: providerId,
            total_amount: totalAmount,
            currency: "PI",
            status: "pending",
            payment_method: "pi",
          })
          .select("*")
          .single()

        if (orderErr || !orderRow) {
          dbDebug = { step: "INSERT_ORDER", error: orderErr?.message || "ORDER_INSERT_FAILED" }
          return dbDebug
        }

        // 2) Upsert pi_payments (pending)
        const { data: payRow, error: payErr } = await supabaseAdmin
          .from("pi_payments")
          .upsert(
            {
              user_id: user.id,
              order_id: orderRow.id,
              pi_payment_id: paymentId,
              amount: totalAmount,
              status: "pending",
              // optional (if you want to log app wallet address)
              to_address: APP_WALLET_ADDRESS,
              metadata: {
                product_id: productId,
                quantity: q,
                pi_approve: data,
              },
            },
            { onConflict: "pi_payment_id" },
          )
          .select("*")
          .single()

        if (payErr || !payRow) {
          dbDebug = { step: "UPSERT_PI_PAYMENTS", error: payErr?.message || "PI_PAYMENT_UPSERT_FAILED" }
          return dbDebug
        }

        // 3) Link back order.payment_id -> pi_payments.id
        const { error: linkErr } = await supabaseAdmin
          .from("orders")
          .update({ payment_id: payRow.id })
          .eq("id", orderRow.id)

        if (linkErr) {
          dbDebug = { step: "LINK_ORDER_PAYMENT_ID", error: linkErr.message }
          return dbDebug
        }

        dbDebug = { ok: true, order_id: orderRow.id, pi_payments_id: payRow.id }
        return dbDebug
      } catch (e: any) {
        return { step: "DB_EXCEPTION", error: e?.message || String(e) }
      }
    }

    // Timebox DB to avoid Pi wallet approval timeout
    const dbTimeoutMs = 2500
    const db = await Promise.race([
      dbWork(),
      new Promise((resolve) => setTimeout(() => resolve({ skipped: true, reason: "DB_TIMEOUT", ms: dbTimeoutMs }), dbTimeoutMs)),
    ])

    return NextResponse.json({
      success: true,
      paymentId,
      pi: data,
      db,
    })
  } catch (error: any) {
    console.error("Payment approval error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to approve payment" },
      { status: 500 },
    )
  }
}
