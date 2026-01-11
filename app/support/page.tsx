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
              <p className="text-lg text-gray-700 leading-relaxed">Xin chào quý khách!</p>
              <p className="text-base text-gray-600 leading-relaxed">
                Chúng tôi đang hoàn thiện tính năng{" "}
                <span className="font-semibold text-amber-600">Dịch vụ hỗ trợ Pi</span> để mang đến trải nghiệm tốt nhất
                cho bạn.
              </p>
            </div>

            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
              <p className="text-gray-700 leading-relaxed">
                Trang đang trong quá trình <span className="font-semibold">xây dựng và hoàn thiện</span>.
                <br />
                Mời bạn quay lại sau.
              </p>
              <p className="text-sm text-amber-600 mt-3">Cảm ơn sự kiên nhẫn của bạn! 🙏</p>
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
