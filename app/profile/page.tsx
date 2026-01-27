"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Star,
  MapPin,
  MessageCircle,
  UserPlus,
  ThumbsUp,
  Package,
  Store,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react"

export default function ProfilePage() {
  const { t, language } = useLanguage()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<"posts" | "products" | "reviews">("posts")

  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileSummary, setProfileSummary] = useState<any>(null)

  // Fetch real profile data from server (P5.1)
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user) return
      setLoadingProfile(true)
      try {
        const headers: Record<string, string> = {}
        // Support multiple auth flows (Pi + Email). Keep existing login flow.
        if ((user as any)?.id) headers["x-user-id"] = String((user as any).id)
        if ((user as any)?.uid) headers["x-user-id"] = String((user as any).uid)
        if ((user as any)?.pi_user_id) headers["x-pi-user-id"] = String((user as any).pi_user_id)
        if ((user as any)?.pi_uid) headers["x-pi-user-id"] = String((user as any).pi_uid)
        if ((user as any)?.username) headers["x-username"] = String((user as any).username)

        const res = await fetch("/api/profile", {
          method: "GET",
          headers,
          cache: "no-store",
        })
        const json = await res.json().catch(() => null)
        if (!cancelled) setProfileSummary(json)
      } catch (e: any) {
        if (!cancelled) {
          setProfileSummary({ ok: false, error: String(e?.message || e) })
        }
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user])

  const profileData = useMemo(() => {
    const fallbackUsername = user?.username || user?.email || ""
    const p = profileSummary?.profile || null
    const w = profileSummary?.wallet || null

    const role = String(p?.user_role || (user as any)?.role || "").toLowerCase()
    const isProvider = Boolean(p?.provider_approved) || ["provider", "admin", "root_admin"].includes(role)
    const isVerified = String(p?.verification_status || "").toLowerCase() === "verified" || Boolean(p?.provider_approved)
    const isTrusted = isVerified || role === "trusted"

    const createdAt = p?.created_at ? new Date(p.created_at) : null
    const joinDate = createdAt
      ? `${String(createdAt.getMonth() + 1).padStart(2, "0")}/${createdAt.getFullYear()}`
      : "—"

    const displayName = (p?.full_name || p?.pi_username || fallbackUsername || "").toString()
    const username = (p?.pi_username || fallbackUsername || "").toString()

    const reviewCount = typeof profileSummary?.stats?.reviewsCount === "number" ? profileSummary.stats.reviewsCount : 0
    const exchangeCount = typeof profileSummary?.stats?.productsCount === "number" ? profileSummary.stats.productsCount : 0

    return {
      username: username || "—",
      displayName: displayName || "—",
      handle: username ? `@${username}` : "—",
      avatar: "π",
      isProvider,
      isTrusted,
      isVerified,
      rating: "—",
      reviewCount,
      exchangeCount,
      location: "—",
      joinDate,
      bio: (p?.provider_description || "").toString() || "—",
      categories: [],
      businessName: (p?.provider_business_name || "").toString() || (isProvider ? "—" : ""),
      businessDesc: (p?.provider_description || "").toString() || (isProvider ? "—" : ""),
      contactInfo: (p?.pi_username ? `pi://${p.pi_username}` : "—").toString(),
      workingHours: "—",
      businessAddress: "—",
      // Wallet summary (kept for future UI sections without altering layout)
      wallet: w
        ? {
            balance: Number(w.balance || 0),
            locked_balance: Number(w.locked_balance || 0),
            total_spent: Number(w.total_spent || 0),
            total_balance: Number(w.total_balance || 0),
            total_earned: Number(w.total_earned || 0),
            address: String(w.address || ""),
          }
        : null,
    }
  }, [user, profileSummary])

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mx-auto shadow-lg">
                <span className="text-3xl">π</span>
              </div>
              <h3 className="text-xl font-semibold">{t("notLoggedIn")}</h3>
              <p className="text-muted-foreground">
                {language === "vi" ? "Đăng nhập để xem hồ sơ" : "Login to view profile"}
              </p>
              <Button
                onClick={() => (window.location.href = "/login")}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {t("login")}
              </Button>
            </div>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white pb-24">
      <Header />

      <main className="container px-4 py-6 space-y-4">
        {/* Profile Header Card */}
        <Card className="overflow-hidden shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-4">
              {/* Avatar */}
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
                <span className="text-3xl font-bold text-white">{profileData.avatar}</span>
              </div>

              <div className="flex-1 min-w-0">
                {/* Name & Handle */}
                <h1 className="text-2xl font-bold text-gray-900">{profileData.displayName}</h1>
                <p className="text-sm text-gray-500 mb-2">{profileData.handle}</p>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    {language === "vi" ? "Thành viên" : "Member"}
                  </Badge>
                  {profileData.isProvider && (
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                      {language === "vi" ? "Nhà cung cấp" : "Provider"}
                    </Badge>
                  )}
                  {profileData.isTrusted && (
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {language === "vi" ? "Uy tín" : "Trusted"}
                    </Badge>
                  )}
                  {profileData.isVerified && (
                    <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                      {language === "vi" ? "Đã xác thực" : "Verified"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" className="bg-gradient-to-r from-purple-600 to-pink-600">
                <MessageCircle className="h-4 w-4 mr-1" />
                {language === "vi" ? "Nhắn tin" : "Message"}
              </Button>
              <Button size="sm" variant="outline">
                <UserPlus className="h-4 w-4 mr-1" />
                {language === "vi" ? "Theo dõi" : "Follow"}
              </Button>
              <Button size="sm" variant="outline">
                <ThumbsUp className="h-4 w-4 mr-1" />
                {language === "vi" ? "Đánh giá" : "Review"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Professional Info Card */}
        <Card className="shadow-lg">
          <CardContent className="p-6 space-y-4">
            {/* Bio */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{language === "vi" ? "Giới thiệu" : "About"}</h3>
              <p className="text-sm text-gray-600">{profileData.bio}</p>
            </div>

            {/* Location */}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">{language === "vi" ? "Khu vực hoạt động" : "Location"}</p>
                <p className="text-sm font-medium text-gray-900">{profileData.location}</p>
              </div>
            </div>

            {/* Categories (Provider only) */}
            {profileData.isProvider && (
              <div>
                <p className="text-xs text-gray-500 mb-2">{language === "vi" ? "Lĩnh vực cung cấp" : "Categories"}</p>
                <div className="flex flex-wrap gap-2">
                  {profileData.categories.map((cat) => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reputation & Trust Card */}
        <Card className="shadow-lg border-2 border-purple-100">
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              {language === "vi" ? "Uy tín & Đánh giá" : "Reputation & Trust"}
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Rating */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold text-gray-900">{profileData.rating}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {profileData.reviewCount} {language === "vi" ? "đánh giá" : "reviews"}
                </p>
              </div>

              {/* Exchanges */}
              <div className="text-center border-x border-gray-200">
                <p className="text-2xl font-bold text-purple-600">{profileData.exchangeCount}</p>
                <p className="text-xs text-gray-500">{language === "vi" ? "lượt trao đổi" : "exchanges"}</p>
              </div>

              {/* Join Date */}
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-900">{profileData.joinDate}</p>
                <p className="text-xs text-gray-500">{language === "vi" ? "tham gia" : "joined"}</p>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Clock className="h-3 w-3 mr-1" />
                {language === "vi" ? "Phản hồi nhanh" : "Quick Response"}
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                {language === "vi" ? "Giao dịch tốt" : "Good Transactions"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Provider Showcase (Provider only) */}
        {profileData.isProvider && (
          <Card className="shadow-lg bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Store className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">{profileData.businessName}</h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">{profileData.businessDesc}</p>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <MessageCircle className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">{language === "vi" ? "Liên hệ" : "Contact"}</p>
                    <p className="font-medium text-gray-900">{profileData.contactInfo}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">{language === "vi" ? "Giờ hoạt động" : "Working Hours"}</p>
                    <p className="font-medium text-gray-900">{profileData.workingHours}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">{language === "vi" ? "Địa chỉ" : "Address"}</p>
                    <p className="font-medium text-gray-900">{profileData.businessAddress}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs Section */}
        <Card className="shadow-lg">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("posts")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === "posts"
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {language === "vi" ? "Bài đăng" : "Posts"}
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === "products"
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {language === "vi" ? "Sản phẩm/Dịch vụ" : "Products/Services"}
              </button>
              <button
                onClick={() => setActiveTab("reviews")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === "reviews"
                    ? "text-purple-600 border-b-2 border-purple-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {language === "vi" ? "Đánh giá" : "Reviews"}
              </button>
            </div>
          </div>

          <CardContent className="p-6">
            {/* Tab content - placeholder */}
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {language === "vi"
                  ? `Chưa có ${activeTab === "posts" ? "bài đăng" : activeTab === "products" ? "sản phẩm" : "đánh giá"}`
                  : `No ${activeTab} yet`}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  )
}
