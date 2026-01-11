"use client"
import { useEffect, useRef, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { AccountHubSheet } from "@/components/account-hub-sheet"
import { PitdTransferModal } from "@/components/pitd-transfer-modal"
import { X, Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react"

const ROOT_ADMIN_USERNAME = "HLong295"

function isUuid(v: any): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

type Transaction = {
  id: string
  wallet_id: string
  user_id: string
  amount: number
  transaction_type: string
  description: string
  status: string
  created_at: string
  balance_after?: number
  metadata?: any
}

type WalletData = {
  id: string
  user_id: string
  balance: number
  address: string
  total_balance?: number
  locked_balance?: number
  total_earned?: number
  total_spent: number
  created_at: string
}

type Purchase = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  total_price: number
  payment_method: string
  status: string
  created_at: string
  product?: {
    id: string
    name: string
    image_url?: string
    media?: any[]
    price: number
  }
}

type Favorite = {
  id: string
  product_id: string
  created_at: string
  product?: {
    id: string
    name: string
    image_url?: string
    media?: any[]
    price: number
  }
}

interface AccountHubWrapperProps {
  isOpen: boolean
  onClose: () => void
}

export function AccountHubWrapper({ isOpen, onClose }: AccountHubWrapperProps) {
  const { user } = useAuth()

  const [pitdBalance, setPitdBalance] = useState<number>(0)
  const [loadingWallet, setLoadingWallet] = useState(false)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsIn, setTransactionsIn] = useState<Transaction[]>([])
  const [transactionsOut, setTransactionsOut] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [txTab, setTxTab] = useState<"in" | "out">("in")
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [showPurchases, setShowPurchases] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  const lastLoadedWalletUserIdRef = useRef<string | null>(null)
  const loadWalletInFlightRef = useRef(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      setDebugMode(params.get("debug") === "1")
    }
  }, [])

  useEffect(() => {
    console.log("[v0] AccountHubWrapper.useEffect: isOpen=", isOpen, "user=", user?.username || user?.email || "none")

    if (!user || !isOpen) return

    let foundUserId: string | null = null

    const storedPiUserId = (() => {
      try {
        return typeof window !== "undefined" ? localStorage.getItem("pi_user_id") : null
      } catch {
        return null
      }
    })()

    if ((user as any).type === "pi") {
      const candidate = (user as any).piUserId || storedPiUserId || user.uid
      foundUserId = isUuid(candidate) ? candidate : null
    } else {
      const candidate = user.uid
      if (isUuid(candidate)) {
        foundUserId = candidate
      } else {
        try {
          const sb = createBrowserClient()
          sb.auth.getSession().then(({ data }) => {
            const sid = data.session?.user?.id
            if (isUuid(sid)) {
              setCurrentUserId(sid)
              loadWallet(sid)
            }
          })
          return
        } catch {
          foundUserId = null
        }
      }
    }

    if (!foundUserId && storedPiUserId && isUuid(storedPiUserId)) {
      foundUserId = storedPiUserId
    }

    try {
      const getCookie = (name: string) => {
        const cookies = typeof document !== "undefined" ? document.cookie || "" : ""
        const parts = cookies.split(";").map((p) => p.trim())
        const hit = parts.find((p) => p.startsWith(name + "="))
        if (!hit) return null
        return hit.substring((name + "=").length)
      }

      const raw = getCookie("pitodo_pi_user") || getCookie("pi_user_id")
      if (raw) {
        const decoded = decodeURIComponent(raw)
        try {
          const maybeJson = JSON.parse(decoded)
          const jsonId = maybeJson?.userId || maybeJson?.id || maybeJson?.uid
          if (isUuid(jsonId)) foundUserId = jsonId
        } catch {
          const m = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
          const cookieUuid = m ? m[0] : null
          if (isUuid(cookieUuid)) foundUserId = cookieUuid
        }
      }
    } catch {}

    if (foundUserId) {
      console.log("[v0] AccountHubWrapper.useEffect: Found userId, calling loadWallet:", foundUserId)
      setCurrentUserId(foundUserId)
      loadWallet(foundUserId)
    } else {
      console.log("[v0] AccountHubWrapper.useEffect: No valid userId found, cannot load wallet")
    }
  }, [user, isOpen])

  const loadWallet = async (userId: any, forceRefresh = false) => {
    console.log("[v0] AccountHubWrapper.loadWallet: Starting for userId:", userId)
    const CACHE_KEY = `pitd_wallet_cache:${userId}`
    if (loadWalletInFlightRef.current) return
    if (!forceRefresh && lastLoadedWalletUserIdRef.current === userId && walletData) return
    loadWalletInFlightRef.current = true

    setLoadingWallet(true)
    setWalletError(null)

    try {
      const isRateLimitLike = (e: any) => {
        const msg = String(e?.message || e || "")
        const status = Number(e?.status || e?.code || 0)
        return status === 429 || msg.includes("Too Many") || msg.includes("429") || msg.includes("rate")
      }

      const readCache = () => {
        try {
          const raw = localStorage.getItem(CACHE_KEY)
          if (!raw) return null
          return JSON.parse(raw)
        } catch {
          return null
        }
      }

      const writeCache = (x: any) => {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(x))
        } catch {}
      }

      let wallet: any = null
      let lastErr: any = null

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController()
          const t = setTimeout(() => controller.abort(), 12000)

          const res = await fetch(`/api/pitd/wallet?userId=${encodeURIComponent(userId)}`, {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          })
          clearTimeout(t)

          const payload = await res.json().catch(() => null)

          if (!res.ok) {
            if (isRateLimitLike(payload) || isRateLimitLike({ status: res.status })) {
              const cached = readCache()
              if (cached) {
                wallet = cached
                break
              }
            }
            lastErr = payload?.error || `HTTP ${res.status}`
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 1500))
              continue
            }
            throw new Error(lastErr)
          }

          if (!payload?.wallet?.address) {
            lastErr = "No wallet data"
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 1500))
              continue
            }
            throw new Error(lastErr)
          }

          wallet = payload.wallet
          break
        } catch (e: any) {
          lastErr = e
          if (attempt === 0 && !isRateLimitLike(e)) {
            await new Promise((r) => setTimeout(r, 1500))
            continue
          }
          if (isRateLimitLike(e)) {
            const cached = readCache()
            if (cached) {
              wallet = cached
              break
            }
          }
          throw e
        }
      }

      if (wallet) {
        const balanceNow = Number(wallet.balance ?? 0)
        const lockedNow = Number(wallet.locked_balance ?? 0)
        const totalBalanceNow = balanceNow + lockedNow
        const spentNow = Number(wallet.total_spent ?? 0)
        const earnedNow = Number(totalBalanceNow + spentNow)

        const normalized = {
          id: wallet.id,
          user_id: wallet.user_id,
          balance: balanceNow,
          total_balance: totalBalanceNow,
          address: wallet.address || "",
          total_earned: earnedNow,
          total_spent: spentNow,
          locked_balance: lockedNow,
          created_at: wallet.created_at || new Date().toISOString(),
        }

        console.log("[v0] AccountHubWrapper.loadWallet: Success - balance:", balanceNow)
        setWalletData(normalized)
        setPitdBalance(balanceNow)
        if (!currentUserId && normalized.user_id && isUuid(normalized.user_id)) {
          setCurrentUserId(normalized.user_id)
        }
        lastLoadedWalletUserIdRef.current = userId
        writeCache(normalized)
      }
    } catch (error) {
      console.error("[v0] AccountHubWrapper.loadWallet: Exception:", error)
      setWalletData(null)
      setWalletError("Không thể tải ví PITD.")
    } finally {
      setLoadingWallet(false)
      loadWalletInFlightRef.current = false
    }
  }

  async function loadTransactions(opts?: {
    direction?: "in" | "out"
    limit?: number
    target?: "in" | "out" | "all"
  }) {
    if (!user) return
    try {
      setLoadingTransactions(true)
      setTransactionsError(null)

      const authType = (user as any)?.type || (user as any)?.authType || "unknown"
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-pitodo-user-id": (user as any).id,
        "x-auth-type": authType,
        "x-user-type": authType,
      }

      if (typeof (user as any).id === "string" && isUuid((user as any).id)) {
        headers["x-user-id"] = (user as any).id
      }

      if (authType === "email") {
        try {
          const supabase = createBrowserClient()
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers["authorization"] = `Bearer ${session.access_token}`
          }
        } catch {}
      }

      if (authType === "pi") {
        try {
          const piUserId = localStorage.getItem("pi_user_id") || ""
          const piUsername = localStorage.getItem("pi_username") || ""
          if (piUserId) headers["x-pi-user-id"] = piUserId
          if (piUsername) headers["x-pi-username"] = piUsername
        } catch {}
      }

      const txUrl = new URL("/api/pitd/transactions", window.location.origin)
      const limit = opts?.limit ?? 50
      txUrl.searchParams.set("limit", String(limit))
      if (opts?.direction) txUrl.searchParams.set("direction", opts.direction)

      const res = await fetch(txUrl.toString(), {
        method: "GET",
        headers,
        credentials: "include",
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.ok) {
        const msg = payload?.error || payload?.message || `HTTP ${res.status}`
        setTransactionsError(String(msg))
        const target = opts?.target || (opts?.direction ? opts.direction : "all")
        if (target === "in") setTransactionsIn([])
        else if (target === "out") setTransactionsOut([])
        else setTransactions([])
        return
      }

      const list = Array.isArray(payload.transactions) ? payload.transactions : []
      const mapped: Transaction[] = list.map((t: any) => ({
        id: String(t.id ?? ""),
        wallet_id: String(t.wallet_id ?? payload.wallet?.id ?? ""),
        user_id: String(payload.wallet?.user_id ?? user.id),
        transaction_type: String(t.transaction_type ?? ""),
        amount: Number(t.amount ?? 0),
        description: String(t.description ?? ""),
        status: "completed",
        created_at: String(t.created_at ?? ""),
        ...(t.balance_after !== undefined ? { balance_after: Number(t.balance_after) } : {}),
        ...(t.metadata !== undefined ? { metadata: t.metadata } : {}),
      }))

      const target = opts?.target || (opts?.direction ? opts.direction : "all")
      if (target === "in") setTransactionsIn(mapped)
      else if (target === "out") setTransactionsOut(mapped)
      else setTransactions(mapped)
    } catch (e: any) {
      setTransactionsError(String(e?.message || e))
      const target = opts?.target || (opts?.direction ? opts.direction : "all")
      if (target === "in") setTransactionsIn([])
      else if (target === "out") setTransactionsOut([])
      else setTransactions([])
    } finally {
      setLoadingTransactions(false)
    }
  }

  async function loadPurchases() {
    if (!user) return
    try {
      setLoadingPurchases(true)
      const supabase = createBrowserClient()

      const candidates = Array.from(
        new Set(
          [
            currentUserId,
            (user as any)?.uid,
            (user as any)?.id,
            (user as any)?.pi_uid,
            (user as any)?.piUid,
            (user as any)?.pi_user_id,
            (user as any)?.piUserId,
            (user as any)?.user_id,
          ]
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean),
        ),
      )

      if (candidates.length === 0) {
        setPurchases([])
        return
      }

      let purchasesData: any[] | null = null
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token

        const headers: Record<string, string> = {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        }
        if ((user as any)?.type === "pi" && (user as any)?.uid) {
          headers["x-pi-user-id"] = (user as any).uid
        }

        const res = await fetch("/api/purchases", {
          method: "GET",
          headers,
          credentials: "include",
          cache: "no-store",
        })

        const json = await res.json().catch(() => null)

        if (res.ok) {
          purchasesData = Array.isArray(json?.purchases) ? json.purchases : []
        }
      } catch {}

      if (purchasesData === null) {
        const { data } = await supabase
          .from("user_purchases")
          .select(`
            *,
            product:products(id, name, image_url, media, price)
          `)
          .in("user_id", candidates)
          .order("created_at", { ascending: false })

        purchasesData = data ?? []
      }

      setPurchases(purchasesData)
    } catch (error) {
      console.error("[v0] Error loading purchases:", error)
    } finally {
      setLoadingPurchases(false)
    }
  }

  async function loadFavorites() {
    if (!user) return
    try {
      setLoadingFavorites(true)
      const supabase = createBrowserClient()

      const candidates = Array.from(
        new Set(
          [
            currentUserId,
            (user as any)?.uid,
            (user as any)?.id,
            (user as any)?.pi_uid,
            (user as any)?.piUid,
            (user as any)?.pi_user_id,
            (user as any)?.piUserId,
            (user as any)?.user_id,
          ]
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean),
        ),
      )

      if (candidates.length === 0) {
        setFavorites([])
        return
      }

      const { data: favoritesData } = await supabase
        .from("user_favorites")
        .select(`
          *,
          product:products(id, name, image_url, media, price)
        `)
        .in("user_id", candidates)
        .order("created_at", { ascending: false })

      if (favoritesData) {
        setFavorites(favoritesData)
      }
    } catch (error) {
      console.error("[v0] Error loading favorites:", error)
    } finally {
      setLoadingFavorites(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTransactionIcon = (amount: number) => {
    if (amount > 0) {
      return <ArrowDownLeft className="h-4 w-4 text-green-500" />
    }
    return <ArrowUpRight className="h-4 w-4 text-red-500" />
  }

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      purchase: "Mua hàng",
      sale: "Bán hàng",
      transfer_in: "Nhận chuyển",
      transfer_out: "Chuyển đi",
      service_fee: "Phí dịch vụ",
      tax: "Thuế",
      reward: "Thưởng",
      refund: "Hoàn tiền",
      deposit: "Nạp tiền",
      withdrawal: "Rút tiền",
    }
    return labels[type] || type
  }

  const getProductImage = (product: any) => {
    if (!product) return "/diverse-products-still-life.png"
    if (product.media && Array.isArray(product.media)) {
      const imageMedia = product.media.find((m: any) => m.type === "image" && m.url && !m.url.startsWith("blob:"))
      if (imageMedia) return imageMedia.url
    }
    if (product.image_url && !product.image_url.startsWith("blob:")) return product.image_url
    return `/placeholder.svg?height=80&width=80&query=${encodeURIComponent(product.name || "product")}`
  }

  async function removeFavorite(favoriteId: string) {
    try {
      const supabase = createBrowserClient()
      await supabase.from("user_favorites").delete().eq("id", favoriteId)
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId))
    } catch (error) {
      console.error("[v0] Error removing favorite:", error)
    }
  }

  return (
    <>
      {/* Debug Mode Overlay */}
      {debugMode && isOpen && (
        <div className="fixed top-20 left-4 z-[60] bg-black/90 text-white p-3 rounded-lg text-xs max-w-xs">
          <div className="font-bold mb-2">🐛 Debug Mode</div>
          <div>User: {user?.username || user?.email || "none"}</div>
          <div>Role: {user?.role || "unknown"}</div>
          <div>User ID: {currentUserId || "not found"}</div>
          <div>Loading: {loadingWallet ? "YES" : "NO"}</div>
          <div>Balance: {pitdBalance}</div>
          <div>Wallet: {walletData ? "loaded" : "null"}</div>
          {walletError && <div className="text-red-400">Error: {walletError}</div>}
        </div>
      )}

      <AccountHubSheet
        isOpen={isOpen}
        onClose={onClose}
        pitdBalance={pitdBalance}
        walletData={walletData}
        loadingWallet={loadingWallet}
        onOpenTransferModal={() => {
          onClose()
          setShowTransferModal(true)
        }}
        onOpenTransactionHistory={async () => {
          onClose()
          await Promise.all([
            loadTransactions({ direction: "in", limit: 20, target: "in" }),
            loadTransactions({ direction: "out", limit: 20, target: "out" }),
          ])
          setShowTransactionHistory(true)
        }}
        onOpenPurchases={() => {
          onClose()
          loadPurchases()
          setShowPurchases(true)
        }}
        onOpenFavorites={() => {
          onClose()
          loadFavorites()
          setShowFavorites(true)
        }}
      />

      {/* Transaction History Modal */}
      {showTransactionHistory && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowTransactionHistory(false)} />
          <div className="fixed inset-4 z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-w-2xl mx-auto my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500">
              <h3 className="text-lg font-bold text-white">Lịch sử giao dịch</h3>
              <button
                onClick={() => setShowTransactionHistory(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setTxTab("in")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  txTab === "in"
                    ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Nhận ({transactionsIn.length})
              </button>
              <button
                onClick={() => setTxTab("out")}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  txTab === "out"
                    ? "text-pink-600 border-b-2 border-pink-600 bg-pink-50"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Gửi ({transactionsOut.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingTransactions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : transactionsError ? (
                <div className="text-center py-8 text-sm text-red-600">{transactionsError}</div>
              ) : (txTab === "in" ? transactionsIn : transactionsOut).length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">Chưa có giao dịch</div>
              ) : (
                (txTab === "in" ? transactionsIn : transactionsOut).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(tx.amount)}
                      <div>
                        <p className="font-medium text-sm text-gray-800">{getTransactionLabel(tx.transaction_type)}</p>
                        <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                        {tx.description && <p className="text-xs text-gray-600 mt-1">{tx.description}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                      </p>
                      {tx.balance_after !== undefined && (
                        <p className="text-xs text-gray-500">
                          Số dư: {tx.balance_after.toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Purchases Modal */}
      {showPurchases && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowPurchases(false)} />
          <div className="fixed inset-4 z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-w-2xl mx-auto my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-orange-400 to-pink-500">
              <h3 className="text-lg font-bold text-white">Sản phẩm đã mua</h3>
              <button
                onClick={() => setShowPurchases(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingPurchases ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : purchases.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">Chưa có đơn hàng</div>
              ) : (
                purchases.map((purchase) => (
                  <div key={purchase.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                    <img
                      src={getProductImage(purchase.product) || "/placeholder.svg"}
                      alt={purchase.product?.name || "Product"}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-800">{purchase.product?.name || "Sản phẩm"}</p>
                      <p className="text-xs text-gray-500 mt-1">Số lượng: {purchase.quantity}</p>
                      <p className="text-xs text-gray-500">Ngày: {formatDate(purchase.created_at)}</p>
                      <p className="text-sm font-semibold text-purple-600 mt-2">
                        {purchase.total_price.toLocaleString("vi-VN")} {purchase.payment_method === "pi" ? "π" : "PITD"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Favorites Modal */}
      {showFavorites && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowFavorites(false)} />
          <div className="fixed inset-4 z-50 bg-white rounded-2xl shadow-2xl flex flex-col max-w-2xl mx-auto my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-pink-500 to-purple-500">
              <h3 className="text-lg font-bold text-white">Sản phẩm yêu thích</h3>
              <button
                onClick={() => setShowFavorites(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingFavorites ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : favorites.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">Chưa có sản phẩm yêu thích</div>
              ) : (
                favorites.map((favorite) => (
                  <div key={favorite.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                    <img
                      src={getProductImage(favorite.product) || "/placeholder.svg"}
                      alt={favorite.product?.name || "Product"}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-800">{favorite.product?.name || "Sản phẩm"}</p>
                      <p className="text-sm font-semibold text-purple-600 mt-2">
                        {favorite.product?.price?.toLocaleString("vi-VN")} PITD
                      </p>
                      <button
                        onClick={() => removeFavorite(favorite.id)}
                        className="text-xs text-red-500 hover:text-red-700 mt-2"
                      >
                        Xóa khỏi danh sách
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <PitdTransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          currentBalance={pitdBalance}
          onTransferSuccess={() => {
            if (currentUserId) {
              loadWallet(currentUserId, true)
            }
          }}
        />
      )}
    </>
  )
}
