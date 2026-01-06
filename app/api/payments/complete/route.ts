export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const PI_API_BASE = "https://api.minepi.com/v2"

// Pi Wallet expects server calls (detail/complete) to be quick.
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

    // Fetch payment details (includes amount + metadata that we will persist to DB).
    const detailUrl = `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`
    const detailResp = await fetchWithTimeout(detailUrl, {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
    })

    const detailText = await detailResp.text()
    let paymentDetail: any = null
    try {
      paymentDetail = detailText ? JSON.parse(detailText) : null
    } catch {
      paymentDetail = { raw: detailText }
    }

    // Complete payment on Pi servers (prove you got txid)
    const url = `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`
    const resp = await fetchWithTimeout(url, {
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
    // DB updates (server-only)
    // IMPORTANT: To avoid Pi Wallet timeouts, we DO NOT do DB writes in /approve.
    // We persist everything here, after user has approved and returned to the app.
    // ----------------------------
    let dbDebug: any = null
    try {
      const user = JSON.parse(userCookie.value)
      const nowIso = new Date().toISOString()
      const supabaseAdmin = getSupabaseAdminClient()

      // Extract essential info from Pi payment detail
      const meta: any = paymentDetail?.metadata || {}
      const productId = meta.product_id || meta.productId || null
      const qty = Number(meta.quantity || 1)
      const totalAmount = Number(paymentDetail?.amount ?? 0)
      const fromAddress = paymentDetail?.from_address || null
      const toAddress =
        paymentDetail?.to_address || process.env.PI_APP_WALLET_ADDRESS || process.env.PI_APP_WALLET || null
      const memo = paymentDetail?.memo || paymentDetail?.note || null

      // Idempotency: if pi_payments already completed, just return
      const { data: existingPay } = await supabaseAdmin
        .from("pi_payments")
        .select("id, order_id, status")
        .eq("pi_payment_id", paymentId)
        .maybeSingle()

      if (existingPay?.status === "completed") {
        dbDebug = { ok: true, alreadyCompleted: true, pi_payments_id: existingPay.id, order_id: existingPay.order_id }
      } else {
        // Find product to get provider_id (bám schema products.provider_id)
        let providerId: string | null = null
        if (productId) {
          const { data: prod } = await supabaseAdmin
            .from("products")
            .select("id, provider_id")
            .eq("id", productId)
            .maybeSingle()
          providerId = (prod as any)?.provider_id || null
        }

        // Order handling (idempotent): reuse existingPay.order_id if present, else create new order
        let orderRow: any = null
        if (existingPay?.order_id) {
          const { data: ord } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", existingPay.order_id)
            .maybeSingle()
          orderRow = ord
          // Best-effort ensure status confirmed
          await supabaseAdmin
            .from("orders")
            .update({ status: "confirmed", confirmed_at: nowIso, updated_at: nowIso })
            .eq("id", existingPay.order_id)
        } else {
          const { data: ord, error: orderErr } = await supabaseAdmin
            .from("orders")
            .insert({
              redeemer_id: user.id,
              provider_id: providerId,
              total_amount: totalAmount,
              currency: "PI",
              status: "confirmed",
              payment_method: "pi",
              payment_id: paymentId,
              confirmed_at: nowIso,
            })
            .select("*")
            .maybeSingle()

          if (orderErr || !ord) {
            dbDebug = { step: "INSERT_ORDER", error: orderErr?.message || "ORDER_INSERT_FAILED" }
          }
          orderRow = ord
        }
        if (orderRow) {
          // Upsert pi_payments row (create if missing)
          const payInsertPayload: any = {
            user_id: user.id,
            pi_payment_id: paymentId,
            order_id: orderRow.id,
            amount: totalAmount,
            currency: "PI",
            status: "completed",
            transaction_id: txid,
            from_address: fromAddress,
            to_address: toAddress,
            memo: memo,
            metadata: meta,
            completed_at: nowIso,
            updated_at: nowIso,
          }

          let payRow: any = null
          if (existingPay?.id) {
            const { data: upd, error: upErr } = await supabaseAdmin
              .from("pi_payments")
              .update(payInsertPayload)
              .eq("id", existingPay.id)
              .select("*")
              .maybeSingle()
            if (upErr || !upd) {
              dbDebug = { step: "UPDATE_PI_PAYMENTS", error: upErr?.message || "PI_PAYMENTS_UPDATE_FAILED" }
              payRow = null
            } else {
              payRow = upd
            }
          } else {
            const { data: ins, error: insErr } = await supabaseAdmin
              .from("pi_payments")
              .insert(payInsertPayload)
              .select("*")
              .maybeSingle()
            if (insErr || !ins) {
              dbDebug = { step: "INSERT_PI_PAYMENTS", error: insErr?.message || "PI_PAYMENTS_INSERT_FAILED" }
              payRow = null
            } else {
              payRow = ins
            }
          }

          // Create purchase record (optional but requested)
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
            }
          }

          if (!dbDebug || dbDebug.ok) {
            dbDebug = { ok: true, pi_payments_id: payRow?.id || existingPay?.id || null, order_id: orderRow.id }
          } else {
            dbDebug = { ...(dbDebug || {}), pi_payments_id: payRow?.id || existingPay?.id || null, order_id: orderRow.id }
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
      paymentDetail,
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
