"use client"

import { X } from "lucide-react"
import { AccountHubContent } from "./AccountHubContent"

interface AccountHubSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function AccountHubSheet({ isOpen, onClose }: AccountHubSheetProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[70] bg-black/40 animate-in fade-in duration-200" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[80] max-h-[90vh] rounded-t-3xl bg-gradient-to-b from-purple-100 via-pink-50 to-purple-50 shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-purple-200/50 bg-white/80 backdrop-blur-xl px-4 py-3 rounded-t-3xl">
          <h2 className="text-lg font-bold text-purple-800">Tài khoản</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-purple-100 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5 text-purple-600" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-60px)] pb-4">
          <AccountHubContent />
        </div>
      </div>
    </>
  )
}
