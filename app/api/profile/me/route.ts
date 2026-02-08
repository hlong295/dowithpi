import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedUserId } from "@/lib/pitd/require-user"

// P5.1 Profile: bind real DB data WITHOUT changing UI.
// - Works for both Pi login (headers/cookies) and Email login (Supabase JWT).
// - Uses server-side admin client (PITD/internal rules: no anon-key reads for sensitive data).

export const dynamic = "force-dynamic"

function toNumberSafe(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const dbgEnabled = url.searchParams.get("dbg") === "1"

  try {
    const auth = (req.headers.get("authorization") || req.headers.get("Authorization") || "").trim()
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""

    // Prefer admin client (server role) when configured, otherwise fall back to
    // a user-scoped client (bearer token) so email users can still load profile
    // even if SUPABASE_SERVICE_ROLE_KEY isn't set on Vercel yet.
    let supabase: any = null
    try {
      supabase = getSupabaseAdminClient()
    } catch {
      if (bearer) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
        })
      }
    }
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "SERVER_MISSING_SUPABASE_ADMIN" }, { status: 500 })
    }

    // Resolve the current user (master users.id)
    const userId = await getAuthenticatedUserId(req)
    if (!userId) {
      return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
    }

    // 1) Load profile from pi_users (tolerant select)
    const { data: piUser, error: piErr } = await supabase
      .from("pi_users")
      .select(
        "id,pi_username,full_name,user_role,provider_approved,provider_label,member_label,verification_status,provider_business_name,provider_description,created_at",
      )
      .eq("id", userId)
      .maybeSingle()

    if (piErr) {
      // Do not hard-fail the whole screen; return minimal data.
      if (dbgEnabled) {
        return NextResponse.json({ ok: true, profile: { user_id: userId }, dbg: { piErr: piErr.message } })
      }
      return NextResponse.json({ ok: true, profile: { user_id: userId } })
    }

    // 2) Provider stats (rating / count / exchanges)
    let ratingAvg = 0
    let reviewCount = 0
    let exchangeCount = 0
    let categories: string[] = []

    // Products of this provider
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id,category")
      .eq("provider_id", userId)
      .limit(2000)

    if (!prodErr && Array.isArray(products) && products.length) {
      const productIds = products.map((p: any) => p.id).filter(Boolean)

      // Categories (top 3)
      const counts: Record<string, number> = {}
      for (const p of products as any[]) {
        const c = String(p?.category || "").trim()
        if (!c) continue
        counts[c] = (counts[c] || 0) + 1
      }
      categories = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k)

      // Reviews table (if present / used)
      try {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("rating")
          .in("product_id", productIds)
          .limit(5000)
        if (Array.isArray(reviews) && reviews.length) {
          const nums = reviews.map((r: any) => toNumberSafe(r?.rating)).filter((n) => n > 0)
          reviewCount = nums.length
          if (nums.length) {
            ratingAvg = nums.reduce((a, b) => a + b, 0) / nums.length
          }
        }
      } catch {
        // ignore if table missing / policy blocks
      }

      // Exchanges = number of purchases for this provider's products
      try {
        const { data: purchases } = await supabase
          .from("user_purchases")
          .select("id")
          .in("product_id", productIds)
          .limit(5000)
        if (Array.isArray(purchases)) exchangeCount = purchases.length
      } catch {
        // ignore
      }
    }

    const out = {
      ok: true,
      profile: {
        user_id: userId,
        ...(piUser || {}),
      },
      stats: {
        ratingAvg,
        reviewCount,
        exchangeCount,
        categories,
      },
      // extras are optional; if you add columns later, UI will consume without changes.
      extras: {
        location: null,
        workingHours: null,
        businessAddress: null,
      },
      ...(dbgEnabled
        ? {
            dbg: {
              userId,
              hasPiUser: !!piUser,
              prodCount: Array.isArray(products) ? products.length : 0,
            },
          }
        : {}),
    }

    return NextResponse.json(out)
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "PROFILE_API_FAILED",
        details: String(e?.message || e || ""),
        ...(dbgEnabled ? { stack: String(e?.stack || "") } : {}),
      },
      { status: 500 },
    )
  }
}
