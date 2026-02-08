"use client"

import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { ProductCard } from "@/components/product-card"
import {
  Sprout,
  Flame,
  Star,
  TrendingUp,
  Sparkles,
  Leaf,
  Flower2,
  Apple,
  Coffee,
  Fish,
  CheckCircle2,
  MapPin,
  ShoppingCart,
  Tractor,
  PawPrint,
  Grid3x3
} from "lucide-react"

interface AgriculturalProduct {
  id: string
  name: string
  location: string
  price: string
  piPrice?: string
  originalPrice?: string
  discount?: number
  verified: boolean
  rating?: number
  sold?: number
  category: string
}

const flashSaleProducts: AgriculturalProduct[] = [
  {
    id: "NS001",
    name: "Dâu Tây Đà Lạt",
    location: "Đà Lạt, Lâm Đồng",
    price: "99.000đ/kg",
    piPrice: "0.5 Pi/kg",
    originalPrice: "150.000đ/kg",
    discount: 34,
    verified: true,
    rating: 4.8,
    sold: 120,
    category: "Rau củ quả"
  },
  {
    id: "NS002",
    name: "Cà Phê Arabica",
    location: "Buôn Ma Thuột",
    price: "180.000đ/kg",
    piPrice: "1.2 Pi/kg",
    originalPrice: "250.000đ/kg",
    discount: 28,
    verified: true,
    rating: 4.9,
    sold: 85,
    category: "Cây công nghiệp"
  }
]

const popularProducts: AgriculturalProduct[] = [
  {
    id: "NS003",
    name: "Rau Xà Lách Hữu Cơ",
    location: "Đà Lạt",
    price: "25.000đ/bó",
    verified: true,
    rating: 4.7,
    sold: 250,
    category: "Rau củ quả"
  },
  {
    id: "NS004",
    name: "Hoa Hồng Đà Lạt",
    location: "Đà Lạt, Lâm Đồng",
    price: "150.000đ/bó",
    verified: true,
    rating: 4.9,
    sold: 180,
    category: "Hoa – cây cảnh"
  }
]

const bestSellingProducts: AgriculturalProduct[] = [
  {
    id: "NS005",
    name: "Cà Chua Cherry",
    location: "Lâm Đồng",
    price: "35.000đ/kg",
    verified: true,
    rating: 4.6,
    sold: 320,
    category: "Rau củ quả"
  },
  {
    id: "NS006",
    name: "Cá Tươi Sạch",
    location: "Vũng Tàu",
    price: "120.000đ/kg",
    verified: true,
    rating: 4.8,
    sold: 150,
    category: "Động vật"
  }
]

const newProducts: AgriculturalProduct[] = [
  {
    id: "NS007",
    name: "Bưởi Da Xanh",
    location: "Bến Tre",
    price: "45.000đ/kg",
    verified: true,
    category: "Cây ăn quả"
  },
  {
    id: "NS008",
    name: "Trà Oolong Cao Cấp",
    location: "Thái Nguyên",
    price: "200.000đ/hộp",
    verified: true,
    category: "Cây công nghiệp"
  }
]

const categoryProducts = {
  "Rau củ quả": [
    { id: "NS009", name: "Súp Lơ Xanh", location: "Đà Lạt", price: "30.000đ/kg", verified: true },
    { id: "NS010", name: "Cà Rót Tím", location: "Lâm Đồng", price: "20.000đ/kg", verified: true },
    { id: "NS011", name: "Cải Bó Xôi", location: "Đà Lạt", price: "18.000đ/bó", verified: true },
    { id: "NS012", name: "Dưa Leo Mini", location: "Lâm Đồng", price: "25.000đ/kg", verified: true }
  ],
  "Hoa – cây cảnh": [
    { id: "NS013", name: "Hoa Cẩm Chướng", location: "Đà Lạt", price: "80.000đ/bó", verified: true },
    { id: "NS014", name: "Sen Đá", location: "Đà Lạt", price: "35.000đ/chậu", verified: true },
    { id: "NS015", name: "Lan Hồ Điệp", location: "Đà Lạt", price: "250.000đ/chậu", verified: true },
    { id: "NS016", name: "Cây Phát Tài", location: "Lâm Đồng", price: "120.000đ/chậu", verified: true }
  ],
  "Cây ăn quả": [
    { id: "NS017", name: "Cam Canh", location: "Vĩnh Long", price: "40.000đ/kg", verified: true },
    { id: "NS018", name: "Sầu Riêng", location: "Đắk Lắk", price: "120.000đ/kg", verified: true },
    { id: "NS019", name: "Xoài Cát Chu", location: "Đồng Tháp", price: "55.000đ/kg", verified: true },
    { id: "NS020", name: "Vải Thiều", location: "Bắc Giang", price: "80.000đ/kg", verified: true }
  ],
  "Cây công nghiệp": [
    { id: "NS021", name: "Cà Phê Robusta", location: "Đắk Lắk", price: "150.000đ/kg", verified: true },
    { id: "NS022", name: "Tiêu Đen", location: "Bình Phước", price: "200.000đ/kg", verified: true },
    { id: "NS023", name: "Điều Rang", location: "Bình Phước", price: "180.000đ/kg", verified: true },
    { id: "NS024", name: "Trà Xanh", location: "Thái Nguyên", price: "150.000đ/hộp", verified: true }
  ],
  "Động vật": [
    { id: "NS025", name: "Gà Ta Sạch", location: "Hà Nội", price: "150.000đ/kg", verified: true },
    { id: "NS026", name: "Heo Rừng", location: "Sơn La", price: "180.000đ/kg", verified: true },
    { id: "NS027", name: "Bò Wagyu", location: "Đà Lạt", price: "500.000đ/kg", verified: true },
    { id: "NS028", name: "Tôm Sú", location: "Cà Mau", price: "250.000đ/kg", verified: true }
  ]
}

export default function NongSanPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Nông sản")

  // Category mapping function
  const mapProductToCategory = (productCategory: string): string => {
    const catLower = productCategory.toLowerCase()
    
    // Thủy sản keywords
    if (catLower.includes("thủy sản") || catLower.includes("cá") || catLower.includes("tôm") || 
        catLower.includes("cua") || catLower.includes("ốc") || catLower.includes("hải sản")) {
      return "Thủy sản"
    }
    
    // Hoa & Cây cảnh keywords
    if (catLower.includes("hoa") || catLower.includes("lan") || catLower.includes("bonsai") || 
        catLower.includes("cây cảnh") || catLower.includes("sen đá") || catLower.includes("phát tài")) {
      return "Hoa & Cây cảnh"
    }
    
    // Cây công nghiệp keywords
    if (catLower.includes("cà phê") || catLower.includes("tiêu") || catLower.includes("điều") || 
        catLower.includes("cao su") || catLower.includes("trà") || catLower.includes("cacao") || 
        catLower.includes("công nghiệp")) {
      return "Cây công nghiệp"
    }
    
    // Động vật keywords
    if (catLower.includes("gà") || catLower.includes("heo") || catLower.includes("bò") || 
        catLower.includes("dê") || catLower.includes("thỏ") || catLower.includes("vịt") || 
        catLower.includes("động vật")) {
      return "Động vật"
    }
    
    // Nông sản (vegetables, fruits, general agriculture)
    if (catLower.includes("rau") || catLower.includes("củ") || catLower.includes("quả") || 
        catLower.includes("cây ăn quả")) {
      return "Nông sản"
    }
    
    // Default to Loại khác
    return "Loại khác"
  }

  // Filter products by selected category
  const filterByCategory = (products: AgriculturalProduct[]) => {
    if (selectedCategory === "Nông sản" && products.length > 0) {
      // For "Nông sản" show all agricultural products (default view)
      return products.filter(p => {
        const mapped = mapProductToCategory(p.category)
        return mapped === "Nông sản" || mapped === "Loại khác"
      })
    }
    
    return products.filter(product => {
      const mappedCategory = mapProductToCategory(product.category)
      return mappedCategory === selectedCategory
    })
  }

  const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
      case "Rau củ quả":
        return <Leaf className="h-4 w-4" />
      case "Hoa – cây cảnh":
        return <Flower2 className="h-4 w-4" />
      case "Cây ăn quả":
        return <Apple className="h-4 w-4" />
      case "Cây công nghiệp":
        return <Coffee className="h-4 w-4" />
      case "Động vật":
        return <Fish className="h-4 w-4" />
      default:
        return <Sprout className="h-4 w-4" />
    }
  }

  const renderProductCard = (product: AgriculturalProduct, showDiscount = false) => (
    <ProductCard
      key={product.id}
      id={product.id}
      name={product.name}
      location={product.location}
      price={product.price}
      piPrice={product.piPrice}
      originalPrice={product.originalPrice}
      discount={product.discount}
      verified={product.verified}
      rating={product.rating}
      sold={product.sold}
      icon={<Sprout className="h-10 w-10 text-[hsl(122,48%,54%)]/20 group-hover:scale-110 transition-transform" />}
      showDiscount={showDiscount}
    />
  )

  return (
    <div className="min-h-screen bg-white pb-24 w-full max-w-full overflow-x-hidden">
      <AppHeader />

      <main className="px-3 py-5 space-y-6 w-full max-w-[430px] mx-auto pt-[calc(3.5rem+1.25rem)]">
        {/* Page Title */}
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">Chợ Bán Sản phẩm Nông nghiệp TSBIO</h1>
          <p className="text-xs text-muted-foreground font-light">Nơi Nhà vườn / thành viên đăng bán sản phẩm nông nghiệp uy tín, chất lượng có sử dụng tsbio đã được chứng thực</p>
        </div>

        {/* Categories Section - Moved to Top */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[hsl(30,18%,38%)]">Danh mục sản phẩm</h2>
          
          <div className="grid grid-cols-3 gap-3">
            {/* Nông sản */}
            <button
              onClick={() => setSelectedCategory("Nông sản")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-all ${
                selectedCategory === "Nông sản"
                  ? "bg-gradient-to-r from-[#F6C247] to-[#F2A900] text-[#3A2A14] shadow-md"
                  : "bg-[#2FA84F] text-white shadow-sm"
              }`}
            >
              <Leaf className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-tight text-center">Nông sản</span>
            </button>

            {/* Thủy sản */}
            <button
              onClick={() => setSelectedCategory("Thủy sản")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-all ${
                selectedCategory === "Thủy sản"
                  ? "bg-gradient-to-r from-[#F6C247] to-[#F2A900] text-[#3A2A14] shadow-md"
                  : "bg-[#2FA84F] text-white shadow-sm"
              }`}
            >
              <Fish className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-tight text-center">Thủy sản</span>
            </button>

            {/* Cây công nghiệp */}
            <button
              onClick={() => setSelectedCategory("Cây công nghiệp")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-all ${
                selectedCategory === "Cây công nghiệp"
                  ? "bg-gradient-to-r from-[#F6C247] to-[#F2A900] text-[#3A2A14] shadow-md"
                  : "bg-[#2FA84F] text-white shadow-sm"
              }`}
            >
              <Tractor className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-tight text-center">Cây công nghiệp</span>
            </button>

            {/* Động vật */}
            <button
              onClick={() => setSelectedCategory("Động vật")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-all ${
                selectedCategory === "Động vật"
                  ? "bg-gradient-to-r from-[#F6C247] to-[#F2A900] text-[#3A2A14] shadow-md"
                  : "bg-[#2FA84F] text-white shadow-sm"
              }`}
            >
              <PawPrint className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-tight text-center">Động vật</span>
            </button>

            {/* Hoa & Cây cảnh */}
            <button
              onClick={() => setSelectedCategory("Hoa & Cây cảnh")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-all ${
                selectedCategory === "Hoa & Cây cảnh"
                  ? "bg-gradient-to-r from-[#F6C247] to-[#F2A900] text-[#3A2A14] shadow-md"
                  : "bg-[#2FA84F] text-white shadow-sm"
              }`}
            >
              <Flower2 className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-tight text-center">Hoa & Cây cảnh</span>
            </button>

            {/* Loại khác */}
            <button
              onClick={() => setSelectedCategory("Loại khác")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-all ${
                selectedCategory === "Loại khác"
                  ? "bg-gradient-to-r from-[#F6C247] to-[#F2A900] text-[#3A2A14] shadow-md"
                  : "bg-[#2FA84F] text-white shadow-sm"
              }`}
            >
              <Grid3x3 className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-tight text-center">Loại khác</span>
            </button>
          </div>
        </section>

        {/* Flash Sale Section */}
        {filterByCategory(flashSaleProducts).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(4,88%,56%)] to-[hsl(24,96%,54%)] shadow-sm">
                  <Flame className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-[15px] font-bold text-[hsl(30,18%,38%)] leading-snug">Flash Sale</h2>
              </div>
              <Badge variant="outline" className="bg-[hsl(4,88%,56%)]/10 text-[hsl(4,88%,56%)] border-[hsl(4,88%,56%)]/30 text-[10px] h-5 font-bold">
                Kết thúc trong 2:45:30
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {filterByCategory(flashSaleProducts).map((product) => renderProductCard(product, true))}
            </div>
          </section>
        )}

        {/* Popular Products */}
        {filterByCategory(popularProducts).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(45,96%,62%)] shadow-sm">
                <Star className="h-4 w-4 text-white fill-white" />
              </div>
              <h2 className="text-[15px] font-bold text-[hsl(30,18%,38%)] leading-snug">Sản phẩm bình chọn</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {filterByCategory(popularProducts).map((product) => renderProductCard(product))}
            </div>
          </section>
        )}

        {/* Best Selling */}
        {filterByCategory(bestSellingProducts).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(122,45%,52%)] to-[hsl(118,55%,58%)] shadow-sm">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Bán chạy</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {filterByCategory(bestSellingProducts).map((product) => renderProductCard(product))}
            </div>
          </section>
        )}

        {/* New Products */}
        {filterByCategory(newProducts).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(118,55%,58%)] to-[hsl(122,45%,52%)] shadow-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-sm font-bold text-foreground">Sản phẩm mới</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {filterByCategory(newProducts).map((product) => renderProductCard(product))}
            </div>
          </section>
        )}


      </main>

      <AppFooter />
    </div>
  )
}
