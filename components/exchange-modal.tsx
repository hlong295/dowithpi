"use client"

import { useEffect, useMemo, useState } from "react"
import { createPiPayment, ensurePiSdkReady, getPiSdkErrorKey, signInWithPi } from "@/lib/pi-sdk"
import { useAuth } from "@/lib/auth-context"
import { CheckCircle, Loader2 } from "lucide-react"

type AnyObj = Record<string, any>

type Currency = "PI" | "PITD"

type ExchangeModalProps = {
  open: boolean
  onClose: () => void
  product: AnyObj | null
  amountPi?: number
  amountPitd?: number
  currency?: Currency
}

export default function ExchangeModal({
  open,
  onClose,
  product,
  amountPi,
  amountPitd,
  currency = "PI",
}: ExchangeModalProps) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(currency)

  // Pi Browser has no console. Add on-screen debug (only meaningful for PI flow).
  const [debugLines, setDebugLines] = useState<string[]>([])
  // Pi Browser has no console -> enable on-screen debug there
  const isPiBrowser =
    typeof navigator !== "undefined" && /pibrowser/i.test(navigator.userAgent || "")
  const debugEnabled =
    isPiBrowser || String(process.env.NEXT_PUBLIC_PI_SANDBOX || "").toLowerCase() === "true"

  // Load persisted Pi payment logs (survives the wallet screen)
  useEffect(() => {
    if (!debugEnabled || !open) return
    try {
      const key = "pitodo_pi_payment_debug"
      const raw = window.localStorage.getItem(key)
      if (!raw) return
      const lines = raw.split("\n").filter(Boolean)
      setDebugLines((prev) => {
        // Merge without duplicating obvious repeats
        const merged = [...prev, ...lines].slice(-60)
        return merged
      })
    } catch {}
  }, [debugEnabled, open])

  const addDebug = (msg: string) => {
    if (!debugEnabled) return
    const ts = new Date().toISOString().slice(11, 19)
    setDebugLines((prev) => [...prev, `[${ts}] ${msg}`].slice(-60))
  }

  const amount = selectedCurrency === "PI" ? amountPi : amountPitd

  const title = useMemo(() => {
    const name = product?.name ?? product?.title ?? "Product"
    return `Exchange: ${name}`
  }, [product])

  const memo = useMemo(() => {
    const name = product?.name ?? product?.title ?? "product"
    const id = product?.id ?? ""
    return `PITODO exchange - ${name}${id ? ` (#${id})` : ""}`
  }, [product])

  if (!open) return null

  const handlePiPayment = async () => {
    if (!amountPi) throw new Error("INVALID_PI_AMOUNT")

    addDebug(`PI payment start | amount=${Number(amountPi)} | productId=${String(product?.id ?? "")}`)

    // helpful env flags snapshot
    addDebug(
      `env: NEXT_PUBLIC_PI_SANDBOX=${String(process.env.NEXT_PUBLIC_PI_SANDBOX)} | PI_NETWORK=${String(
        process.env.PI_NETWORK,
      )}`,
    )

    const ready = await ensurePiSdkReady()
    addDebug(`ensurePiSdkReady: ok=${String(ready.ok)}${ready.ok ? "" : ` | error=${ready.error}`}`)
    if (!ready.ok) throw new Error(ready.error)

    // Ensure "payments" scope is granted before calling Pi.createPayment()
    try {
      addDebug("Pi.authenticate scopes=[username,payments]...")
      await signInWithPi(["username", "payments"])
      addDebug("Pi.authenticate: OK")
    } catch (e: any) {
      const key = getPiSdkErrorKey(e)
      setErr(`PI_AUTH_FAIL(${key}): ${e?.message || String(e)}`)
      addDebug(`Pi.authenticate: FAIL key=${key} msg=${e?.message || String(e)}`)
      throw e
    }


    if (!product) throw new Error("NO_PRODUCT")

    await createPiPayment(
      {
        amount: Number(amountPi),
        memo,
        metadata: {
          productId: product?.id ?? null,
          category: product?.category ?? null,
          merchant: product?.merchant_username ?? product?.merchant_name ?? null,
        },
      },
      {
        onReadyForServerApproval: async (paymentId: string) => {
          addDebug(`onReadyForServerApproval: paymentId=${paymentId}`)
          try {
            const r = await fetch("/api/payments/approve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // Do NOT change UI. We only pass additional data so the server
              // can create DB records accurately (orders/pi_payments/user_purchases).
              body: JSON.stringify({
                paymentId,
                productId: product?.id ?? null,
                quantity: 1,
                amount: Number(amountPi),
              }),
            })

            const txt = await r.text().catch(() => "")
            addDebug(`approve HTTP ${r.status} ${r.statusText} | body=${txt ? txt.slice(0, 220) : "<empty>"}`)

            if (!r.ok) {
              let j: any = {}
              try {
                j = txt ? JSON.parse(txt) : {}
              } catch {}
              setErr(`APPROVE_FAIL: ${j?.error || r.statusText || r.status}`)
            }
          } catch (e: any) {
            setErr(`APPROVE_ERR: ${e?.message || String(e)}`)
            addDebug(`approve EXCEPTION: ${e?.message || String(e)}`)
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          addDebug(`onReadyForServerCompletion: paymentId=${paymentId} txid=${txid}`)
          try {
            const r = await fetch("/api/payments/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId, txid }),
            })

            const txt = await r.text().catch(() => "")
            addDebug(
              `complete HTTP ${r.status} ${r.statusText} | body=${txt ? txt.slice(0, 220) : "<empty>"}`,
            )

            if (!r.ok) {
              let j: any = {}
              try {
                j = txt ? JSON.parse(txt) : {}
              } catch {}
              setErr(`COMPLETE_FAIL: ${j?.error || r.statusText || r.status}`)
            }
          } catch (e: any) {
            setErr(`COMPLETE_ERR: ${e?.message || String(e)}`)
            addDebug(`complete EXCEPTION: ${e?.message || String(e)}`)
          } finally {
            setDone(true)
            setBusy(false)
          }
        },
        onCancel: (paymentId: string) => {
          addDebug(`onCancel: paymentId=${paymentId}`)
          setBusy(false)
          setErr("Payment cancelled.")
        },
        onError: (error: Error, payment?: AnyObj) => {
          addDebug(`onError: ${String(error?.message || error)} | payment=${payment ? JSON.stringify(payment).slice(0, 220) : "<none>"}`)
          setBusy(false)
          setErr(String(error?.message || error))
        },
      },
    )
  }

  const handlePitdPayment = async () => {
    if (!amountPitd) throw new Error("INVALID_PITD_AMOUNT")
    if (!product) throw new Error("NO_PRODUCT")

    // IMPORTANT: PITD is internal => buyer identity must come from current auth context.
    // Server will resolve master user id and verify the PITD amount against product data.
    const buyerId = (user as any)?.uid || (user as any)?.id || ""
    if (!buyerId) throw new Error("USER_NOT_FOUND")

    // Pi Browser (WebView) đôi khi không tự gửi cookie khi dùng fetch.
    // -> ép gửi cookie + gửi kèm header user id để server nhận diện chắc chắn.
    // IMPORTANT: không đổi UI / luồng login; chỉ bổ sung header để server PITD nhận user.
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    // Always send x-user-id so email/user login vẫn thanh toán PITD được (server không đọc được localStorage session).
    if (buyerId) headers["x-user-id"] = buyerId
    // Keep existing Pi header for Pi-user flows.
    if ((user as any)?.type === "pi" && buyerId) headers["x-pi-user-id"] = buyerId

    const response = await fetch("/api/payments/pitd", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        productId: product.id,
        userId: buyerId,
        // The server will compute & verify expected PITD price (including flash sale).
        expectedAmount: amountPitd,
        productName: product?.name ?? product?.title ?? "Product",
        quantity: 1,
      }),
    })

    const result = await response.json()

    // On-screen debug (Pi Browser has no console)
    addDebug(`[PITD] status=${response.status} ok=${response.ok}`)
    try {
      addDebug(`[PITD] response=${JSON.stringify(result).slice(0, 500)}`)
    } catch {
      // ignore stringify errors
    }

    if (!response.ok) {
      const msg = result?.message || "Payment failed"
      const code = result?.code ? ` (${result.code})` : ""
      throw new Error(`${msg}${code}`)
    }

    console.log("[v0] PITD payment completed:", result)
  }

  const start = async () => {
    setErr(null)
    setDone(false)
    setBusy(true)
    setDebugLines([])

    try {
      if (!product) throw new Error("NO_PRODUCT")
      if (!amount || Number.isNaN(amount) || amount <= 0) throw new Error("INVALID_AMOUNT")

      if (selectedCurrency === "PI") {
        await handlePiPayment()
      } else {
        await handlePitdPayment()
        setDone(true)
        setBusy(false)
      }
    } catch (e: any) {
      const key = getPiSdkErrorKey(e)
      if (key === "PI_SDK_MISSING") setErr("Pi SDK is missing. Please open PITODO inside Pi Browser.")
      else if (key === "PI_SDK_AUTH_CANCELLED") setErr("You cancelled the Pi confirmation.")
      else if (String(e?.message).includes("Insufficient PITD balance")) setErr("Số dư PITD không đủ.")
      else if (String(e?.message).includes("USER_NOT_FOUND"))
        setErr("Không tìm thấy tài khoản. Vui lòng đăng nhập lại.")
      else setErr(String(e?.message || e))
      setBusy(false)
    }
  }

  const handleClose = () => {
    setDone(false)
    setErr(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3">
      <div className="w-full max-w-md rounded-2xl bg-white/90 backdrop-blur shadow-xl border border-white/60">
        <div className="p-4">
          {done ? (
            <div className="py-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-green-700 mb-2">Thanh toán thành công!</h3>
              <p className="text-gray-600 mb-1">Bạn đã mua thành công sản phẩm</p>
              <p className="font-semibold text-purple-700 mb-4">{product?.name ?? product?.title ?? "Product"}</p>
              <p className="text-sm text-gray-500 mb-6">
                Số tiền:{" "}
                <span className="font-semibold text-pink-600">
                  {amount} {selectedCurrency === "PI" ? "π" : "PITD"}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium hover:bg-gray-50"
                  onClick={handleClose}
                >
                  Đóng
                </button>
                <button
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-700"
                  onClick={() => {
                    handleClose()
                    window.location.href = "/account"
                  }}
                >
                  Xem đơn hàng
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-base font-semibold text-[#6e2036]">{title}</div>
              <div className="mt-1 text-sm text-gray-600">
                {selectedCurrency === "PI"
                  ? "Bạn sẽ kết nối ví Pi khi xác nhận."
                  : "Thanh toán sẽ được trừ từ ví PITD của bạn."}
              </div>

              {/* Currency selector */}
              {amountPi && amountPitd && (
                <div className="mt-3 flex gap-2 rounded-xl bg-gray-100 p-1">
                  <button
                    onClick={() => setSelectedCurrency("PI")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                      selectedCurrency === "PI" ? "bg-white shadow-sm text-purple-700" : "text-gray-600"
                    }`}
                  >
                    Thanh toán Pi
                  </button>
                  <button
                    onClick={() => setSelectedCurrency("PITD")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                      selectedCurrency === "PITD" ? "bg-white shadow-sm text-pink-700" : "text-gray-600"
                    }`}
                  >
                    Thanh toán PITD
                  </button>
                </div>
              )}

              <div className="mt-3 rounded-xl bg-white/80 border border-gray-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Số tiền</span>
                  <span className={`font-semibold ${selectedCurrency === "PI" ? "text-purple-600" : "text-pink-600"}`}>
                    {amount} {selectedCurrency === "PI" ? "π" : "PITD"}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500 break-words">Ghi chú: {memo}</div>
              </div>

              {err ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              ) : null}

              {debugEnabled && debugLines.length ? (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <div className="mb-1 text-xs font-semibold text-gray-700">PI DEBUG (screenshot this)</div>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-4 text-gray-600">
                    {debugLines.join("\n")}
                  </pre>
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium"
                  onClick={handleClose}
                  disabled={busy}
                >
                  Hủy
                </button>

                <button
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
                    selectedCurrency === "PI"
                      ? "bg-gradient-to-r from-purple-600 to-pink-600"
                      : "bg-gradient-to-r from-pink-600 to-purple-600"
                  }`}
                  onClick={start}
                  disabled={busy}
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : (
                    "Xác nhận thanh toán"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export { ExchangeModal }
