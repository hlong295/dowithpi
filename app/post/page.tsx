"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/header"
import { BottomNav } from "@/components/bottom-nav"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { createBrowserClient } from "@/lib/supabase/client"

interface Category {
  id: string
  name: string
}

export default function PostProductPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const supabase = useMemo(() => createBrowserClient(), [])

  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<string>("")
  const [name, setName] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [imageUrl, setImageUrl] = useState<string>("")
  const [pricePitd, setPricePitd] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [debug, setDebug] = useState<string>("")

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("id,name")
          .order("name", { ascending: true })

        if (error) {
          setDebug((p) => p + `\n[CATEGORIES_ERROR] ${error.message}`)
          return
        }
        setCategories((data || []) as any)
      } catch (e: any) {
        setDebug((p) => p + `\n[CATEGORIES_EXCEPTION] ${e?.message || e}`)
      }
    })()
  }, [supabase])

  async function onSubmit() {
    setStatus("")
    setDebug("")

    if (!user?.id) {
      setStatus("Bạn cần đăng nhập để đăng bài.")
      return
    }
    if (!name.trim()) {
      setStatus("Vui lòng nhập tên sản phẩm/dịch vụ.")
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        name: name.trim(),
        description: description || "",
        image_url: imageUrl || null,
        currency: "PITD",
      }

      if (categoryId) payload.category_id = categoryId

      const n = Number(pricePitd)
      if (!Number.isNaN(n) && pricePitd !== "") {
        payload.price = n
      }

      const res = await fetch("/api/internal/products", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setStatus("Đăng bài thất bại.")
        setDebug(JSON.stringify(json, null, 2))
        return
      }

      setStatus("Đăng bài thành công.")
      setDebug(JSON.stringify(json, null, 2))
      setName("")
      setDescription("")
      setImageUrl("")
      setPricePitd("")
      // keep category
    } catch (e: any) {
      setStatus("Đăng bài thất bại.")
      setDebug(`${e?.message || e}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <Header />
      <main className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
        <Card className="border-2 border-purple-100 shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div>
              <h1 className="text-xl font-bold text-purple-700">Đăng bài</h1>
              <p className="text-sm text-gray-600">
                Thành viên thường sẽ bị trừ PITD theo cấu hình. Provider đã duyệt có thể được miễn/giảm.
              </p>
            </div>

            {status ? (
              <Alert>
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <Label>Danh mục</Label>
              <select
                className="w-full mt-2 p-3 border border-purple-200 rounded-lg bg-white"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Tên</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên..." />
            </div>

            <div>
              <Label>Mô tả</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn..."
                className="min-h-[120px]"
              />
            </div>

            <div>
              <Label>Ảnh (URL)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div>
              <Label>Giá (PITD)</Label>
              <Input value={pricePitd} onChange={(e) => setPricePitd(e.target.value)} placeholder="Ví dụ: 10" />
            </div>

            <Button
              onClick={onSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {submitting ? "Đang đăng..." : "Đăng bài"}
            </Button>

            {debug ? (
              <pre className="text-xs whitespace-pre-wrap bg-white border border-purple-100 rounded-lg p-3 text-gray-700">
                {debug}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
    </div>
  )
}
