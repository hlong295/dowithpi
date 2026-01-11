"use client"

import type React from "react"
import { Search, Gift, User, Globe } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import { usePitdWallet } from "@/lib/pitd/usePitdWallet"

function isUuid(v: any): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export function Header() {
  const { language, setLanguage, t } = useLanguage()
  const { user } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const userId = useMemo(() => {
    if (!user) return null

    const storedPiUserId = (() => {
      try {
        return typeof window !== "undefined" ? localStorage.getItem("pi_user_id") : null
      } catch {
        return null
      }
    })()

    if ((user as any).type === "pi") {
      const candidate = (user as any).piUserId || storedPiUserId || user.uid
      return isUuid(candidate) ? candidate : null
    } else {
      const candidate = user.uid
      return isUuid(candidate) ? candidate : null
    }
  }, [user])

  const { balance, isLoading: isLoadingBalance } = usePitdWallet(user, userId)

  const hasSpunToday = false
  const hasCheckedIn = false
  const hasNotification = !hasSpunToday || !hasCheckedIn

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false)
      }
    }

    if (isLanguageDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isLanguageDropdownOpen])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/exchange?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang as any)
    setIsLanguageDropdownOpen(false)
  }

  const displayBalance = balance !== null ? Math.floor(balance) : null

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

          {/* Right: Globe Language Selector + PITD Balance + Gift Icon + Avatar */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="flex items-center justify-center h-9 w-9 bg-white/90 backdrop-blur-md rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                aria-label="Select Language"
              >
                <Globe className="h-4.5 w-4.5 text-purple-600" />
              </button>

              {isLanguageDropdownOpen && (
                <div className="absolute top-full mt-1 right-0 w-40 bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden z-50">
                  <button
                    onClick={() => handleLanguageSelect("vi")}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-purple-50 transition-colors ${
                      language === "vi" ? "bg-purple-100 font-semibold" : ""
                    }`}
                  >
                    <span>🇻🇳</span>
                    <span>Việt</span>
                  </button>
                  <button
                    onClick={() => handleLanguageSelect("en")}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-purple-50 transition-colors ${
                      language === "en" ? "bg-purple-100 font-semibold" : ""
                    }`}
                  >
                    <span>🇬🇧</span>
                    <span>English</span>
                  </button>
                  <button
                    onClick={() => handleLanguageSelect("kh")}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-purple-50 transition-colors ${
                      language === "kh" ? "bg-purple-100 font-semibold" : ""
                    }`}
                  >
                    <span>🇰🇭</span>
                    <span>Cambodia</span>
                  </button>
                  <button
                    onClick={() => handleLanguageSelect("zh")}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-purple-50 transition-colors ${
                      language === "zh" ? "bg-purple-100 font-semibold" : ""
                    }`}
                  >
                    <span>🇨🇳</span>
                    <span>中文</span>
                  </button>
                </div>
              )}
            </div>

            {user && (
              <button
                onClick={() => router.push("/account")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
                disabled={isLoadingBalance}
              >
                <img src="/pitd_header_24.png" alt="" width="24" height="24" className="flex-shrink-0" />
                <span className="text-xs font-bold text-purple-900">
                  {isLoadingBalance ? "..." : displayBalance !== null ? displayBalance : "--"}
                </span>
              </button>
            )}

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
              onClick={() => {
                console.log("[v0] Header: Avatar button clicked, navigating to /account")
                router.push("/account")
              }}
              className="flex items-center justify-center h-9 w-9 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
              aria-label="Account"
            >
              <User className="h-4.5 w-4.5 text-white stroke-[2.5]" />
            </button>
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
