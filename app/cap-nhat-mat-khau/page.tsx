"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function CapNhatMatKhauPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When opened from Supabase recovery link, Supabase will set session automatically (hash params)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await supabaseBrowser.auth.getSession();
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!password) return setError("Vui lòng nhập mật khẩu mới");

    setLoading(true);
    try {
      const { error: err } = await supabaseBrowser.auth.updateUser({ password });
      if (err) {
        setError(err.message);
        return;
      }
      setMessage("Cập nhật mật khẩu thành công. Đang chuyển về trang đăng nhập...");
      setTimeout(() => router.push("/tai-khoan"), 800);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <AppHeader />
      {/* AppHeader is fixed (h-14) */}
      <main className="px-4 pt-14 pb-4 space-y-4 max-w-screen-sm mx-auto">
        <Card className="bg-white border-border">
          <CardHeader className="pb-2">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">Đặt lại mật khẩu</h1>
              <p className="text-sm text-muted-foreground">Nhập mật khẩu mới để hoàn tất</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {!ready ? (
              <div className="text-sm text-muted-foreground">Đang tải...</div>
            ) : (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu mới</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                {error && <div className="text-sm text-destructive">{error}</div>}
                {message && <div className="text-sm text-emerald-600">{message}</div>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                </Button>

                <div className="text-center text-sm">
                  <Link href="/tai-khoan" className="text-[hsl(122,45%,52%)] font-medium">
                    Quay lại đăng nhập
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
