"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { AccountHubSheet } from "@/components/account-hub-sheet"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Star, MapPin, MessageCircle, UserPlus, ThumbsUp, Package } from "lucide-react"
import Link from "next/link"

export default function ProfilePage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [showAccountHub, setShowAccountHub] = useState(false)

  // Mock data - in real app, fetch from API based on route params or current user
  const profileUser = {
    username: user?.username || "PiUser123",
    avatar: "π",
    role: user?.role || "redeemer",
    isTrusted: true,
    isProvider: user?.role === "provider",
    isVerified: true,
    bio: "Yêu thích công nghệ và Pi Network. Trao đổi hàng điện tử, đồ công nghệ.",
    location: "Hồ Chí Minh, Việt Nam",
    rating: 4.8,
    totalTrades: 127,
    followers: 89,
    activeListings: 12,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <Header onOpenAccountHub={() => setShowAccountHub(true)} />

      <main className="container px-4 py-6 max-w-2xl mx-auto space-y-4">
        {/* Profile Header */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
              {profileUser.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-purple-800 truncate">{profileUser.username}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {profileUser.isTrusted && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500" />
                    Thành viên uy tín
                  </span>
                )}
                {profileUser.isProvider && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                    Nhà cung cấp
                  </span>
                )}
                {profileUser.isVerified && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    Đã xác thực
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {profileUser.bio && <p className="text-sm text-gray-600 mb-3 leading-relaxed">{profileUser.bio}</p>}

          {/* Location */}
          {profileUser.location && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <MapPin className="h-4 w-4" />
              <span>{profileUser.location}</span>
            </div>
          )}

          {/* Reputation Stats */}
          <div className="grid grid-cols-3 gap-3 py-4 border-t border-b border-gray-200">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
                <Star className="h-4 w-4 fill-yellow-500" />
                <span className="text-lg font-bold">{profileUser.rating}</span>
              </div>
              <p className="text-xs text-gray-500">Đánh giá</p>
            </div>
            <div className="text-center border-l border-r border-gray-200">
              <div className="text-lg font-bold text-purple-700 mb-1">{profileUser.totalTrades}</div>
              <p className="text-xs text-gray-500">Giao dịch</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-pink-600 mb-1">{profileUser.followers}</div>
              <p className="text-xs text-gray-500">Người theo dõi</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all">
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-medium">Nhắn tin</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-white border-2 border-purple-300 text-purple-600 hover:bg-purple-50 transition-all">
              <UserPlus className="h-5 w-5" />
              <span className="text-xs font-medium">Theo dõi</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-white border-2 border-pink-300 text-pink-600 hover:bg-pink-50 transition-all">
              <ThumbsUp className="h-5 w-5" />
              <span className="text-xs font-medium">Đánh giá</span>
            </button>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button className="flex-1 py-3 px-4 text-sm font-medium text-purple-700 border-b-2 border-purple-500 bg-purple-50/50">
                Sản phẩm ({profileUser.activeListings})
              </button>
              <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">Dịch vụ</button>
              <button className="flex-1 py-3 px-4 text-sm font-medium text-gray-500 hover:bg-gray-50">Đánh giá</button>
            </div>
          </div>

          {/* Active Listings */}
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Link
                key={i}
                href={`/product/${i}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center flex-shrink-0">
                  <Package className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">Sản phẩm mẫu {i}</h3>
                  <p className="text-sm text-gray-500">Còn hàng</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-purple-600">5 π</span>
                    <span className="text-xs text-gray-400">hoặc</span>
                    <span className="text-sm font-bold text-pink-600">10 PITD</span>
                  </div>
                </div>
              </Link>
            ))}

            {profileUser.activeListings === 0 && (
              <div className="py-12 text-center text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Chưa có sản phẩm nào</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <AccountHubSheet
        isOpen={showAccountHub}
        onClose={() => setShowAccountHub(false)}
        pitdBalance={25}
        onOpenTransferModal={() => {}}
        onOpenTransactionHistory={() => {}}
        onOpenPurchases={() => {}}
        onOpenFavorites={() => {}}
      />

      <BottomNav />
    </div>
  )
}
