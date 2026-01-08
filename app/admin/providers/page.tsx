"use client"

import { Header } from "@/components/header"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, Shield, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminProvidersPage() {
  const { t } = useLanguage()
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [pendingProviders, setPendingProviders] = useState<any[]>([])
  const [approvedProviders, setApprovedProviders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const providerLabelText = (label?: string | null) => {
    if (label === "verified") return "Đã xác thực"
    if (label === "trusted") return "Uy tín"
    return "Chưa xác thực"
  }

  useEffect(() => {
    if (user && isAdmin()) {
      loadProviders()
    }
  }, [user])

  const loadProviders = async () => {
    try {
      setLoading(true)
      setErrorMsg(null)
      const requesterId = user?.uid
      const res = await fetch(`/api/admin/providers?requesterId=${encodeURIComponent(requesterId || "")}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load providers")
      }
      setPendingProviders(Array.isArray(json?.pending) ? json.pending : [])
      setApprovedProviders(Array.isArray(json?.approved) ? json.approved : [])
    } catch (err) {
      console.error("[v0] Failed to load providers:", err)
      setErrorMsg((err as any)?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!user || !isAdmin()) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container px-4 py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t("adminOnlyDesc")}</AlertDescription>
          </Alert>
        </main>
      </div>
    )
  }

  const handleApprove = async (providerId: string) => {
    try {
      setErrorMsg(null)
      const requesterId = user?.uid
      const res = await fetch("/api/admin/approve-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId, targetUserId: providerId, approve: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Failed to approve provider")
      }
      await loadProviders()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  const handleSetProviderLabel = async (providerId: string, nextLabel: "unverified" | "verified" | "trusted") => {
    try {
      setErrorMsg(null)
      const requesterId = (user as any)?.id
      const res = await fetch("/api/admin/members/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_provider_label", requesterId, targetUserId: providerId, provider_label: nextLabel }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Failed to update provider label")
      await loadProviders()
    } catch (err: any) {
      console.error("[v0] Failed to set provider label:", err)
      setErrorMsg(err?.message || String(err))
    }
  }

  const handleReject = async (providerId: string, reason?: string) => {
    try {
      setErrorMsg(null)
      const requesterId = user?.uid
      const res = await fetch("/api/admin/approve-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId, targetUserId: providerId, approve: false, reason: reason || "" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || "Failed to reject provider")
      }
      await loadProviders()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  // NOTE: Provider verification labels will be implemented in Phase 1.4.
  // For now, we keep the list read-only (approved vs pending).

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
        <Header />
        <main className="container px-4 py-6">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-purple-600">{t("loading")}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 pb-20">
      <Header />
      <main className="container px-4 py-6">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {t("providerManagement")}
        </h1>

        {errorMsg ? (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-2 backdrop-blur-sm bg-white/40 rounded-2xl p-1 shadow-[0_4px_12px_rgb(147,51,234,0.08)] border border-white/60">
            <TabsTrigger
              value="pending"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              {t("pendingProviders")} ({pendingProviders.length})
            </TabsTrigger>
            <TabsTrigger
              value="approved"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
            >
              {t("approvedProviders")} ({approvedProviders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingProviders.length === 0 ? (
              <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
                <CardContent className="pt-6 text-center text-gray-600">{t("noProvidersFound")}</CardContent>
              </Card>
            ) : (
              pendingProviders.map((provider) => (
                <Card
                  key={provider.id}
                  className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{provider.provider_business_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{provider.full_name || provider.email}</p>
                      </div>
                      <Badge variant="outline">{t("pendingApproval")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm">
                        <strong>{t("email")}:</strong> {provider.email}
                      </p>
                      <p className="text-sm">
                        <strong>{t("phone")}:</strong> {provider.phone || "N/A"}
                      </p>
                      <p className="text-sm">
                        <strong>{t("description")}:</strong> {provider.provider_description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("memberSince")}: {provider.created_at ? new Date(provider.created_at).toLocaleDateString() : "-"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(provider.id)}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl"
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        {t("approveProvider")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(provider.id)}
                        className="rounded-xl"
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        {t("rejectProvider")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            {approvedProviders.length === 0 ? (
              <Card className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60">
                <CardContent className="pt-6 text-center text-gray-600">{t("noProvidersFound")}</CardContent>
              </Card>
            ) : (
              approvedProviders.map((provider) => (
                <Card
                  key={provider.id}
                  className="rounded-3xl shadow-[0_8px_30px_rgb(147,51,234,0.12)] backdrop-blur-sm bg-white/40 border-white/60"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{provider.provider_business_name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{provider.full_name || provider.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className="bg-blue-500">{t("approvedProviders")}</Badge>
                        <Badge variant="outline" className="border-yellow-400 text-yellow-700">
                          {providerLabelText(provider.provider_label)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm">
                        <strong>{t("email")}:</strong> {provider.email}
                      </p>
                      <p className="text-sm">
                        <strong>{t("description")}:</strong> {provider.provider_description}
                      </p>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs text-gray-600">Label nhà cung cấp</label>
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm"
                        value={(provider.provider_label || "unverified") as string}
                        onChange={(e) => handleSetProviderLabel(provider.id, e.target.value as any)}
                      >
                        <option value="unverified">Chưa xác thực</option>
                        <option value="verified">Đã xác thực</option>
                        <option value="trusted">Uy tín</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
