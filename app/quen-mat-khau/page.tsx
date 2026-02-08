"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function QuenMatKhauPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const em = email.trim();
    if (!em) return setError("Vui lòng nhập email");

    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: err } = await supabaseBrowser.auth.resetPasswordForEmail(em, {
        redirectTo: `${origin}/cap-nhat-mat-khau`,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setMessage("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.");
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
              <h1 className="text-lg font-semibold">Quên mật khẩu</h1>
              <p className="text-sm text-muted-foreground">Nhập email để nhận link đặt lại mật khẩu</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vd: dowithpi@gmail.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}
              {message && <div className="text-sm text-emerald-600">{message}</div>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Đang gửi..." : "Gửi email đặt lại"}
              </Button>

              <div className="text-center text-sm">
                Quay lại{" "}
                <Link href="/tai-khoan" className="text-[hsl(122,45%,52%)] font-medium">
                  Đăng nhập
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
      <AppFooter />
    </div>
  );
}
