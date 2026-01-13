"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign } from "lucide-react";

export default function BuySellPiPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-24">
      <Header />

      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Button
          variant="ghost"
          className="mb-6 text-emerald-700 hover:text-emerald-800"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại
        </Button>

        <Card className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <DollarSign className="h-12 w-12 text-white" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold text-emerald-800">Mua - Bán Pi</h1>
            <div className="w-20 h-1 bg-emerald-500 mx-auto rounded-full" />
          </div>

          <div className="space-y-4 max-w-2xl mx-auto">
            <p className="text-xl text-gray-700">Xin chào quý khách!</p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Chúng tôi đang hoàn thiện tính năng <span className="text-emerald-600 font-semibold">Mua - Bán Pi</span> để
              mang đến trải nghiệm tốt nhất cho bạn.
            </p>
          </div>

          <div className="pt-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 max-w-lg mx-auto">
              <p className="text-emerald-800 font-medium text-lg">Trang đang trong quá trình xây dựng và hoàn thiện.</p>
            </div>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
