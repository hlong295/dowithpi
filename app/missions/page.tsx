"use client"

import { useEffect, useState } from "react"
import { Target, Calendar, Sparkles } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { MISSION_CATALOG } from "@/lib/missions/catalog"

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
  const { piUser, user, isLoading } = useAuth()
  const [pitdBalance, setPitdBalance] = useState(0)
  const [loggedIn, setLoggedIn] = useState(false)
  const [adminConfig, setAdminConfig] = useState<any | null>(null)
  const [debug, setDebug] = useState<string | null>(null)
  const [loadingMissions, setLoadingMissions] = useState(true)

  const authHeaders = (() => {
    const h: Record<string, string> = {}

    // IMPORTANT:
    // - In our app, `useAuth().user` can be either:
    //   (a) a Supabase auth user (has `.id` uuid) for email/user, OR
    //   (b) a Pi user object (commonly uses `.uid` as internal uuid) for Pi login.
    // - The server auth helper (`getUserFromRequest`) requires a UUID user id.
    const userId = String((user as any)?.id || (user as any)?.uid || "").trim()
    if (userId) h["x-user-id"] = userId

    // Keep backward compat: some routes accept x-pi-user-id too.
    if (userId) h["x-pi-user-id"] = userId

    const piUsername =
      String((piUser as any)?.pi_username || (piUser as any)?.username || (user as any)?.username || "").trim()
    if (piUsername) h["x-pi-username"] = piUsername
    return h
  })()
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

  const loadMissions = async () => {
    try {
      setLoadingMissions(true)
      setDebug(null)
      const res = await fetch("/api/missions/daily", {
        method: "GET",
        headers: authHeaders,
        cache: "no-store",
      })
      const text = await res.text().catch(() => "")
      if (!res.ok) {
        setDebug(`PITD_MISSIONS_LOAD_HTTP_${res.status}: ${text}`)
        return
      }
      const data = text ? JSON.parse(text) : null
      if (!data) {
        setDebug("PITD_MISSIONS_LOAD_EMPTY_BODY")
        return
      }

      setLoggedIn(Boolean(data.logged_in))
      setAdminConfig(data.admin_config ?? null)

      if (!data.logged_in) {
        // Helpful debug for Pi Browser where cookies/headers can be flaky.
        const sentUserId = (authHeaders["x-user-id"] || "").trim()
        const sentPiUsername = (authHeaders["x-pi-username"] || "").trim()
        if (sentUserId || sentPiUsername) {
          setDebug(
            `PITD_MISSIONS_NOT_LOGGED_IN (sent x-user-id=${sentUserId || ""} x-pi-username=${sentPiUsername || ""})`,
          )
        }
        // Not logged in: do not show missions list.
        setPitdBalance(0)
        return
      }

      if (typeof data.wallet_balance === "number") setPitdBalance(data.wallet_balance)

      const claimed = new Set<string>((data.claimed || []).filter(Boolean))
      const missionsByKey: Record<string, any> = {}
      for (const m of data.missions || []) missionsByKey[m.key] = m

      setDailyMissions((prev) =>
        prev
          .map((m) => {
          const map: Record<string, string> = {
            checkin: "daily_checkin",
            "lucky-spin": "lucky_spin",
            "view-exchange": "view_exchange",
          }
          const key = map[m.id]
          if (!key) return m
          const server = missionsByKey[key]
          if (!server) return null
          const completed = claimed.has(key)
          const reward = Number(server?.reward_pitd ?? 0) || 0
          return {
            ...m,
            reward: reward > 0 ? `+${reward} PITD` : m.reward,
            completed,
            action: completed ? "Đã nhận" : m.action,
          }
        })
          .filter(Boolean) as any,
      )

      setExtendedMissions((prev) =>
        prev
          .map((m) => {
          const map: Record<string, string> = {
            "post-exchange": "post_exchange",
            "complete-3-missions": "bonus_all",
          }
          const key = map[m.id]
          if (!key) return m
          const server = missionsByKey[key]
          if (!server) return null
          const completed = claimed.has(key)
          const reward = Number(server?.reward_pitd ?? 0) || 0
          return {
            ...m,
            reward: reward > 0 ? `+${reward} PITD` : m.reward,
            completed,
            action: completed ? "Đã nhận" : m.action,
          }
        })
          .filter(Boolean) as any,
      )
    } catch (e: any) {
      setDebug(`PITD_MISSIONS_LOAD_EXCEPTION: ${e?.message || String(e)}`)
    } finally {
      setLoadingMissions(false)
    }
  }

  const claimMission = async (mission_key: string) => {
    try {
      setDebug(null)
      const res = await fetch("/api/missions/claim", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({ mission_key }),
      })
      const text = await res.text().catch(() => "")
      if (!res.ok) {
        setDebug(`PITD_MISSIONS_CLAIM_HTTP_${res.status}: ${text}`)
        return { ok: false, text }
      }
      const data = text ? JSON.parse(text) : null
      if (data?.wallet_balance != null) setPitdBalance(data.wallet_balance)
      await loadMissions()
      return { ok: true, data }
    } catch (e: any) {
      setDebug(`PITD_MISSIONS_CLAIM_EXCEPTION: ${e?.message || String(e)}`)
      return { ok: false, error: e }
    }
  }

  const updateAdminMission = (key: string, patch: { enabled?: boolean; reward_pitd?: number }) => {
    setAdminConfig((prev: any) => {
      if (!prev?.missions) return prev
      return {
        ...prev,
        missions: prev.missions.map((m: any) =>
          m.key === key
            ? {
                ...m,
                ...(patch.enabled != null ? { enabled: patch.enabled } : null),
                ...(patch.reward_pitd != null ? { reward_pitd: patch.reward_pitd } : null),
              }
            : m,
        ),
      }
    })
  }

  const saveAdminConfig = async () => {
    try {
      setDebug(null)
      const day = adminConfig?.day
      const missions = Array.isArray(adminConfig?.missions) ? adminConfig.missions : []
      const res = await fetch("/api/missions/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ day, missions }),
      })
      const text = await res.text().catch(() => "")
      if (!res.ok) {
        setDebug(`PITD_MISSIONS_CONFIG_HTTP_${res.status}: ${text}`)
        return
      }
      const data = text ? JSON.parse(text) : null
      if (data?.ok) {
        setAdminConfig({ day: data.day, missions: data.missions })
        setRewardMessage("✅ Đã lưu cấu hình nhiệm vụ")
        setTimeout(() => setRewardMessage(null), 2500)
        // reload missions so banner + list stay in sync
        loadMissions()
      }
    } catch (e: any) {
      setDebug(`PITD_MISSIONS_CONFIG_EXCEPTION: ${e?.message || String(e)}`)
    }
  }

  useEffect(() => {
    // Avoid flashing the "please login" banner while auth is still initializing.
    if (isLoading) return
    // API will respond logged_in=false if not authenticated.
    loadMissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, (user as any)?.id, (user as any)?.uid, (piUser as any)?.uid, (piUser as any)?.pi_uid])

  const completedCount = loggedIn ? [...dailyMissions, ...extendedMissions].filter((m) => m.completed).length : 0
  const totalCount = loggedIn ? dailyMissions.length + extendedMissions.length : 0

  const allCompleted = loggedIn && totalCount > 0 && completedCount === totalCount

  const handleMissionAction = async (missionId: string) => {
    if (missionId === "checkin") {
      const result = await claimMission("daily_checkin")
      if (result.ok) {
        setRewardMessage("🎉 Tuyệt vời! Bạn đã nhận PITD")
        setTimeout(() => setRewardMessage(null), 3000)
      }
    } else if (missionId === "lucky-spin") {
      // Mark mission as done (reward can be 0) then navigate.
      await claimMission("lucky_spin")
      router.push("/lucky-spin")
    } else if (missionId === "view-exchange") {
      await claimMission("view_exchange")
      router.push("/exchange")
    } else if (missionId === "post-exchange") {
      await claimMission("post_exchange")
      router.push("/exchange") // Would go to post form
    } else if (missionId === "complete-3-missions") {
      const result = await claimMission("bonus_all")
      if (result.ok) {
        setRewardMessage("🎉 Tuyệt vời! Bạn đã nhận PITD thưởng")
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
            {isLoading || loadingMissions ? (
              <div className="space-y-2">
                <div className="text-sm text-white/90">Đang tải thông tin nhiệm vụ...</div>
                <div className="w-full bg-white/30 rounded-full h-2">
                  <div className="bg-white/60 h-2 rounded-full animate-pulse" style={{ width: "40%" }} />
                </div>
              </div>
            ) : !loggedIn ? (
              <div className="space-y-3">
                <div className="text-sm text-white/90">Mời bạn đăng nhập để thực hiện nhiệm vụ nhận PITD.</div>
                <button
                  onClick={() => router.push("/account")}
                  className="w-full bg-white text-purple-700 px-4 py-3 rounded-xl font-bold hover:bg-purple-50 transition-all"
                >
                  Đăng nhập
                </button>
              </div>
            ) : (
              <>
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
                    style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </>
            )}
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

      {debug && (
        <div className="fixed bottom-24 left-4 right-4 z-50">
          <div className="bg-black/80 text-white px-4 py-3 rounded-2xl shadow-xl text-left text-xs max-w-md mx-auto whitespace-pre-wrap">
            debug: {debug}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loggedIn ? (
          <>
        {/* Admin: Configure daily missions */}
        {adminConfig?.missions && (
          <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-gray-800">Quản trị: Cấu hình nhiệm vụ trong ngày</div>
              <button
                onClick={saveAdminConfig}
                className="px-4 py-2 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg"
              >
                Lưu cấu hình
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-3">Ngày áp dụng: {adminConfig.day}</div>

            <div className="space-y-2">
              {(adminConfig.missions || []).map((m: any) => (
                <div key={m.key} className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                  <input
                    type="checkbox"
                    checked={Boolean(m.enabled)}
                    onChange={(e) => updateAdminMission(m.key, { enabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{m.key}</div>
                    <div className="text-xs text-gray-500 truncate">{(MISSION_CATALOG as any)[m.key]?.title || ""}</div>
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={Number(m.reward_pitd ?? 0)}
                    onChange={(e) => updateAdminMission(m.key, { reward_pitd: Number(e.target.value) })}
                    className="w-28 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  />
                  <div className="text-xs text-gray-500 w-10">PITD</div>
                </div>
              ))}
            </div>
          </div>
        )}

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
          </>
        ) : null}
      </div>

      <BottomNav />
    </div>
  )
}
