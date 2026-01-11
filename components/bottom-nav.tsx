"use client"

import { Home, ArrowLeftRight, User, Gift, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language-context"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function BottomNav() {
  const { t } = useLanguage()
  const pathname = usePathname()

  const hasSpunToday = false

  const navItems = [
    { id: "home", href: "/", icon: Home, labelKey: "navHome" as const },
    { id: "exchange", href: "/exchange", icon: ArrowLeftRight, labelKey: "navExchange" as const },
    { id: "lucky-spin", href: "/lucky-spin", icon: Gift, labelKey: "navLuckySpin" as const, isCenter: true },
    { id: "missions", href: "/missions", icon: Target, labelKey: "navMissions" as const },
    { id: "profile", href: "/profile", icon: User, labelKey: "navProfile" as const },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-[0_-4px_24px_rgba(168,85,247,0.15)] border-t border-purple-100/50">
      <div className="container px-1">
        <div className="grid grid-cols-5 h-16 items-end pb-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const isCenter = item.isCenter

            if (isCenter) {
              return (
                <div key={item.id} className="flex justify-center relative">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 transition-all duration-300",
                      "h-14 w-14 rounded-2xl shadow-xl -mt-4",
                      isActive
                        ? "bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 scale-105"
                        : hasSpunToday
                          ? "bg-gradient-to-br from-gray-400 to-gray-500"
                          : "bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 hover:scale-105",
                    )}
                  >
                    <item.icon className="h-6 w-6 stroke-[2.5] text-white" />
                    <span className="text-[8px] font-bold text-white">Quay số</span>
                    {!hasSpunToday && (
                      <span className="absolute -top-1 -right-0 px-1 py-0.5 bg-yellow-400 text-[7px] font-black text-red-600 rounded-full shadow-md animate-pulse">
                        FREE
                      </span>
                    )}
                  </Link>
                </div>
              )
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-300 rounded-xl mx-0.5",
                  isActive
                    ? "bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30"
                    : "text-gray-400 hover:text-gray-600",
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 transition-all duration-300",
                    isActive ? "stroke-[2.5] text-white" : "stroke-[2]",
                  )}
                />
                <span
                  className={cn(
                    "text-[9px] transition-all duration-300 whitespace-nowrap",
                    isActive ? "font-bold text-white" : "font-medium opacity-70",
                  )}
                >
                  {t(item.labelKey)}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
