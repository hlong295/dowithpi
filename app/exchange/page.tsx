"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Zap, Star, Sparkles } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { CATEGORIES } from "@/lib/constants"
import { ProductCard } from "@/components/product-card"

export default function ExchangePage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const filter = searchParams.get("filter")
  const searchQuery = searchParams.get("search")
  const categoryParam = searchParams.get("category")

  const [flashSaleProducts, setFlashSaleProducts] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)


  const providerMapRef = useRef<Record<string, { name: string }>>({})

  async function hydrateProviderMap(supabase: any, products: any[]) {
    const providerIds = Array.from(new Set(products.map((p) => p?.provider_id).filter(Boolean)))
    if (providerIds.length === 0) return

    const { data: providersData, error: providersError } = await supabase
      .from("pi_users")
      .select("id, pi_username, provider_business_name")
      .in("id", providerIds)

    if (!providersError && providersData) {
      const nextMap: Record<string, { name: string }> = {}
      for (const pr of providersData as any[]) {
        const name = (pr.provider_business_name || pr.pi_username || "").trim()
        if (pr.id && name) nextMap[pr.id] = { name }
      }
      providerMapRef.current = nextMap
    }
  }


  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        const supabase = createBrowserClient()

        const nowIso = new Date().toISOString()

        let flashQuery = supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .eq("flash_sale_enabled", true)
          .gte("flash_sale_end_date", nowIso)

        let featuredQuery = supabase.from("products").select("*").eq("is_active", true).eq("is_featured", true)

        let newQuery = supabase.from("products").select("*").eq("is_active", true)

        // Apply category filter if present
        if (categoryParam && categoryParam !== "all") {
          flashQuery = flashQuery.eq("category_id", categoryParam)
          featuredQuery = featuredQuery.eq("category_id", categoryParam)
          newQuery = newQuery.eq("category_id", categoryParam)
        }

        // Apply search filter if present
        if (searchQuery) {
          const searchFilter = `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
          flashQuery = flashQuery.or(searchFilter)
          featuredQuery = featuredQuery.or(searchFilter)
          newQuery = newQuery.or(searchFilter)
        }

        // Apply specific filter if present
        if (filter === "flash") {
          // Only show flash sale products
          const { data: flashData } = await flashQuery
            .order("average_rating", { ascending: false })
            .order("total_sold", { ascending: false })
            .limit(50)

          const allData = flashData || []
          const productIds = allData.map((p) => p.id)
          const productRatings = await fetchProductRatings(supabase, productIds)
           await hydrateProviderMap(supabase, allData)
           setFlashSaleProducts(allData.map((p) => formatProduct(p, productRatings)))
          setFeaturedProducts([])
          setNewProducts([])
        } else if (filter === "featured") {
          // Only show featured products
          const { data: featuredData } = await featuredQuery
            .order("average_rating", { ascending: false })
            .order("total_sold", { ascending: false })
            .limit(50)

          const allData = featuredData || []
          const productIds = allData.map((p) => p.id)
          const productRatings = await fetchProductRatings(supabase, productIds)
           await hydrateProviderMap(supabase, allData)
           setFlashSaleProducts([])
          setFeaturedProducts(allData.map((p) => formatProduct(p, productRatings)))
          setNewProducts([])
        } else if (filter === "new") {
          // Only show new products
          const { data: newData } = await newQuery
            .order("created_at", { ascending: false })
            .order("average_rating", { ascending: false })
            .limit(50)

          const allData = newData || []
          const productIds = allData.map((p) => p.id)
          const productRatings = await fetchProductRatings(supabase, productIds)
           await hydrateProviderMap(supabase, allData)
           setFlashSaleProducts([])
          setFeaturedProducts([])
          setNewProducts(allData.map((p) => formatProduct(p, productRatings)))
        } else {
          // Show all sections
          const [flashRes, featuredRes, newRes] = await Promise.all([
            flashQuery
              .order("average_rating", { ascending: false })
              .order("total_sold", { ascending: false })
              .limit(10),
            featuredQuery
              .order("average_rating", { ascending: false })
              .order("total_sold", { ascending: false })
              .limit(10),
            newQuery.order("created_at", { ascending: false }).order("average_rating", { ascending: false }).limit(10),
          ])

          const flashData = flashRes.data || []
          const featuredData = featuredRes.data || []
          const newData = newRes.data || []

          const allProductIds = [
            ...flashData.map((p) => p.id),
            ...featuredData.map((p) => p.id),
            ...newData.map((p) => p.id),
          ].filter((id, index, arr) => arr.indexOf(id) === index)

          const productRatings = await fetchProductRatings(supabase, allProductIds)

          await hydrateProviderMap(supabase, [...flashData, ...featuredData, ...newData])

          setFlashSaleProducts(flashData.map((p) => formatProduct(p, productRatings)))
          setFeaturedProducts(featuredData.map((p) => formatProduct(p, productRatings)))
          setNewProducts(newData.map((p) => formatProduct(p, productRatings)))
        }
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [categoryParam, searchQuery, filter])

  async function fetchProductRatings(supabase: any, productIds: string[]) {
    const productRatings: Record<string, { avg: number; count: number }> = {}
    if (productIds.length > 0) {
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("product_id, rating")
        .in("product_id", productIds)

      if (reviewsData && reviewsData.length > 0) {
        const sums: Record<string, number> = {}
        const counts: Record<string, number> = {}
        for (const r of reviewsData) {
          const pid = r.product_id
          const rating = Number(r.rating || 0)
          sums[pid] = (sums[pid] || 0) + rating
          counts[pid] = (counts[pid] || 0) + 1
        }
        for (const pid of Object.keys(counts)) {
          const count = counts[pid]
          productRatings[pid] = { count, avg: count > 0 ? sums[pid] / count : 0 }
        }
      }
    }
    return productRatings
  }

  function formatProduct(p: any, productRatings: Record<string, { avg: number; count: number }>) {
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
          const imageMedia = p.media.find((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
          if (imageMedia) return imageMedia.url
        }
        if (p.image_url && !p.image_url.startsWith("blob:")) {
          return p.image_url
        }
        return `/placeholder.svg?height=200&width=200&query=${encodeURIComponent(p.name || "product")}`
      })(),
      rating: productRatings[p.id]?.avg || 0,
      reviewCount: productRatings[p.id]?.count || 0,
      quantityExchanged: p.total_sold || 0,
      deliveryTime: p.estimated_delivery_days || "2-3 days",
      providerName: providerMapRef.current[p.provider_id]?.name || p.provider_name || p.merchant_username || "PITODO",
      providerLocation: p.store_location || "Vietnam",
    }
  }

  const handleRedeem = (productId: string) => {
    router.push(`/product/${productId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-purple-600">{t("loading")}</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
      <Header />

      <main className="container mx-auto px-4 py-6 space-y-10">
        <section>
          <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-4xl mx-auto">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  if (category.id === "all") {
                    params.delete("category")
                  } else {
                    params.set("category", category.id)
                  }
                  router.push(`/exchange?${params.toString()}`)
                }}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/80 hover:bg-white hover:shadow-lg transition-all duration-200 border border-purple-100/50 min-h-[90px]"
              >
                <div className="text-3xl">{category.icon}</div>
                <span className="text-xs font-medium text-center text-gray-700 leading-tight line-clamp-2">
                  {language === "vi" ? category.nameVi : category.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Flash Sale Block */}
        {flashSaleProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  {t("flashSale")}
                </h2>
              </div>
              {!filter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set("filter", "flash")
                    router.push(`/exchange?${params.toString()}`)
                  }}
                  className="gap-1 hover:bg-purple-100 text-purple-700"
                >
                  {t("viewAll")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {flashSaleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onRedeem={() => handleRedeem(product.id)}
                  showActionButton={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* Featured Block */}
        {featuredProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-md">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {t("featuredProducts")}
                </h2>
              </div>
              {!filter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set("filter", "featured")
                    router.push(`/exchange?${params.toString()}`)
                  }}
                  className="gap-1 hover:bg-purple-100 text-purple-700"
                >
                  {t("viewAll")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onRedeem={() => handleRedeem(product.id)}
                  showActionButton={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* New Products Block */}
        {newProducts.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {t("newProducts")}
                </h2>
              </div>
              {!filter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString())
                    params.set("filter", "new")
                    router.push(`/exchange?${params.toString()}`)
                  }}
                  className="gap-1 hover:bg-purple-100 text-purple-700"
                >
                  {t("viewAll")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {newProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onRedeem={() => handleRedeem(product.id)}
                  showActionButton={false}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
