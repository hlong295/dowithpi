"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Shield,
  Users,
  Search,
  UserCheck,
  UserX,
  Crown,
  Store,
  User,
  AlertCircle,
  CheckCircle,
  Mail,
} from "lucide-react"
import Link from "next/link"
// IMPORTANT: Admin member management must not query DB directly from client.
// Always go through server API routes (works on Pi Browser and respects RLS).

interface Member {
  id: string
  pi_username?: string
  email?: string
  full_name?: string
  user_role: string
  user_type: string
  verification_status: string
  provider_approved?: boolean
  member_label?: "regular" | "trusted" | null
  provider_label?: "unverified" | "verified" | "trusted" | null
  provider_business_name?: string
  created_at: string
  last_login_at?: string
}

export default function AdminMembersPage() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuth()
  // NOTE: some baselines expose isAdmin as boolean, others as function.
  // Normalize to avoid runtime crash on client.
  const isAdminUser = typeof isAdmin === "function" ? (isAdmin as any)() : !!isAdmin
  const [piMembers, setPiMembers] = useState<Member[]>([])
  const [emailMembers, setEmailMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  // Pi Browser không có console log, nên lưu debug để hiển thị trên màn hình khi cần.
  const [debugText, setDebugText] = useState<string | null>(null)

  // Ban/lock UI state (per-member) — stored client-side only.
  const [banDaysById, setBanDaysById] = useState<Record<string, string>>({})
  const [banReasonById, setBanReasonById] = useState<Record<string, string>>({})
  const [rowLoadingById, setRowLoadingById] = useState<Record<string, boolean>>({})

  // Some auth baselines accidentally expose user.id as an object (e.g. { id: 'uuid' }).
  // If we pass that object to the server, it becomes "[object Object]" and breaks UUID queries.
  const getRequesterId = () => {
    const raw: any = (user as any)?.id ?? (user as any)?.piUserId ?? (user as any)?.user_id ?? (user as any)?.uid ?? ""
    if (typeof raw === "string") return raw
    if (raw && typeof raw === "object") {
      const v = (raw as any)?.id ?? (raw as any)?.userId ?? (raw as any)?.uid ?? ""
      return typeof v === "string" ? v : String(v || "")
    }
    return ""
  }

  // No direct supabase client here.

  // Load only when we can identify current user (Pi login / Email login)
  useEffect(() => {
    const requesterId = getRequesterId()
    if (!requesterId) return
    loadMembers(requesterId)
  }, [user])

  const loadMembers = async (requesterId: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("requesterId", requesterId)

      const res = await fetch(`/api/admin/members/list?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        console.error("members/list error", json)
        throw new Error(json?.error || "members/list failed")
      }

      setPiMembers(Array.isArray(json?.piMembers) ? json.piMembers : [])
      setEmailMembers(Array.isArray(json?.emailMembers) ? json.emailMembers : [])
    } catch (error: any) {
      console.error("Error loading members:", error)
      setActionMessage({ type: "error", text: "Không tải được danh sách thành viên." })
      // Hiển thị debug trên Pi Browser (không có console)
      const msg = error?.message || String(error)
      setDebugText(msg)
    } finally {
      setLoading(false)
    }
  }

  const updateMemberRole = async (memberId: string, newRole: string, memberType: string) => {
    try {
      // Provider approval must persist to DB (pi_users.user_role + provider_approved fields).
      // Client-side direct UPDATE can silently affect 0 rows due to RLS, so we use a server API.
      const approvingProvider = newRole === "provider" || newRole === "redeemer"

      if (approvingProvider) {
        if (!isAdminUser) {
          throw new Error("Bạn không có quyền thực hiện thao tác này.")
        }
        const requesterId = getRequesterId()
        if (!requesterId) {
          throw new Error("Không xác định được requesterId. Vui lòng đăng nhập lại.")
        }

        const res = await fetch("/api/admin/approve-provider", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requesterId,
            targetUserId: memberId,
            role: newRole,
            approve: false,
          }),
        })

        const json = await res.json().catch(() => ({} as any))
        if (!res.ok || json?.error) {
          // Pi Browser không có console log, nên show lỗi chi tiết ngay trên màn hình để bạn chụp.
          const rawDetails = json?.details ?? json?.debug ?? json?.message ?? ""
          const details =
            typeof rawDetails === "string" ? rawDetails : JSON.stringify(rawDetails, null, 2)
          const msg = json?.error || "Không thể cập nhật quyền Provider."
          throw new Error(details ? `${msg} | ${details}` : msg)
        }

        const updatedRole = json?.user?.user_role || newRole

        if (memberType === "pi") {
          setPiMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: updatedRole } : m)))
        } else {
          setEmailMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: updatedRole } : m)))
        }

        setActionMessage({ type: "success", text: "Đã cập nhật quyền thành công!" })
        setTimeout(() => setActionMessage(null), 3000)
        return
      }

      // Other roles: update via server API (never update DB directly from client).
      const requesterId = getRequesterId()
      if (!requesterId) {
        throw new Error("Không xác định được requesterId. Vui lòng đăng nhập lại.")
      }

      const res = await fetch(`/api/admin/members/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_role", requesterId, targetUserId: memberId, role: newRole }),
      })

      const json = await res.json().catch(() => ({} as any))
      if (!res.ok || json?.error) {
        const rawDetails = json?.details ?? json?.debug ?? json?.message ?? ""
        const details = typeof rawDetails === "string" ? rawDetails : JSON.stringify(rawDetails, null, 2)
        const msg = json?.error || "Không thể cập nhật quyền."
        throw new Error(details ? `${msg} | ${details}` : msg)
      }

      // Update local state
      if (memberType === "pi") {
        setPiMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: newRole } : m)))
      } else {
        setEmailMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, user_role: newRole } : m)))
      }

      setActionMessage({ type: "success", text: "Đã cập nhật quyền thành công!" })
      setTimeout(() => setActionMessage(null), 3000)
    } catch (error) {
      console.error("Error updating role:", error)
      const msg =
        (error as any)?.message && typeof (error as any).message === "string"
          ? (error as any).message
          : "Không thể cập nhật quyền"
      // Pi Browser không có console log, nên hiển thị thông báo lỗi chi tiết ngay trên màn hình
      // để bạn chụp màn hình gửi lại.
      setActionMessage({ type: "error", text: msg.startsWith("Không") ? msg : `Không thể cập nhật quyền: ${msg}` })
    }
  }

  
const approveProvider = async (memberId: string, approve: boolean) => {
  try {
    setDebugText(null)
    // IMPORTANT: do this via server API (service role) to avoid RLS blocking updates.
    const requesterId = getRequesterId()
    if (!requesterId) throw new Error("Missing requesterId")

    const res = await fetch("/api/admin/approve-provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterId, targetUserId: memberId, approve }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (json?.debug) {
        try {
          setDebugText(JSON.stringify(json.debug, null, 2))
        } catch {
          setDebugText(String(json.debug))
        }
      }
      throw new Error(json?.error || "Không thể cập nhật")
    }

    const updatedRole = json?.user?.user_role || (approve ? "provider" : "redeemer")
    setPiMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              provider_approved: approve,
              user_role: updatedRole,
            }
          : m,
      ),
    )

    setActionMessage({
      type: "success",
      text: approve ? "Đã phê duyệt nhà cung cấp" : "Đã hủy phê duyệt",
    })
    setDebugText(null)
    setTimeout(() => setActionMessage(null), 3000)
  } catch (error) {
    console.error("Error approving provider:", error)
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Không thể cập nhật"
    setActionMessage({ type: "error", text: msg })
  }
}

  const updateMemberLabel = async (memberId: string, nextLabel: "regular" | "trusted") => {
    try {
      setActionMessage(null)
      const requesterId = getRequesterId()
      const res = await fetch("/api/admin/members/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_member_label", requesterId, targetUserId: memberId, memberLabel: nextLabel }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Failed")

      // refresh lists so labels reflect immediately
      await loadMembers(requesterId)
    } catch (e: any) {
      setActionMessage({ type: "error", text: `Không thể cập nhật nhãn: ${e?.message || e}` })
    }
  }

  const updateProviderLabel = async (
    memberId: string,
    nextLabel: "unverified" | "verified" | "trusted"
  ) => {
    try {
      setActionMessage(null)
      const requesterId = getRequesterId()
      const res = await fetch("/api/admin/members/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_provider_label", requesterId, targetUserId: memberId, providerLabel: nextLabel }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Failed")

      await loadMembers(requesterId)
    } catch (e: any) {
      setActionMessage({ type: "error", text: `Không thể cập nhật nhãn: ${e?.message || e}` })
    }
  }

  const updateBan = async (
    memberId: string,
    memberType: string,
    banType: "none" | "temp" | "perm",
    banDays?: number,
  ) => {
    const requesterId = getRequesterId()
    if (!requesterId) {
      setActionMessage({ type: "error", text: "Không xác định được requesterId. Vui lòng đăng nhập lại." })
      return
    }

    setRowLoadingById((p) => ({ ...p, [memberId]: true }))
    setActionMessage(null)

    try {
      const res = await fetch("/api/admin/members/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ban",
          requesterId,
          targetUserId: memberId,
          updates: {
            banType,
            banDays: banDays ?? undefined,
            bannedReason: (banReasonById[memberId] || "").trim() || null,
          },
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.error) throw new Error(json?.error || "Failed")

      await loadMembers(requesterId)
      setActionMessage({
        type: "success",
        text: banType === "none" ? "Đã mở khóa tài khoản" : banType === "perm" ? "Đã khóa vĩnh viễn" : "Đã khóa tạm thời",
      })
      setTimeout(() => setActionMessage(null), 2500)
    } catch (e: any) {
      setActionMessage({ type: "error", text: `Không thể khóa/mở khóa: ${e?.message || e}` })
    } finally {
      setRowLoadingById((p) => ({ ...p, [memberId]: false }))
    }
  }

  const adminCreatePitdWallet = async (memberId: string) => {
    const requesterId = getRequesterId()
    if (!requesterId) {
      setActionMessage({ type: "error", text: "Không xác định được requesterId. Vui lòng đăng nhập lại." })
      return
    }
    setRowLoadingById((p) => ({ ...p, [memberId]: true }))
    setActionMessage(null)
    try {
      const res = await fetch("/api/admin/pitd-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId, targetUserId: memberId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed")

      setActionMessage({ type: "success", text: "Đã tạo ví PITD cho thành viên" })
      setTimeout(() => setActionMessage(null), 2500)

      // No UI changes to member rows; just reload list (keeps stable behavior)
      await loadMembers(requesterId)
    } catch (e: any) {
      setActionMessage({ type: "error", text: `Không thể tạo ví PITD: ${e?.message || e}` })
    } finally {
      setRowLoadingById((p) => ({ ...p, [memberId]: false }))
    }
  }

const filterMembers = (members: Member[]) => {
    if (!searchQuery) return members
    const q = searchQuery.toLowerCase()
    return members.filter(
      (m) =>
        m.pi_username?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.full_name?.toLowerCase().includes(q) ||
        m.provider_business_name?.toLowerCase().includes(q),
    )
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "root_admin":
        return (
          <Badge className="bg-red-500 text-white">
            <Crown className="h-3 w-3 mr-1" />
            ROOT ADMIN
          </Badge>
        )
      case "provider":
        return (
          <Badge className="bg-purple-500 text-white">
            <Store className="h-3 w-3 mr-1" />
            Provider
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <User className="h-3 w-3 mr-1" />
            Redeemer
          </Badge>
        )
    }
  }

  const getMemberLabelBadge = (label?: string | null) => {
    if (label !== "trusted") return null
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
        Uy tín
      </span>
    )
  }

  const getProviderLabelBadge = (label?: string | null) => {
    if (!label) return null
    const map: Record<string, { text: string; cls: string }> = {
      unverified: { text: "Chưa xác thực", cls: "bg-gray-100 text-gray-700" },
      verified: { text: "Đã xác thực", cls: "bg-green-100 text-green-700" },
      trusted: { text: "Uy tín", cls: "bg-yellow-100 text-yellow-800" },
    }
    const item = map[label] || { text: label, cls: "bg-gray-100 text-gray-700" }
    return (
      <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.cls}`}>{item.text}</span>
    )
  }

  if (!user || !isAdminUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <Card className="p-12 rounded-2xl shadow-md">
            <div className="text-center space-y-4">
              <Shield className="h-16 w-16 text-purple-500 mx-auto" />
              <h3 className="text-xl font-bold">{t("adminOnly")}</h3>
              <Link href="/">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">
                  {t("navHome")}
                </Button>
              </Link>
            </div>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  const totalMembers = piMembers.length + emailMembers.length
  const totalProviders = piMembers.filter((m) => m.user_role === "provider").length
  const approvedProviders = piMembers.filter((m) => m.user_role === "provider" && m.provider_approved).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6 max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-purple-700">Quản lý thành viên</h1>
            <p className="text-sm text-gray-600">{totalMembers} thành viên</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl shadow-sm bg-white/60">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{piMembers.length}</div>

              <div className="text-xs text-gray-500">Pi Users</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm bg-white/60">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{emailMembers.length}</div>

              <div className="text-xs text-gray-500">Email Users</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm bg-white/60">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {approvedProviders}/{totalProviders}
              </div>
              <div className="text-xs text-gray-500">Providers</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <Alert
            className={`rounded-xl ${actionMessage.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={actionMessage.type === "success" ? "text-green-700" : "text-red-700"}>
              {actionMessage.text}
              {actionMessage.type === "error" && debugText ? (
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-black/5 p-2 text-xs leading-relaxed">
                  {debugText}
                </pre>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <Card className="rounded-2xl shadow-sm bg-white/60">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm theo tên, email, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl border-gray-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="pi" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-white/60 rounded-xl p-1">
            <TabsTrigger
              value="pi"
              className="rounded-lg data-[state=active]:bg-purple-500 data-[state=active]:text-white"
            >
              Pi Users ({piMembers.length})
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="rounded-lg data-[state=active]:bg-purple-500 data-[state=active]:text-white"
            >
              Email Users ({emailMembers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pi">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : filterMembers(piMembers).length === 0 ? (
              <Card className="rounded-2xl bg-white/60">
                <CardContent className="p-12 text-center">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Không có thành viên Pi</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filterMembers(piMembers).map((member) => (
                  <Card key={member.id} className="rounded-xl shadow-sm">
                    <CardContent className="p-4">
			  	  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                          π
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{member.pi_username}</h3>
                            {getRoleBadge(member.user_role)}
                            {getMemberLabelBadge(member.member_label)}
                            {getProviderLabelBadge(member.provider_label)}
                          </div>
                          {member.provider_business_name && (
                            <p className="text-sm text-gray-500">{member.provider_business_name}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            Tham gia: {new Date(member.created_at).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
							<div className="w-full sm:w-auto flex flex-col gap-2 sm:items-end">
                          {member.user_role === "provider" && (
                            <Button
                              size="sm"
                              variant={member.provider_approved ? "outline" : "default"}
                              className={`rounded-lg ${member.provider_approved ? "" : "bg-green-500 hover:bg-green-600"}`}
                              onClick={() => approveProvider(member.id, !member.provider_approved)}
                            >
                              {member.provider_approved ? (
                                <>
                                  <UserX className="h-3.5 w-3.5 mr-1" />
                                  Hủy
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                                  Duyệt
                                </>
                              )}
                            </Button>
                          )}
                          {member.user_role !== "root_admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg bg-transparent"
                              onClick={() =>
                                updateMemberRole(
                                  member.id,
                                  member.user_role === "provider" ? "redeemer" : "provider",
                                  "pi",
                                )
                              }
                            >
                              {member.user_role === "provider" ? (
                                <>
                                  <User className="h-3.5 w-3.5 mr-1" />→ User
                                </>
                              ) : (
                                <>
                                  <Store className="h-3.5 w-3.5 mr-1" />→ Provider
                                </>
                              )}
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg bg-transparent"
                            onClick={() =>
                              updateMemberLabel(member.id, member.member_label === "trusted" ? "regular" : "trusted")
                            }
                            disabled={!!rowLoadingById[member.id]}
                          >
                            {member.member_label === "trusted" ? "Bỏ uy tín" : "→ Uy tín"}
                          </Button>

                          {/* Ban / lock controls (4.1) */}
                          {member.user_role !== "root_admin" && (
                            <div className="rounded-lg border border-gray-200 bg-white/50 p-2 space-y-2">
								  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Input
                                  placeholder="Số ngày"
                                  value={banDaysById[member.id] ?? ""}
                                  onChange={(e) =>
                                    setBanDaysById((p) => ({ ...p, [member.id]: e.target.value }))
                                  }
									  className="h-8 rounded-md w-full"
                                />
                                <Button
                                  size="sm"
									  className="h-8 rounded-md bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
                                  onClick={() => {
                                    const raw = (banDaysById[member.id] ?? "").trim() || "1"
                                    const n = Math.max(1, Math.min(365, parseInt(raw, 10) || 1))
                                    updateBan(member.id, "pi", "temp", n)
                                  }}
                                  disabled={!!rowLoadingById[member.id]}
                                >
                                  Khóa tạm
                                </Button>
                              </div>
                              <Input
                                placeholder="Lý do (tuỳ chọn)"
                                value={banReasonById[member.id] ?? ""}
                                onChange={(e) =>
                                  setBanReasonById((p) => ({ ...p, [member.id]: e.target.value }))
                                }
                                className="h-8 rounded-md"
                              />
								  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
									  className="h-8 rounded-md w-full sm:w-auto"
                                  onClick={() => updateBan(member.id, "pi", "none")}
                                  disabled={!!rowLoadingById[member.id]}
                                >
                                  Mở khóa
                                </Button>
                                <Button
                                  size="sm"
									  className="h-8 rounded-md bg-red-500 hover:bg-red-600 text-white w-full sm:w-auto"
                                  onClick={() => updateBan(member.id, "pi", "perm")}
                                  disabled={!!rowLoadingById[member.id]}
                                >
                                  Khóa vĩnh viễn
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Admin create PITD wallet (4) */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg bg-transparent"
                            onClick={() => adminCreatePitdWallet(member.id)}
                            disabled={!!rowLoadingById[member.id]}
                          >
                            Tạo ví PITD
                          </Button>

                          {member.user_role === "provider" && (
                            <label className="text-xs text-gray-500">
                              Xác thực nhà cung cấp
                              <select
                                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
                                value={member.provider_label || "unverified"}
                                onChange={(e) => updateProviderLabel(member.id, e.target.value as any)}
                              >
                                <option value="unverified">Chưa xác thực</option>
                                <option value="verified">Đã xác thực</option>
                                <option value="trusted">Uy tín</option>
                              </select>
                            </label>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="email">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : filterMembers(emailMembers).length === 0 ? (
              <Card className="rounded-2xl bg-white/60">
                <CardContent className="p-12 text-center">
                  <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Không có thành viên Email</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filterMembers(emailMembers).map((member) => (
                  <Card key={member.id} className="rounded-xl shadow-sm">
                    <CardContent className="p-4">
					  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white">
                          <Mail className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{member.full_name || member.email}</h3>
                            {getRoleBadge(member.user_role)}
                            {getMemberLabelBadge(member.member_label)}
                            {getProviderLabelBadge(member.provider_label, member.user_role)}
                          </div>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          <p className="text-xs text-gray-400">
                            Tham gia: {new Date(member.created_at).toLocaleDateString("vi-VN")}
                          </p>
                        </div>

						<div className="w-full sm:w-auto flex flex-col gap-2 sm:items-end">
                          {member.user_role === "provider" && (
                            <Button
                              size="sm"
                              variant={member.provider_approved ? "outline" : "default"}
                              className={`rounded-lg ${member.provider_approved ? "" : "bg-green-500 hover:bg-green-600"}`}
                              onClick={() => approveProvider(member.id, !member.provider_approved)}
                            >
                              {member.provider_approved ? (
                                <>
                                  <UserX className="h-3.5 w-3.5 mr-1" />
                                  Hủy
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                                  Duyệt
                                </>
                              )}
                            </Button>
                          )}
                          {member.user_role !== "root_admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg bg-transparent"
                              onClick={() =>
                                updateMemberRole(
                                  member.id,
                                  member.user_role === "provider" ? "redeemer" : "provider",
                                  "email",
                                )
                              }
                            >
                              {member.user_role === "provider" ? (
                                <>
                                  <User className="h-3.5 w-3.5 mr-1" />→ User
                                </>
                              ) : (
                                <>
                                  <Store className="h-3.5 w-3.5 mr-1" />→ Provider
                                </>
                              )}
                            </Button>
                          )}

                          {/* Label thành viên: Uy tín / Thường */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg bg-transparent"
                            onClick={() =>
                              updateMemberLabel(member.id, member.member_label === "trusted" ? "regular" : "trusted")
                            }
                          >
                            {member.member_label === "trusted" ? "Bỏ uy tín" : "→ Uy tín"}
                          </Button>

                          {/* Ban / lock controls (4.1) */}
                          {member.user_role !== "root_admin" && (
                            <div className="rounded-lg border border-gray-200 bg-white/50 p-2 space-y-2">
							  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Input
                                  placeholder="Số ngày"
                                  value={banDaysById[member.id] ?? ""}
                                  onChange={(e) =>
                                    setBanDaysById((p) => ({ ...p, [member.id]: e.target.value }))
                                  }
								className="h-8 rounded-md w-full"
                                />
                                <Button
                                  size="sm"
								className="h-8 rounded-md bg-amber-500 hover:bg-amber-600 text-white w-full sm:w-auto"
                                  onClick={() => {
                                    const raw = (banDaysById[member.id] ?? "").trim() || "1"
                                    const n = Math.max(1, Math.min(365, parseInt(raw, 10) || 1))
                                    updateBan(member.id, "email", "temp", n)
                                  }}
                                  disabled={!!rowLoadingById[member.id]}
                                >
                                  Khóa tạm
                                </Button>
                              </div>
                              <Input
                                placeholder="Lý do (tuỳ chọn)"
                                value={banReasonById[member.id] ?? ""}
                                onChange={(e) =>
                                  setBanReasonById((p) => ({ ...p, [member.id]: e.target.value }))
                                }
                                className="h-8 rounded-md"
                              />
							  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
								className="h-8 rounded-md w-full sm:w-auto"
                                  onClick={() => updateBan(member.id, "email", "none")}
                                  disabled={!!rowLoadingById[member.id]}
                                >
                                  Mở khóa
                                </Button>
                                <Button
                                  size="sm"
								className="h-8 rounded-md bg-red-500 hover:bg-red-600 text-white w-full sm:w-auto"
                                  onClick={() => updateBan(member.id, "email", "perm")}
                                  disabled={!!rowLoadingById[member.id]}
                                >
                                  Khóa vĩnh viễn
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Admin create PITD wallet (4) */}
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg bg-transparent"
                            onClick={() => adminCreatePitdWallet(member.id)}
                            disabled={!!rowLoadingById[member.id]}
                          >
                            Tạo ví PITD
                          </Button>

                          {/* Label provider: Chưa xác thực / Đã xác thực / Uy tín */}
                          {member.user_role === "provider" && (
                            <select
                              className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm"
                              value={(member.provider_label as any) || "unverified"}
                              onChange={(e) => updateProviderLabel(member.id, e.target.value as any)}
                            >
                              <option value="unverified">Chưa xác thực</option>
                              <option value="verified">Đã xác thực</option>
                              <option value="trusted">Uy tín</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <BottomNav />
    </div>
  )
}
