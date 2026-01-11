"use client"

import type React from "react"
import { Search, Gift, Star } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import Image from "next/image"

interface HeaderProps {
  onOpenAccountHub?: () => void
}

export function Header({ onOpenAccountHub }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage()
  const { user, logout, isAdmin } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  const pitdBalance = 25
  const hasSpunToday = false // Check if user has spun today
  const hasCheckedIn = false // Check if user has checked in today
  const hasNotification = !hasSpunToday || !hasCheckedIn

  const handleAuth = async () => {
    if (user) {
      logout()
      router.push("/")
    } else {
      router.push("/login")
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/exchange?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  const handleAvatarClick = () => {
    console.log("[v0] Header.handleAvatarClick: Calling onOpenAccountHub")
    onOpenAccountHub?.()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-gradient-to-r from-purple-400 via-purple-300 to-pink-300 shadow-[0_4px_20px_rgba(168,85,247,0.2)]">
      <div className="container mx-auto px-3">
        <div className="flex h-11 items-center justify-between gap-2">
          {/* Left: Logo */}
          <button onClick={() => router.push("/")} className="flex items-center gap-1.5 flex-shrink-0">
            <div className="h-7 w-7 rounded-xl overflow-hidden shadow-lg shadow-purple-500/30 bg-white flex items-center justify-center">
              <Image
                src="/pitodo-logo.png"
                alt="DO WITH PI"
                width={28}
                height={28}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="font-bold text-base text-white drop-shadow-sm">{t("appName")}</span>
          </button>

          {/* Right: PITD Balance + Gift Icon + Avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* PITD Balance Pill */}
            <button
              onClick={() => router.push("/deposit-pitd")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-bold text-purple-900">PITD {pitdBalance}</span>
            </button>

            {/* Gift Icon with Notification Badge */}
            <button
              onClick={() => router.push("/lucky-spin")}
              className="relative flex items-center justify-center h-9 w-9 bg-white/90 backdrop-blur-md rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              <Gift className="h-4.5 w-4.5 text-pink-600" />
              {hasNotification && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse" />
              )}
            </button>

            <button
              onClick={handleAvatarClick}
              className="relative flex items-center justify-center h-9 w-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span className="text-white text-sm font-bold">π</span>
            </button>

            {/* Language Switcher */}
            <div className="hidden sm:flex items-center border border-white/40 rounded-full overflow-hidden shadow-sm bg-white/30 backdrop-blur-md">
              <button
                onClick={() => setLanguage("vi")}
                className={`px-3 py-1 text-xs font-medium transition-all duration-300 rounded-full ${
                  language === "vi"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                    : "hover:bg-white/20 text-white"
                }`}
              >
                VI
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1 text-xs font-medium transition-all duration-300 rounded-full ${
                  language === "en"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                    : "hover:bg-white/20 text-white"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSearch} className="pb-2 pt-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-500" />
            <Input
              type="search"
              placeholder={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm rounded-full border-white/40 bg-white/60 backdrop-blur-md focus-visible:ring-white/50 focus-visible:border-white/60 shadow-sm placeholder:text-purple-400/70 text-purple-900"
            />
          </div>
        </form>

        {!hasSpunToday && (
          <div className="pb-2">
            <p className="text-xs text-center text-white/95 font-bold drop-shadow-sm animate-pulse">
              <span className="inline-block brightness-110">🎁</span> Bạn còn 1 lượt quay hôm nay
            </p>
          </div>
        )}
        {hasSpunToday && (
          <div className="pb-2">
            <p className="text-xs text-center text-white/80 font-medium drop-shadow-sm">✅ Đã nhận quà hôm nay</p>
          </div>
        )}
      </div>
    </header>
  )
}
