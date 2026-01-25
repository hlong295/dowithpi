"use client"

import { useState, useEffect, useRef } from "react"
import { createBrowserClient } from "@/lib/supabase/client"

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

function isUuid(v: any): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export function usePitdWallet(user: any, userId: string | null) {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastLoadedUserIdRef = useRef<string | null>(null)
  const loadInFlightRef = useRef(false)

  useEffect(() => {
    const loadWallet = async () => {
      if (!user || !userId || !isUuid(userId)) {
        setWallet(null)
        setBalance(null)
        return
      }

      // Prevent duplicate calls
      if (loadInFlightRef.current) return
      if (lastLoadedUserIdRef.current === userId && wallet) return

      loadInFlightRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const CACHE_KEY = `pitd_wallet_cache:${userId}`

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

        const isRateLimitLike = (e: any) => {
          const msg = String(e?.message || e || "")
          const status = Number(e?.status || e?.code || 0)
          return status === 429 || msg.includes("Too Many") || msg.includes("429") || msg.includes("rate")
        }

        let walletResult: any = null
        let lastErr: any = null

        // Retry logic (max 2 attempts)
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const controller = new AbortController()
            const t = setTimeout(() => controller.abort(), 12000)

            const qp: string[] = []
            if (typeof userId === "string" && isUuid(userId)) {
              qp.push(`userId=${encodeURIComponent(userId)}`)
            }
            const url = `/api/pitd/wallet${qp.length ? `?${qp.join("&")}` : ""}`

            // Build auth headers (copied verbatim from Account page)
            const headers: Record<string, string> = {
              "x-user-type": user?.type || "unknown",
            }

            if (typeof userId === "string" && isUuid(userId)) {
              headers["x-user-id"] = userId
            }

            // Email user: forward Supabase access token
            if (user?.type === "email") {
              try {
                const supabase = createBrowserClient()
                const { data } = await supabase.auth.getSession()
                const token = data?.session?.access_token
                if (token) headers["authorization"] = `Bearer ${token}`
              } catch (e) {
                console.log("[v0] usePitdWallet: Could not read email session token:", e)
              }
            }

            // Pi user: forward Pi auth headers
            if (user?.type === "pi") {
              try {
                const storedPiUserId = localStorage.getItem("pi_user_id") || ""
                const piUserId = (storedPiUserId || user?.id || "").trim()
                if (piUserId) headers["x-pi-user-id"] = piUserId

                const storedPiUsername = localStorage.getItem("pi_username") || ""
                const piUsername = (
                  storedPiUsername ||
                  (user as any)?.piUsername ||
                  (user as any)?.username ||
                  ""
                ).trim()
                if (piUsername) headers["x-pi-username"] = piUsername
              } catch (e) {
                console.log("[v0] usePitdWallet: Could not read Pi headers:", e)
              }
            }

            const res = await fetch(url, {
              method: "GET",
              credentials: "include",
              headers,
              signal: controller.signal,
            }).finally(() => clearTimeout(t))

            if (!res.ok) {
              const ct = res.headers.get("content-type") || ""
              let detailsText = ""
              if (ct.includes("application/json")) {
                try {
                  const j = await res.json()
                  detailsText = j?.details
                    ? typeof j.details === "string"
                      ? j.details
                      : JSON.stringify(j.details)
                    : j?.error || ""
                } catch {
                  detailsText = await res.text().catch(() => "")
                }
              } else {
                detailsText = await res.text().catch(() => "")
              }
              const err: any = new Error(detailsText || `HTTP_${res.status}`)
              err.status = res.status
              throw err
            }

            const json = await res.json().catch(async () => {
              const text = await res.text().catch(() => "")
              throw new Error(text || "WALLET_API_INVALID_JSON")
            })

            if (json?.ok === false) {
              const msg = json?.details || json?.error || "WALLET_API_OK_FALSE"
              throw new Error(msg)
            }

            walletResult = json?.wallet
            lastErr = null
            break
          } catch (e: any) {
            lastErr = e
            if (attempt === 0 && isRateLimitLike(e)) {
              await new Promise((r) => setTimeout(r, 700))
              continue
            }
            break
          }
        }

        if (lastErr) {
          // Fallback to cache
          const cached = readCache()
          if (cached) {
            setWallet(cached)
            setBalance(Number(cached.balance ?? 0))
            lastLoadedUserIdRef.current = userId
          }
          setError(String((lastErr as any)?.message || lastErr))
          return
        }

        if (walletResult) {
          const balanceNow = Number(walletResult.balance ?? 0)
          const lockedNow = Number(walletResult.locked_balance ?? 0)
          const totalBalanceNow = balanceNow + lockedNow
          const spentNow = Number(walletResult.total_spent ?? 0)
          const earnedNow = Number(totalBalanceNow + spentNow)

          const normalized = {
            id: walletResult.id,
            user_id: walletResult.user_id,
            balance: balanceNow,
            total_balance: totalBalanceNow,
            address: walletResult.address || "",
            total_earned: earnedNow,
            total_spent: spentNow,
            locked_balance: lockedNow,
            created_at: walletResult.created_at || new Date().toISOString(),
          }

          setWallet(normalized)
          setBalance(balanceNow)
          lastLoadedUserIdRef.current = userId
          writeCache(normalized)
        }
      } catch (err) {
        console.error("[v0] usePitdWallet: Exception:", err)
        setWallet(null)
        setError("Không thể tải ví PITD.")
      } finally {
        setIsLoading(false)
        loadInFlightRef.current = false
      }
    }

    loadWallet()
  }, [user, userId])

  return { wallet, balance, isLoading, error }
}
