"use client";

import { useEffect, useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { AdminJsonTable } from "@/components/admin/admin-json-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminLedgerPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string>("");
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);

  async function load() {
    const headers = { ...(await getAdminBearer()), "content-type": "application/json" } as any;
    const res = await fetch("/api/admin/ledger?limit=100", { headers });
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

  async function rollback() {
    setRollbackMsg(null);
    const headers = { ...(await getAdminBearer()), "content-type": "application/json" } as any;
    const res = await fetch("/api/admin/ledger/rollback", {
      method: "POST",
      headers,
      body: JSON.stringify({ tx_id: txId.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRollbackMsg(`${json?.error || "ROLLBACK_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
      return;
    }
    setRollbackMsg("OK");
    setTxId("");
    await load();
  }

  return (
    <AdminShell title="Admin Ledger">
      <div className="mb-4 space-y-2">
        <div className="text-sm text-muted-foreground">Rollback = tạo giao dịch bù (compensating tx). Cần DB function <code>tsb_apply_tx</code> đã apply.</div>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="tx_id để rollback" className="max-w-md" />
          <Button onClick={rollback} disabled={!txId.trim()}>Rollback</Button>
          {rollbackMsg ? <span className={rollbackMsg === "OK" ? "text-sm text-green-600" : "text-sm text-red-600"}>{rollbackMsg}</span> : null}
        </div>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <AdminJsonTable
        items={items}
        columns={[
          { key: "id", label: "id" },
          { key: "wallet_id", label: "wallet_id" },
          { key: "type", label: "type" },
          { key: "amount", label: "amount" },
          { key: "balance_after", label: "balance_after" },
          { key: "reference_type", label: "reference_type" },
          { key: "reference_id", label: "reference_id" },
          { key: "created_at", label: "created_at" },
        ]}
      />
    </AdminShell>
  );
}
