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
    const { paymentId, txid } = await request.json()

    if (!paymentId || !txid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
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

    // Complete payment on Pi servers (prove you got txid)
    const url = `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txid }),
    })

    const text = await resp.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }

    // If already completed, Pi may return 4xx. Treat certain cases as success.
    if (!resp.ok) {
      const msg = (data?.error || data?.message || "").toString().toLowerCase()
      const looksAlreadyDone =
        msg.includes("already") && (msg.includes("complete") || msg.includes("completed"))
      if (!looksAlreadyDone) {
        return NextResponse.json(
          {
            error: data?.error || data?.message || "Pi complete failed",
            status: resp.status,
            details: data,
          },
          { status: 502 },
        )
      }
    }

    // ----------------------------
    // DB updates (server-only) – bám đúng schema user gửi:
    // - pi_payments: status -> completed, transaction_id -> txid, completed_at
    // - orders: status -> confirmed, confirmed_at
    // - user_purchases: create purchase record (payment_method = 'pi')
    // ----------------------------
    let dbDebug: any = null
    try {
      const user = JSON.parse(userCookie.value)
      const supabaseAdmin = getSupabaseAdminClient()

      // Find pi_payments row
      const { data: payRow, error: payFindErr } = await supabaseAdmin
        .from("pi_payments")
        .select("*")
        .eq("pi_payment_id", paymentId)
        .maybeSingle()

      if (payFindErr || !payRow) {
        dbDebug = { step: "FIND_PI_PAYMENTS", error: payFindErr?.message || "PI_PAYMENT_NOT_FOUND" }
      } else {
        // Update pi_payments
        const { error: payUpErr } = await supabaseAdmin
          .from("pi_payments")
          .update({
            status: "completed",
            transaction_id: txid,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payRow.id)

        if (payUpErr) {
          dbDebug = { step: "UPDATE_PI_PAYMENTS", error: payUpErr.message }
        } else {
          // Update order
          if (payRow.order_id) {
            const { error: ordErr } = await supabaseAdmin
              .from("orders")
              .update({
                status: "confirmed",
                confirmed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", payRow.order_id)

            if (ordErr) {
              dbDebug = { step: "UPDATE_ORDER", error: ordErr.message }
            }
          }

          // Insert user_purchases
          const meta: any = (payRow as any).metadata || {}
          const productId = meta.product_id || meta.productId || null
          const qty = Number(meta.quantity || 1)
          const totalAmount = Number((payRow as any).amount || 0)

          if (productId && totalAmount && !Number.isNaN(totalAmount)) {
            const unitPrice = qty > 0 ? totalAmount / qty : totalAmount
            const { error: purErr } = await supabaseAdmin.from("user_purchases").insert({
              user_id: user.id,
              product_id: productId,
              quantity: qty,
              unit_price: unitPrice,
              total_price: totalAmount,
              payment_method: "pi",
              status: "completed",
            })

            if (purErr) {
              dbDebug = { ...(dbDebug || {}), step: "INSERT_USER_PURCHASES", error: purErr.message }
            } else {
              dbDebug = { ok: true, pi_payments_id: payRow.id, order_id: payRow.order_id }
            }
          } else {
            dbDebug = { ...(dbDebug || {}), warn: "SKIP_USER_PURCHASES_MISSING_PRODUCT_OR_AMOUNT" }
          }
        }
      }
    } catch (e: any) {
      dbDebug = { step: "DB_EXCEPTION", error: e?.message || String(e) }
    }

    return NextResponse.json({
      success: true,
      paymentId,
      txid,
      pi: data,
      db: dbDebug,
    })
  } catch (error: any) {
    console.error("Payment completion error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to complete payment" },
      { status: 500 },
    )
  }
}
