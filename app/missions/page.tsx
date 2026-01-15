"use client"

import { useState } from "react"
import { Target, Calendar, Sparkles } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { useRouter } from "next/navigation"

interface Mission {
  id: string
  name: string
  description: string
  reward: string
  icon: string
  completed: boolean
  action?: string
  note?: string
}

export default function MissionsPage() {
  const router = useRouter()
  const [pitdBalance, setPitdBalance] = useState(25)
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([
    {
      id: "checkin",
      name: "Check-in hôm nay",
      description: "Mở app mỗi ngày",
      reward: "+1 PITD",
      icon: "📅",
      completed: false,
      action: "Nhận",
    },
    {
      id: "lucky-spin",
      name: "Quay số may mắn",
      description: "Thử vận may mỗi ngày",
      reward: "+1 PITD",
      icon: "🎁",
      completed: false,
      action: "Đi quay",
    },
    {
      id: "view-exchange",
      name: "Xem 1 trao đổi",
      description: "Khám phá hàng hóa & dịch vụ",
      reward: "+1 PITD",
      icon: "🔄",
      completed: false,
      action: "Xem",
    },
  ])

  const [extendedMissions, setExtendedMissions] = useState<Mission[]>([
    {
      id: "post-exchange",
      name: "Đăng 1 bài trao đổi",
      description: "Chia sẻ hàng hóa hoặc dịch vụ",
      reward: "+3 PITD",
      icon: "📝",
      completed: false,
      action: "Đăng bài",
      note: "Bài cần được duyệt hợp lệ",
    },
    {
      id: "complete-3-missions",
      name: "Hoàn thành 3 nhiệm vụ",
      description: "Bất kỳ nhiệm vụ nào trong hôm nay",
      reward: "🎁 +1 lượt quay",
      icon: "⭐",
      completed: false,
      action: "Tiếp tục",
    },
  ])

  const [rewardMessage, setRewardMessage] = useState<string | null>(null)

  const completedCount = [...dailyMissions, ...extendedMissions].filter((m) => m.completed).length
  const totalCount = dailyMissions.length + extendedMissions.length

  const allCompleted = completedCount === totalCount

  const handleMissionAction = (missionId: string) => {
    if (missionId === "checkin") {
      // Mark as completed and show reward
      setDailyMissions((prev) =>
        prev.map((m) => (m.id === "checkin" ? { ...m, completed: true, action: "Đã nhận" } : m)),
      )
      setPitdBalance((prev) => prev + 1)
      setRewardMessage("🎉 Tuyệt vời! Bạn đã nhận +1 PITD")
      setTimeout(() => setRewardMessage(null), 3000)
    } else if (missionId === "lucky-spin") {
      router.push("/lucky-spin")
    } else if (missionId === "view-exchange") {
      router.push("/exchange")
    } else if (missionId === "post-exchange") {
      router.push("/exchange") // Would go to post form
    } else if (missionId === "complete-3-missions") {
      // Check if 3 missions completed
      if (completedCount >= 3) {
        setExtendedMissions((prev) =>
          prev.map((m) => (m.id === "complete-3-missions" ? { ...m, completed: true, action: "Đã nhận" } : m)),
        )
        setRewardMessage("🎉 Tuyệt vời! Bạn đã nhận +1 lượt quay")
        setTimeout(() => setRewardMessage(null), 3000)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 text-white px-4 pt-6 pb-8 rounded-b-3xl shadow-xl">
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Target className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold">Nhiệm vụ hôm nay</h1>
          </div>

          {/* Subtitle */}
          <p className="text-white/90 text-sm mb-4">Hoàn thành để nhận PITD & mở quà</p>

          {/* Status Bar */}
          <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">⭐ PITD hiện có:</span>
              <span className="text-xl font-bold">{pitdBalance}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Hôm nay:</span>
              <span className="text-lg font-bold">
                {completedCount} / {totalCount} nhiệm vụ
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-white/30 rounded-full h-2">
              <div
                className="bg-yellow-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reward Message */}
      {rewardMessage && (
        <div className="fixed top-24 left-4 right-4 z-50 animate-in slide-in-from-top duration-300">
          <div className="bg-green-500 text-white px-4 py-3 rounded-2xl shadow-xl text-center font-bold max-w-md mx-auto">
            {rewardMessage}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* All Completed State */}
        {allCompleted && (
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-3xl p-8 text-center shadow-xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">Bạn đã hoàn thành nhiệm vụ hôm nay</h2>
            <p className="text-white/90 mb-6">Hẹn gặp lại ngày mai nhé!</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/")}
                className="bg-white text-green-600 px-6 py-3 rounded-xl font-bold hover:bg-green-50 transition-all"
              >
                Quay lại Trang chủ
              </button>
              <button
                onClick={() => router.push("/account")}
                className="bg-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/30 transition-all"
              >
                Xem quà của tôi
              </button>
            </div>
          </div>
        )}

        {/* Daily Missions */}
        {!allCompleted && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Nhiệm vụ hôm nay
            </h2>

            {dailyMissions.map((mission) => (
              <div
                key={mission.id}
                className={`bg-white rounded-2xl p-4 shadow-md border-2 transition-all ${
                  mission.completed ? "border-green-400 bg-green-50" : "border-purple-200 hover:border-purple-400"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="text-3xl flex-shrink-0">{mission.icon}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 mb-1">{mission.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{mission.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-lg">
                        {mission.reward}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleMissionAction(mission.id)}
                    disabled={mission.completed}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                      mission.completed
                        ? "bg-green-100 text-green-600 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:scale-105"
                    }`}
                  >
                    {mission.completed ? "✓ " + mission.action : mission.action}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Extended Missions */}
        {!allCompleted && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              Nhiệm vụ mở rộng
            </h2>

            {extendedMissions.map((mission) => {
              const isLocked = mission.id === "complete-3-missions" && completedCount < 3
              return (
                <div
                  key={mission.id}
                  className={`bg-white rounded-2xl p-4 shadow-md border-2 transition-all ${
                    mission.completed
                      ? "border-green-400 bg-green-50"
                      : isLocked
                        ? "border-gray-300 bg-gray-50 opacity-60"
                        : "border-orange-200 hover:border-orange-400"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="text-3xl flex-shrink-0">{mission.icon}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 mb-1">{mission.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{mission.description}</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-lg">
                          {mission.reward}
                        </span>
                      </div>
                      {mission.note && <p className="text-xs text-gray-500 italic mt-1">💡 {mission.note}</p>}
                      {isLocked && (
                        <p className="text-xs text-gray-500 italic mt-1">
                          ⏳ Hoàn thành {3 - completedCount} nhiệm vụ nữa để mở
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleMissionAction(mission.id)}
                      disabled={mission.completed || isLocked}
                      className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                        mission.completed
                          ? "bg-green-100 text-green-600 cursor-not-allowed"
                          : isLocked
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:scale-105"
                      }`}
                    >
                      {mission.completed ? "✓ Đã nhận" : isLocked ? "🔒 Khóa" : mission.action}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer Reminder */}
        {!allCompleted && (
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl p-6 text-center shadow-xl">
            <p className="text-sm mb-2 font-medium">💡 Nhắc nhẹ</p>
            <p className="text-xs opacity-90 mb-1">PITD là tiện ích trung gian giúp bạn dùng DoWithPi dễ hơn</p>
            <p className="text-sm font-bold">Pi để giữ – PITD để dùng</p>
          </div>
        )}

        {/* Micro-copy hints */}
        <div className="text-center space-y-2 text-xs text-gray-500 italic">
          <p>✨ Làm nhanh – Có thưởng liền</p>
          <p>🎁 Hoàn thành để mở lượt quay</p>
          <p>💎 PITD dùng để quay & đổi - Không cần dùng Pi</p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
