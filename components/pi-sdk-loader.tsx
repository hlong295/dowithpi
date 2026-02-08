"use client"

import { useEffect, useState } from "react"

/**
 * PERF NOTE
 * - In Pi Browser, `window.Pi` is injected by the container.
 * - Loading `https://sdk.minepi.com/pi-sdk.js` again can add a slow 3rd‑party
 *   network request before interactive scripts settle (observed as long blank
 *   load on Pi Browser).
 *
 * This loader only injects the Pi SDK script if `window.Pi` is missing.
 * It does NOT change any UI.
 */
export default function PiSdkLoader() {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    // If Pi is already available (Pi Browser), do nothing.
    // Otherwise, load the SDK for non-Pi environments where it may be needed.
    const hasPi = typeof window !== "undefined" && (window as any).Pi
    if (!hasPi) setShouldLoad(true)
  }, [])

  useEffect(() => {
    if (!shouldLoad) return
    if (document.getElementById("pi-sdk-js")) return

    const s = document.createElement("script")
    s.id = "pi-sdk-js"
    s.src = "https://sdk.minepi.com/pi-sdk.js"
    s.async = true
    s.defer = true
    document.head.appendChild(s)
  }, [shouldLoad])

  return null
}
