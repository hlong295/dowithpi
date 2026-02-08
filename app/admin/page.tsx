"use client";

import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminHomePage() {
  return (
    <AdminShell title="Admin Core v1">
      <div className="space-y-2 text-sm">
        <p><b>TSBIO Admin</b> — chỉ Root Admin (role = root_admin) mới có quyền đọc/ghi.</p>
        <p>Module này đáp ứng yêu cầu <b>A3 — ADMIN CORE v1</b> (Users / Identities / Wallets / Ledger / Audit / Rules) và <b>A1 — Orphan checker</b>.</p>
        <p className="text-muted-foreground">Nếu bạn không phải root_admin, các API sẽ trả về FORBIDDEN_NOT_ROOT.</p>
      </div>
    </AdminShell>
  );
}
