"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function AdminNewsEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [item, setItem] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const headers = { ...(await getAdminBearer()) } as any;
      const res = await fetch(`/api/admin/posts/${params.id}`, { headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${json?.error || "LOAD_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
      setItem(json?.item || null);
    } catch (e: any) {
      setError(e?.message || "LOAD_FAILED");
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const headers = { ...(await getAdminBearer()) } as any;
        const url = new URL("/api/admin/categories", window.location.origin);
        url.searchParams.set("kind", "news");
        const res = await fetch(url.toString(), { headers });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setCategories(json?.items || []);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const save = async (patch: any) => {
    setError(null);
    setSaving(true);
    try {
      const headers = { "Content-Type": "application/json", ...(await getAdminBearer()) } as any;
      const res = await fetch(`/api/admin/posts/${params.id}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
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
    <AdminShell title={`Tin tức — Edit ${params.id}`}>
      <div className="flex flex-col gap-4 max-w-2xl">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        {!item ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="grid gap-2">
              <div className="text-sm font-medium">Title</div>
              <Input value={item.title || ""} onChange={(e) => setItem({ ...item, title: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Slug</div>
              <Input value={item.slug || ""} onChange={(e) => setItem({ ...item, slug: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Excerpt</div>
              <Textarea value={item.excerpt || ""} onChange={(e) => setItem({ ...item, excerpt: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Content</div>
              <Textarea
                value={item.content || ""}
                onChange={(e) => setItem({ ...item, content: e.target.value })}
                className="min-h-[240px]"
              />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Cover URL</div>
              <Input value={item.cover_url || ""} onChange={(e) => setItem({ ...item, cover_url: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Category</div>
              <Select value={item.category_id || "_none"} onValueChange={(v) => setItem({ ...item, category_id: v === "_none" ? null : v })}>
                <SelectTrigger className="w-[280px]"><SelectValue placeholder="Chọn category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">(None)</SelectItem>
                  {(categories || []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Status</div>
              <Select value={item.status || "draft"} onValueChange={(v) => setItem({ ...item, status: v })}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={!!item.featured} onCheckedChange={(v) => setItem({ ...item, featured: v })} />
              <div className="text-sm">Featured</div>
            </div>

            <Separator />

            <div className="grid gap-2">
              <div className="text-sm font-medium">SEO Title</div>
              <Input value={item.seo_title || ""} onChange={(e) => setItem({ ...item, seo_title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <div className="text-sm font-medium">SEO Description</div>
              <Textarea value={item.seo_description || ""} onChange={(e) => setItem({ ...item, seo_description: e.target.value })} />
            </div>

            <Separator />

            <div className="flex gap-2 flex-wrap">
              <Button
                disabled={saving}
                onClick={() =>
                  save({
                    title: item.title,
                    slug: item.slug || null,
                    excerpt: item.excerpt || null,
                    content: item.content || null,
                    cover_url: item.cover_url || null,
                    category_id: item.category_id || null,
                    status: item.status,
                    featured: !!item.featured,
                    seo_title: item.seo_title || null,
                    seo_description: item.seo_description || null,
                    published_at: item.status === "published" ? (item.published_at || new Date().toISOString()) : null,
                  })
                }
              >
                Save
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                Back
              </Button>
              {item.deleted_at ? (
                <Button disabled={saving} variant="secondary" onClick={() => save({ deleted_at: null, status: "draft" })}>
                  Restore
                </Button>
              ) : null}
              <Button
                variant="destructive"
                disabled={saving}
                onClick={async () => {
                  if (!confirm("Soft delete post?")) return;
                  setSaving(true);
                  setError(null);
                  try {
                    const headers = { ...(await getAdminBearer()) } as any;
                    const res = await fetch(`/api/admin/posts/${params.id}`, { method: "DELETE", headers });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(`${json?.error || "DELETE_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
                    router.replace("/admin/content/news");
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
