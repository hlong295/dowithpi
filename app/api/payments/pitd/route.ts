
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server"
import { getEffectivePitdWalletIds } from "@/lib/system-wallets"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { resolveMasterUserId } from "@/lib/pitd/resolve-master-user"

/**
 * PITD internal payment:
 * - Debits buyer PITD wallet
 * - Credits provider PITD wallet
 * - Credits platform service fee PITD wallet
 * - Credits platform tax PITD wallet
 *
 * NOTE: This matches current DB schema:
 * - pitd_wallets: id, user_id, balance, locked_balance, total_spent, address
 * - pitd_transactions: id, wallet_id, transaction_type, amount, balance_after, reference_id, reference_type, description, metadata, created_at
 */
export async function POST(request: Request) {
  try {
    const { productId, userId, expectedAmount, productName, quantity = 1 } = await request.json()

    if (!productId || !userId) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json({ message: "Server not configured" }, { status: 500 })
    }

    // Resolve master users.id without touching login flows
    const buyerResolved = await resolveMasterUserId(supabase as any, String(userId))
    const buyerUserId = buyerResolved.userId

    /**
     * IMPORTANT (FIX): Avoid selecting columns that may not exist on some DB baselines.
     * - If we select a non-existent column, PostgREST returns an error and we incorrectly
     *   show PRODUCT_NOT_FOUND.
     * - Using `select('*')` keeps backward/forward compatibility across schema iterations.
     */
    const { data: productRow, error: prodErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", String(productId))
      .maybeSingle()
    if (prodErr || !productRow) {
      return NextResponse.json(
        {
          message: "PRODUCT_NOT_FOUND",
          debug: {
            productId: String(productId),
            prodErr: prodErr ? String((prodErr as any).message || prodErr) : null,
          },
        },
        { status: 404 },
      )
    }

    const providerIdRaw = (productRow as any).provider_id || (productRow as any).seller_id
    if (!providerIdRaw) {
      return NextResponse.json({ message: "PROVIDER_NOT_FOUND" }, { status: 400 })
    }

    const providerResolved = await resolveMasterUserId(supabase as any, String(providerIdRaw))
    const providerUserId = providerResolved.userId

    const qty = Math.max(1, Number(quantity) || 1)

    // Compute expected PITD unit price (supports multiple historical field names)
    const basePitd = Number(
      (productRow as any).pitd_amount ??
        (productRow as any).pitdAmount ??
        (productRow as any).price_pitd ??
        (productRow as any).pitd_price ??
        (productRow as any).price ??
        0,
    )
    const flashEnabled = Boolean((productRow as any).flash_sale_enabled ?? (productRow as any).flashSaleEnabled ?? (productRow as any).is_flash_sale)
    const flashStartRaw =
      (productRow as any).flash_sale_start_date ?? (productRow as any).flash_start_at ?? (productRow as any).flashSaleStartDate
    const flashEndRaw =
      (productRow as any).flash_sale_end_date ?? (productRow as any).flash_end_at ?? (productRow as any).flashSaleEndDate
    const flashStart = flashStartRaw ? new Date(flashStartRaw) : null
    const flashEnd = flashEndRaw ? new Date(flashEndRaw) : null
    const flashPitd =
      (productRow as any).flash_sale_pitd_price ??
      (productRow as any).flash_sale_pitd_amount ??
      (productRow as any).flash_sale_price_pitd ??
      (productRow as any).flash_pitd_price ??
      (productRow as any).flash_price_pitd ??
      (productRow as any).flashSalePitdPrice
    const now = new Date()
    const flashActive =
      flashEnabled &&
      (!flashStart || now >= flashStart) &&
      (!flashEnd || now <= flashEnd) &&
      flashPitd !== undefined &&
      flashPitd !== null
    const unitPitd = flashActive ? Number(flashPitd) : basePitd
    const total = Math.round(unitPitd * qty * 1e6) / 1e6

    // Optional client-side verification to catch mismatched UI mapping
    if (expectedAmount !== undefined && expectedAmount !== null) {
      const exp = Number(expectedAmount)
      if (Number.isFinite(exp) && Math.abs(exp - total) > 1e-6) {
        return NextResponse.json({ message: "AMOUNT_MISMATCH" }, { status: 400 })
      }
    }

    // Load percentages (fallback to constants if missing)
    const { data: settings } = await supabase.from("app_settings").select("service_fee_percentage, tax_percentage").limit(1).maybeSingle()
    const serviceFeePercentage = Number(settings?.service_fee_percentage ?? 2)
    const taxPercentage = Number(settings?.tax_percentage ?? 8)

    const serviceFee = Math.round((total * serviceFeePercentage) / 100 * 1e6) / 1e6
    const tax = Math.round((total * taxPercentage) / 100 * 1e6) / 1e6
    const providerAmount = Math.round((total - serviceFee - tax) * 1e6) / 1e6

    if (providerAmount < 0) {
      return NextResponse.json({ message: "Invalid fee/tax configuration" }, { status: 400 })
    }

    // Use effective fee/tax wallets (admin-configurable receiver accounts)
    const effective = await getEffectivePitdWalletIds()

    // Fetch wallets
    const { data: buyerWallet, error: buyerErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance, locked_balance, total_spent")
      .eq("user_id", buyerUserId)
      .single()
    if (buyerErr) throw buyerErr

    const buyerBalance = Number(buyerWallet.balance || 0)
    if (buyerBalance < total) {
      return NextResponse.json({ message: "Insufficient PITD balance" }, { status: 400 })
    }

    const { data: providerWallet, error: providerErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance")
      .eq("user_id", providerUserId)
      .single()
    if (providerErr) throw providerErr

    const { data: surchargeWallet, error: surErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance")
      .eq("id", effective.surchargeWalletId)
      .single()
    if (surErr) throw surErr

    const { data: taxWallet, error: taxErr } = await supabase
      .from("pitd_wallets")
      .select("id, balance")
      .eq("id", effective.taxWalletId)
      .single()
    if (taxErr) throw taxErr

    // Update balances
    const buyerNewBalance = Math.round((buyerBalance - total) * 1e6) / 1e6
    const providerNewBalance = Math.round((Number(providerWallet.balance || 0) + providerAmount) * 1e6) / 1e6
    const surchargeNewBalance = Math.round((Number(surchargeWallet.balance || 0) + serviceFee) * 1e6) / 1e6
    const taxNewBalance = Math.round((Number(taxWallet.balance || 0) + tax) * 1e6) / 1e6

    // Buyer
    const { error: buyerUpErr } = await supabase
      .from("pitd_wallets")
      .update({
        balance: buyerNewBalance,
        total_spent: Number(buyerWallet.total_spent || 0) + total,
      })
      .eq("id", buyerWallet.id)
    if (buyerUpErr) throw buyerUpErr

    // Provider
    const { error: provUpErr } = await supabase.from("pitd_wallets").update({ balance: providerNewBalance }).eq("id", providerWallet.id)
    if (provUpErr) throw provUpErr

    // Platform wallets
    const { error: surUpErr } = await supabase.from("pitd_wallets").update({ balance: surchargeNewBalance }).eq("id", surchargeWallet.id)
    if (surUpErr) throw surUpErr

    const { error: taxUpErr2 } = await supabase.from("pitd_wallets").update({ balance: taxNewBalance }).eq("id", taxWallet.id)
    if (taxUpErr2) throw taxUpErr2

    // Create purchase record so "Sản phẩm đã mua" can load correctly
    const { data: purchaseRow, error: purchaseErr } = await supabase
      .from("user_purchases")
      .insert({
        user_id: buyerUserId,
        product_id: String(productId),
        quantity: qty,
        unit_price: unitPitd,
        total_price: total,
        payment_method: "pitd",
        status: "completed",
      })
      .select("id")
      .single()
    if (purchaseErr) throw purchaseErr

    // Insert transactions (statement/history)
    const referenceId = String(purchaseRow?.id || productId)
    const referenceType = "purchase"

    const metadata = {
      purchase_id: purchaseRow?.id,
      product_id: productId,
      provider_id: providerUserId,
      user_id: buyerUserId,
      quantity: qty,
      unit_price: unitPitd,
      product_name: productName || (productRow as any)?.name || "",
    }

    const inserts = [
      {
        wallet_id: buyerWallet.id,
        transaction_type: "debit_purchase",
        amount: -total,
        balance_after: buyerNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Thanh toán PITD: ${productName || productId}`,
        metadata,
      },
      {
        wallet_id: providerWallet.id,
        transaction_type: "credit_provider",
        amount: providerAmount,
        balance_after: providerNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Nhà cung cấp nhận từ ${productName || productId}`,
        metadata,
      },
      {
        wallet_id: surchargeWallet.id,
        transaction_type: "credit_service_fee",
        amount: serviceFee,
        balance_after: surchargeNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Phí dịch vụ từ ${productName || productId}`,
        metadata,
      },
      {
        wallet_id: taxWallet.id,
        transaction_type: "credit_tax",
        amount: tax,
        balance_after: taxNewBalance,
        reference_id: referenceId,
        reference_type: referenceType,
        description: `Thuế từ ${productName || productId}`,
        metadata,
      },
    ]

    const { error: insErr } = await supabase.from("pitd_transactions").insert(inserts as any)
    if (insErr) throw insErr

    return NextResponse.json({
      success: true,
      purchaseId: purchaseRow?.id,
      breakdown: {
        total,
        serviceFee,
        tax,
        providerAmount,
        serviceFeePercentage,
        taxPercentage,
      },
    })
  } catch (error: any) {
    console.error("[payments/pitd] error:", error)
    const msg = error?.message || "PITD payment error"
    if (msg === "MISSING_SUPABASE_SERVICE_ROLE_KEY") {
      return NextResponse.json({
        message: "Server thiếu SUPABASE_SERVICE_ROLE_KEY (Service Role) nên PITD API bị RLS chặn.",
        hint: "Trên Vercel: Settings → Environment Variables → thêm SUPABASE_SERVICE_ROLE_KEY (Production + Preview) rồi redeploy.",
        code: "MISSING_SUPABASE_SERVICE_ROLE_KEY",
      }, { status: 500 })
    }
    return NextResponse.json({ message: msg }, { status: 500 })
  }
}