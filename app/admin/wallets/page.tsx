"use client";

import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { AdminJsonTable } from "@/components/admin/admin-json-table";

export default function AdminWalletsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const headers = { ...(await getAdminBearer()) } as any;
      const res = await fetch("/api/admin/wallets?limit=100", { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`${json?.error || "FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
        return;
      }
      setItems(json?.items || []);
    })();
  }, []);

  return (
    <AdminShell title="Admin Wallets">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <AdminJsonTable
        items={items}
        columns={[
          { key: "id", label: "id" },
          { key: "profile_id", label: "profile_id" },
          { key: "balance", label: "balance" },
          { key: "locked", label: "locked" },
          { key: "created_at", label: "created_at" },
        ]}
      />
    </AdminShell>
  );
}
