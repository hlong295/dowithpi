"use client"

import * as React from "react"

export default function AdminMembersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        Lỗi khi mở “Quản lý thành viên”
      </h2>
      <p style={{ marginBottom: 12 }}>
        Vui lòng chụp màn hình phần thông tin bên dưới và gửi lại cho mình.
      </p>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          background: "#fff",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>error.message</div>
        <div>{String(error?.message || "(no message)")}</div>

        <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>
          error.digest
        </div>
        <div>{String((error as any)?.digest || "(none)")}</div>

        <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 6 }}>
          error.stack
        </div>
        <div>{String(error?.stack || "(no stack)")}</div>
      </div>

      <button
        onClick={() => reset()}
        style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #e5e7eb",
          background: "#fff",
          fontWeight: 600,
        }}
      >
        Thử tải lại
      </button>
    </div>
  )
}
