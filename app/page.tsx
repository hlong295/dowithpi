"use client"

import React from "react"
import Image from "next/image"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import HeroSearch from "@/components/home/hero-search"
import { 
  ShieldCheck, 
  Sprout, 
  MapPin,
  CheckCircle2,
  Package,
  Store,
  Home as HomeIcon,
  Leaf,
  ChevronRight,
  Star
} from "lucide-react"

type HomeHeroState = {
  headlineTop: string
  headlineBottom: string
}

const DEFAULT_HERO: HomeHeroState = {
  headlineTop: "TSBIO - ĐỒNG HÀNH CỨU VƯỜN",
  headlineBottom: "HƠN 10.000 NHÀ VƯỜN\nPHỤC HỒI VƯỜN THÀNH CÔNG",
}

interface FeaturedProduct {
  id: string
  name: string
  location: string
  price: string
  verified: boolean
  image?: string
}

const featuredProducts: FeaturedProduct[] = [
  {
    id: "TS001",
    name: "Rau Xanh Hữu Cơ",
    location: "Đà Lạt, Lâm Đồng",
    price: "25.000đ/kg",
    verified: true
  },
  {
    id: "TS002",
    name: "Cà Chua Cherry",
    location: "Lâm Đồng",
    price: "35.000đ/kg",
    verified: true
  },
  {
    id: "TS003",
    name: "Dâu Tây Sạch",
    location: "Đà Lạt",
    price: "120.000đ/kg",
    verified: true
  },
  {
    id: "TS004",
    name: "Xà Lách Frillice",
    location: "Đà Lạt",
    price: "30.000đ/kg",
    verified: true
  }
]

interface QuickAccessItem {
  icon: React.ReactNode
  label: string
  color: string
  bgColor: string
}

const quickAccessItems: QuickAccessItem[] = [
  {
    icon: <Package className="h-8 w-8" />,
    label: "Sản phẩm TSBIO",
    color: "text-primary",
    bgColor: "bg-transparent"
  },
  {
    icon: <Leaf className="h-8 w-8" />,
    label: "Nông sản đầu ra",
    color: "text-primary",
    bgColor: "bg-transparent"
  },
  {
    icon: <HomeIcon className="h-8 w-8" />,
    label: "Nhà vườn mẫu",
    color: "text-primary",
    bgColor: "bg-transparent"
  },
  {
    icon: <Leaf className="h-8 w-8" />,
    label: "Cứu vườn – cứu đất",
    color: "text-primary",
    bgColor: "bg-transparent"
  }
]

export default function TSBIOApp() {
  const [hero, setHero] = React.useState<HomeHeroState>({
    headlineTop: "TSBIO - ĐỒNG HÀNH CỨU VƯỜN",
    headlineBottom: "HƠN 10.000 NHÀ VƯỜN\nPHỤC HỒI VƯỜN THÀNH CÔNG",
  })

  React.useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch("/api/public/app-settings", {
          cache: "no-store",
        })
        if (!res.ok) return
        const json = await res.json()
        const next = json?.hero
        if (!next) return
        if (!isMounted) return
        setHero({
          headlineTop: String(next.headlineTop || ""),
          headlineBottom: String(next.headlineBottom || ""),
        })
      } catch {
        // Keep defaults
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-white pb-24 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <AppHeader />

      {/* Main Content */}
      <main className="w-full max-w-[430px] mx-auto pt-14">
        {/* Hero Section with Overlay Blocks */}
        <section className="relative w-full max-w-full">
          {/* Hero Banner with Rich Harvest Background */}
          <div className="overflow-hidden relative h-[220px] sm:h-64 flex flex-col items-center justify-center w-full">
            {/* Rich Harvest Background Image - Full clarity, no overlays */}
            <Image
              src="/tsbio-harvest-hero.jpg"
              alt="TSBIO Fresh Harvest - Tomatoes, Peppers, Vegetables"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 640px) 100vw, 640px"
            />
            
            {/* Organic Wave Bottom Edge */}
            <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden">
              <svg 
                viewBox="0 0 1200 40" 
                preserveAspectRatio="none" 
                className="w-full h-full"
              >
                <path 
                  d="M0,20 Q300,35 600,20 T1200,20 L1200,40 L0,40 Z" 
                  fill="white"
                  opacity="0.98"
                />
              </svg>
            </div>
            
            {/* Centered Text Content - White with brown/earth tone shadow for readability */}
            <div className="relative z-10 text-center text-white px-6 mb-4">
              <h2 
                className="text-xl font-bold leading-tight mb-2 text-balance" 
                style={{ 
                  textShadow: '0 1px 2px rgba(120,80,40,0.9), 0 3px 6px rgba(80,50,20,0.7)'
                }}
              >
                {hero.headlineTop}
              </h2>
              <p 
                className="text-sm leading-relaxed font-medium whitespace-pre-line" 
                style={{ 
                  textShadow: '0 1px 2px rgba(120,80,40,0.9), 0 3px 6px rgba(80,50,20,0.7)'
                }}
              >
                {hero.headlineBottom}
              </p>

              {/* A1.2 CTA: giữ đúng link route hiện có */}
              <div className="mt-3 flex justify-center">
                <Button
                  asChild
                  size="sm"
                  className="rounded-full bg-orange-500 hover:bg-orange-600 text-white px-5 shadow-md"
                >
                  <a href="/cuu-vuon">HỖ TRỢ KỸ THUẬT CHUYÊN SÂU</a>
                </Button>
              </div>

              {/* A1.3 Search: nhập keyword → /chan-doan?q=... */}
              <div className="mt-3">
                <HeroSearch />
              </div>
            </div>
          </div>

          {/* Quick Access Blocks Overlay */}
          <div className="relative z-20 px-4 -mt-16 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {quickAccessItems.map((item, index) => (
                <Card 
                  key={index} 
                  className="bg-white border border-[hsl(30,8%,88%)]/60 shadow-lg hover:shadow-xl transition-all cursor-pointer rounded-[1rem] animate-fade-in-up active:scale-[0.98] hover:-translate-y-1"
                  style={{
                    animationDelay: `${index * 100}ms`
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center gap-2.5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(115,48%,90%)] to-[hsl(118,52%,60%)]/20 text-[hsl(122,48%,54%)] transition-all group-hover:scale-105 shadow-sm">
                        <div className="relative">
                          {item.icon}
                        </div>
                      </div>
                      <span className="text-xs font-semibold leading-[1.3] text-[hsl(30,18%,38%)]">{item.label}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <div className="px-3 space-y-6 pt-4 w-full max-w-full">

          {/* Featured Products Section - "Sản phẩm TSBIO nổi bật" */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[hsl(30,18%,38%)] leading-snug">Sản phẩm TSBIO nổi bật</h2>
              <Badge className="bg-gradient-to-r from-[hsl(45,96%,62%)] to-[hsl(24,96%,54%)] text-white text-[10px] font-bold px-2.5 py-0.5 shadow-sm">
                HOT
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
            {featuredProducts.slice(0, 2).map((product, index) => (
              <div 
                key={product.id} 
                className="space-y-2 cursor-pointer group animate-fade-in-up"
                style={{
                  animationDelay: `${400 + index * 100}ms`
                }}
              >
                <div className="aspect-square bg-[hsl(115,48%,90%)] rounded-[1rem] flex items-center justify-center relative overflow-hidden shadow-sm group-hover:shadow-lg transition-all border border-[hsl(30,8%,88%)]/40">
                  <img
                    src={product.image || "/tsbio-harvest-hero.jpg"}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-300"
                  />
                  {product.verified && (
                    <Badge className="absolute top-2 right-2 bg-[hsl(122,48%,54%)] text-white text-[9px] font-bold px-1.5 py-0.5 shadow-md">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 px-0.5">
                  <h3 className="font-semibold text-xs text-[hsl(30,18%,38%)] group-hover:text-[hsl(122,48%,54%)] transition-colors leading-[1.3]">{product.name}</h3>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-[hsl(30,12%,55%)]" />
                    <p className="text-[10px] text-[hsl(30,12%,55%)] leading-relaxed">{product.location}</p>
                  </div>
                  <p className="text-xs font-bold text-[hsl(4,88%,56%)] leading-relaxed">{product.price}</p>
                </div>
              </div>
            ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer Navigation */}
      <AppFooter />
    </div>
  )
}
