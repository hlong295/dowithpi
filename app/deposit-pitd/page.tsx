"use client"

import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { Wallet, Home, ArrowLeft } from "lucide-react"

export default function DepositPitdPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 pb-20">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-6 gap-2 hover:bg-blue-100 text-blue-700">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>

          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                <Wallet className="h-12 w-12 text-white" />
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Nạp PITD Token
            </h1>

            <div className="space-y-3 py-6 border-y border-blue-100">
              <p className="text-lg text-gray-700 leading-relaxed">Xin chào quý khách!</p>
              <p className="text-base text-gray-600 leading-relaxed">
                Chúng tôi đang hoàn thiện tính năng <span className="font-semibold text-blue-600">Nạp PITD Token</span>{" "}
                để mang đến trải nghiệm tốt nhất cho bạn.
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
              <p className="text-gray-700 leading-relaxed">
                Trang đang trong quá trình <span className="font-semibold">xây dựng và hoàn thiện</span>.
                <br />
                Mời bạn quay lại sau.
              </p>
              <p className="text-sm text-blue-600 mt-3">Cảm ơn sự kiên nhẫn của bạn! 🙏</p>
            </div>

            <Button
              onClick={() => router.push("/")}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-6 rounded-xl text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 gap-2"
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
