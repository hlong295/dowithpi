"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type Kind = "farm" | "tsbio";

export default function AdminProductNewPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("farm");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceVnd, setPriceVnd] = useState<string>("");
  const [pricePi, setPricePi] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [stockQuantity, setStockQuantity] = useState<string>("0");
  const [isUnlimitedStock, setIsUnlimitedStock] = useState<boolean>(false);
  const [active, setActive] = useState<boolean>(true);
  const [sellerId, setSellerId] = useState<string>("");
  const [categories, setCategories] = useState<any[]>([]);
  const [farmId, setFarmId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const headers = { ...(await getAdminBearer()) } as any;
        const url = new URL("/api/admin/categories", window.location.origin);
        url.searchParams.set("kind", "product");
        const res = await fetch(url.toString(), { headers });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setCategories(json?.items || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <AdminShell title="New Product">
      <div className="flex flex-col gap-4 max-w-xl">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="grid gap-2">
          <div className="text-sm font-medium">Kind</div>
          <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="farm">Farm product</SelectItem>
              <SelectItem value="tsbio">TSBIO product</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">
            * kind=farm sẽ yêu cầu farm_id (nếu DB của bạn đang dùng farm_id để phân loại).
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên sản phẩm" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Description</div>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Price (VND)</div>
          <Input value={priceVnd} onChange={(e) => setPriceVnd(e.target.value)} placeholder="e.g. 120000" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Price (Pi)</div>
          <Input value={pricePi} onChange={(e) => setPricePi(e.target.value)} placeholder="e.g. 0.12" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Farm ID (optional)</div>
          <Input value={farmId} onChange={(e) => setFarmId(e.target.value)} placeholder="farm_id (uuid)" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Category (Product)</div>
          <Select value={categoryId || "_none"} onValueChange={(v) => setCategoryId(v === "_none" ? "" : v)}>
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
          <Input value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="e.g. 100" />
          <div className="text-xs text-muted-foreground">* stock_quantity=0 và is_unlimited_stock=true → không giới hạn.</div>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Flags</div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={isUnlimitedStock ? "default" : "outline"}
              onClick={() => setIsUnlimitedStock((v) => !v)}
            >
              Unlimited stock: {isUnlimitedStock ? "ON" : "OFF"}
            </Button>
            <Button type="button" variant={active ? "default" : "outline"} onClick={() => setActive((v) => !v)}>
              Active: {active ? "ON" : "OFF"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Seller ID (root only)</div>
          <Input value={sellerId} onChange={(e) => setSellerId(e.target.value)} placeholder="seller_id (uuid)" />
          <div className="text-xs text-muted-foreground">* Nếu không nhập, hệ thống dùng user hiện tại (provider/self).</div>
        </div>

        <Separator />

        <div className="flex gap-2">
          <Button
            disabled={saving}
            onClick={async () => {
              setError(null);
              setSaving(true);
              try {
                const headers = { "Content-Type": "application/json", ...(await getAdminBearer()) } as any;
                const body: any = {
                  name,
                  description,
                  price_vnd: priceVnd ? Number(priceVnd) : null,
                  price_pi: pricePi ? Number(pricePi) : null,
                  farm_id: kind === "farm" ? (farmId || null) : null,
                  category_id: categoryId || null,
                  stock_quantity: stockQuantity ? Number(stockQuantity) : 0,
                  is_unlimited_stock: isUnlimitedStock,
                  active,
                  seller_id: sellerId || undefined,
                };
                const res = await fetch("/api/admin/products", {
                  method: "POST",
                  headers,
                  body: JSON.stringify(body),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(`${json?.error || "CREATE_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
                const id = json?.item?.id;
                router.replace(id ? `/admin/products/${id}` : "/admin/products");
              } catch (e: any) {
                setError(e?.message || "CREATE_FAILED");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
