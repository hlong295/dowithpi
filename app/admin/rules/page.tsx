"use client";

import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { AdminJsonTable } from "@/components/admin/admin-json-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AdminRulesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string>("");
  const [valueText, setValueText] = useState<string>("{}");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const headers = { ...(await getAdminBearer()) } as any;
    const res = await fetch("/api/admin/rules", { headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(`${json?.error || "FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
      return;
    }
    setItems(json?.items || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function upsert() {
    setMsg(null);
    let val: any = valueText;
    try {
      val = JSON.parse(valueText);
    } catch {
      // allow plain text
      val = valueText;
    }

    const headers = { ...(await getAdminBearer()), "content-type": "application/json" } as any;
    const res = await fetch("/api/admin/rules", {
      method: "POST",
      headers,
      body: JSON.stringify({ key: key.trim(), value: val }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(`${json?.error || "UPSERT_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
      return;
    }
    setMsg("OK");
    setKey("");
    await load();
  }

  return (
    <AdminShell title="Admin Rules">
      <div className="mb-4 space-y-2">
        <div className="text-sm text-muted-foreground">system_rules — cấu hình hệ thống (admin-only).</div>
        <div className="flex flex-wrap gap-2">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key" className="max-w-sm" />
          <Button onClick={upsert} disabled={!key.trim()}>
            Upsert
          </Button>
          {msg ? <span className={msg === "OK" ? "text-sm text-green-600" : "text-sm text-red-600"}>{msg}</span> : null}
        </div>
        <Textarea value={valueText} onChange={(e) => setValueText(e.target.value)} rows={4} placeholder='{"example":true}' />
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <AdminJsonTable items={items} columns={[{ key: "key", label: "key" }, { key: "value", label: "value" }]} />
    </AdminShell>
  );
}
