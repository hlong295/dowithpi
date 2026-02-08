"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminProductEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [item, setItem] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const headers = { ...(await getAdminBearer()) } as any;

        // load product categories
        {
          const url = new URL("/api/admin/categories", window.location.origin);
          url.searchParams.set("kind", "product");
          const r = await fetch(url.toString(), { headers });
          const j = await r.json().catch(() => ({}));
          if (r.ok) setCategories(j?.items || []);
        }
        const res = await fetch(`/api/admin/products/${params.id}`, { headers });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${json?.error || "LOAD_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
        setItem(json?.item || null);
      } catch (e: any) {
        setError(e?.message || "LOAD_FAILED");
      }
    })();
  }, [params.id]);

  const patchAndSave = async (patch: any) => {
    setError(null);
    setSaving(true);
    try {
      const headers = { "Content-Type": "application/json", ...(await getAdminBearer()) } as any;
      const res = await fetch(`/api/admin/products/${params.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${json?.error || "SAVE_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
      setItem(json?.item || null);
    } catch (e: any) {
      setError(e?.message || "SAVE_FAILED");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title={`Edit Product — ${params.id}`}> 
      <div className="flex flex-col gap-4 max-w-xl">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {!item ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="grid gap-2">
              <div className="text-sm font-medium">Name</div>
              <Input
                value={item.name || ""}
                onChange={(e) => setItem({ ...item, name: e.target.value })}
                placeholder="Tên sản phẩm"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Description</div>
              <Textarea
                value={item.description || ""}
                onChange={(e) => setItem({ ...item, description: e.target.value })}
                placeholder="Mô tả"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Price (VND)</div>
              <Input
                value={item.price_vnd ?? ""}
                onChange={(e) => setItem({ ...item, price_vnd: e.target.value })}
                placeholder="e.g. 120000"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Price (Pi)</div>
              <Input
                value={item.price_pi ?? ""}
                onChange={(e) => setItem({ ...item, price_pi: e.target.value })}
                placeholder="e.g. 0.12"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Category ID</div>
              <Select value={item.category_id || "_none"} onValueChange={(v) => setItem({ ...item, category_id: v === "_none" ? null : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">(None)</SelectItem>
                  {(categories || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Stock</div>
              <Input
                value={item.stock_quantity ?? ""}
                onChange={(e) => setItem({ ...item, stock_quantity: e.target.value })}
                placeholder="e.g. 10"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={!!item.is_unlimited_stock} onCheckedChange={(v) => setItem({ ...item, is_unlimited_stock: v })} />
              <div className="text-sm">Unlimited stock</div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Seller ID (root only)</div>
              <Input value={item.seller_id ?? ""} onChange={(e) => setItem({ ...item, seller_id: e.target.value })} placeholder="seller_id (uuid)" />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={!!item.active}
                onCheckedChange={(v) => setItem({ ...item, active: v })}
              />
              <div className="text-sm">Active</div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button
                disabled={saving}
                onClick={() =>
                  patchAndSave({
                    name: item.name,
                    description: item.description,
                    price_vnd: item.price_vnd === "" ? null : Number(item.price_vnd),
                    price_pi: item.price_pi === "" ? null : Number(item.price_pi),
                    category_id: item.category_id || null,
                    stock_quantity: item.stock_quantity === "" ? null : Number(item.stock_quantity),
                    is_unlimited_stock: !!item.is_unlimited_stock,
                    seller_id: item.seller_id || undefined,
                    active: !!item.active,
                  })
                }
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                Back
              </Button>
              {item.deleted_at ? (
                <Button
                  disabled={saving}
                  variant="secondary"
                  onClick={() => patchAndSave({ deleted_at: null, active: true })}
                >
                  Restore
                </Button>
              ) : null}
              <Button
                variant="destructive"
                disabled={saving}
                onClick={async () => {
                  if (!confirm("Soft delete product?")) return;
                  setSaving(true);
                  setError(null);
                  try {
                    const headers = { ...(await getAdminBearer()) } as any;
                    const res = await fetch(`/api/admin/products/${params.id}`, { method: "DELETE", headers });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(`${json?.error || "DELETE_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
                    router.replace("/admin/products");
                  } catch (e: any) {
                    setError(e?.message || "DELETE_FAILED");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Soft delete
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
