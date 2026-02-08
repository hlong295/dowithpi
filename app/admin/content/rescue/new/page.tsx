"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminShell, getAdminBearer } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export default function AdminRescueNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [featured, setFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <AdminShell title="Cứu vườn — New">
      <div className="flex flex-col gap-4 max-w-2xl">
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="grid gap-2">
          <div className="text-sm font-medium">Title</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Slug</div>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (optional)" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Excerpt</div>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Tóm tắt" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Content</div>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung" className="min-h-[240px]" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Cover URL</div>
          <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Category ID</div>
          <Input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="category_id (uuid)" />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium">Status</div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={featured} onCheckedChange={setFeatured} />
          <div className="text-sm">Featured</div>
        </div>

        <Separator />

        <div className="grid gap-2">
          <div className="text-sm font-medium">SEO Title</div>
          <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="SEO title" />
        </div>
        <div className="grid gap-2">
          <div className="text-sm font-medium">SEO Description</div>
          <Textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} placeholder="SEO description" />
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
                const res = await fetch("/api/admin/posts", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({
                    type: "rescue",
                    title,
                    slug: slug || null,
                    excerpt: excerpt || null,
                    content: content || null,
                    cover_url: coverUrl || null,
                    category_id: categoryId || null,
                    status,
                    featured,
                    seo_title: seoTitle || null,
                    seo_description: seoDesc || null,
                    published_at: status === "published" ? new Date().toISOString() : null,
                  }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(`${json?.error || "CREATE_FAILED"}${json?.detail ? `: ${json.detail}` : ""}`);
                router.replace(`/admin/content/rescue/${json?.item?.id}`);
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
