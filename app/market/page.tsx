"use client"

// Route alias required by TSBIO "Hiến pháp kỹ thuật": /market
// Keep UI intact by reusing the existing /nong-san implementation.

import NongSanPage from "../nong-san/page"

export default function MarketPage() {
  return <NongSanPage />
}
