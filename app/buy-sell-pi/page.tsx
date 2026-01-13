"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { DollarSign, Home, ArrowLeft, ShieldCheck, Cpu, MessageCircle, Trash2, Plus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth-context"

type ExpertCategory = "KYC_MAINNET" | "PI_NODE" | "PI_NETWORK"
type PricingType = "FREE" | "PI" | "PITD" | "BOTH"

type BuySellPiExpert = {
  id?: string
  category: ExpertCategory
  username: string
  full_name?: string | null
  phone?: string | null
  chat_apps?: string[]
  chat_handle?: string | null
  pricing_type?: PricingType
  price_pi?: any
  price_pitd?: any
  note?: string | null
  is_active?: boolean
  updated_at?: string
}

const CHAT_APPS = ["zalo", "telegram", "viber", "whatsapp"] as const

function categoryLabel(cat: ExpertCategory) {
  if (cat === "PI_NODE") return "Vận hành Pi Node"
  if (cat === "PI_NETWORK") return "Tư vấn & giải đáp Pi Network"
  return "KYC & Pi Mainnet"
}

function categoryDesc(cat: ExpertCategory) {
  if (cat === "PI_NODE") {
    return "Tư vấn cài đặt, cấu hình, tối ưu và xử lý lỗi trong quá trình chạy Pi Node."
  }
  if (cat === "PI_NETWORK") {
    return "Chia sẻ kinh nghiệm, giải đáp câu hỏi về Pi Network theo tình huống thực tế."
  }
  return "Hỗ trợ Pioneer thực hiện KYC và hoàn thành các bước Pi Mainnet (theo checklist từng trường hợp)."
}

function pricingLabel(t?: PricingType) {
  const v = (t || "FREE").toUpperCase()
  if (v === "PI") return "Tính phí Pi"
  if (v === "PITD") return "Tính phí PITD"
  if (v === "BOTH") return "Tính phí Pi | PITD"
  return "Miễn phí"
}

export default function BuySellPiPage() {
  const router = useRouter()

  const [publicExperts, setPublicExperts] = useState<Record<ExpertCategory, BuySellPiExpert[]>>({
    KYC_MAINNET: [],
    PI_NODE: [],
    PI_NETWORK: [],
  })
  const [adminExperts, setAdminExperts] = useState<BuySellPiExpert[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminApiError, setAdminApiError] = useState<string | null>(null)
  const { user, isAdmin: isAdminFn, loading: authLoading } = useAuth()

  useEffect(() => {
    if (authLoading) return
    const roleAdmin = typeof isAdminFn === "function" ? !!isAdminFn() : false
    const rootByUsername = (user as any)?.username === "hlong295" || (user as any)?.pi_username === "hlong295"
    setIsAdmin(roleAdmin || rootByUsername)
  }, [authLoading, isAdminFn, user])

  const [loading, setLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)

  const [form, setForm] = useState<BuySellPiExpert>({
    category: "KYC_MAINNET",
    username: "",
    full_name: "",
    phone: "",
    chat_apps: [],
    chat_handle: "",
    pricing_type: "FREE",
    price_pi: "",
    price_pitd: "",
    note: "",
    is_active: true,
  })

  const effectiveExperts = useMemo(() => {
    // If admin, show the admin list (includes inactive) to allow toggling.
    if (isAdmin) return adminExperts
    // Public already grouped; flatten for convenience elsewhere if needed.
    return ([] as BuySellPiExpert[]).concat(
      publicExperts.KYC_MAINNET,
      publicExperts.PI_NODE,
      publicExperts.PI_NETWORK
    )
  }, [isAdmin, adminExperts, publicExperts])

  async function loadPublicExperts() {
    try {
      const res = await fetch("/api/pi-exchange/experts", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json?.ok && json?.experts) {
        setPublicExperts({
          KYC_MAINNET: json.experts.KYC_MAINNET || [],
          PI_NODE: json.experts.PI_NODE || [],
          PI_NETWORK: json.experts.PI_NETWORK || [],
        })
      }
    } catch {
      // ignore (public page should not break)
    }
  }

  async function loadAdminExperts() {
  try {
    setAdminApiError(null)
    const res = await fetch("/api/admin/pi-exchange/experts", { cache: "no-store" })
    if (!res.ok) {
      setAdminExperts([])
      setAdminApiError(`HTTP_${res.status}`)
      return
    }
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) {
      setAdminExperts([])
      setAdminApiError(json?.error || json?.message || "API_NOT_OK")
      return
    }
    setAdminExperts(Array.isArray(json.experts) ? json.experts : [])
  } catch (e: any) {
    setAdminExperts([])
    setAdminApiError(e?.message || "LOAD_ADMIN_FAILED")
  }
}

async function refreshAll() {
    await loadPublicExperts()
    await loadAdminExperts()
  }

  useEffect(() => {
    refreshAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function saveExpert() {
    try {
      setLoading(true)
      setAdminError(null)
      const payload: BuySellPiExpert = {
        ...form,
        username: (form.username || "").trim(),
        full_name: (form.full_name || "").trim(),
        phone: (form.phone || "").trim(),
        chat_handle: (form.chat_handle || "").trim(),
        note: (form.note || "").trim(),
        chat_apps: Array.isArray(form.chat_apps) ? form.chat_apps : [],
      }

      const res = await fetch("/api/admin/pi-exchange/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setAdminError(json?.error || json?.message || "SAVE_FAILED")
        return
      }

      // Reset form
      setForm({
        category: "KYC_MAINNET",
        username: "",
        full_name: "",
        phone: "",
        chat_apps: [],
        chat_handle: "",
        pricing_type: "FREE",
        price_pi: "",
        price_pitd: "",
        note: "",
        is_active: true,
      })

      await refreshAll()
    } finally {
      setLoading(false)
    }
  }

  async function deleteExpert(id?: string) {
    if (!id) return
    try {
      setLoading(true)
      setAdminError(null)
      const res = await fetch(`/api/admin/pi-exchange/experts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setAdminError(json?.error || json?.message || "DELETE_FAILED")
        return
      }
      await refreshAll()
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(expert: BuySellPiExpert) {
    try {
      setLoading(true)
      setAdminError(null)
      const res = await fetch("/api/admin/pi-exchange/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...expert, is_active: !(expert.is_active ?? true) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setAdminError(json?.error || json?.message || "UPDATE_FAILED")
        return
      }
      await refreshAll()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 pb-20">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6 gap-2 hover:bg-emerald-100 text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>

          {/* Main content card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                <DollarSign className="h-12 w-12 text-white" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Mua - Bán Pi
            </h1>

            {/* Greeting */}
            <div className="space-y-3 py-6 border-y border-emerald-100">
              <p className="text-lg text-gray-700 leading-relaxed">Xin chào quý khách!</p>
              <p className="text-base text-gray-600 leading-relaxed">
                Chúng tôi đang hoàn thiện tính năng <span className="font-semibold text-emerald-600">Mua - Bán Pi</span>{" "}
                để mang đến trải nghiệm tốt nhất cho bạn.
              </p>
            </div>

            {/* Under construction message */}
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200">
              <p className="text-gray-700 leading-relaxed">
                Trang đang trong quá trình <span className="font-semibold">xây dựng và hoàn thiện</span>.
                <br />
                Mời bạn quay lại sau.
              </p>
              <p className="text-sm text-emerald-600 mt-3">Cảm ơn sự kiên nhẫn của bạn! 🙏</p>
            </div>

            {/* Home button */}
            <Button
              onClick={() => router.push("/")}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-8 py-6 rounded-xl text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 gap-2"
            >
              <Home className="h-5 w-5" />
              Về trang chủ
            </Button>
          </div>

          {/* Dịch vụ hỗ trợ Pi (content + experts) */}
          <div className="mt-8 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-900">Dịch vụ hỗ trợ Pi</h2>
              <p className="text-sm text-gray-600 mt-2">
                Kết nối Pioneer với chuyên gia uy tín để hỗ trợ theo tình huống thực tế. Phí tư vấn do từng chuyên gia
                quyết định (Miễn phí / Pi / PITD).
              </p>

              <div className="mt-6 grid gap-4">
                {/* Category blocks */}
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center border border-emerald-200">
                      <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-emerald-900">KYC &amp; Pi Mainnet</h3>
                      <p className="text-sm text-emerald-900/80 mt-1">{categoryDesc("KYC_MAINNET")}</p>
                      <div className="mt-3 space-y-3">
                        {(publicExperts.KYC_MAINNET || []).length === 0 ? (
                          <p className="text-sm text-emerald-900/70">Chưa có chuyên gia được duyệt.</p>
                        ) : (
                          (publicExperts.KYC_MAINNET || []).map((ex) => (
                            <div key={ex.id || ex.username} className="rounded-xl bg-white p-4 border border-emerald-100">
                              <div className="text-sm text-gray-800">
                                <span className="font-semibold">Chuyên gia:</span> {ex.username}
                                {ex.full_name ? ` | Tên: ${ex.full_name}` : ""}
                                {ex.phone ? ` | Điện thoại: ${ex.phone}` : ""}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                <span className="font-semibold">Nickchat:</span>{" "}
                                {(ex.chat_apps || []).length > 0 ? `${(ex.chat_apps || []).join(", ")}` : "..."}
                                {ex.chat_handle ? `: ${ex.chat_handle}` : ""}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                <span className="font-semibold">Phí:</span> {pricingLabel(ex.pricing_type)}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PI" && ex.price_pi != null
                                  ? ` | ${ex.price_pi} Pi`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PITD" && ex.price_pitd != null
                                  ? ` | ${ex.price_pitd} PITD`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "BOTH" && (
                                  <>
                                    {ex.price_pi != null ? ` | ${ex.price_pi} Pi` : ""}
                                    {ex.price_pitd != null ? ` | ${ex.price_pitd} PITD` : ""}
                                  </>
                                )}
                              </div>
                              {ex.note ? <div className="text-sm text-gray-600 mt-2">Ghi chú: {ex.note}</div> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center border border-teal-200">
                      <Cpu className="h-5 w-5 text-teal-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-teal-900">Vận hành Pi Node</h3>
                      <p className="text-sm text-teal-900/80 mt-1">{categoryDesc("PI_NODE")}</p>
                      <div className="mt-3 space-y-3">
                        {(publicExperts.PI_NODE || []).length === 0 ? (
                          <p className="text-sm text-teal-900/70">Chưa có chuyên gia được duyệt.</p>
                        ) : (
                          (publicExperts.PI_NODE || []).map((ex) => (
                            <div key={ex.id || ex.username} className="rounded-xl bg-white p-4 border border-teal-100">
                              <div className="text-sm text-gray-800">
                                <span className="font-semibold">Chuyên gia:</span> {ex.username}
                                {ex.full_name ? ` | Tên: ${ex.full_name}` : ""}
                                {ex.phone ? ` | Điện thoại: ${ex.phone}` : ""}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                <span className="font-semibold">Nickchat:</span>{" "}
                                {(ex.chat_apps || []).length > 0 ? `${(ex.chat_apps || []).join(", ")}` : "..."}
                                {ex.chat_handle ? `: ${ex.chat_handle}` : ""}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                <span className="font-semibold">Phí:</span> {pricingLabel(ex.pricing_type)}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PI" && ex.price_pi != null
                                  ? ` | ${ex.price_pi} Pi`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PITD" && ex.price_pitd != null
                                  ? ` | ${ex.price_pitd} PITD`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "BOTH" && (
                                  <>
                                    {ex.price_pi != null ? ` | ${ex.price_pi} Pi` : ""}
                                    {ex.price_pitd != null ? ` | ${ex.price_pitd} PITD` : ""}
                                  </>
                                )}
                              </div>
                              {ex.note ? <div className="text-sm text-gray-600 mt-2">Ghi chú: {ex.note}</div> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-purple-100 bg-purple-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center border border-purple-200">
                      <MessageCircle className="h-5 w-5 text-purple-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-purple-900">Tư vấn &amp; giải đáp Pi Network</h3>
                      <p className="text-sm text-purple-900/80 mt-1">{categoryDesc("PI_NETWORK")}</p>
                      <div className="mt-3 space-y-3">
                        {(publicExperts.PI_NETWORK || []).length === 0 ? (
                          <p className="text-sm text-purple-900/70">Chưa có chuyên gia được duyệt.</p>
                        ) : (
                          (publicExperts.PI_NETWORK || []).map((ex) => (
                            <div key={ex.id || ex.username} className="rounded-xl bg-white p-4 border border-purple-100">
                              <div className="text-sm text-gray-800">
                                <span className="font-semibold">Chuyên gia:</span> {ex.username}
                                {ex.full_name ? ` | Tên: ${ex.full_name}` : ""}
                                {ex.phone ? ` | Điện thoại: ${ex.phone}` : ""}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                <span className="font-semibold">Nickchat:</span>{" "}
                                {(ex.chat_apps || []).length > 0 ? `${(ex.chat_apps || []).join(", ")}` : "..."}
                                {ex.chat_handle ? `: ${ex.chat_handle}` : ""}
                              </div>
                              <div className="text-sm text-gray-700 mt-1">
                                <span className="font-semibold">Phí:</span> {pricingLabel(ex.pricing_type)}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PI" && ex.price_pi != null
                                  ? ` | ${ex.price_pi} Pi`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PITD" && ex.price_pitd != null
                                  ? ` | ${ex.price_pitd} PITD`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "BOTH" && (
                                  <>
                                    {ex.price_pi != null ? ` | ${ex.price_pi} Pi` : ""}
                                    {ex.price_pitd != null ? ` | ${ex.price_pitd} PITD` : ""}
                                  </>
                                )}
                              </div>
                              {ex.note ? <div className="text-sm text-gray-600 mt-2">Ghi chú: {ex.note}</div> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-sm text-gray-600">
                <span className="font-semibold">Lưu ý:</span> Danh sách chuyên gia do admin duyệt và hiển thị.
              </div>
            </div>

            {/* Admin panel (inline on this page) */}
            {isAdmin ? (
              <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-gray-900">Quản trị: Chuyên gia tư vấn Pi</h3>
                  <div className="text-xs text-gray-500">(Chỉ admin thấy)</div>
                </div>

                {adminError ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {adminError}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Nhóm tư vấn</label>
                      <Select
                        value={form.category}
                        onValueChange={(v) => setForm((p) => ({ ...p, category: v as ExpertCategory }))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Chọn nhóm" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KYC_MAINNET">KYC &amp; Pi Mainnet</SelectItem>
                          <SelectItem value="PI_NODE">Vận hành Pi Node</SelectItem>
                          <SelectItem value="PI_NETWORK">Tư vấn &amp; giải đáp Pi Network</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">Username (bắt buộc)</label>
                      <Input
                        className="mt-2"
                        value={form.username || ""}
                        onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                        placeholder="vd: hlong295"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">Tên</label>
                      <Input
                        className="mt-2"
                        value={form.full_name || ""}
                        onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                        placeholder="Tên hiển thị..."
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">Điện thoại</label>
                      <Input
                        className="mt-2"
                        value={form.phone || ""}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="SĐT liên hệ..."
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">Ứng dụng chat</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {CHAT_APPS.map((app) => {
                          const checked = (form.chat_apps || []).includes(app)
                          return (
                            <button
                              key={app}
                              type="button"
                              onClick={() =>
                                setForm((p) => {
                                  const curr = new Set(p.chat_apps || [])
                                  if (curr.has(app)) curr.delete(app)
                                  else curr.add(app)
                                  return { ...p, chat_apps: Array.from(curr) }
                                })
                              }
                              className={`px-3 py-1 rounded-full text-xs border transition ${
                                checked
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-emerald-300"
                              }`}
                            >
                              {app}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">Nick chat</label>
                      <Input
                        className="mt-2"
                        value={form.chat_handle || ""}
                        onChange={(e) => setForm((p) => ({ ...p, chat_handle: e.target.value }))}
                        placeholder="vd: @username / số / link..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Tính phí</label>
                      <Select
                        value={form.pricing_type || "FREE"}
                        onValueChange={(v) => setForm((p) => ({ ...p, pricing_type: v as PricingType }))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Chọn" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FREE">Miễn phí</SelectItem>
                          <SelectItem value="PI">Pi</SelectItem>
                          <SelectItem value="PITD">PITD</SelectItem>
                          <SelectItem value="BOTH">Pi | PITD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">Phí Pi</label>
                      <Input
                        className="mt-2"
                        value={String(form.price_pi ?? "")}
                        onChange={(e) => setForm((p) => ({ ...p, price_pi: e.target.value }))}
                        placeholder="vd: 1.5"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">Phí PITD</label>
                      <Input
                        className="mt-2"
                        value={String(form.price_pitd ?? "")}
                        onChange={(e) => setForm((p) => ({ ...p, price_pitd: e.target.value }))}
                        placeholder="vd: 10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">Ghi chú</label>
                    <Textarea
                      className="mt-2"
                      value={form.note || ""}
                      onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                      placeholder="Ghi chú thêm về chuyên gia..."
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={form.is_active !== false}
                        onCheckedChange={(checked) => setForm((p) => ({ ...p, is_active: checked }))}
                      />
                      <span className="text-sm text-gray-700">Hiển thị</span>
                    </div>

                    <Button
                      disabled={loading}
                      onClick={saveExpert}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {loading ? "Đang lưu..." : "Thêm / Cập nhật"}
                    </Button>
                  </div>
                </div>

                {/* Admin list */}
                <div className="mt-8">
                  <div className="text-sm font-semibold text-gray-800 mb-3">Danh sách chuyên gia</div>
                  {adminExperts.length === 0 ? (
                    <div className="text-sm text-gray-600">Chưa có dữ liệu.</div>
                  ) : (
                    <div className="space-y-3">
                      {adminExperts.map((ex) => (
                        <div key={ex.id || ex.username} className="rounded-2xl border border-gray-200 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-sm text-gray-900 font-semibold">
                                {categoryLabel(ex.category)} — {ex.username}
                                {ex.full_name ? ` | ${ex.full_name}` : ""}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {ex.phone ? `SĐT: ${ex.phone} | ` : ""}
                                {pricingLabel(ex.pricing_type)}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PI" && ex.price_pi != null
                                  ? ` | ${ex.price_pi} Pi`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "PITD" && ex.price_pitd != null
                                  ? ` | ${ex.price_pitd} PITD`
                                  : ""}
                                {String(ex.pricing_type || "FREE").toUpperCase() === "BOTH" && (
                                  <>
                                    {ex.price_pi != null ? ` | ${ex.price_pi} Pi` : ""}
                                    {ex.price_pitd != null ? ` | ${ex.price_pitd} PITD` : ""}
                                  </>
                                )}
                              </div>
                              {ex.note ? <div className="text-xs text-gray-600 mt-1">Ghi chú: {ex.note}</div> : null}
                              <div className="text-xs text-gray-500 mt-2">
                                Trạng thái: {ex.is_active === false ? "Ẩn" : "Hiển thị"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                disabled={loading}
                                onClick={() => setForm({ ...ex, price_pi: ex.price_pi ?? "", price_pitd: ex.price_pitd ?? "" })}
                              >
                                Sửa
                              </Button>
                              <Button
                                variant="outline"
                                disabled={loading}
                                onClick={() => toggleActive(ex)}
                              >
                                {ex.is_active === false ? "Bật" : "Tắt"}
                              </Button>
                              <Button
                                variant="destructive"
                                disabled={loading}
                                onClick={() => deleteExpert(ex.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Debug small */}
                <div className="mt-6 text-xs text-gray-500">
                  Debug: isAdmin={String(isAdmin)} | adminExperts={adminExperts.length} | publicExperts={effectiveExperts.length}
                  {adminError ? ` | lastError=${adminError}` : ""}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
