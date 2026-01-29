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

  type ProfileApiResponse = {
    ok: boolean
    profile?: {
      user_id: string
      pi_username?: string | null
      full_name?: string | null
      user_role?: string | null
      provider_approved?: boolean | null
      provider_label?: string | null
      member_label?: string | null
      verification_status?: string | null
      provider_business_name?: string | null
      provider_description?: string | null
      created_at?: string | null
    }
    stats?: {
      ratingAvg?: number
      reviewCount?: number
      exchangeCount?: number
      categories?: string[]
    }
    extras?: {
      location?: string | null
      workingHours?: string | null
      businessAddress?: string | null
    }
    dbg?: any
  }

  const [profileApi, setProfileApi] = useState<ProfileApiResponse | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)

  const dbgEnabled = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("dbg") === "1"
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        setProfileErr(null)

        const headers: Record<string, string> = {
          "x-user-type": (user as any)?.type || "unknown",
        }

        // Email auth: attach Supabase JWT so server can verify.
        if ((user as any)?.type === "email") {
          try {
            const { createBrowserClient } = await import("@/lib/supabase/client")
            const supabase = createBrowserClient()
            const { data } = await supabase.auth.getSession()
            const token = data?.session?.access_token
            if (token) headers["authorization"] = `Bearer ${token}`
          } catch {
            // ignore
          }
        }

        // Pi auth: forward Pi headers (server routes already support these).
        if ((user as any)?.type === "pi") {
          try {
            const storedPiUserId = localStorage.getItem("pi_user_id") || ""
            const piUserId = (storedPiUserId || (user as any)?.id || "").trim()
            if (piUserId) headers["x-pi-user-id"] = piUserId

            const storedPiUsername = localStorage.getItem("pi_username") || ""
            const piUsername = (storedPiUsername || (user as any)?.piUsername || (user as any)?.username || "").trim()
            if (piUsername) headers["x-pi-username"] = piUsername
          } catch {
            // ignore
          }
        }

        const qp: string[] = []
        if (dbgEnabled) qp.push("dbg=1")
        const url = `/api/profile/me${qp.length ? `?${qp.join("&")}` : ""}`

        const res = await fetch(url, { method: "GET", credentials: "include", headers })
        const json: ProfileApiResponse = await res.json().catch(() => ({ ok: false } as any))
        if (!res.ok || json?.ok === false) {
          throw new Error((json as any)?.details || (json as any)?.error || `HTTP_${res.status}`)
        }
        if (!cancelled) setProfileApi(json)
      } catch (e: any) {
        if (!cancelled) setProfileErr(String(e?.message || e || "PROFILE_LOAD_FAILED"))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, dbgEnabled])

  const profileData = useMemo(() => {
    const username =
      (profileApi?.profile?.pi_username || (user as any)?.pi_username || (user as any)?.username || "").trim() || ""
    const displayName =
      (profileApi?.profile?.full_name || (user as any)?.full_name || username || (user as any)?.username || "").trim() ||
      username ||
      ""

    const roleRaw = String(profileApi?.profile?.user_role || (user as any)?.role || "member").toLowerCase()
    const isProvider = roleRaw === "provider" || roleRaw === "merchant" || roleRaw === "seller"

    const providerLabel = String(profileApi?.profile?.provider_label || "").toLowerCase()
    const memberLabel = String(profileApi?.profile?.member_label || "").toLowerCase()
    const isTrusted = providerLabel === "trusted" || memberLabel === "trusted"

    const isVerified =
      !!profileApi?.profile?.provider_approved ||
      String(profileApi?.profile?.verification_status || "").toLowerCase() === "verified" ||
      providerLabel === "verified"

    const createdAt = profileApi?.profile?.created_at || null
    const joinDate = (() => {
      if (!createdAt) return ""
      const d = new Date(createdAt)
      if (Number.isNaN(d.getTime())) return ""
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const yyyy = String(d.getFullYear())
      return `${mm}/${yyyy}`
    })()

    const ratingAvg = Number(profileApi?.stats?.ratingAvg || 0)
    const reviewCount = Number(profileApi?.stats?.reviewCount || 0)
    const exchangeCount = Number(profileApi?.stats?.exchangeCount || 0)
    const categories = Array.isArray(profileApi?.stats?.categories) ? profileApi!.stats!.categories! : []

    const bio =
      (profileApi?.profile?.provider_description || "").trim() ||
      (language === "vi" ? "Chưa cập nhật giới thiệu." : "No bio yet.")

    const businessName = (profileApi?.profile?.provider_business_name || "").trim() ||
      (username ? `${username} Store` : language === "vi" ? "Cửa hàng" : "Store")

    return {
      username: username || (user as any)?.username || "",
      displayName: displayName || username || (user as any)?.username || "",
      handle: `@${username || (user as any)?.username || ""}`,
      avatar: "π",
      isProvider,
      isTrusted,
      isVerified,
      rating: Number.isFinite(ratingAvg) && ratingAvg > 0 ? Number(ratingAvg.toFixed(1)) : 0,
      reviewCount,
      exchangeCount,
      location:
        (profileApi?.extras?.location || "").trim() || (language === "vi" ? "Chưa cập nhật" : "Not set"),
      joinDate: joinDate || (language === "vi" ? "Chưa rõ" : "—"),
      bio,
      categories: categories.length ? categories : [language === "vi" ? "Khác" : "Other"],
      businessName,
      businessDesc:
        (profileApi?.profile?.provider_description || "").trim() ||
        (language === "vi" ? "Cửa hàng đang cập nhật thông tin." : "Store details coming soon."),
      contactInfo: username ? `pi://${username}` : "",
      workingHours:
        (profileApi?.extras?.workingHours || "").trim() || (language === "vi" ? "Chưa cập nhật" : "Not set"),
      businessAddress:
        (profileApi?.extras?.businessAddress || "").trim() || (language === "vi" ? "Chưa cập nhật" : "Not set"),
    }
  }, [profileApi, user, language])

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
        {dbgEnabled && (profileErr || profileApi?.dbg) && (
          <Card className="shadow-lg border-dashed border-2 border-orange-200">
            <CardContent className="p-4 text-xs text-gray-700 space-y-2">
              {profileErr && (
                <div>
                  <div className="font-semibold text-red-600">DBG: profile load error</div>
                  <div className="break-words">{profileErr}</div>
                </div>
              )}
              {profileApi?.dbg && (
                <div>
                  <div className="font-semibold text-orange-600">DBG: /api/profile/me</div>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(profileApi.dbg, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
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
