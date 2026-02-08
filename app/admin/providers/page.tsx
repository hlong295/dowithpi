"use client";

import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { AdminJsonTable } from "@/components/admin/admin-json-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminProvidersPage() {
  const [q, setQ] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const headers = { ...(await getAdminBearer()) } as any;
      const url = new URL("/api/admin/providers", window.location.origin);
      if (q) url.searchParams.set("q", q);
      const res = await fetch(url.toString(), { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${json?.error || "LOAD_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
      setItems(json?.items || []);
    } catch (e: any) {
      setError(e?.message || "LOAD_FAILED");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell title="Providers">
      <div className="flex flex-col gap-3">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="flex flex-wrap gap-2 items-center">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username/name/phone/email" className="max-w-sm" />
          <Button variant="outline" onClick={load} disabled={loading}>
            Search
          </Button>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <AdminJsonTable
            items={items}
            columns={[
              { key: "id", label: "id" },
              { key: "username", label: "username" },
              { key: "full_name", label: "full_name" },
              { key: "phone", label: "phone" },
              { key: "email", label: "email" },
              { key: "role", label: "role" },
              { key: "level", label: "level" },
              { key: "created_at", label: "created_at" },
            ]}
          />
        )}
      </div>
    </AdminShell>
  );
}
