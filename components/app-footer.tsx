"use client"

import React, { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Home, Package, Leaf, HandHeart, Newspaper } from "lucide-react"
import { cn } from "@/lib/utils"

interface FooterNavItem {
  label: string
  icon: React.ElementType
  href: string
  isPrimary?: boolean
}

const navItems: FooterNavItem[] = [
  {
    label: "Trang chủ",
    icon: Home,
    href: "/",
  },
  {
    label: "Chợ Nông sản",
    icon: Package,
    href: "/nong-san",
  },
  {
    label: "TSBIO",
    icon: Leaf,
    href: "/tsbio",
    isPrimary: true,
  },
  {
    label: "Cứu vườn",
    icon: HandHeart,
    href: "/cuu-vuon",
  },
  {
    label: "Tin tức",
    icon: Newspaper,
    href: "/tin-tuc",
  },
]

export function AppFooter() {
  const pathname = usePathname()

  // Keep the footer highlight consistent on nested routes (e.g. product detail pages).
  const activeHref = React.useMemo(() => {
    const p = pathname || "/"
    if (p === "/") return "/"
    if (p.startsWith("/nong-san")) return "/nong-san"
    if (p.startsWith("/tsbio")) return "/tsbio"
    if (p.startsWith("/cuu-vuon")) return "/cuu-vuon"
    if (p.startsWith("/tin-tuc")) return "/tin-tuc"
    // fallback: no tab
    return p
  }, [pathname])

  // Prefetch all navigation pages on idle
  useEffect(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        navItems.forEach(item => {
          const link = document.createElement('link')
          link.rel = 'prefetch'
          link.href = item.href
          document.head.appendChild(link)
        })
      })
    }
  }, [])

  return (
    <footer className="fixed bottom-0 left-0 right-0 w-full z-50 border-t border-gray-200/60 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)' }}>
      <nav className="w-full max-w-[430px] mx-auto">
        <ul className="flex items-center justify-between h-20 px-1 w-full">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeHref === item.href
            const isPrimary = item.isPrimary

            return (
              <li key={item.href} className="flex-1 min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 px-0.5 transition-all duration-300 active:scale-95",
                    isPrimary && "relative -mt-6"
                  )}
                  prefetch={true}
                >
                  {isPrimary ? (
                    // TSBIO Center Button - The Living Biological Heart
                    <div className="relative w-16 h-16 animate-bio-breathe">
                      {/* Outer soft glow - life energy aura */}
                      <div 
                        className="absolute -inset-2 rounded-full animate-subtle-glow" 
                        style={{
                          background: 'radial-gradient(circle, rgba(118, 209, 122, 0.4) 0%, rgba(253, 216, 53, 0.15) 50%, transparent 70%)',
                        }}
                      />

                      {/* Always-on gentle ring so users feel this is the core tab */}
                      <div
                        className={cn(
                          "absolute -inset-1 rounded-full opacity-70 animate-bio-core-ring",
                          isActive && "opacity-90"
                        )}
                        style={{
                          background:
                            'conic-gradient(from 180deg, rgba(118, 209, 122, 0.0) 0%, rgba(118, 209, 122, 0.35) 25%, rgba(253, 216, 53, 0.25) 50%, rgba(118, 209, 122, 0.35) 75%, rgba(118, 209, 122, 0.0) 100%)',
                          filter: 'blur(0.5px)',
                        }}
                      />
                      
                      {/* Active state soft pulse */}
                      {isActive && (
                        <>
                          <div 
                            className="absolute inset-0 rounded-full animate-bio-glow-pulse"
                            style={{
                              background: 'radial-gradient(circle, rgba(118, 209, 122, 0.6) 0%, transparent 60%)',
                            }}
                          />
                          <div 
                            className="absolute inset-0 rounded-full animate-bio-cell-expand"
                            style={{
                              boxShadow: '0 0 0 0 rgba(118, 209, 122, 0.5)',
                            }}
                          />
                        </>
                      )}
                      
                      {/* Main button circle with heart pulse */}
                      <div className={cn(
                        "flex items-center justify-center w-full h-full rounded-full relative overflow-hidden",
                        isActive 
                          ? "bg-gradient-to-br from-[hsl(122,48%,54%)] via-[hsl(118,52%,60%)] to-[hsl(122,48%,54%)] animate-bio-heart-pulse" 
                          : "bg-gradient-to-br from-[hsl(130,38%,32%)] via-[hsl(122,48%,54%)] to-[hsl(118,52%,60%)] shadow-lg hover:shadow-xl transition-shadow"
                      )}>
                        <Icon className="h-8 w-8 text-white relative z-10" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }} />
                        
                        {/* Subtle shimmer for vitality */}
                        <div 
                          className={cn(
                            "absolute inset-0 rounded-full opacity-20",
                            isActive && "animate-shimmer"
                          )}
                          style={{
                            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                          }}
                        />
                        
                        {/* Organic inner glow */}
                        <div 
                          className="absolute inset-2 rounded-full opacity-30"
                          style={{
                            background: 'radial-gradient(circle at 40% 40%, rgba(255,255,255,0.4) 0%, transparent 60%)',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    // Regular Nav Items - Increased contrast and clarity
                    <div className={cn(
                      "flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 relative",
                      isActive 
                        ? "bg-[#22C55E]/10 text-[#22C55E] shadow-sm" 
                        : "text-[#6B7280] hover:text-[#22C55E] hover:bg-gray-100/50"
                    )}>
                      <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
                      
                      {/* Active glow - reduced opacity */}
                      {isActive && (
                        <>
                          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                          <div 
                            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-[#22C55E]/40 blur-[2px]"
                          />
                        </>
                      )}
                    </div>
                  )}
                  
                  <span
                    className={cn(
                      "text-[11px] font-medium leading-none whitespace-nowrap transition-colors duration-300",
                      isPrimary && "font-bold text-[#22C55E]",
                      isActive && !isPrimary && "text-[#22C55E] font-semibold",
                      !isActive && !isPrimary && "text-[#6B7280]"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </footer>
  )
}
