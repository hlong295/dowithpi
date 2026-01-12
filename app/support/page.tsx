"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  BadgeCheck,
  HelpCircle,
  Home,
  MessageCircle,
  Server,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

type SupportExpert = {
  id: string
  user_id: string
  display_name: string | null
  areas: string[]
  charge_mode: "FREE" | "PI" | "PITD" | "BOTH"
  price_pi: number | null
  price_pitd: number | null
  note: string | null
  is_active: boolean
}

type SupportExpertsResponse = {
  ok: boolean
  experts: SupportExpert[]
  debug?: any
  error?: string
  detail?: string
}

export default function SupportPage() {
  const router = useRouter()

  const [experts, setExperts] = useState<SupportExpert[]>([])
  const [loadingExperts, setLoadingExperts] = useState(true)
  const [expertsError, setExpertsError] = useState<string | null>(null)

  const debugEnabled = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("debug") === "1"
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoadingExperts(true)
      setExpertsError(null)
      try {
        const res = await fetch("/api/pi-support/experts", { cache: "no-store" })
        const json = (await res.json().catch(() => ({}))) as SupportExpertsResponse
        if (!res.ok || !json?.ok) {
          const msg = json?.error || "Không tải được danh sách Pioneer uy tín"
          throw new Error(msg)
        }
        if (!cancelled) setExperts(Array.isArray(json.experts) ? json.experts : [])
      } catch (e: any) {
        if (!cancelled) setExpertsError(e?.message || "Không tải được danh sách Pioneer uy tín")
      } finally {
        if (!cancelled) setLoadingExperts(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const services = useMemo(
    () => [
      {
        icon: ShieldCheck,
        title: "KYC & Pi Mainnet",
        desc: "Hỗ trợ Pioneer thực hiện KYC và hoàn thành các bước Pi Mainnet (theo checklist từng trường hợp).",
      },
      {
        icon: Server,
        title: "Vận hành Pi Node",
        desc: "Tư vấn cài đặt, cấu hình, tối ưu và xử lý lỗi trong quá trình chạy Pi Node.",
      },
      {
        icon: MessageCircle,
        title: "Tư vấn & giải đáp",
        desc: "Chia sẻ kinh nghiệm, giải đáp câu hỏi về Pi Network theo tình huống thực tế.",
      },
    ],
    []
  )

  const formatPrice = (n: any) => {
    const x = Number(n)
    if (!Number.isFinite(x) || x <= 0) return null
    // show up to 6 decimals without trailing zeros
    const s = x.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")
    return s
  }

  const renderPrice = (e: SupportExpert) => {
    const mode = (e.charge_mode || "FREE").toUpperCase() as any
    if (mode === "FREE") return "Miễn phí"
    if (mode === "PI") {
      const p = formatPrice(e.price_pi)
      return p ? `${p} Pi` : "Pi (thỏa thuận)"
    }
    if (mode === "PITD") {
      const p = formatPrice(e.price_pitd)
      return p ? `${p} PITD` : "PITD (thỏa thuận)"
    }
    // BOTH
    const p1 = formatPrice(e.price_pi)
    const p2 = formatPrice(e.price_pitd)
    const left = p1 ? `${p1} Pi` : "Pi (thỏa thuận)"
    const right = p2 ? `${p2} PITD` : "PITD (thỏa thuận)"
    return `${left} | ${right}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 pb-20">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6 gap-2 hover:bg-amber-100 text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>

          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <HelpCircle className="h-12 w-12 text-white" />
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Dịch vụ hỗ trợ Pi
            </h1>

            <div className="space-y-3 py-6 border-y border-amber-100">
              <p className="text-lg text-gray-700 leading-relaxed">Chào Pioneer! 👋</p>
              <p className="text-base text-gray-600 leading-relaxed">
                Đây là nơi tổng hợp các <span className="font-semibold text-amber-600">dịch vụ hỗ trợ Pi</span> do những Pioneer uy tín cung cấp.
              </p>
            </div>

            {/* Services */}
            <div className="space-y-4 text-left">
              <p className="text-gray-900 font-semibold text-lg">Các dịch vụ chính</p>

              <div className="grid gap-4">
                {services.map((s) => {
                  const Icon = s.icon
                  return (
                    <Card key={s.title} className="p-5 rounded-2xl border-amber-200 bg-amber-50/60">
                      <div className="flex gap-3 items-start">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{s.title}</div>
                          <div className="text-gray-700 text-sm leading-relaxed mt-1">{s.desc}</div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Experts */}
            <div className="text-left">
              <div className="flex items-center gap-2 mb-3">
                <BadgeCheck className="h-5 w-5 text-amber-700" />
                <p className="text-gray-900 font-semibold text-lg">Pioneer uy tín (Admin chọn)</p>
              </div>

              <Card className="p-5 rounded-2xl border-amber-200 bg-white">
                {loadingExperts ? (
                  <p className="text-gray-600">Đang tải danh sách…</p>
                ) : expertsError ? (
                  <div className="space-y-2">
                    <p className="text-rose-600">{expertsError}</p>
                    {debugEnabled ? (
                      <p className="text-xs text-gray-500">DEBUG=1 bật. Bạn có thể chụp màn hình lỗi này gửi mình.</p>
                    ) : null}
                  </div>
                ) : experts.length === 0 ? (
                  <p className="text-gray-600">Chưa có Pioneer nào được chọn hiển thị.</p>
                ) : (
                  <div className="space-y-4">
                    {experts
                      .filter((e) => e.is_active)
                      .map((e, idx) => (
                        <div key={e.id} className={idx === 0 ? "" : "pt-4 border-t border-amber-100"}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">{e.display_name || "Pioneer"}</div>
                              {Array.isArray(e.areas) && e.areas.length > 0 ? (
                                <div className="text-sm text-gray-700 mt-1">
                                  Lĩnh vực: <span className="font-medium">{e.areas.join(", ")}</span>
                                </div>
                              ) : null}
                              {e.note ? <div className="text-sm text-gray-600 mt-1">{e.note}</div> : null}
                            </div>
                            <div className="text-sm text-amber-800 font-semibold whitespace-nowrap">{renderPrice(e)}</div>
                          </div>
                        </div>
                      ))}

                    <div className="pt-3 border-t border-amber-100">
                      <p className="text-sm text-amber-700">
                        Phí dịch vụ: có thể tính bằng <span className="font-semibold">Pi</span> hoặc <span className="font-semibold">PITD</span> (tùy Pioneer).
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <Button
              onClick={() => router.push("/")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-6 rounded-xl text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 gap-2"
            >
              <Home className="h-5 w-5" />
              Về trang chủ
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
