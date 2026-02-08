"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { Leaf, Menu, Search, X, Globe, User, Home, Package, HandHeart, Newspaper } from "lucide-react"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const { isAuthenticated, piUser, emailUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const menuItems = [
    { label: "Trang chủ", href: "/", icon: Home },
    { label: "Nông sản", href: "/nong-san", icon: Package },
    { label: "TSBIO", href: "/tsbio", icon: Leaf },
    { label: "Cứu vườn", href: "/cuu-vuon", icon: HandHeart },
    { label: "Tin tức", href: "/tin-tuc", icon: Newspaper }
  ]

  // Prefetch navigation pages on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        menuItems.forEach(item => {
          const link = document.createElement('link')
          link.rel = 'prefetch'
          link.href = item.href
          document.head.appendChild(link)
        })
      })
    }
  }, [])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full overflow-hidden shadow-lg bg-gradient-to-r from-[hsl(130,38%,32%)] via-[hsl(122,48%,54%)] to-[hsl(130,38%,32%)]">
        {/* Base static green background - moved to parent for sticky */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(130,38%,32%)] via-[hsl(122,48%,54%)] to-[hsl(130,38%,32%)]" />
        
        {/* VISIBLE ANIMATED GRADIENT OVERLAY - Moving colors */}
        <div 
          className="absolute inset-0 pointer-events-none animate-bio-header-gradient will-change-transform"
          style={{
            background: 'linear-gradient(90deg, rgba(46,125,50,0.4) 0%, rgba(139,195,74,0.3) 50%, rgba(205,220,57,0.2) 100%)',
            backgroundSize: '200% 100%'
          }}
        />
        
        {/* BREATHING LIGHT EFFECT - Pulsing overlay */}
        <div 
          className="absolute inset-0 pointer-events-none animate-bio-breathe"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
          }}
        />

        <div className="flex h-14 items-center px-3 max-w-screen-sm mx-auto gap-1.5 relative z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {/* Left Zone: Hamburger Menu */}
          <div className="flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 bg-transparent hover:bg-white/20 text-white transition-all active:scale-95"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5 animate-bio-idle-pulse" />}
            </Button>
          </div>

          {/* Center Zone: App Logo and Name */}
          <div className="flex-1 flex items-center justify-center min-w-0">
            <Link href="/" className="flex items-center gap-1.5 cursor-pointer group" prefetch={true}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/25 flex-shrink-0 group-hover:bg-white/35 transition-all group-active:scale-95">
                <Leaf className="h-4 w-4 text-white animate-bio-idle-pulse" style={{ animationDelay: '4s' }} />
              </div>
              <h1 
                className="text-sm font-semibold text-white whitespace-nowrap relative animate-bio-logo-shimmer"
                style={{
                  background: 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.8) 60%, rgba(255,255,255,1) 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text'
                }}
              >
                TSBIO
              </h1>
            </Link>
          </div>

          {/* Right Zone: Icons Group (Search, Language, Account) */}
          <div className="flex-shrink-0 flex items-center gap-0.5">
            {/* Search Icon */}
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 bg-transparent hover:bg-white/20 text-white flex-shrink-0 transition-all active:scale-95"
              aria-label="Tìm kiếm"
            >
              <Search className="h-4.5 w-4.5 animate-bio-idle-pulse" style={{ animationDelay: '1s' }} />
            </Button>

            {/* Language Selector */}
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 bg-transparent hover:bg-white/20 text-white flex-shrink-0 transition-all active:scale-95"
              aria-label="Chuyển ngôn ngữ"
            >
              <Globe className="h-4.5 w-4.5 animate-bio-idle-pulse" style={{ animationDelay: '2s' }} />
            </Button>

            {/* Account/Login */}
            <Link href="/tai-khoan" prefetch={true}>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-9 w-9 bg-transparent hover:bg-white/20 text-white relative flex-shrink-0 transition-all active:scale-95"
                aria-label={
                  isAuthenticated ? (piUser?.username || emailUser?.username || emailUser?.email) : "Đăng nhập"
                }
              >
                <User className="h-4.5 w-4.5 animate-bio-idle-pulse" style={{ animationDelay: '3s' }} />
                {isAuthenticated && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 p-0 bg-[hsl(45,95%,60%)] border-2 border-white rounded-full" />
                )}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Slide Menu Drawer */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav className="fixed left-0 top-14 w-72 bg-white z-40 shadow-2xl border-r border-border/20 animate-bio-fade-in-up" style={{ height: 'calc(100vh - 3.5rem)' }}>
            <div className="p-6 space-y-1">
              <div className="mb-6">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Điều hướng</h2>
              </div>
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all active:scale-98",
                      isActive 
                        ? "bg-[hsl(115,50%,88%)] text-[hsl(122,45%,52%)] shadow-sm" 
                        : "text-foreground hover:bg-muted/50 hover:text-[hsl(122,45%,52%)]"
                    )}
                    onClick={() => setMenuOpen(false)}
                    prefetch={true}
                  >
                    <Icon className={cn(
                      "h-5 w-5 flex-shrink-0",
                      isActive && "text-[hsl(122,45%,52%)]"
                    )} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        </>
      )}
    </>
  )
}
