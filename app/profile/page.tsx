"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { Star, MapPin, Package, MessageCircle, UserPlus, Award, Store, Shield } from "lucide-react"
import Link from "next/link"

export default function ProfilePage() {
  const { user } = useAuth()

  // Mock data for public profile display
  const profileUser = {
    username: user?.username || "Guest",
    avatar: "π",
    rating: 4.8,
    reviewCount: 127,
    location: "TP. Hồ Chí Minh",
    joinedDate: "Tham gia 6 tháng trước",
    isProvider: (user as any)?.role === "provider" || (user as any)?.role === "root_admin",
    isTrusted: (user as any)?.providerLabel === "trusted" || (user as any)?.memberLabel === "trusted",
    bio: "Thành viên Pi Network tích cực. Yêu thích trao đổi hàng hóa và dịch vụ trong cộng đồng Pi.",
    stats: {
      listings: 12,
      sales: 45,
      followers: 89,
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-lg mx-auto space-y-4">
        {/* Profile Header Card */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm p-5">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
              {profileUser.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-purple-800">{profileUser.username}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    {profileUser.isProvider && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-600 flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        Provider
                      </span>
                    )}
                    {profileUser.isTrusted && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Uy tín
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.floor(profileUser.rating) ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-700">{profileUser.rating}</span>
                <span className="text-xs text-gray-500">({profileUser.reviewCount} đánh giá)</span>
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {profileUser.location}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{profileUser.joinedDate}</p>
            </div>
          </div>

          {/* Bio */}
          {profileUser.bio && (
            <div className="mt-4 p-3 rounded-xl bg-purple-50/50 border border-purple-100">
              <p className="text-sm text-gray-700 leading-relaxed">{profileUser.bio}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all">
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-medium">Nhắn tin</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-white border-2 border-purple-300 text-purple-600 hover:bg-purple-50 transition-all">
              <UserPlus className="h-5 w-5" />
              <span className="text-xs font-medium">Theo dõi</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-white border-2 border-pink-300 text-pink-600 hover:bg-pink-50 transition-all">
              <Award className="h-5 w-5" />
              <span className="text-xs font-medium">Đánh giá</span>
            </button>
          </div>
        </div>

        {/* Stats Card */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-200">
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{profileUser.stats.listings}</p>
              <p className="text-xs text-gray-600 mt-1">Sản phẩm</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-pink-600">{profileUser.stats.sales}</p>
              <p className="text-xs text-gray-600 mt-1">Đã bán</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{profileUser.stats.followers}</p>
              <p className="text-xs text-gray-600 mt-1">Theo dõi</p>
            </div>
          </div>
        </div>

        {/* Provider Shop (if provider) */}
        {profileUser.isProvider && (
          <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500">
              <div className="flex items-center gap-2 text-white">
                <Store className="h-5 w-5" />
                <span className="font-semibold">Gian hàng</span>
              </div>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">
                {profileUser.username} đang cung cấp nhiều sản phẩm và dịch vụ chất lượng
              </p>
              <Link
                href={`/provider/${user?.uid || "shop"}`}
                className="block w-full py-3 text-center bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all"
              >
                Xem gian hàng
              </Link>
            </div>
          </div>
        )}

        {/* Products/Services Placeholder */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              <span className="font-semibold text-gray-800">Sản phẩm nổi bật</span>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center border border-purple-200"
                >
                  <Package className="h-8 w-8 text-purple-400" />
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-gray-500 mt-3">Chức năng hiển thị sản phẩm đang được phát triển</p>
          </div>
        </div>

        {/* Reviews Placeholder */}
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <span className="font-semibold text-gray-800">Đánh giá gần đây</span>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-sm font-bold">
                      U{i}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">User {i}</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">2 ngày trước</span>
                </div>
                <p className="text-xs text-gray-600">Sản phẩm tốt, giao hàng nhanh. Người bán nhiệt tình và uy tín.</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
