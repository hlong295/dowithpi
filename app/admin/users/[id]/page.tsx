"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLES = ["member", "provider", "editor", "approval", "root_admin"] as const;

export default function AdminUserEditPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const id = params?.id;

  const [item, setItem] = useState<any>(null);
  const [role, setRole] = useState<string>("member");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const headers = { ...(await getAdminBearer()) } as any;
        const res = await fetch(`/api/admin/users?limit=200`, { headers });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${json?.error || "FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
        const found = (json?.items || []).find((x: any) => x.id === id) || null;
        setItem(found);
        setRole(found?.role || "member");
      } catch (e: any) {
        setError(e?.message || "LOAD_FAILED");
      }
    })();
  }, [id]);

  return (
    <AdminShell title="Edit User">
      <div className="flex flex-col gap-4 max-w-xl">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {item ? (
          <>
            <div className="text-sm">
              <div><span className="text-muted-foreground">id:</span> {item.id}</div>
              <div><span className="text-muted-foreground">username:</span> {item.username || "-"}</div>
              <div><span className="text-muted-foreground">email:</span> {item.email || "-"}</div>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Role</div>
              <Select value={role} onValueChange={(v) => setRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setError(null);
                  try {
                    const headers = { "Content-Type": "application/json", ...(await getAdminBearer()) } as any;
                    const res = await fetch(`/api/admin/users/${id}`, {
                      method: "PATCH",
                      headers,
                      body: JSON.stringify({ role }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(`${json?.error || "SAVE_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
                    router.replace("/admin/users");
                  } catch (e: any) {
                    setError(e?.message || "SAVE_FAILED");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                Back
              </Button>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
      </div>
    </AdminShell>
  );
}
