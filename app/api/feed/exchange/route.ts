import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config"

// Cache briefly for Pi Browser. Query params still vary, so keep TTL short.
export const revalidate = 15

type RatingAgg = { avg: number; count: number }

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

function buildRatingAgg(rows: any[] | null | undefined): Record<string, RatingAgg> {
  const out: Record<string, RatingAgg> = {}
  if (!rows || rows.length === 0) return out
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const pid = String(r.product_id ?? "")
    if (!pid) continue
    const rating = Number(r.rating || 0)
    sums[pid] = (sums[pid] || 0) + rating
    counts[pid] = (counts[pid] || 0) + 1
  }
  for (const pid of Object.keys(counts)) {
    const c = counts[pid]
    out[pid] = { count: c, avg: c > 0 ? (sums[pid] || 0) / c : 0 }
  }
  return out
}

function formatProduct(p: any, ratingMap: Record<string, RatingAgg>, providerMap: Record<string, string>) {
  return {
    id: p.id,
    title: p.name,
    description: p.short_description || p.description,
    piAmount: p.pi_amount || p.price,
    pitdAmount: p.pitd_amount || p.price,
    flashSaleEnabled: p.flash_sale_enabled,
    flashSaleStartDate: p.flash_sale_start_date ? new Date(p.flash_sale_start_date) : undefined,
    flashSaleEndDate: p.flash_sale_end_date ? new Date(p.flash_sale_end_date) : undefined,
    flashSalePiPrice: p.flash_sale_pi_price,
    flashSalePitdPrice: p.flash_sale_pitd_price,
    originalPiAmount: p.flash_sale_enabled ? p.pi_amount || p.price : undefined,
    originalPitdAmount: p.flash_sale_enabled ? p.pitd_amount || p.price : undefined,
    imageUrl: (() => {
      if (Array.isArray(p.media)) {
        const imageMedia = p.media.find((m: any) => m?.type === "image" && m?.url && !String(m.url).startsWith("blob:"))
        if (imageMedia) return imageMedia.url
      }
      if (p.image_url && !String(p.image_url).startsWith("blob:")) return p.image_url
      return `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(p.name || "product")}`
    })(),
    rating: ratingMap[String(p.id)]?.avg || 0,
    reviewCount: ratingMap[String(p.id)]?.count || 0,
    quantityExchanged: p.total_sold || 0,
    deliveryTime: p.estimated_delivery_days || "2-3 days",
    providerName: providerMap[String(p.provider_id)] || p.provider_name || p.merchant_username || "PITODO",
    providerLocation: p.store_location || "Vietnam",
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const filter = url.searchParams.get("filter") || ""
  const search = url.searchParams.get("search") || ""
  const category = url.searchParams.get("category") || ""
  const nowIso = new Date().toISOString()

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const baseFlash = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("flash_sale_enabled", true)
    .gte("flash_sale_end_date", nowIso)

  const baseFeatured = supabase.from("products").select("*").eq("is_active", true).eq("is_featured", true)
  const baseNew = supabase.from("products").select("*").eq("is_active", true)

  const applyCategory = (q: any) => (category && category !== "all" ? q.eq("category_id", category) : q)
  const applySearch = (q: any) => {
    if (!search) return q
    const searchFilter = `name.ilike.%${search}%,description.ilike.%${search}%`
    return q.or(searchFilter)
  }

  const flashQuery = applySearch(applyCategory(baseFlash))
  const featuredQuery = applySearch(applyCategory(baseFeatured))
  const newQuery = applySearch(applyCategory(baseNew))

  let flashData: any[] = []
  let featuredData: any[] = []
  let newData: any[] = []

  if (filter === "flash") {
    const res = await flashQuery.order("average_rating", { ascending: false }).order("total_sold", { ascending: false }).limit(50)
    flashData = res.data || []
  } else if (filter === "featured") {
    const res = await featuredQuery.order("average_rating", { ascending: false }).order("total_sold", { ascending: false }).limit(50)
    featuredData = res.data || []
  } else if (filter === "new") {
    const res = await newQuery.order("created_at", { ascending: false }).order("average_rating", { ascending: false }).limit(50)
    newData = res.data || []
  } else {
    const [a, b, c] = await Promise.all([
      flashQuery.order("average_rating", { ascending: false }).order("total_sold", { ascending: false }).limit(10),
      featuredQuery.order("average_rating", { ascending: false }).order("total_sold", { ascending: false }).limit(10),
      newQuery.order("created_at", { ascending: false }).order("average_rating", { ascending: false }).limit(10),
    ])
    flashData = a.data || []
    featuredData = b.data || []
    newData = c.data || []
  }

  const all = [...flashData, ...featuredData, ...newData]
  const productIds = uniq(all.map((p: any) => p?.id).filter(Boolean).map(String))
  const providerIds = uniq(all.map((p: any) => p?.provider_id).filter(Boolean).map(String))

  const [reviewsRes, providersRes] = await Promise.all([
    productIds.length
      ? supabase.from("reviews").select("product_id, rating").in("product_id", productIds)
      : Promise.resolve({ data: [] as any[] } as any),
    providerIds.length
      ? supabase.from("pi_users").select("id, pi_username, provider_business_name").in("id", providerIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ])

  const ratingMap = buildRatingAgg((reviewsRes as any).data)
  const providerMap: Record<string, string> = {}
  const providersData = (providersRes as any).data || []
  for (const pr of providersData) {
    const name = String(pr?.provider_business_name || pr?.pi_username || "").trim()
    if (pr?.id && name) providerMap[String(pr.id)] = name
  }

  const payload = {
    flashSaleProducts: flashData.map((p: any) => formatProduct(p, ratingMap, providerMap)),
    featuredProducts: featuredData.map((p: any) => formatProduct(p, ratingMap, providerMap)),
    newProducts: newData.map((p: any) => formatProduct(p, ratingMap, providerMap)),
    ts: Date.now(),
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
    },
  })
}
