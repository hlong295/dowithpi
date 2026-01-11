"use client"

import { useLanguage } from "@/lib/language-context"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Zap,
  Star,
  Sparkles,
  DollarSign,
  Wallet,
  ArrowLeftRight,
  Heart,
  HelpCircle,
  MapPin,
  Gift,
} from "lucide-react"
import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"

export default function HomePage() {
  const { t, language } = useLanguage()
  const router = useRouter()

  const [flashSaleProducts, setFlashSaleProducts] = useState<any[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [piRates, setPiRates] = useState({
    buyPrice: "...",
    sellPrice: "...",
    loading: true,
  })

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        const supabase = createBrowserClient()

        const nowIso = new Date().toISOString()
        const [flashRes, featuredRes, newRes] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .eq("flash_sale_enabled", true)
            .gte("flash_sale_end_date", nowIso)
            .order("average_rating", { ascending: false })
            .order("total_sold", { ascending: false })
            .limit(10),
          supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .eq("is_featured", true)
            .order("average_rating", { ascending: false })
            .order("total_sold", { ascending: false })
            .limit(10),
          supabase
            .from("products")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .order("average_rating", { ascending: false })
            .limit(10),
        ])

        const flashData = flashRes.data || []
        const featuredData = featuredRes.data || []
        const newData = newRes.data || []

        const allProductIds = [
          ...flashData.map((p) => p.id),
          ...featuredData.map((p) => p.id),
          ...newData.map((p) => p.id),
        ].filter((id, index, arr) => arr.indexOf(id) === index)

        const productRatings: Record<string, { avg: number; count: number }> = {}
        if (allProductIds.length > 0) {
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("product_id, rating")
            .in("product_id", allProductIds)

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

        const formatProduct = (p: any) => ({
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
          providerName: p.provider_name || "PITODO",
          providerLocation: p.store_location || "Vietnam",
        })

        setFlashSaleProducts(flashData.map(formatProduct))
        setFeaturedProducts(featuredData.map(formatProduct))
        setNewProducts(newData.map(formatProduct))
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  useEffect(() => {
    async function fetchPiRates() {
      try {
        setTimeout(() => {
          setPiRates({
            buyPrice: "...",
            sellPrice: "...",
            loading: false,
          })
        }, 500)
      } catch (error) {
        console.error("Error fetching Pi rates:", error)
        setPiRates({
          buyPrice: "...",
          sellPrice: "...",
          loading: false,
        })
      }
    }

    fetchPiRates()
  }, [])

  const handleRedeem = (productId: string) => {
    router.push(`/product/${productId}`)
  }

  const featureBlocks = [
    {
      id: "buy-sell-pi",
      icon: <DollarSign className="h-6 w-6 text-white" />,
      title: "Mua - Bán Pi",
      description: "Mua Pi tích lũy - Bán Pi khi cần",
      gradient: "from-emerald-500 to-teal-500",
      action: () => router.push("/buy-sell-pi"),
      contrast: "high",
      content: (
        <div className="mt-2 space-y-1 border-t border-emerald-100 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Giá mua Pi:</span>
            <span className="text-xs font-semibold text-emerald-600">{piRates.buyPrice} VND</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Giá bán Pi:</span>
            <span className="text-xs font-semibold text-emerald-600">{piRates.sellPrice} VND</span>
          </div>
        </div>
      ),
    },
    {
      id: "deposit-pitd",
      icon: <Wallet className="h-6 w-6 text-white" />,
      title: "Nạp PITD Token",
      description: "PITD giúp bạn dùng Pi an toàn hơn",
      gradient: "from-blue-500 to-indigo-500",
      action: () => router.push("/deposit-pitd"),
      contrast: "high",
      content: (
        <div className="mt-2 space-y-1.5 border-t border-blue-100 pt-2">
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] leading-tight">📅 Check-in mỗi ngày</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] leading-tight">🎁 Quay số & hoạt động</span>
          </div>
        </div>
      ),
    },
    {
      id: "exchange-goods",
      icon: <ArrowLeftRight className="h-6 w-6 text-white" />,
      title: "Trao đổi hàng hóa dịch vụ",
      description: "Dùng PI - PITD đổi hàng hóa và dịch vụ bạn cần",
      gradient: "from-purple-500 to-pink-500",
      action: () => router.push("/exchange"),
      contrast: "medium",
    },
    {
      id: "charity",
      icon: <Heart className="h-6 w-6 text-white" />,
      title: "Quỹ Từ Thiện - Ủng Hộ",
      description: "Chung tay chia sẻ bằng Pi",
      gradient: "from-rose-500 to-red-500",
      action: () => router.push("/charity"),
      contrast: "high",
      content: (
        <div className="mt-2 border-t border-rose-100 pt-2">
          <p className="text-[10px] text-gray-600 leading-tight">Đóng góp ủng hộ bằng Pi</p>
        </div>
      ),
    },
    {
      id: "support-services",
      icon: <HelpCircle className="h-6 w-6 text-white" />,
      title: "Dịch vụ hỗ trợ Pi",
      description: "KYC & Hỗ trợ Pi",
      gradient: "from-amber-500 to-orange-500",
      action: () => router.push("/support"),
      contrast: "high",
    },
    {
      id: "locations",
      icon: <MapPin className="h-6 w-6 text-white" />,
      title: "Địa điểm trao đổi Pi",
      description: "Tìm gần bạn",
      gradient: "from-cyan-500 to-blue-500",
      action: () => router.push("/locations"),
      contrast: "medium",
    },
  ]

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-purple-600">{t("loading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-10">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/lucky-spin")}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 hover:from-yellow-500 hover:via-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl transition-all duration-300 text-left group relative overflow-hidden"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg flex-shrink-0 animate-pulse">
              <Gift className="h-7 w-7 text-white" />
            </div>

            <div className="flex-1">
              <h3 className="text-base font-bold text-white leading-tight">Quay số trúng thưởng</h3>
              <p className="text-xs text-white/90 leading-snug mt-0.5">Mỗi ngày 1 lượt - Có quà liền</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-sm font-bold text-yellow-200 animate-pulse">🎁 Nhận Pi hoặc PITD</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
            <div className="bg-white/95 backdrop-blur-sm px-2.5 py-0.5 rounded-full shadow-md">
              <span className="text-[10px] font-bold text-orange-600">FREE mỗi ngày</span>
            </div>
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform duration-300">
              <ArrowRight className="h-5 w-5 text-white" />
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-4xl mx-auto">
        {featureBlocks.map((block) => (
          <button
            key={block.id}
            onClick={block.action}
            className={`flex flex-col p-3 rounded-2xl bg-white hover:shadow-xl transition-all duration-300 text-left group ${
              block.contrast === "high"
                ? "border-2 border-purple-200/80 shadow-md"
                : "border border-purple-100/50 shadow-sm"
            }`}
          >
            <div className="flex items-center">
              <div
                className={`h-10 w-10 rounded-xl bg-gradient-to-br ${block.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}
              >
                {block.icon}
              </div>
              <h3 className="ml-2.5 text-xs font-bold text-gray-800 leading-tight">{block.title}</h3>
            </div>
            <p className="text-[10px] text-gray-500 leading-snug mt-2 w-full">{block.description}</p>
            {block.content && <div className="w-full">{block.content}</div>}
          </button>
        ))}
      </div>

      {flashSaleProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Flash Sale
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/exchange?filter=flash")}
              className="gap-1 hover:bg-purple-100 text-purple-700"
            >
              {t("viewAll")}
              <ArrowRight className="h-4 w-4" />
            </Button>
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

      {featuredProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-md">
                <Star className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Sản Phẩm Nổi Bật
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/exchange?filter=featured")}
              className="gap-1 hover:bg-purple-100 text-purple-700"
            >
              {t("viewAll")}
              <ArrowRight className="h-4 w-4" />
            </Button>
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

      {newProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Sản Phẩm Mới
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/exchange?filter=new")}
              className="gap-1 hover:bg-purple-100 text-purple-700"
            >
              {t("viewAll")}
              <ArrowRight className="h-4 w-4" />
            </Button>
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
    </div>
  )
}
