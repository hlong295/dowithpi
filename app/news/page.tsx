"use client"

// Route alias required by TSBIO "Hiến pháp kỹ thuật": /news
// Keep UI intact by reusing the existing /tin-tuc implementation.

import TinTucPage from "../tin-tuc/page"

export default function NewsPage() {
  return <TinTucPage />
}
