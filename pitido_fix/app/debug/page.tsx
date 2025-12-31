"use client"

import { useEffect, useState } from "react"

type ApiResult = {
  ok: boolean
  status?: number
  data?: any
  error?: string
}

export default function DebugPage() {
  const [env, setEnv] = useState<any>(null)
  const [walletResult, setWalletResult] = useState<ApiResult | null>(null)
  const [ensureUserResult, setEnsureUserResult] = useState<ApiResult | null>(null)

  useEffect(() => {
    const hasWindow = typeof window !== "undefined"
    const hasPi = hasWindow && (window as any).Pi
    setEnv({
      buildId: "DEBUG_UI_2025-12-31",
      hasWindow,
      isPiBrowser: Boolean(hasPi),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
      location: hasWindow ? window.location.href : "N/A",
    })

    fetch("/api/auth/ensure-user")
      .then(async (res) => {
        const text = await res.text()
        let data: any = null
        try {
          data = text ? JSON.parse(text) : null
        } catch {
          data = text
        }
        setEnsureUserResult({ ok: res.ok, status: res.status, data })
      })
      .catch((e) => setEnsureUserResult({ ok: false, error: String(e) }))

    fetch("/api/pitd/wallet")
      .then(async (res) => {
        const text = await res.text()
        let data: any = null
        try {
          data = text ? JSON.parse(text) : null
        } catch {
          data = text
        }
        setWalletResult({ ok: res.ok, status: res.status, data })
      })
      .catch((e) => setWalletResult({ ok: false, error: String(e) }))
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: "monospace", lineHeight: 1.4 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>🔎 PITODO DEBUG</h1>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>1️⃣ Environment</h2>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(env, null, 2)}</pre>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>2️⃣ /api/auth/ensure-user</h2>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {JSON.stringify(ensureUserResult, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>3️⃣ /api/pitd/wallet</h2>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(walletResult, null, 2)}</pre>
      </section>

      <p style={{ opacity: 0.8 }}>
        Nếu 1 trong 2 API trả 401/403/500, chụp màn hình trang này gửi lại là đủ để fix tiếp (không cần console).
      </p>
    </div>
  )
}
