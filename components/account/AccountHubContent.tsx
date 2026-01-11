"use client"

import * as React from "react"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { initPiSdk } from "@/lib/pi-sdk"
import { createBrowserClient } from "@/lib/supabase/client"
import { SUPABASE_PROJECT_REF, SUPABASE_URL } from "@/lib/supabase/config"
import { useAuth } from "@/lib/auth-context"
import { PitdTransferModal } from "@/components/pitd-transfer-modal"
import {
  Shield,
  Package,
  Users,
  Store,
  Settings,
  HelpCircle,
  Info,
  LogOut,
  Plus,
  ChevronRight,
  Loader2,
  Coins,
  Wallet,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  X,
  Heart,
  ShoppingBag,
  Send,
  AlertTriangle,
} from "lucide-react"

const ROOT_ADMIN_USERNAME = "HLong295"
const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]

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

export function AccountHubContent() {
  const { user, isLoading: authLoading, logout } = useAuth()

  const debugEnabled = (() => {
    if (!user) return false
    const role = String((user as any).role || "").toLowerCase()
    const username = String((user as any).username || "").toLowerCase()
    const piUsername = String((user as any).pi_username || "").toLowerCase()
    return (
      role === "root_admin" ||
      role === "root" ||
      username === ROOT_ADMIN_USERNAME.toLowerCase() ||
      piUsername === ROOT_ADMIN_USERNAME.toLowerCase() ||
      username === "hlong295" ||
      piUsername === "hlong295"
    )
  })()
  const [debugAuth, setDebugAuth] = React.useState<any>(null)
  const [debugEnsure, setDebugEnsure] = React.useState<any>(null)
  const [debugLoading, setDebugLoading] = React.useState(false)

  React.useEffect(() => {
    if (!debugEnabled) return
    ;(async () => {
      try {
        const supabase = createBrowserClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const { data: userData } = await supabase.auth.getUser()
        setDebugAuth({
          appUser: user
            ? {
                type: (user as any).type,
                role: (user as any).role || null,
                username: (user as any).username || (user as any).pi_username || null,
                uid: (user as any).uid || null,
                piUserId: (user as any).piUserId || (user as any).piUserIdCookie || null,
                email: (user as any).email || null,
              }
            : null,
          cookies: (() => {
            try {
              const m = document.cookie.match(/(?:^|; )pi_user_id=([^;]+)/)
              return { pi_user_id: m ? decodeURIComponent(m[1]) : null }
            } catch {
              return { pi_user_id: null }
            }
          })(),
          session: sessionData?.session
            ? { userId: sessionData.session.user.id, email: sessionData.session.user.email }
            : null,
          authUser: userData?.user
            ? {
                id: userData.user.id,
                email: userData.user.email,
                email_confirmed_at: (userData.user as any).email_confirmed_at,
              }
            : null,
        })
      } catch (e: any) {
        setDebugAuth({ error: e?.message || String(e) })
      }
      try {
        setDebugEnsure((window as any).__pitodoEnsureUserLast || null)
      } catch {}
    })()
  }, [debugEnabled])

  React.useEffect(() => {
    if (!debugEnabled) return
    if ((window as any).__pitodoEnsureUserAutoRan) return
    ;(window as any).__pitodoEnsureUserAutoRan = true
    runEnsureUserDebug()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugEnabled])

  const runEnsureUserDebug = async () => {
    if (!debugEnabled) return
    setDebugLoading(true)
    try {
      const authUser = (debugAuth as any)?.authUser
      const piUserIdFromCookie = (() => {
        try {
          const m = document.cookie.match(/(?:^|; )pi_user_id=([^;]+)/)
          return m ? decodeURIComponent(m[1]) : null
        } catch {
          return null
        }
      })()
      const payload = authUser
        ? {
            userId: authUser.id,
            email: authUser.email,
            metadata: { email_confirmed_at: (authUser as any).email_confirmed_at },
          }
        : user
          ? {
              userId: (user as any).piUserId || piUserIdFromCookie || (user as any).id || (user as any).uid,
              email: (user as any).email || null,
              metadata: {
                from_pi: true,
                email_confirmed_at: (user as any)?.email_confirmed_at,
                username: (user as any)?.pi_username || (user as any)?.username || null,
              },
            }
          : null

      if (!payload?.userId) {
        setDebugEnsure({
          at: new Date().toISOString(),
          ok: false,
          error: "No auth userId available (no Supabase session?)",
        })
        return
      }

      const res = await fetch("/api/auth/ensure-user?debug=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      const pack = { at: new Date().toISOString(), ok: res.ok, status: res.status, data }
      ;(window as any).__pitodoEnsureUserLast = pack
      setDebugEnsure(pack)
    } catch (e: any) {
      setDebugEnsure({ at: new Date().toISOString(), ok: false, error: e?.message || String(e) })
    } finally {
      setDebugLoading(false)
    }
  }

  const [isLoading, setIsLoading] = useState(true)
  const [piUsername, setPiUsername] = useState<string | null>(null)
  const [isRootAdmin, setIsRootAdmin] = useState(false)
  const [userRole, setUserRole] = useState("redeemer")
  const [pitdBalance, setPitdBalance] = useState<number>(0)
  const [loadingWallet, setLoadingWallet] = useState(false)
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walletErrStack, setWalletErrStack] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsIn, setTransactionsIn] = useState<Transaction[]>([])
  const [transactionsOut, setTransactionsOut] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [showTransactionHistory, setShowTransactionHistory] = useState(false)
  const [txTab, setTxTab] = useState<"in" | "out">("in")
  const [txShowAll, setTxShowAll] = useState(false)
  const [txAllDirection, setTxAllDirection] = useState<"all" | "in" | "out">("all")
  const [txFrom, setTxFrom] = useState("")
  const [txTo, setTxTo] = useState("")
  const [copied, setCopied] = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [showPurchases, setShowPurchases] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [loadingFavorites, setLoadingFavorites] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  const [dbgEnabled, setDbgEnabled] = useState(false)
  const [dbgLines, setDbgLines] = useState<string[]>([])
  const dbgPush = (line: string) => {
    try {
      if (!dbgEnabled) return
      setDbgLines((prev) => {
        const next = [...prev, `${new Date().toISOString()} | ${line}`]
        return next.length > 60 ? next.slice(next.length - 60) : next
      })
    } catch {
      // ignore
    }
  }

  const dbgAdd = (tag: string, data?: any) => {
    try {
      const payload = data !== undefined ? ` ${JSON.stringify(data)}` : ""
      dbgPush(`${tag}${payload}`)
    } catch {
      dbgPush(`${tag}`)
    }
  }
  const addDebugLog = (line: string) => dbgPush(line)

  const lastLoadedWalletUserIdRef = useRef<string | null>(null)
  const loadWalletInFlightRef = useRef(false)

  useEffect(() => {
    try {
      initPiSdk()
    } catch (err) {
      console.error("[v0] AccountHubContent: Failed to init Pi SDK:", err)
    }
  }, [])

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const enabled = sp.get("dbg") === "1" || localStorage.getItem("pitodo_debug") === "1"
      setDbgEnabled(enabled)
      if (enabled) {
        setDbgLines([`${new Date().toISOString()} | DBG enabled`])
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    console.log("[v0] AccountHubContent: user =", user ? user.username : "null", "authLoading =", authLoading)
  }, [user, authLoading])

  useEffect(() => {
    const initializeAccount = async () => {
      try {
        console.log("[v0] AccountHubContent: initializeAccount starting...")

        if (authLoading) {
          console.log("[v0] AccountHubContent: Still loading auth, waiting...")
          return
        }

        let foundUsername: string | null = null
        let foundRole = "redeemer"
        let foundUserId: string | null = null

        if (user) {
          console.log("[v0] AccountHubContent: Using user from auth context:", user.username)
          foundUsername = user.username
          foundRole = user.role || "redeemer"
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
                const { data } = await sb.auth.getSession()
                const sid = data.session?.user?.id
                foundUserId = isUuid(sid) ? sid : null
              } catch {
                foundUserId = null
              }
            }
          }
        } else {
          console.log("[v0] AccountHubContent: No auth user, checking localStorage...")

          if (typeof window !== "undefined" && window.localStorage) {
            for (const key of STORAGE_KEYS) {
              try {
                const data = localStorage.getItem(key)
                console.log("[v0] AccountHubContent: Checking key", key, ":", data ? "found" : "empty")

                if (data) {
                  const parsed = JSON.parse(data)
                  const username = parsed.piUsername || parsed.pi_username || parsed.username
                  const role = parsed.userRole || parsed.user_role || parsed.role || "redeemer"
                  const userId = parsed.uid || parsed.id || parsed.piUserId

                  if (username) {
                    console.log("[v0] AccountHubContent: Found user in localStorage:", username)
                    foundUsername = username
                    foundRole = role
                    foundUserId = userId
                    break
                  }
                }
              } catch (e) {
                console.error("[v0] AccountHubContent: Error parsing localStorage key", key, ":", e)
                continue
              }
            }
          } else {
            console.warn("[v0] AccountHubContent: localStorage not available")
          }
        }

        let normalizedUserId: string | null = isUuid(foundUserId) ? foundUserId : null
        if (!normalizedUserId) {
          try {
            const storedPiUserId = localStorage.getItem("pi_user_id")
            if (isUuid(storedPiUserId)) normalizedUserId = storedPiUserId
          } catch {}
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
            let pickedFromJson = false
            try {
              const maybeJson = JSON.parse(decoded)
              const jsonId = maybeJson?.userId || maybeJson?.id || maybeJson?.uid
              if (isUuid(jsonId)) {
                normalizedUserId = jsonId
                pickedFromJson = true
              }
            } catch {
              // ignore JSON errors
            }

            if (!pickedFromJson) {
              const m = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
              const cookieUuid = m ? m[0] : null
              if (isUuid(cookieUuid)) normalizedUserId = cookieUuid
            }
          }
        } catch {}

        console.log(
          "[v0] AccountHubContent: Final - username:",
          foundUsername,
          "role:",
          foundRole,
          "userId:",
          normalizedUserId,
        )

        if (dbgEnabled) {
          const storedPiUserId = (() => {
            try {
              return typeof window !== "undefined" ? localStorage.getItem("pi_user_id") : null
            } catch {
              return null
            }
          })()
          dbgPush(
            `init | authUser=${user ? user.username : "null"} | type=${(user as any)?.type || "-"} | foundUserId=${
              foundUserId || "-"
            } | stored_pi_user_id=${storedPiUserId || "-"}`,
          )
        }

        setPiUsername(foundUsername)
        setUserRole(foundRole)
        setCurrentUserId(normalizedUserId)

        if (foundUsername && !normalizedUserId) {
          setWalletError("MISSING_USER_ID")
          dbgAdd("missing_user_id", { foundUsername, foundUserId })
        }

        const isAdmin = foundUsername?.toLowerCase() === ROOT_ADMIN_USERNAME.toLowerCase()
        setIsRootAdmin(isAdmin)

        setIsLoading(false)

        if (foundUsername && normalizedUserId) {
          try {
            await loadWallet(normalizedUserId)
          } catch (walletErr) {
            console.error("[v0] AccountHubContent: Wallet load failed:", walletErr)
          }
        }
      } catch (error) {
        console.error("[v0] AccountHubContent: Critical error in initializeAccount:", error)
        setPageError("Đã xảy ra lỗi khi tải trang. Vui lòng thử lại.")
        setIsLoading(false)
      }
    }

    initializeAccount()
  }, [user, authLoading])

  const loadWallet = async (userId: any, forceRefresh = false) => {
    console.log("[v0] AccountHubContent.loadWallet: Starting for userId:", userId)
    if (dbgEnabled) dbgPush(`loadWallet start | userId=${userId}`)
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
          const qp: string[] = []
          if (typeof userId === "string" && isUuid(userId)) {
            qp.push(`userId=${encodeURIComponent(userId)}`)
          }
          const url = `/api/pitd/wallet${qp.length ? "?" + qp.join("&") : ""}`
          console.log("[v0] AccountHubContent.loadWallet: Fetching", url)
          if (dbgEnabled) dbgPush(`fetch attempt ${attempt + 1} | ${url}`)
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
          })
          clearTimeout(t)

          if (!res.ok) {
            const txt = await res.text()
            console.warn(`[v0] AccountHubContent.loadWallet: API returned ${res.status}: ${txt}`)
            if (dbgEnabled) dbgPush(`wallet API ${res.status} | ${txt}`)
            lastErr = { status: res.status, message: txt }
            if (isRateLimitLike({ status: res.status, message: txt })) {
              const cached = readCache()
              if (cached) {
                wallet = cached
                console.log("[v0] AccountHubContent.loadWallet: Using cached wallet due to rate limit")
                break
              }
            }
            throw new Error(`Wallet API error ${res.status}: ${txt}`)
          }

          const data = await res.json()
          if (dbgEnabled) dbgPush(`wallet received | balance=${data?.balance}`)
          if (data && typeof data.balance === "number") {
            wallet = data
            writeCache(wallet)
            break
          } else {
            console.warn("[v0] AccountHubContent.loadWallet: Malformed wallet response:", data)
            lastErr = { message: "Malformed wallet response" }
            throw new Error("Malformed wallet response")
          }
        } catch (err: any) {
          console.error(`[v0] AccountHubContent.loadWallet: Attempt ${attempt + 1} failed:`, err)
          if (dbgEnabled) dbgPush(`attempt ${attempt + 1} err | ${err?.message || String(err)}`)
          lastErr = err

          if (err.name === "AbortError" || isRateLimitLike(err)) {
            const cached = readCache()
            if (cached) {
              wallet = cached
              console.log("[v0] AccountHubContent.loadWallet: Using cached wallet after error")
              break
            }
          }

          if (attempt === 1) {
            throw err
          }
          await new Promise((r) => setTimeout(r, 800))
        }
      }

      if (!wallet) {
        throw lastErr || new Error("Failed to load wallet after retries")
      }

      setWalletData(wallet)
      setPitdBalance(Number(wallet.balance) || 0)
      lastLoadedWalletUserIdRef.current = userId
      console.log("[v0] AccountHubContent.loadWallet: Success, balance =", wallet.balance)
      if (dbgEnabled) dbgPush(`wallet loaded | balance=${wallet.balance}`)
    } catch (error: any) {
      console.error("[v0] AccountHubContent.loadWallet: Final error:", error)
      setWalletError(error?.message || String(error))
      setWalletErrStack(error?.stack || null)
      if (dbgEnabled) dbgPush(`wallet error | ${error?.message || String(error)}`)
    } finally {
      setLoadingWallet(false)
      loadWalletInFlightRef.current = false
    }
  }

  const loadTransactions = async (opts?: {
    direction?: "all" | "in" | "out"
    limit?: number
    offset?: number
    from?: string
    to?: string
    target?: "all" | "in" | "out"
  }) => {
    console.log("[v0] AccountHubContent.loadTransactions:", opts)
    if (!currentUserId) return
    setLoadingTransactions(true)
    setTransactionsError(null)

    try {
      const qp: string[] = []
      if (opts?.direction && opts.direction !== "all") qp.push(`direction=${opts.direction}`)
      if (opts?.limit) qp.push(`limit=${opts.limit}`)
      if (opts?.offset) qp.push(`offset=${opts.offset}`)
      if (opts?.from) qp.push(`from=${encodeURIComponent(opts.from)}`)
      if (opts?.to) qp.push(`to=${encodeURIComponent(opts.to)}`)

      const url = `/api/pitd/transactions${qp.length ? "?" + qp.join("&") : ""}`
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error(`Transactions API error ${res.status}`)
      }

      const data = await res.json()
      const txs: Transaction[] = data.transactions || []

      if (opts?.target === "in") {
        setTransactionsIn(txs)
      } else if (opts?.target === "out") {
        setTransactionsOut(txs)
      } else {
        setTransactions(txs)
      }

      console.log("[v0] AccountHubContent.loadTransactions: Loaded", txs.length, "transactions")
    } catch (error: any) {
      console.error("[v0] AccountHubContent.loadTransactions: Error:", error)
      setTransactionsError(error?.message || String(error))
    } finally {
      setLoadingTransactions(false)
    }
  }

  const loadPurchases = async () => {
    console.log("[v0] AccountHubContent.loadPurchases")
    if (!currentUserId) return
    setLoadingPurchases(true)

    try {
      const supabase = createBrowserClient()
      const candidates: string[] = []
      if (currentUserId) candidates.push(currentUserId)
      if (user?.uid && user.uid !== currentUserId) candidates.push(user.uid)

      if (dbgEnabled) {
        try {
          dbgPush(`purchases candidates | ${candidates.join(" | ")}`)
        } catch {}
      }

      if (candidates.length === 0) {
        setPurchases([])
        return
      }

      const { data: purchasesData } = await supabase
        .from("purchases")
        .select(
          `
          *,
          product:products(id, name, image_url, media, price)
        `,
        )
        .in("user_id", candidates)
        .order("created_at", { ascending: false })

      if (purchasesData) {
        setPurchases(purchasesData)
        if (dbgEnabled) {
          try {
            dbgPush(`purchases loaded | count=${purchasesData.length}`)
          } catch {}
        }
      }
    } catch (error) {
      console.error("[v0] Error loading purchases:", error)
      if (dbgEnabled) dbgPush(`purchases error | ${String((error as any)?.message || error)}`)
    } finally {
      setLoadingPurchases(false)
    }
  }

  const loadFavorites = async () => {
    console.log("[v0] AccountHubContent.loadFavorites")
    if (!currentUserId) return
    setLoadingFavorites(true)

    try {
      const supabase = createBrowserClient()
      const candidates: string[] = []
      if (currentUserId) candidates.push(currentUserId)
      if (user?.uid && user.uid !== currentUserId) candidates.push(user.uid)

      if (dbgEnabled) {
        try {
          dbgPush(`favorites candidates | ${candidates.join(" | ")}`)
        } catch {}
      }

      if (candidates.length === 0) {
        setFavorites([])
        return
      }

      const { data: favoritesData } = await supabase
        .from("user_favorites")
        .select(
          `
          *,
          product:products(id, name, image_url, media, price)
        `,
        )
        .in("user_id", candidates)
        .order("created_at", { ascending: false })

      if (favoritesData) {
        setFavorites(favoritesData)
        if (dbgEnabled) {
          try {
            dbgPush(`favorites loaded | count=${favoritesData.length}`)
          } catch {}
        }
      }
    } catch (error) {
      console.error("[v0] Error loading favorites:", error)
      if (dbgEnabled) dbgPush(`favorites error | ${String((error as any)?.message || error)}`)
    } finally {
      setLoadingFavorites(false)
    }
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

  const copyWalletAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatWalletAddress = (address: string) => {
    if (!address) return "N/A"
    if (address.length <= 16) return address
    return `${address.slice(0, 8)}...${address.slice(-8)}`
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

  const getTransactionIcon = (type: string, amount: number) => {
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

  const handleLogout = () => {
    try {
      STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
      logout()
      window.location.href = "/"
    } catch (err) {
      console.error("[v0] AccountHubContent: Logout error:", err)
      window.location.href = "/"
    }
  }

  const loggedIn = !!piUsername
  const isProvider = userRole === "provider" || isRootAdmin
  // </CHANGE>

  if (pageError) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <p className="text-center text-gray-700">{pageError}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-purple-600 text-white rounded-lg">
            Tải lại trang
          </button>
        </div>

        {debugEnabled ? (
          <div className="mt-4 p-3 border border-purple-300 rounded-lg bg-white">
            <div className="text-xs font-bold text-purple-900 mb-2">DEBUG (?debug=1) — Ensure User / Auth</div>
            <div className="text-xs whitespace-pre-wrap break-words">
              <div className="mb-2">
                <b>Auth Context user:</b> {JSON.stringify(user)}
              </div>
              <div className="mb-2">
                <b>Supabase auth/session:</b> {JSON.stringify(debugAuth)}
              </div>
              <div className="mb-2">
                <b>Last ensure-user result:</b> {JSON.stringify(debugEnsure)}
              </div>
            </div>
            <button
              type="button"
              onClick={runEnsureUserDebug}
              disabled={debugLoading}
              className="mt-2 px-3 py-2 rounded-md bg-purple-700 text-white text-sm disabled:opacity-60"
            >
              {debugLoading ? "Running ensure-user..." : "Run /api/auth/ensure-user (debug=1)"}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  if (isLoading || authLoading) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm text-gray-500">Đang tải tài khoản...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* User Card */}
      <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
            π
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-purple-800">{piUsername || "Khách"}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600">{piUsername ? "Ví Pi" : "Chưa đăng nhập"}</span>
              {loggedIn && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isRootAdmin
                      ? "bg-red-100 text-red-600"
                      : isProvider
                        ? "bg-purple-100 text-purple-600"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {isRootAdmin ? "ROOT ADMIN" : userRole.toUpperCase().replace("_", " ")}
                </span>
              )}
              {loggedIn &&
                ((user as any)?.providerLabel === "trusted" ||
                  (user as any)?.memberLabel === "trusted" ||
                  (user as any)?.provider_label === "trusted" ||
                  (user as any)?.member_label === "trusted") && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                    Uy tín
                  </span>
                )}
            </div>
          </div>
        </div>

        {/* Pi Wallet Info */}
        {piUsername && (
          <>
            <div className="mt-4 rounded-xl bg-white/60 border border-white/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-purple-700">Ví Pi</span>
              </div>
              <p className="text-xs text-gray-500">
                Ví Pi của bạn chỉ kết nối qua Pi SDK khi thanh toán. Số dư Pi không hiển thị ở đây. Khi bạn trao đổi
                hàng hóa/dịch vụ, ứng dụng sẽ kết nối đến ví Pi của bạn để thanh toán.
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 p-4 space-y-4">
              {/* Wallet Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-pink-600" />
                  <span className="text-sm font-semibold text-pink-700">Ví PITD</span>
                </div>
                {loadingWallet && <Loader2 className="h-4 w-4 animate-spin text-pink-500" />}
              </div>

              {/* Wallet Address */}
              {walletData?.address && (
                <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Địa chỉ ví</p>
                    <p className="text-sm font-mono text-gray-700 truncate">
                      {formatWalletAddress(walletData.address)}
                    </p>
                  </div>
                  <button
                    onClick={copyWalletAddress}
                    className="ml-2 p-2 rounded-lg hover:bg-pink-100 transition-colors"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-pink-500" />}
                  </button>
                </div>
              )}

              {/* Balance */}
              <div className="text-center py-3 bg-white/60 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Số dư</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold text-pink-700">
                    {pitdBalance.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </span>
                  <span className="text-lg text-pink-500 font-medium">PITD</span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50/80 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 mb-1">Tổng nhận</p>
                  <p className="text-sm font-semibold text-green-700">
                    +{(walletData?.total_earned || 0).toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-red-50/80 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-600 mb-1">Tổng chi</p>
                  <p className="text-sm font-semibold text-red-700">
                    -{(walletData?.total_spent || 0).toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Transaction History Button */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all"
                >
                  <Send className="h-4 w-4" />
                  Gửi PITD
                </button>
                <button
                  onClick={async () => {
                    setTxShowAll(false)
                    setTxTab("in")
                    await Promise.all([
                      loadTransactions({ direction: "in", limit: 20, target: "in" }),
                      loadTransactions({ direction: "out", limit: 20, target: "out" }),
                    ])
                    setShowTransactionHistory(true)
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-pink-300 text-pink-600 rounded-xl font-medium text-sm hover:bg-pink-50 transition-all"
                >
                  <History className="h-4 w-4" />
                  Lịch sử
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                PITD (Pi Token Dao) là token nội bộ của ứng dụng. Bạn có thể sử dụng PITD để thanh toán và trao đổi hàng
                hóa/dịch vụ trên PITODO.
              </p>

              {dbgEnabled && isRootAdmin && (
                <div className="rounded-xl bg-white/80 border border-pink-200 p-3 text-[11px] text-gray-700">
                  <div className="mb-2">
                    <span className="font-semibold text-pink-700">DBG</span>
                    <div className="text-[10px] text-gray-500">
                      Bật bằng cách thêm <span className="font-mono">?dbg=1</span> vào URL.
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div>
                      supabase.url: <span className="font-mono">{SUPABASE_URL}</span>
                    </div>
                    <div>
                      supabase.ref: <span className="font-mono">{SUPABASE_PROJECT_REF}</span>
                    </div>
                    <div>
                      user.type: <span className="font-mono">{(user as any)?.type || "-"}</span>
                    </div>
                    <div>
                      user.uid: <span className="font-mono">{(user as any)?.uid || "-"}</span>
                    </div>
                    <div>
                      pi_user_id(ls):{" "}
                      <span className="font-mono">
                        {(() => {
                          try {
                            return localStorage.getItem("pi_user_id") || "-"
                          } catch {
                            return "-"
                          }
                        })()}
                      </span>
                    </div>
                    <div>
                      currentUserId: <span className="font-mono">{currentUserId || "-"}</span>
                    </div>
                    <div>
                      wallet.id: <span className="font-mono">{walletData?.id || "-"}</span>
                    </div>
                    <div>
                      wallet.address: <span className="font-mono">{walletData?.address || "-"}</span>
                    </div>
                    <div>
                      walletError: <span className="font-mono">{walletError || "-"}</span>
                    </div>
                  </div>
                  <div className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono">
                    {dbgLines.length ? dbgLines.join("\n") : "(no logs)"}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!loggedIn && (
          <Link
            href="/login"
            className="mt-4 block w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Đăng nhập
          </Link>
        )}
      </div>

      {loggedIn && (
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-orange-400 to-pink-500">
            <div className="flex items-center gap-2 text-white">
              <ShoppingBag className="h-5 w-5" />
              <span className="font-semibold">Quản lý đơn hàng</span>
            </div>
          </div>

          <button
            onClick={() => {
              setShowPurchases(true)
              loadPurchases()
            }}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-orange-500" />
              <div className="text-left">
                <span className="font-medium text-gray-800">Sản phẩm đã mua</span>
                <p className="text-xs text-gray-500">Xem lịch sử mua hàng của bạn</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>

          <button
            onClick={() => {
              setShowFavorites(true)
              loadFavorites()
            }}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-pink-500" />
              <div className="text-left">
                <span className="font-medium text-gray-800">Sản phẩm yêu thích</span>
                <p className="text-xs text-gray-500">Danh sách sản phẩm đã lưu</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      )}

      {/* ROOT ADMIN Menu */}
      {isRootAdmin && (
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500">
            <div className="flex items-center gap-2 text-white">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">Quản trị hệ thống</span>
            </div>
          </div>

          <Link
            href="/admin"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-red-500" />
              <span className="font-medium text-gray-800">Bảng điều khiển</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/admin/products"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-800">Quản lý sản phẩm</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/admin/products/add"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-800">Thêm sản phẩm mới</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/admin/pitd-management"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-pink-600" />
              <span className="font-medium text-gray-800">Quản lý PITD</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/admin/members"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-800">Quản lý thành viên</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>
        </div>
      )}

      {/* Provider Menu */}
      {loggedIn && isProvider && (
        <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500">
            <div className="flex items-center gap-2 text-white">
              <Store className="h-5 w-5" />
              <span className="font-semibold">Quản lý Provider</span>
            </div>
          </div>

          <Link
            href="/provider"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-800">Gian hàng của tôi</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/provider/products"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-gray-800">Sản phẩm của tôi</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>

          <Link
            href="/provider/products/add"
            className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Plus className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-800">Thêm sản phẩm</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </Link>
        </div>
      )}

      {/* System Menu */}
      <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-gray-400 to-gray-500">
          <div className="flex items-center gap-2 text-white">
            <Settings className="h-5 w-5" />
            <span className="font-semibold">Hệ thống</span>
          </div>
        </div>

        <Link
          href="/settings"
          className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-gray-600" />
            <span className="font-medium text-gray-800">Cài đặt</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>

        <Link
          href="/help"
          className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-800">Trợ giúp</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>

        <Link
          href="/about"
          className="flex items-center justify-between px-4 py-4 hover:bg-purple-50 transition-colors border-b border-gray-100"
        >
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-gray-800">Giới thiệu</span>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>

        {loggedIn && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-red-50 transition-colors text-red-600"
          >
            <div className="flex items-center gap-3">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Đăng xuất</span>
            </div>
            <ChevronRight className="h-5 w-5 text-red-400" />
          </button>
        )}
      </div>

      {/* Transaction History Modal */}
      {showTransactionHistory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg mx-4 bg-white rounded-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-pink-500" />
                <h2 className="text-lg font-semibold text-gray-800">Lịch sử giao dịch</h2>
              </div>
              <button
                onClick={() => setShowTransactionHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {!txShowAll && (
              <div className="flex border-b">
                <button
                  onClick={() => setTxTab("in")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    txTab === "in"
                      ? "text-pink-600 border-b-2 border-pink-600 bg-pink-50/50"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Nhận
                </button>
                <button
                  onClick={() => setTxTab("out")}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    txTab === "out"
                      ? "text-pink-600 border-b-2 border-pink-600 bg-pink-50/50"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Gửi
                </button>
                <button
                  onClick={() => {
                    setTxShowAll(true)
                    setTxAllDirection("all")
                    loadTransactions({ direction: "all", limit: 50 })
                  }}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Tất cả
                </button>
              </div>
            )}

            {txShowAll && (
              <div className="p-4 border-b bg-gray-50">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTxShowAll(false)
                        setTxTab("in")
                      }}
                      className="text-sm text-purple-600 hover:underline"
                    >
                      ← Quay lại
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setTxAllDirection("all")
                        loadTransactions({ direction: "all", limit: 50, from: txFrom, to: txTo })
                      }}
                      className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                        txAllDirection === "all"
                          ? "bg-pink-600 text-white"
                          : "bg-white text-gray-600 border border-gray-300"
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => {
                        setTxAllDirection("in")
                        loadTransactions({ direction: "in", limit: 50, from: txFrom, to: txTo })
                      }}
                      className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                        txAllDirection === "in"
                          ? "bg-pink-600 text-white"
                          : "bg-white text-gray-600 border border-gray-300"
                      }`}
                    >
                      Nhận
                    </button>
                    <button
                      onClick={() => {
                        setTxAllDirection("out")
                        loadTransactions({ direction: "out", limit: 50, from: txFrom, to: txTo })
                      }}
                      className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                        txAllDirection === "out"
                          ? "bg-pink-600 text-white"
                          : "bg-white text-gray-600 border border-gray-300"
                      }`}
                    >
                      Gửi
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : transactionsError ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <AlertTriangle className="h-12 w-12 mb-3 text-amber-500" />
                  <p className="text-center">{transactionsError}</p>
                </div>
              ) : (
                (() => {
                  const displayTxs = txShowAll ? transactions : txTab === "in" ? transactionsIn : transactionsOut
                  return displayTxs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <History className="h-12 w-12 mb-3 text-gray-300" />
                      <p>Chưa có giao dịch</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayTxs.map((tx) => (
                        <div key={tx.id} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                          <div className="mt-1">{getTransactionIcon(tx.transaction_type, tx.amount)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 text-sm">
                                  {getTransactionLabel(tx.transaction_type)}
                                </p>
                                {tx.description && (
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tx.description}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-sm font-semibold ${
                                    tx.amount > 0 ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {tx.amount > 0 ? "+" : ""}
                                  {tx.amount.toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                                </p>
                                {tx.balance_after !== undefined && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Còn: {tx.balance_after.toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(tx.created_at)}</p>
                            <span
                              className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                                tx.status === "completed"
                                  ? "bg-green-100 text-green-600"
                                  : tx.status === "pending"
                                    ? "bg-yellow-100 text-yellow-600"
                                    : "bg-red-100 text-red-600"
                              }`}
                            >
                              {tx.status === "completed"
                                ? "Hoàn thành"
                                : tx.status === "pending"
                                  ? "Đang xử lý"
                                  : tx.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {showPurchases && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg mx-4 bg-white rounded-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-800">Sản phẩm đã mua</h2>
              </div>
              <button
                onClick={() => setShowPurchases(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingPurchases ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Package className="h-12 w-12 mb-3 text-gray-300" />
                  <p>Bạn chưa mua sản phẩm nào</p>
                  <Link href="/" className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium">
                    Khám phá sản phẩm
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <Link
                      key={purchase.id}
                      href={`/product/${purchase.product_id}`}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors"
                    >
                      <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                        <Image
                          src={getProductImage(purchase.product) || "/placeholder.svg"}
                          alt={purchase.product?.name || "Product"}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{purchase.product?.name || "Sản phẩm"}</p>
                        <p className="text-sm text-gray-500">Số lượng: {purchase.quantity}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm font-semibold text-pink-600">
                            {(purchase.total_price || 0).toLocaleString("vi-VN")}{" "}
                            {purchase.payment_method === "pitd" ? "PITD" : "Pi"}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              purchase.status === "completed"
                                ? "bg-green-100 text-green-600"
                                : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {purchase.status === "completed" ? "Hoàn thành" : purchase.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(purchase.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showFavorites && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg mx-4 bg-white rounded-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-500" />
                <h2 className="text-lg font-semibold text-gray-800">Sản phẩm yêu thích</h2>
              </div>
              <button
                onClick={() => setShowFavorites(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingFavorites ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Heart className="h-12 w-12 mb-3 text-gray-300" />
                  <p>Bạn chưa có sản phẩm yêu thích</p>
                  <Link href="/" className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium">
                    Khám phá sản phẩm
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((favorite) => (
                    <div key={favorite.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <Link href={`/product/${favorite.product_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                          <Image
                            src={getProductImage(favorite.product) || "/placeholder.svg"}
                            alt={favorite.product?.name || "Product"}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{favorite.product?.name || "Sản phẩm"}</p>
                          <p className="text-sm font-semibold text-pink-600 mt-1">
                            {(favorite.product?.price || 0).toLocaleString("vi-VN")} PITD
                          </p>
                          <p className="text-xs text-gray-400 mt-1">Đã lưu: {formatDate(favorite.created_at)}</p>
                        </div>
                      </Link>
                      <button
                        onClick={() => removeFavorite(favorite.id)}
                        className="p-2 hover:bg-red-100 rounded-full transition-colors"
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PitdTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        currentBalance={pitdBalance}
        walletAddress={walletData?.address || ""}
        onTransferComplete={() => {
          if (currentUserId) {
            loadWallet(currentUserId, true)
          }
          loadTransactions()
        }}
      />

      {dbgEnabled && (walletError || pageError) && (
        <div className="fixed inset-x-2 bottom-24 z-50 rounded-xl border border-amber-200 bg-amber-50/95 backdrop-blur p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-amber-700">DBG snapshot (account)</div>
            <button
              className="p-1 rounded-md hover:bg-amber-100"
              onClick={() => {
                try {
                  setDbgEnabled(false)
                } catch {}
              }}
              aria-label="Close debug"
            >
              <X className="h-4 w-4 text-amber-700" />
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {walletError && <div className="text-xs text-amber-900">walletError: {walletError}</div>}
            {walletErrStack && (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-snug text-amber-900 bg-white/60 rounded-lg p-2">
                {walletErrStack}
              </pre>
            )}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[10px] leading-snug text-gray-800 bg-white/60 rounded-lg p-2">
              {dbgLines.join("\n")}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
  // </CHANGE>
}
