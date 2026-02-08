"use client"

import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { ProductCard } from "@/components/product-card"
import { Leaf, Droplet, Fish, Beaker, CheckCircle2, MapPin, Star, ShoppingCart } from "lucide-react"

interface TSBIOProduct {
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
  description: string
}

const productCategories = [
  {
    id: "agricultural",
    name: "Vi sinh nông nghiệp",
    icon: Leaf,
    products: [
      {
        id: "TS-AG-001",
        name: "TSBIO Nông Nghiệp 1",
        location: "Đà Lạt, Lâm Đồng",
        price: "250.000đ/lít",
        piPrice: "1.5 Pi/lít",
        verified: true,
        rating: 4.8,
        sold: 145,
        category: "agricultural",
        description: "Cải thiện cấu trúc đất, tăng độ phì nhiêu"
      },
      {
        id: "TS-AG-002",
        name: "TSBIO Nông Nghiệp 2",
        location: "Lâm Đồng",
        price: "280.000đ/lít",
        piPrice: "1.8 Pi/lít",
        verified: true,
        rating: 4.7,
        sold: 128,
        category: "agricultural",
        description: "Phân hủy chất hữu cơ, cung cấp dinh dưỡng"
      },
      {
        id: "TS-AG-003",
        name: "TSBIO Nông Nghiệp 3",
        location: "Đà Lạt",
        price: "320.000đ/lít",
        piPrice: "2.0 Pi/lít",
        verified: true,
        rating: 4.9,
        sold: 98,
        category: "agricultural",
        description: "Chống nấm bệnh, tăng sức đề kháng cây trồng"
      },
      {
        id: "TS-AG-004",
        name: "TSBIO Nông Nghiệp 4",
        location: "Lâm Đồng",
        price: "290.000đ/lít",
        verified: true,
        rating: 4.6,
        sold: 112,
        category: "agricultural",
        description: "Kích thích sinh trưởng, phát triển rễ"
      }
    ]
  },
  {
    id: "organic",
    name: "Vi sinh hữu cơ (phân bón)",
    icon: Beaker,
    products: [
      {
        id: "TS-OR-001",
        name: "TSBIO Phân Bón Hữu Cơ 1",
        location: "Đà Lạt, Lâm Đồng",
        price: "180.000đ/kg",
        piPrice: "1.2 Pi/kg",
        verified: true,
        rating: 4.8,
        sold: 210,
        category: "organic",
        description: "Phân hủy phế phẩm nông nghiệp thành phân bón"
      },
      {
        id: "TS-OR-002",
        name: "TSBIO Phân Bón Hữu Cơ 2",
        location: "Lâm Đồng",
        price: "200.000đ/kg",
        verified: true,
        rating: 4.7,
        sold: 156,
        category: "organic",
        description: "Tăng hàm lượng chất dinh dưỡng trong đất"
      },
      {
        id: "TS-OR-003",
        name: "TSBIO Compost",
        location: "Đà Lạt",
        price: "150.000đ/kg",
        piPrice: "1.0 Pi/kg",
        verified: true,
        rating: 4.9,
        sold: 189,
        category: "organic",
        description: "Ủ phân hữu cơ nhanh, không mùi"
      }
    ]
  },
  {
    id: "livestock",
    name: "Vi sinh thức ăn cho vật nuôi",
    icon: Leaf,
    products: [
      {
        id: "TS-LS-001",
        name: "TSBIO Vật Nuôi 1",
        location: "Đồng Nai",
        price: "220.000đ/lít",
        piPrice: "1.4 Pi/lít",
        verified: true,
        rating: 4.7,
        sold: 95,
        category: "livestock",
        description: "Cải thiện tiêu hóa, tăng trọng nhanh"
      },
      {
        id: "TS-LS-002",
        name: "TSBIO Vật Nuôi 2",
        location: "Bình Dương",
        price: "240.000đ/lít",
        verified: true,
        rating: 4.6,
        sold: 87,
        category: "livestock",
        description: "Giảm mùi hôi chuồng trại, phòng bệnh"
      },
      {
        id: "TS-LS-003",
        name: "TSBIO Probiotics",
        location: "Đồng Nai",
        price: "300.000đ/lít",
        piPrice: "1.9 Pi/lít",
        verified: true,
        rating: 4.8,
        sold: 102,
        category: "livestock",
        description: "Bổ sung lợi khuẩn, tăng sức đề kháng"
      }
    ]
  },
  {
    id: "water",
    name: "Xử lý nước",
    icon: Droplet,
    products: [
      {
        id: "TS-WT-001",
        name: "TSBIO Xử Lý Nước 1",
        location: "Cần Thơ",
        price: "200.000đ/lít",
        piPrice: "1.3 Pi/lít",
        verified: true,
        rating: 4.7,
        sold: 134,
        category: "water",
        description: "Phân hủy chất hữu cơ trong nước thải"
      },
      {
        id: "TS-WT-002",
        name: "TSBIO Xử Lý Nước 2",
        location: "Vĩnh Long",
        price: "180.000đ/lít",
        verified: true,
        rating: 4.6,
        sold: 98,
        category: "water",
        description: "Khử mùi, làm trong nước ao hồ"
      },
      {
        id: "TS-WT-003",
        name: "TSBIO Ao Nuôi",
        location: "Cần Thơ",
        price: "250.000đ/lít",
        piPrice: "1.6 Pi/lít",
        verified: true,
        rating: 4.8,
        sold: 156,
        category: "water",
        description: "Cải thiện môi trường nước nuôi trồng thủy sản"
      }
    ]
  },
  {
    id: "supplement",
    name: "Sản phẩm bổ sung",
    icon: Fish,
    products: [
      {
        id: "TS-SP-001",
        name: "TSBIO Đạm Cá",
        location: "Vũng Tàu",
        price: "350.000đ/kg",
        piPrice: "2.2 Pi/kg",
        verified: true,
        rating: 4.9,
        sold: 167,
        category: "supplement",
        description: "Bổ sung đạm protein từ cá, tăng năng suất"
      },
      {
        id: "TS-SP-002",
        name: "TSBIO Vi Sinh Đa Năng",
        location: "Đà Lạt",
        price: "400.000đ/lít",
        piPrice: "2.5 Pi/lít",
        originalPrice: "500.000đ/lít",
        discount: 20,
        verified: true,
        rating: 4.9,
        sold: 143,
        category: "supplement",
        description: "Kết hợp nhiều chủng vi sinh có lợi"
      },
      {
        id: "TS-SP-003",
        name: "TSBIO Enzyme",
        location: "Lâm Đồng",
        price: "280.000đ/lít",
        verified: true,
        rating: 4.7,
        sold: 121,
        category: "supplement",
        description: "Enzyme sinh học hỗ trợ phân hủy"
      }
    ]
  }
]

export default function TSBIOProductsPage() {
  const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
      case "agricultural":
        return <Leaf className="h-4 w-4" />
      case "organic":
        return <Beaker className="h-4 w-4" />
      case "livestock":
        return <Leaf className="h-4 w-4" />
      case "water":
        return <Droplet className="h-4 w-4" />
      case "supplement":
        return <Fish className="h-4 w-4" />
      default:
        return <Leaf className="h-4 w-4" />
    }
  }

  const renderProductCard = (product: TSBIOProduct, showDiscount = false) => (
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
      icon={<Leaf className="h-10 w-10 text-[hsl(122,48%,54%)]/20 group-hover:scale-110 transition-transform" />}
      showDiscount={showDiscount}
    />
  )

  return (
    <div className="min-h-screen bg-white pb-24 w-full max-w-full overflow-x-hidden">
      <AppHeader />

      <main className="px-3 py-5 space-y-6 w-full max-w-[430px] mx-auto pt-[calc(3.5rem+1.25rem)]">
        {/* Page Title */}
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">Sản phẩm TSBIO</h1>
          <p className="text-xs text-muted-foreground font-light">Các sản phẩm vi sinh sinh học cho nông nghiệp bền vững</p>
        </div>

        {/* Product Categories */}
        {productCategories.map((category) => {
          const Icon = category.icon
          return (
            <section key={category.id} className="space-y-3">
              {/* Category Header */}
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(122,45%,52%)] to-[hsl(118,55%,58%)] shadow-sm">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-sm font-bold text-foreground">{category.name}</h2>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 gap-4">
                {category.products.map((product) => renderProductCard(product, !!product.discount))}
              </div>
            </section>
          )
        })}
      </main>

      <AppFooter />
    </div>
  )
}
