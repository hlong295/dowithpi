"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DangKyPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const u = username.trim().toLowerCase();
    if (!u) return setError("Vui lòng nhập username");
    if (u.startsWith("pi_")) return setError("Username dành cho Pi phải có dạng pi_... (không dùng ở email)");
    if (!email.trim()) return setError("Vui lòng nhập email");
    if (!password) return setError("Vui lòng nhập mật khẩu");

    setLoading(true);
    try {
      // Supabase email sign up (will send verification email if enabled in Supabase)
      const { data, error: signErr } = await supabaseBrowser.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: u,
          },
        },
      });

      if (signErr) {
        setError(signErr.message);
        return;
      }

      // If session exists immediately (email verification disabled), provision now.
      if (data?.session?.access_token) {
        await fetch("/api/auth/ensure-profile", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({ username: u }),
        }).catch(() => null);

        setMessage("Đăng ký thành công. Đang chuyển sang trang tài khoản...");
        router.push("/tai-khoan");
        return;
      }

      // Email verification required — user must verify then login.
      if (data?.user?.id) {
        await fetch("/api/auth/provision-signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: data.user.id, email: email.trim(), username: u }),
        }).catch(() => null);
      }
      setMessage("Đã gửi email xác minh. Vui lòng kiểm tra hộp thư và xác minh trước khi đăng nhập.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <AppHeader />
      {/* AppHeader is fixed (h-14) so pages must offset content to avoid being covered */}
      <main className="px-4 pt-14 pb-4 space-y-4 max-w-screen-sm mx-auto">
        <Card className="bg-white border-border">
          <CardHeader className="pb-2">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">Đăng ký</h1>
              <p className="text-sm text-muted-foreground">Tạo tài khoản email để dùng TSBIO</p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="vd: abc123"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <p className="text-xs text-muted-foreground">Email username: <b>abc123</b> (không dùng tiền tố pi_)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vd: user@gmail.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
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
                {loading ? "Đang xử lý..." : "Tạo tài khoản"}
              </Button>

              <div className="text-center text-sm">
                Đã có tài khoản?{" "}
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
