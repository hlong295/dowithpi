"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminJsonTable } from "@/components/admin/admin-json-table";

type Kind = "all" | "farm" | "tsbio";

async function fetchProducts(kind: Kind, q: string) {
  const headers = { ...(await getAdminBearer()) } as any;
  const url = new URL("/api/admin/products", window.location.origin);
  if (kind) url.searchParams.set("kind", kind);
  if (q) url.searchParams.set("q", q);
  url.searchParams.set("limit", "100");
  const res = await fetch(url.toString(), { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${json?.error || "FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
  return json?.items || [];
}

export default function AdminProductsPage() {
  const [kind, setKind] = useState<Kind>("all");
  const [q, setQ] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const kindLabel = useMemo(() => {
    if (kind === "farm") return "Farm products";
    if (kind === "tsbio") return "TSBIO products";
    return "All products";
  }, [kind]);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = await fetchProducts(kind, q);
        setItems(data);
      } catch (e: any) {
        setError(e?.message || "LOAD_FAILED");
      } finally {
        setLoading(false);
      }
    })();
  }, [kind, q]);

  return (
    <AdminShell title={`Product Management — ${kindLabel}`}> 
      <div className="flex flex-col gap-3">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name/description…"
            className="max-w-sm"
          />
          <Button asChild variant="default">
            <Link href="/admin/products/new">+ New product</Link>
          </Button>
        </div>

        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList>
            <TabsTrigger value="all">Tất cả</TabsTrigger>
            <TabsTrigger value="farm">Farm</TabsTrigger>
            <TabsTrigger value="tsbio">TSBIO</TabsTrigger>
          </TabsList>
          <TabsContent value={kind}>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <AdminJsonTable
                items={items}
                columns={[
                  { key: "id", label: "id" },
                  { key: "name", label: "name" },
                  { key: "price_vnd", label: "price_vnd" },
                  { key: "price_pi", label: "price_pi" },
                  { key: "active", label: "active" },
                  { key: "seller_id", label: "seller_id" },
                  { key: "farm_id", label: "farm_id" },
                  { key: "category_id", label: "category_id" },
                  { key: "stock_quantity", label: "stock" },
                  { key: "created_at", label: "created_at" },
                ]}
                rowActions={(row) => (
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/products/${row.id}`}>Edit</Link>
                    </Button>
                  </div>
                )}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  );
}
