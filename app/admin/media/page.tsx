"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminMediaPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefix, setPrefix] = useState("uploads/");
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const canUpload = useMemo(() => !!selected && !busy, [selected, busy]);

  const load = async () => {
    setError(null);
    try {
      const headers = { ...(await getAdminBearer()) } as any;
      const url = new URL("/api/admin/media/list", window.location.origin);
      url.searchParams.set("prefix", prefix || "uploads/");
      const res = await fetch(url.toString(), { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${json?.error || "LIST_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
      setItems(json?.items || []);
    } catch (e: any) {
      setError(e?.message || "LIST_FAILED");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const headers = { "Content-Type": "application/json", ...(await getAdminBearer()) } as any;
      const signRes = await fetch("/api/admin/media/sign-upload", {
        method: "POST",
        headers,
        body: JSON.stringify({ filename: selected.name, contentType: selected.type || "application/octet-stream" }),
      });
      const signJson = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(`${signJson?.error || "SIGN_FAILED"}${signJson?.detail ? `: ${signJson.detail}` : ""}`);

      const putRes = await fetch(signJson.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selected.type || "application/octet-stream",
          ...(signJson.token ? { "x-upsert": "true" } : {}),
        },
        body: selected,
      });
      if (!putRes.ok) throw new Error(`UPLOAD_FAILED: ${putRes.status}`);

      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "UPLOAD_FAILED");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Media">
      <div className="flex flex-col gap-4">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="prefix" className="max-w-[280px]" />
          <Button variant="outline" disabled={busy} onClick={load}>Refresh</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            onChange={(e) => setSelected(e.target.files?.[0] || null)}
          />
          <Button disabled={!canUpload} onClick={upload}>Upload</Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Bucket: <b>media</b> (list/upload via admin API)
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-12 gap-2 p-2 text-xs bg-muted">
            <div className="col-span-7">Name</div>
            <div className="col-span-3">Updated</div>
            <div className="col-span-2 text-right">Size</div>
          </div>
          {(items || []).map((it, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 p-2 text-xs border-t">
              <div className="col-span-7 break-all">{it.name}</div>
              <div className="col-span-3">{it.updated_at || ""}</div>
              <div className="col-span-2 text-right">{it.metadata?.size ?? ""}</div>
            </div>
          ))}
          {!items?.length ? <div className="p-2 text-sm text-muted-foreground">No items.</div> : null}
        </div>
      </div>
    </AdminShell>
  );
}
