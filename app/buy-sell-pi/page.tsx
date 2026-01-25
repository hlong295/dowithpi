"use client";

import dynamic from "next/dynamic";

// IMPORTANT: Pi App Studio (pinet.com) sometimes crashes on pages that SSR/hydrate client hooks.
// Render this page as client-only to avoid "Application error: a client-side exception".

const BuySellPiClient = dynamic(() => import("./ui/BuySellPiClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 text-center">
          <div className="h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-emerald-100 mx-auto" />
          <div className="mt-6 h-8 w-48 bg-gray-100 rounded-xl mx-auto" />
          <div className="mt-3 h-3 w-64 bg-gray-100 rounded-xl mx-auto" />
          <div className="mt-8 h-32 bg-emerald-50 border border-emerald-100 rounded-2xl" />
        </div>
      </div>
    </div>
  ),
});

export default function BuySellPiPage() {
  return <BuySellPiClient />;
}
