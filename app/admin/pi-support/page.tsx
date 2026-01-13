"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BadgeCheck, Save, Trash2, Users, AlertCircle, CheckCircle } from "lucide-react"

type Member = {
  id: string
  pi_username?: string | null
  email?: string | null
  full_name?: string | null
  user_type?: string | null
  provider_business_name?: string | null
}

type Expert = {
  id?: string
  user_id: string
  display_name?: string | null
  areas: string[]
  charge_mode: "FREE" | "PI" | "PITD" | "BOTH"
  price_pi?: any
  price_pitd?: any
  note?: string | null
  is_active: boolean
}

export default function AdminPiSupportPage() {
  const { user, isAdmin } = useAuth()
  const isAdminUser = typeof isAdmin === "function" ? (isAdmin as any)() : !!isAdmin

  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [experts, setExperts] = useState<Expert[]>([])
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [debugText, setDebugText] = useState<string | null>(null)

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [displayName, setDisplayName] = useState<string>("")
  const [areasText, setAreasText] = useState<string>("KYC & Mainnet, Pi Node, Giải đáp")
  const [chargeMode, setChargeMode] = useState<Expert["charge_mode"]>("FREE")
  const [pricePi, setPricePi] = useState<string>("")
  const [pricePitd, setPricePitd] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [isActive, setIsActive] = useState<boolean>(true)

  const requesterId = useMemo(() => {
    const raw: any = (user as any)?.id ?? (user as any)?.piUserId ?? (user as any)?.user_id ?? (user as any)?.uid ?? ""
    if (typeof raw === "string") return raw
    if (raw && typeof raw === "object") {
      const v = (raw as any)?.id ?? (raw as any)?.userId ?? (raw as any)?.uid ?? ""
      return typeof v === "string" ? v : String(v || "")
    }
    return ""
  }, [user])

  useEffect(() => {
    if (!requesterId) return
    // Load members + experts
    ;(async () => {
      setLoading(true)
      setMessage(null)
      setDebugText(null)
      try {
        // Members list (existing admin endpoint)
        const mres = await fetch(`/api/admin/members/list?requesterId=${encodeURIComponent(requesterId)}`, {
          cache: "no-store",
        })
        const mjson = await mres.json().catch(() => null)
        if (!mres.ok) throw new Error(mjson?.error || "members/list failed")
        const list: Member[] = [...(mjson?.piMembers || []), ...(mjson?.emailMembers || [])]
        setMembers(list)

        // Experts list
        const eres = await fetch(`/api/admin/pi-support-experts`, {
          cache: "no-store",
          headers: { "x-user-id": requesterId },
        })
        const ejson = await eres.json().catch(() => null)
        if (!eres.ok) throw new Error(ejson?.error || "pi-support-experts failed")
        setExperts(Array.isArray(ejson?.experts) ? ejson.experts : [])
      } catch (e: any) {
        setMessage({ type: "error", text: "Không tải được dữ liệu cấu hình." })
        setDebugText(e?.message || String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [requesterId])

  const memberLabel = (m: Member) => {
    const uname = m.pi_username ? `@${m.pi_username}` : ""
    const name = m.provider_business_name || m.full_name || m.email || m.id
    return `${name} ${uname}`.trim()
  }

  const parseAreas = (t: string) =>
    t
      .split(/[,\n]/g)
      .map((x) => x.trim())
      .filter(Boolean)

  const resetForm = () => {
    setSelectedUserId("")
    setDisplayName("")
    setAreasText("KYC & Mainnet, Pi Node, Giải đáp")
    setChargeMode("FREE")
    setPricePi("")
    setPricePitd("")
    setNote("")
    setIsActive(true)
  }

  const saveExpert = async () => {
    setMessage(null)
    setDebugText(null)
    try {
      if (!selectedUserId) throw new Error("Bạn chưa chọn thành viên")

      const payload: any = {
        user_id: selectedUserId,
        display_name: displayName.trim() || null,
        areas: parseAreas(areasText),
        charge_mode: chargeMode,
        price_pi: pricePi.trim() ? Number(pricePi) : null,
        price_pitd: pricePitd.trim() ? Number(pricePitd) : null,
        note: note.trim() || null,
        is_active: isActive,
      }

      const res = await fetch("/api/admin/pi-support-experts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": requesterId },
        body: JSON.stringify({ expert: payload }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.detail || json?.error || "Lưu thất bại")

      // Refresh list
      const eres = await fetch(`/api/admin/pi-support-experts`, {
        cache: "no-store",
        headers: { "x-user-id": requesterId },
      })
      const ejson = await eres.json().catch(() => null)
      setExperts(Array.isArray(ejson?.experts) ? ejson.experts : [])

      setMessage({ type: "success", text: "Đã cập nhật danh sách Pioneer tư vấn." })
      resetForm()
    } catch (e: any) {
      setMessage({ type: "error", text: "Không lưu được cấu hình." })
      setDebugText(e?.message || String(e))
    }
  }

  const deleteExpert = async (id: string) => {
    setMessage(null)
    setDebugText(null)
    try {
      const res = await fetch(`/api/admin/pi-support-experts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-user-id": requesterId },
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.detail || json?.error || "Xóa thất bại")
      setExperts((prev) => prev.filter((e) => String((e as any).id) !== id))
      setMessage({ type: "success", text: "Đã xóa khỏi danh sách." })
    } catch (e: any) {
      setMessage({ type: "error", text: "Không xóa được." })
      setDebugText(e?.message || String(e))
    }
  }

  if (!isAdminUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 pb-20">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-xl mx-auto p-6 rounded-2xl">
            <div className="flex items-center gap-2 text-rose-600 font-semibold">
              <AlertCircle className="h-5 w-5" />
              Không có quyền truy cập.
            </div>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 pb-20">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-amber-700" />
            <h1 className="text-2xl font-bold text-gray-900">Cấu hình chuyên gia tư vấn Pi</h1>
            <Badge className="ml-auto bg-amber-100 text-amber-800">Root/Admin</Badge>
          </div>

          {message ? (
            <Alert className={message.type === "success" ? "border-emerald-200" : "border-rose-200"}>
              <AlertDescription className="flex items-start gap-2">
                {message.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">{message.text}</div>
                  {debugText ? <div className="text-xs text-gray-500 mt-1">DEBUG: {debugText}</div> : null}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-gray-900 font-semibold">
                <Users className="h-5 w-5 text-amber-700" />
                Thêm / cập nhật Pioneer tư vấn
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-700 font-medium">Chọn thành viên</div>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={loading ? "Đang tải…" : "Chọn thành viên"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(members || []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-sm text-gray-700 font-medium">Tên hiển thị (tuỳ chọn)</div>
                  <Input className="rounded-xl" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="VD: Long (Pi Node)" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-700 font-medium">Trạng thái</div>
                  <Select value={isActive ? "active" : "inactive"} onValueChange={(v) => setIsActive(v === "active")}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Hiển thị</SelectItem>
                      <SelectItem value="inactive">Ẩn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-700 font-medium">Lĩnh vực tư vấn (phân tách bằng dấu phẩy)</div>
                <Input className="rounded-xl" value={areasText} onChange={(e) => setAreasText(e.target.value)} placeholder="KYC & Mainnet, Pi Node, Giải đáp" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <div className="text-sm text-gray-700 font-medium">Tính phí</div>
                  <Select value={chargeMode} onValueChange={(v) => setChargeMode(v as any)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FREE">Miễn phí</SelectItem>
                      <SelectItem value="PI">Pi</SelectItem>
                      <SelectItem value="PITD">PITD</SelectItem>
                      <SelectItem value="BOTH">Pi | PITD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-700 font-medium">Giá Pi (nếu có)</div>
                  <Input className="rounded-xl" value={pricePi} onChange={(e) => setPricePi(e.target.value)} placeholder="VD: 0.5" inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-gray-700 font-medium">Giá PITD (nếu có)</div>
                  <Input className="rounded-xl" value={pricePitd} onChange={(e) => setPricePitd(e.target.value)} placeholder="VD: 10" inputMode="decimal" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-700 font-medium">Ghi chú thêm (tuỳ chọn)</div>
                <Input className="rounded-xl" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Hỗ trợ online, đặt lịch trước" />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveExpert} className="rounded-xl bg-amber-600 hover:bg-amber-700 gap-2">
                  <Save className="h-4 w-4" />
                  Lưu
                </Button>
                <Button variant="outline" onClick={resetForm} className="rounded-xl">
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="text-gray-900 font-semibold">Danh sách đang hiển thị</div>

              {experts.length === 0 ? (
                <div className="text-gray-600">Chưa có Pioneer nào.</div>
              ) : (
                <div className="space-y-3">
                  {experts.map((e: any, idx) => (
                    <div key={String(e.id || idx)} className={idx === 0 ? "" : "pt-3 border-t border-amber-100"}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{e.display_name || e.user_id}</div>
                          <div className="text-sm text-gray-700 mt-1">Lĩnh vực: {(e.areas || []).join(", ") || "(chưa set)"}</div>
                          <div className="text-sm text-gray-600 mt-1">Tính phí: {e.charge_mode || "FREE"}</div>
                          {e.note ? <div className="text-sm text-gray-600 mt-1">{e.note}</div> : null}
                          <div className="text-xs text-gray-400 mt-1">user_id: {e.user_id}</div>
                        </div>
                        <Button variant="outline" onClick={() => deleteExpert(String(e.id))} className="rounded-xl gap-2">
                          <Trash2 className="h-4 w-4" />
                          Xóa
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
