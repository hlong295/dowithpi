"use client"

import { useEffect, useMemo, useState } from "react"

type NavTiming = {
  ttfbMs?: number
  domContentLoadedMs?: number
  loadMs?: number
}

function getNavTiming(): NavTiming {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    if (!nav) return {}
    const ttfbMs = Math.max(0, nav.responseStart - nav.startTime)
    const domContentLoadedMs = Math.max(0, nav.domContentLoadedEventEnd - nav.startTime)
    const loadMs = Math.max(0, nav.loadEventEnd - nav.startTime)
    return { ttfbMs, domContentLoadedMs, loadMs }
  } catch {
    return {}
  }
}

async function timedFetch(url: string, timeoutMs: number): Promise<{ ms: number; ok: boolean; status?: number }> {
  const started = performance.now()
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" })
    const ms = Math.round(performance.now() - started)
    return { ms, ok: res.ok, status: res.status }
  } catch {
    const ms = Math.round(performance.now() - started)
    return { ms, ok: false }
  } finally {
    clearTimeout(t)
  }
}

export default function DebugPerfOverlay() {
  const enabled = useMemo(() => {
    if (typeof window === "undefined") return false
    const sp = new URLSearchParams(window.location.search)
    // Use ?dbg=1 to enable on Pi Browser (no console)
    return sp.get("dbg") === "1"
  }, [])

  const [nav, setNav] = useState<NavTiming>({})
  const [api, setApi] = useState<{ home?: string; wallet?: string }>({})

  useEffect(() => {
    if (!enabled) return
    setNav(getNavTiming())

    ;(async () => {
      const [home, wallet] = await Promise.all([
        timedFetch("/api/feed/home", 15000),
        timedFetch("/api/pitd/wallet", 15000),
      ])
      setApi({
        home: `${home.ok ? "OK" : "ERR"}${home.status ? `:${home.status}` : ""} ${home.ms}ms`,
        wallet: `${wallet.ok ? "OK" : "ERR"}${wallet.status ? `:${wallet.status}` : ""} ${wallet.ms}ms`,
      })
    })()
  }, [enabled])

  if (!enabled) return null

  const f = (n?: number) => (typeof n === "number" ? `${Math.round(n)}ms` : "-")

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        padding: "10px 12px",
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.4,
        maxWidth: 280,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>DEBUG PERF (dbg=1)</div>
      <div>TTFB: {f(nav.ttfbMs)}</div>
      <div>DCL: {f(nav.domContentLoadedMs)}</div>
      <div>Load: {f(nav.loadMs)}</div>
      <div style={{ marginTop: 6, fontWeight: 700 }}>API</div>
      <div>/api/feed/home: {api.home ?? "..."}</div>
      <div>/api/pitd/wallet: {api.wallet ?? "..."}</div>
    </div>
  )
}
