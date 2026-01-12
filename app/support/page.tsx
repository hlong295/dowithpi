"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { HelpCircle, Home, ArrowLeft } from "lucide-react"

export default function SupportPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 pb-20">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6 gap-2 hover:bg-amber-100 text-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>

          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                <HelpCircle className="h-12 w-12 text-white" />
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Dịch vụ hỗ trợ Pi
            </h1>

            <div className="space-y-3 py-6 border-y border-amber-100">
              <p className="text-lg text-gray-700 leading-relaxed">Chào Pioneer! 👋</p>
              <p className="text-base text-gray-600 leading-relaxed">
                Đây là nơi tổng hợp các <span className="font-semibold text-amber-600">dịch vụ hỗ trợ Pi</span> do những Pioneer uy tín cung cấp.
              </p>
            </div>

            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
              <p className="text-gray-800 font-semibold mb-3">Các dịch vụ chính:</p>
              <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
                <li>Hỗ trợ Pioneer thực hiện <span className="font-semibold">KYC</span> và hoàn thành các bước <span className="font-semibold">Pi Mainnet</span>.</li>
                <li>Tư vấn – hỗ trợ vận hành <span className="font-semibold">Pi Node</span>.</li>
                <li>Tư vấn, chia sẻ và giải đáp về <span className="font-semibold">Pi Network</span>.</li>
              </ul>

              <div className="mt-5 pt-4 border-t border-amber-200">
                <p className="text-gray-800 font-semibold mb-2">Danh sách Pioneer uy tín (Admin chọn):</p>
                <p className="text-gray-700 leading-relaxed">a. ...</p>
                <p className="text-gray-700 leading-relaxed">b. ...</p>
                <p className="text-sm text-amber-700 mt-3">
                  Phí dịch vụ: <span className="font-semibold">PI</span> hoặc <span className="font-semibold">PITD</span> tùy theo từng người tư vấn.
                </p>
              </div>
            </div>

            <Button
              onClick={() => router.push("/")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8 py-6 rounded-xl text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 gap-2"
            >
              <Home className="h-5 w-5" />
              Về trang chủ
            </Button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
