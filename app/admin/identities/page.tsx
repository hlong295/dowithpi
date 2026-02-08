"use client";

import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { AdminJsonTable } from "@/components/admin/admin-json-table";

export default function AdminIdentitiesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const headers = { ...(await getAdminBearer()) } as any;
      const res = await fetch("/api/admin/identities?limit=100", { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`${json?.error || "FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
        return;
      }
      setItems(json?.items || []);
    })();
  }, []);

  return (
    <AdminShell title="Admin Identities">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <AdminJsonTable
        items={items}
        columns={[
          { key: "id", label: "id" },
          { key: "profile_id", label: "profile_id" },
          { key: "provider", label: "provider" },
          { key: "provider_uid", label: "provider_uid" },
          { key: "identity_data", label: "identity_data" },
          { key: "created_at", label: "created_at" },
        ]}
      />
    </AdminShell>
  );
}
