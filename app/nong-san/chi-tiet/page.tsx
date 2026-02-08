"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { usePiPayment } from "@/hooks/use-pi-payment"
import {
  Sprout,
  MapPin,
  CheckCircle2,
  ChevronLeft,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Star,
  Shield,
  Wallet,
  AlertCircle
} from "lucide-react"
import Link from "next/link"

interface ProductMedia {
  type: "video" | "image"
  url: string
}

interface ProductDetail {
  id: string
  name: string
  location: string
  farm: string
  price: string
  piPrice?: string
  verified: boolean
  rating: number
  sold: number
  category: string
  description: string
  certifications: string[]
  media: ProductMedia[]
}

// Sample product data
const productData: Record<string, ProductDetail> = {
  "NS001": {
    id: "NS001",
    name: "Dâu Tây Đà Lạt",
    location: "Đà Lạt, Lâm Đồng",
    farm: "Nông Trại Xanh Đà Lạt",
    price: "99.000đ/kg",
    piPrice: "0.5 Pi/kg",
    verified: true,
    rating: 4.8,
    sold: 120,
    category: "Rau củ quả",
    description: "Dâu tây Đà Lạt trồng theo quy trình hữu cơ, không sử dụng hóa chất độc hại. Quả to, ngọt tự nhiên, giàu vitamin C. Được canh tác với TSBIO, đảm bảo an toàn tuyệt đối cho người tiêu dùng.",
    certifications: ["TSBIO Verified", "VietGAP", "Organic"],
    media: [
      { type: "video", url: "/videos/product-demo.mp4" },
      { type: "image", url: "/images/product1.jpg" },
      { type: "image", url: "/images/product2.jpg" }
    ]
  },
  "NS002": {
    id: "NS002",
    name: "Cà Phê Arabica",
    location: "Buôn Ma Thuột",
    farm: "Trại Cà Phê Cao Nguyên",
    price: "180.000đ/kg",
    piPrice: "1.2 Pi/kg",
    verified: true,
    rating: 4.9,
    sold: 85,
    category: "Cây công nghiệp",
    description: "Cà phê Arabica cao cấp từ cao nguyên Buôn Ma Thuột. Hương vị đậm đà, thơm ngon đặc trưng. Canh tác theo phương pháp hữu cơ với TSBIO, đảm bảo chất lượng tốt nhất.",
    certifications: ["TSBIO Verified", "Organic", "Fair Trade"],
    media: [
      { type: "image", url: "/images/coffee1.jpg" },
      { type: "image", url: "/images/coffee2.jpg" }
    ]
  }
}

// Related products (sample data)
const relatedProducts = [
  {
    id: "NS003",
    name: "Rau Xà Lách Hữu Cơ",
    location: "Đà Lạt",
    price: "25.000đ/bó",
    verified: true
  },
  {
    id: "NS004",
    name: "Cà Chua Cherry",
    location: "Lâm Đồng",
    price: "35.000đ/kg",
    verified: true
  }
]

function ProductDetailContent() {
  const searchParams = useSearchParams()
  const productId = searchParams.get("id") || searchParams.get("slug") || "NS001"
  const product = productData[productId] || productData["NS001"]

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [expandedVerified, setExpandedVerified] = useState(false)
  const [expandedDescription, setExpandedDescription] = useState(false)

  // Pi Payment integration
  const { isAuthenticated, isWalletConnected, isLoading: isPiLoading, initiatePiPayment } = usePiPayment()

  // Sort media to show video first
  const sortedMedia = [...product.media].sort((a, b) => 
    a.type === "video" ? -1 : b.type === "video" ? 1 : 0
  )

  const handlePiPayment = async () => {
    if (!isAuthenticated) {
      alert("Vui lòng đăng nhập bằng Pi Network để sử dụng tính năng này")
      return
    }

    if (!isWalletConnected) {
      alert("Vui lòng kết nối ví Pi")
      return
    }

    try {
      const piAmount = parseFloat(product.piPrice?.split(" ")[0] || "0")
      await initiatePiPayment({
        amount: piAmount,
        memo: `Mua ${product.name}`,
        metadata: {
          productId: product.id,
          productName: product.name
        }
      })
      alert("Chuẩn bị thanh toán Pi (chưa xử lý thực tế)")
    } catch (error) {
      console.error("[v0] Pi payment error:", error)
      alert("Có lỗi xảy ra khi chuẩn bị thanh toán")
    }
  }

  return (
    <div className="min-h-screen bg-white pb-24 w-full max-w-full overflow-x-hidden">
      <AppHeader />

      <main className="w-full max-w-[430px] mx-auto pt-14">
        {/* Back Button */}
        <div className="sticky top-14 z-40 bg-white border-b border-border/50 px-3 py-2">
          <Link href="/nong-san">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs hover:bg-transparent bg-transparent font-medium">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Quay lại
            </Button>
          </Link>
        </div>

        {/* Media Block */}
        <section className="bg-secondary/30">
          <div className="aspect-square bg-secondary/50 flex items-center justify-center relative">
            {sortedMedia[currentMediaIndex]?.type === "video" ? (
              <div className="w-full h-full flex items-center justify-center bg-black/5">
                <video
                  className="w-full h-full object-cover"
                  controls
                  poster="/placeholder.jpg"
                >
                  <source src={sortedMedia[currentMediaIndex].url} type="video/mp4" />
                  Video không được hỗ trợ
                </video>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Sprout className="h-20 w-20 text-muted-foreground/30" />
              </div>
            )}

            {/* Verified Badge */}
            {product.verified && (
              <Badge className="absolute top-3 right-3 bg-primary text-white text-[10px] h-5 px-2">
                <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                TSBIO Verified
              </Badge>
            )}
          </div>

          {/* Media Thumbnails */}
          {sortedMedia.length > 1 && (
            <div className="p-3 flex gap-2 overflow-x-auto">
              {sortedMedia.map((media, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentMediaIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    currentMediaIndex === index ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="w-full h-full bg-secondary/50 flex items-center justify-center">
                    {media.type === "video" ? (
                      <span className="text-[8px] font-medium">Video</span>
                    ) : (
                      <Sprout className="h-6 w-6 text-muted-foreground/30" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Product Information */}
        <section className="px-3 py-5 space-y-4">
          {/* Title & Rating */}
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-foreground leading-snug">{product.name}</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-semibold">{product.rating}</span>
              </div>
              <span className="text-xs text-muted-foreground font-light">Đã bán {product.sold}</span>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <p className="text-lg font-bold text-primary">{product.price}</p>
            {product.piPrice && (
              <p className="text-xs text-accent font-semibold">Hoặc {product.piPrice}</p>
            )}
          </div>

          {/* Location & Farm */}
          <div className="space-y-1.5 py-4 border-y border-border/50">
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-foreground">{product.farm}</p>
                <p className="text-muted-foreground font-light">{product.location}</p>
              </div>
            </div>
          </div>

          {/* Pi Wallet Status */}
          {isAuthenticated && product.piPrice && (
            <Card className="bg-accent/10 border-accent/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Wallet className={`h-4 w-4 ${isWalletConnected ? "text-accent" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      {isWalletConnected ? "Ví Pi đã kết nối" : "Ví Pi chưa kết nối"}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-light">
                      {isWalletConnected 
                        ? "Bạn có thể thanh toán bằng Pi" 
                        : "Vui lòng kết nối ví để thanh toán"}
                    </p>
                  </div>
                  {isWalletConnected && (
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Buy Buttons */}
          <div className="space-y-2">
            <Button className="w-full h-10 bg-primary hover:bg-primary/90 text-white text-sm font-medium">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Mua ngay
            </Button>
            {product.piPrice && (
              <Button 
                variant="outline" 
                className={`w-full h-10 border-accent text-accent hover:bg-accent/10 text-sm font-medium bg-transparent ${
                  !isAuthenticated || !isWalletConnected ? "opacity-50" : ""
                }`}
                onClick={handlePiPayment}
                disabled={!isAuthenticated || !isWalletConnected || isPiLoading}
              >
                <span className="mr-2">π</span>
                {isPiLoading ? "Đang xử lý..." : "Mua bằng Pi"}
              </Button>
            )}
            
            {product.piPrice && !isAuthenticated && (
              <div className="flex items-start gap-2 p-2 bg-accent/10 border border-accent/20 rounded-lg">
                <AlertCircle className="h-3 w-3 text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-accent/80 leading-relaxed font-light">
                  Đăng nhập bằng Pi Network để thanh toán bằng Pi
                </p>
              </div>
            )}
          </div>

          {/* TSBIO Verified Section */}
          <Card className="bg-white border-border/50">
            <CardContent className="p-3">
              <button
                onClick={() => setExpandedVerified(!expandedVerified)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">TSBIO Verified</span>
                </div>
                {expandedVerified ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {expandedVerified && (
                <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground leading-relaxed font-light">
                    Sản phẩm được chứng nhận bởi TSBIO, đảm bảo nguồn gốc rõ ràng và quy trình canh tác minh bạch.
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Chứng nhận:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {product.certifications.map((cert, index) => (
                        <Badge key={index} variant="outline" className="text-[10px] h-5 bg-white font-medium">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          <div className="space-y-2">
            <button
              onClick={() => setExpandedDescription(!expandedDescription)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-sm font-semibold text-foreground">Mô tả sản phẩm</h2>
              {expandedDescription ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {expandedDescription && (
              <p className="text-xs text-muted-foreground leading-relaxed font-light">
                {product.description}
              </p>
            )}
          </div>

          {/* Related Products */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            <h2 className="text-sm font-semibold text-foreground">Sản phẩm liên quan</h2>
            <div className="grid grid-cols-2 gap-3">
              {relatedProducts.map((related) => (
                <Link key={related.id} href={`/nong-san/chi-tiet?id=${related.id}`}>
                  <Card className="bg-white border-border/50 overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                    <div className="aspect-square bg-secondary/40 flex items-center justify-center relative">
                      <Sprout className="h-10 w-10 text-muted-foreground/25" />
                      {related.verified && (
                        <Badge className="absolute top-2 right-2 bg-primary text-white text-[8px] h-5 px-2 font-medium">
                          <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-semibold text-xs leading-snug line-clamp-1 mb-1.5">{related.name}</h3>
                      <div className="flex items-start gap-1 mb-2">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-[10px] text-muted-foreground leading-tight line-clamp-1">{related.location}</span>
                      </div>
                      <p className="text-xs font-bold text-primary">{related.price}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}

export default function ChiTietNongSanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ProductDetailContent />
    </Suspense>
  )
}
