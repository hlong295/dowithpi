"use client";

import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { AdminJsonTable } from "@/components/admin/admin-json-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CatType = "hub" | "product" | "news" | "rescue";

export default function AdminCategoriesPage() {
  const [type, setType] = useState<CatType>("product");
  const [items, setItems] = useState<any[]>([]);
  const [hubItems, setHubItems] = useState<any[]>([]);
  const [hubId, setHubId] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const headers = { ...(await getAdminBearer()) } as any;

      // Always load hub list for mapping
      {
        const hubUrl = new URL("/api/admin/categories", window.location.origin);
        hubUrl.searchParams.set("kind", "hub");
        const hubRes = await fetch(hubUrl.toString(), { headers });
        const hubJson = await hubRes.json().catch(() => ({}));
        if (hubRes.ok) setHubItems(hubJson?.items || []);
      }

      const url = new URL("/api/admin/categories", window.location.origin);
      url.searchParams.set("kind", type);
      if (hubId && type !== "hub") url.searchParams.set("hub_id", hubId);
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
  }, [type, hubId]);

  return (
    <AdminShell title="Categories">
      <div className="flex flex-col gap-3">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={type} onValueChange={(v) => setType(v as CatType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hub">Category Hub</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="news">Tin tức</SelectItem>
              <SelectItem value="rescue">Cứu vườn</SelectItem>
            </SelectContent>
          </Select>
          {type !== "hub" ? (
            <Select value={hubId || "_all"} onValueChange={(v) => setHubId(v === "_all" ? "" : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Hub (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All hubs</SelectItem>
                {(hubItems || []).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (optional)" className="max-w-xs" />
          )}
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="max-w-xs" />
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (optional)" className="max-w-xs" />
          {type === "hub" ? (
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="max-w-md" />
          ) : null}
          <Button
            disabled={saving}
            onClick={async () => {
              setError(null);
              setSaving(true);
              try {
                const headers = { "Content-Type": "application/json", ...(await getAdminBearer()) } as any;
                const res = await fetch("/api/admin/categories", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ kind: type, name, slug, hub_id: type === "hub" ? undefined : hubId || null, code, description }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(`${json?.error || "CREATE_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
                setName("");
                setSlug("");
                setCode("");
                setDescription("");
                await load();
              } catch (e: any) {
                setError(e?.message || "CREATE_FAILED");
              } finally {
                setSaving(false);
              }
            }}
          >
            + Add
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <AdminJsonTable
            items={items}
            columns={[
              { key: "id", label: "id" },
              { key: "hub_id", label: "hub_id" },
              { key: "code", label: "code" },
              { key: "name", label: "name" },
              { key: "slug", label: "slug" },
              { key: "order_no", label: "order_no" },
              { key: "is_active", label: "is_active" },
              { key: "priority", label: "priority" },
              { key: "created_at", label: "created_at" },
            ]}
          />
        )}
      </div>
    </AdminShell>
  );
}
