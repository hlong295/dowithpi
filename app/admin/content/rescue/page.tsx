"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { AdminJsonTable } from "@/components/admin/admin-json-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchPosts(type: string, q: string) {
  const headers = { ...(await getAdminBearer()) } as any;
  const url = new URL("/api/admin/posts", window.location.origin);
  url.searchParams.set("type", type);
  if (q) url.searchParams.set("q", q);
  url.searchParams.set("limit", "100");
  const res = await fetch(url.toString(), { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${json?.error || "FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
  return json?.items || [];
}

export default function AdminRescueCmsPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      setItems(await fetchPosts("rescue", q));
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
    <AdminShell title="Cứu vườn CMS">
      <div className="flex flex-col gap-3">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="flex flex-wrap gap-2 items-center">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title/slug…" className="max-w-sm" />
          <Button variant="outline" onClick={load} disabled={loading}>Search</Button>
          <Button asChild variant="default"><Link href="/admin/content/rescue/new">+ New</Link></Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <AdminJsonTable
            items={items}
            columns={[
              { key: "id", label: "id" },
              { key: "status", label: "status" },
              { key: "featured", label: "featured" },
              { key: "title", label: "title" },
              { key: "slug", label: "slug" },
              { key: "category_id", label: "category_id" },
              { key: "published_at", label: "published_at" },
              { key: "created_at", label: "created_at" },
            ]}
            rowActions={(row) => (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/content/rescue/${row.id}`}>Edit</Link>
              </Button>
            )}
          />
        )}
      </div>
    </AdminShell>
  );
}
