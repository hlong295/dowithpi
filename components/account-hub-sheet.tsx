"use client"
import {
  X,
  Wallet,
  Package,
  Heart,
  Shield,
  Settings,
  HelpCircle,
  Info,
  LogOut,
  Plus,
  ChevronRight,
  Store,
  Send,
  History,
  Loader2,
  Copy,
  Check,
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useState } from "react"

const ROOT_ADMIN_USERNAME = "HLong295"

interface AccountHubSheetProps {
  isOpen: boolean
  onClose: () => void
  pitdBalance: number
  walletData: any
  loadingWallet: boolean
  onOpenTransferModal: () => void
  onOpenTransactionHistory: () => void
  onOpenPurchases: () => void
  onOpenFavorites: () => void
}

export function AccountHubSheet({
  isOpen,
  onClose,
  pitdBalance,
  walletData,
  loadingWallet,
  onOpenTransferModal,
  onOpenTransactionHistory,
  onOpenPurchases,
  onOpenFavorites,
}: AccountHubSheetProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const piUsername = user?.username || null
  const userRole = user?.role || "redeemer"
  const isRootAdmin = piUsername?.toLowerCase() === ROOT_ADMIN_USERNAME.toLowerCase()
  const isProvider = userRole === "provider" || isRootAdmin
  const loggedIn = !!piUsername

  const handleLogout = () => {
    try {
      const STORAGE_KEYS = ["pitodo_pi_user", "pi_user", "current_user"]
      STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
      logout()
      onClose()
      router.push("/")
    } catch (err) {
      console.error("[v0] AccountHubSheet: Logout error:", err)
      router.push("/")
    }
  }

  const copyWalletAddress = () => {
    if (walletData?.address) {
      navigator.clipboard.writeText(walletData.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatWalletAddress = (address: string) => {
    if (!address) return "N/A"
    if (address.length <= 16) return address
    return `${address.slice(0, 8)}...${address.slice(-8)}`
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 animate-in fade-in duration-200" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-400 via-purple-300 to-pink-300 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Tài khoản</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 pb-20">
          {/* User Block */}
          <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                π
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold text-purple-800 truncate">{piUsername || "Khách"}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-gray-600">{piUsername ? "Ví Pi" : "Chưa đăng nhập"}</span>
                  {loggedIn && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isRootAdmin
                          ? "bg-red-100 text-red-600"
                          : isProvider
                            ? "bg-purple-100 text-purple-600"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {isRootAdmin ? "ROOT ADMIN" : userRole.toUpperCase().replace("_", " ")}
                    </span>
                  )}
                  {loggedIn &&
                    ((user as any)?.providerLabel === "trusted" ||
                      (user as any)?.memberLabel === "trusted" ||
                      (user as any)?.provider_label === "trusted" ||
                      (user as any)?.member_label === "trusted") && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                        Uy tín
                      </span>
                    )}
                </div>
              </div>
            </div>

            {!loggedIn && (
              <Link
                href="/login"
                onClick={onClose}
                className="mt-4 block w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Đăng nhập
              </Link>
            )}
          </div>

          {/* Wallet Area */}
          {piUsername && (
            <>
              {/* Pi Wallet Info */}
              <div className="rounded-xl bg-white/60 border border-purple-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-purple-700">Ví Pi</span>
                </div>
                <p className="text-xs text-gray-500">
                  Ví Pi của bạn chỉ kết nối qua Pi SDK khi thanh toán. Số dư Pi không hiển thị ở đây.
                </p>
              </div>

              {/* PITD Wallet */}
              <div className="rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-pink-600" />
                    <span className="text-sm font-semibold text-pink-700">Ví PITD</span>
                  </div>
                  {loadingWallet && <Loader2 className="h-4 w-4 animate-spin text-pink-500" />}
                </div>

                {/* Wallet Address */}
                {walletData?.address && (
                  <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Địa chỉ ví</p>
                      <p className="text-sm font-mono text-gray-700 truncate">
                        {formatWalletAddress(walletData.address)}
                      </p>
                    </div>
                    <button
                      onClick={copyWalletAddress}
                      className="ml-2 p-2 rounded-lg hover:bg-pink-100 transition-colors"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-pink-500" />
                      )}
                    </button>
                  </div>
                )}

                {/* Balance */}
                <div className="text-center py-3 bg-white/60 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1">Số dư</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold text-pink-700">
                      {pitdBalance.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </span>
                    <span className="text-sm text-pink-500 font-medium">PITD</span>
                  </div>
                </div>

                {/* Stats Row */}
                {walletData && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50/80 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600 mb-1">Tổng nhận</p>
                      <p className="text-sm font-semibold text-green-700">
                        +{(walletData.total_earned || 0).toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-red-50/80 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-600 mb-1">Tổng chi</p>
                      <p className="text-sm font-semibold text-red-700">
                        -{(walletData.total_spent || 0).toLocaleString("vi-VN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onOpenTransferModal}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all"
                  >
                    <Send className="h-4 w-4" />
                    Gửi
                  </button>
                  <button
                    onClick={onOpenTransactionHistory}
                    className="flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-pink-300 text-pink-600 rounded-lg font-medium text-sm hover:bg-pink-50 transition-all"
                  >
                    <History className="h-4 w-4" />
                    Lịch sử
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  PITD (Pi Token Dao) là token nội bộ của ứng dụng. Bạn có thể sử dụng PITD để thanh toán và trao đổi
                  hàng hóa/dịch vụ trên PITODO.
                </p>
              </div>
            </>
          )}

          {/* Orders Section */}
          {loggedIn && (
            <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-orange-400 to-pink-500">
                <span className="font-semibold text-white text-sm">Quản lý đơn hàng</span>
              </div>

              <button
                onClick={onOpenPurchases}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-orange-500" />
                  <span className="font-medium text-gray-800 text-sm">Sản phẩm đã mua</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>

              <button
                onClick={onOpenFavorites}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Heart className="h-5 w-5 text-pink-500" />
                  <span className="font-medium text-gray-800 text-sm">Sản phẩm yêu thích</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          )}

          {/* System Administration - ROOT ADMIN */}
          {isRootAdmin && (
            <div className="rounded-2xl bg-white border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500">
                <div className="flex items-center gap-2 text-white">
                  <Shield className="h-4 w-4" />
                  <span className="font-semibold text-sm">Quản trị hệ thống</span>
                </div>
              </div>

              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-gray-800 text-sm">Bảng điều khiển</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/admin/products"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-gray-800 text-sm">Quản lý sản phẩm</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/admin/products/add"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Plus className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-gray-800 text-sm">Thêm sản phẩm mới</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/admin/pitd-management"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="h-4 w-4 text-pink-600" />
                  <span className="font-medium text-gray-800 text-sm">Quản lý PITD Token</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/admin/members"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-gray-800 text-sm">Quản lý thành viên</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/admin/providers"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Store className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-gray-800 text-sm">Duyệt nhà cung cấp</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/admin/settings"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-800 text-sm">Quản lý phí & thuế</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>

              <Link
                href="/admin/settings"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="h-4 w-4 text-gray-700" />
                  <span className="font-medium text-gray-800 text-sm">Chọn ví nhận PITD</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            </div>
          )}

          {/* Provider Menu */}
          {isProvider && !isRootAdmin && (
            <div className="rounded-2xl bg-white border border-purple-200 overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500">
                <div className="flex items-center gap-2 text-white">
                  <Store className="h-4 w-4" />
                  <span className="font-semibold text-sm">Nhà cung cấp</span>
                </div>
              </div>
              <Link
                href="/provider/products"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-gray-800 text-sm">Sản phẩm của tôi</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            </div>
          )}

          {/* System Menu */}
          <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
            <Link
              href="/settings"
              onClick={onClose}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Settings className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-800 text-sm">Cài đặt</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>

            <Link
              href="/help"
              onClick={onClose}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-800 text-sm">Trợ giúp</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>

            <Link
              href="/about"
              onClick={onClose}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-purple-50 transition-colors border-b border-gray-100"
            >
              <div className="flex items-center gap-3">
                <Info className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-800 text-sm">Về PITODO</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>

            {loggedIn && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                <span className="font-medium text-red-500 text-sm">Đăng xuất</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
