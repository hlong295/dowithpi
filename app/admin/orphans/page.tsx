"use client";

import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";

export default function AdminOrphansPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const headers = { ...(await getAdminBearer()) } as any;
      const res = await fetch("/api/admin/orphans", { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(`${json?.error || "FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
        return;
      }
      setData(json);
    })();
  }, []);

  return (
    <AdminShell title="Admin Orphan Checker">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {data ? <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre> : null}
    </AdminShell>
  );
}
