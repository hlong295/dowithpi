"use client"

import React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { PiAuthenticationCard } from "@/components/pi-authentication-card"
import { User, Mail, Lock, LogIn, LogOut, ShoppingBag, Heart, Bell, Settings } from "lucide-react"
import { supabaseBrowser } from "@/lib/supabase/client"
import { isRootIdentity } from "@/lib/root-admin"

export default function AccountPage() {
  const router = useRouter()
  const { isAuthenticated, piUser, emailUser, login, logout, refreshEmailUser } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPiAuth, setShowPiAuth] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setEmailError(null)
    try {
      const input = email.trim()
      if (!input) {
        setEmailError("Vui lòng nhập email hoặc username")
        return
      }

      if (!password) {
        setEmailError("Vui lòng nhập mật khẩu")
        return
      }

      // If user types username, resolve to email via server (identity link)
      let resolvedEmail = input
      if (!input.includes("@")) {
        const res = await fetch(`/api/auth/resolve-email?username=${encodeURIComponent(input)}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setEmailError(data?.error || "Không tìm thấy email cho username này")
          return
        }
        resolvedEmail = data.email
      }

      const { data, error } = await supabaseBrowser.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      })

      if (error) {
        const msg = (error.message || "").toLowerCase()
        // Normalize common Supabase auth errors to user-friendly Vietnamese
        if (msg.includes("invalid login credentials") || msg.includes("invalid") || msg.includes("credentials")) {
          setEmailError("Sai username/email hoặc mật khẩu")
        } else if (msg.includes("email not confirmed") || msg.includes("confirm")) {
          setEmailError("Email chưa được xác minh. Vui lòng kiểm tra hộp thư và xác minh trước khi đăng nhập.")
        } else if (msg.includes("user not found") || msg.includes("not found")) {
          setEmailError("Tài khoản không tồn tại")
        } else if (msg.includes("too many") || msg.includes("rate")) {
          setEmailError("Bạn thao tác quá nhanh. Vui lòng thử lại sau vài phút.")
        } else {
          setEmailError(error.message || "Đăng nhập thất bại")
        }
        return
      }

      if (data?.session?.access_token) {
        // Ensure profile/identity/wallet exists, then refresh context
        await fetch("/api/auth/ensure-profile", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({}),
        }).catch(() => null)

        await refreshEmailUser().catch(() => null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePiLoginClick = () => {
    setShowPiAuth(true)
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }


  const isAdmin = isRootIdentity({
    email: emailUser?.email,
    username: emailUser?.username,
    role: emailUser?.role || piUser?.role,
  })

  // If authenticated, show account dashboard (Pi OR Email)
  if (isAuthenticated && (piUser || emailUser)) {
    return (
      <div className="min-h-screen bg-white pb-24 w-full max-w-full overflow-x-hidden">
        <AppHeader />
        <main className="px-3 py-5 space-y-5 w-full max-w-[430px] mx-auto pt-[calc(3.5rem+1.25rem)]">
          {/* User Profile Section */}
          <Card className="bg-white border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                  <svg
                    className="h-8 w-8 text-accent"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {piUser?.username || emailUser?.username || emailUser?.email}
                  </h2>
                  {piUser ? (
                    <p className="text-xs text-muted-foreground font-light">Pi User ID: {piUser.uid}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground font-light">Email: {emailUser?.email}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] text-primary font-semibold">
                      {piUser ? "Pi Network Connected" : "Email Login"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-white border-border/50 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium leading-snug">Đơn hàng</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-border/50 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                    <Heart className="h-5 w-5 text-red-500" />
                  </div>
                  <span className="text-xs font-medium leading-snug">Yêu thích</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-border/50 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Bell className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium leading-tight">Thông báo</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-border cursor-pointer hover:border-primary/50 transition-colors">
              <CardContent className="p-3.5">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Settings className="h-5 w-5 text-foreground" />
                  </div>
                  <span className="text-xs font-medium leading-tight">Cài đặt</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Info */}
          <Card className="bg-white border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Thông tin tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Loại tài khoản</span>
                <span className="text-xs font-medium">{piUser ? "Pi Network" : "Email"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Trạng thái</span>
                <span className="text-xs font-medium text-primary">
                  {piUser ? "Đã xác thực" : emailUser?.emailVerified ? "Đã xác minh email" : "Chưa xác minh"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">TSB Wallet</span>
                <span className="text-xs font-medium text-amber-600">
                  {emailUser?.wallet ? `${emailUser.wallet.balance} TSB` : "Đang tải..."}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Logout Button */}

          {isAdmin && (
            <Button
              variant="outline"
              className="w-full h-10 text-sm bg-transparent border-accent/30 hover:bg-accent/10"
              onClick={() => router.push("/admin")}
            >
              <Settings className="mr-2 h-4 w-4" />
              Vào trang quản trị
            </Button>
          )}

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-10 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 bg-transparent"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </main>
        <AppFooter />
      </div>
    )
  }

  // Show login form if not authenticated
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-[hsl(115,48%,98%)] w-full max-w-full overflow-x-hidden">
      <AppHeader />

      <main className="px-3 pt-[calc(3.5rem+0.375rem)] pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-2 w-full max-w-[430px] mx-auto min-h-[calc(100dvh-3.5rem-5rem)]">
        {/* Header Section - Ultra Compact for mobile */}
        <div className="text-center">
          <h1 className="text-lg font-semibold text-[hsl(130,38%,32%)]">Đăng nhập</h1>
        </div>

        {/* Login Options */}
        <Tabs defaultValue="pi" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-7 bg-white/70">
            <TabsTrigger 
              value="pi" 
              className="text-[11px] bg-white/70 text-gray-600 border border-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(45,96%,62%)] data-[state=active]:to-[hsl(38,92%,50%)] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:border-transparent"
            >
              <svg
                className="mr-1 h-3 w-3"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
              Pi Network
            </TabsTrigger>
            <TabsTrigger 
              value="email" 
              className="text-[11px] bg-white/70 text-gray-600 border border-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(45,96%,62%)] data-[state=active]:to-[hsl(38,92%,50%)] data-[state=active]:text-black data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:border-transparent"
            >
              <Mail className="mr-1 h-3 w-3" />
              Email / Username
            </TabsTrigger>
          </TabsList>

          {/* Email/Username Login Tab */}
          <TabsContent value="email" className="mt-1.5">
            <Card className="bg-white border-[hsl(30,8%,88%)]/50 shadow-sm">
              <CardContent className="p-2.5">
                <form onSubmit={handleEmailLogin} className="space-y-1.5">
                  <div className="space-y-0.5">
                    <Label htmlFor="email" className="text-[10px] font-medium text-[hsl(130,38%,32%)]">
                      Email / Username
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(30,12%,55%)]" />
                      <Input
                        id="email"
                        type="text"
                        placeholder="Nhập email hoặc username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-8 h-9 text-xs bg-white border-[hsl(30,8%,88%)]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <Label htmlFor="password" className="text-[10px] font-medium text-[hsl(130,38%,32%)]">
                      Mật khẩu
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(30,12%,55%)]" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Nhập mật khẩu"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-8 h-9 text-xs bg-white border-[hsl(30,8%,88%)]"
                        required
                      />
                    </div>
                  </div>

                  {emailError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTitle className="text-[11px]">Đăng nhập thất bại</AlertTitle>
                      <AlertDescription className="text-[11px]">
                        {emailError}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-end pt-0.5">
                    <Link href="/quen-mat-khau" className="text-[10px] text-[hsl(122,48%,54%)] hover:underline font-medium">
                      Quên mật khẩu?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 bg-[hsl(122,48%,54%)] hover:bg-[hsl(122,48%,48%)] text-white text-xs font-semibold shadow-sm"
                    disabled={isLoading}
                  >
                    <LogIn className="mr-1.5 h-3.5 w-3.5" />
                    {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
                  </Button>

                  <div className="text-center">
                    <p className="text-[10px] text-[hsl(30,12%,45%)]">
                      Chưa có tài khoản?{" "}
                      <Link href="/dang-ky" className="text-[hsl(122,48%,54%)] font-medium hover:underline">
                        Đăng ký ngay
                      </Link>
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pi Network Login Tab */}
          <TabsContent value="pi" className="mt-1.5">
            {!showPiAuth ? (
              <Card className="bg-white border-[hsl(30,8%,88%)]/50 shadow-sm">
                <CardContent className="p-2.5 space-y-1.5">
                  {/* Pi SDK Status Line - Compact Pill */}
                  <div className="flex items-center justify-between px-2 py-1 bg-[hsl(115,48%,95%)] rounded-full">
                    <span className="text-[10px] font-medium text-[hsl(130,38%,32%)]">Pi SDK:</span>
                    <span className="text-[10px] font-semibold text-[hsl(122,48%,54%)]">Connected</span>
                  </div>

                  <div className="flex flex-col items-center justify-center py-2 space-y-2">
                    {/* Pi Network Official Logo - 72x72 */}
                    <div className="relative flex items-center justify-center">
                      <img 
                        src="/images/pi-network-logo.png" 
                        alt="Pi Network" 
                        className="h-[72px] w-[72px] object-contain mx-auto"
                        style={{ background: 'transparent', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-[hsl(30,12%,45%)] leading-tight max-w-[240px]">
                        Kết nối Pi để thanh toán và giao dịch
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handlePiLoginClick}
                    className="w-full rounded-2xl py-4 font-semibold text-white shadow-md bg-gradient-to-r from-[#F6C247] to-[#F2A900]"
                  >
                    <svg
                      className="mr-1.5 h-3.5 w-3.5"
                      viewBox="0 0 100 100"
                      fill="currentColor"
                    >
                      <circle cx="50" cy="50" r="45"/>
                    </svg>
                    Đăng nhập bằng Pi
                  </Button>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5">
                    <p className="text-[9px] text-amber-800 leading-tight line-clamp-2">
                      <strong>Lưu ý:</strong> Tính năng này hoạt động khi bạn mở ứng dụng trong Pi Browser.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <PiAuthenticationCard onSuccess={(accessToken, username, uid) => {
                // Root admin identity (policy: Pi username hlong295)
                const role = username === "hlong295" ? "admin" : "user"
                login({ accessToken, username, uid, role })
                router.push("/")
              }} />
            )}
          </TabsContent>
        </Tabs>

        {/* Additional Info - Ultra Compact */}
        <Card className="bg-[hsl(115,48%,98%)] border-[hsl(122,48%,85%)]">
          <CardContent className="p-2">
            <div className="space-y-1">
              <h3 className="text-[10px] font-semibold text-[hsl(130,38%,32%)]">Tại sao đăng nhập?</h3>
              <ul className="space-y-0.5 text-[10px] text-[hsl(30,12%,45%)] leading-tight">
                <li className="flex items-start gap-1">
                  <span className="text-[hsl(122,48%,54%)] font-bold shrink-0 text-[11px]">✓</span>
                  <span>Mua sắm nông sản và sản phẩm TSBIO</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-[hsl(122,48%,54%)] font-bold shrink-0 text-[11px]">✓</span>
                  <span>Theo dõi đơn hàng và lịch sử giao dịch</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-[hsl(122,48%,54%)] font-bold shrink-0 text-[11px]">✓</span>
                  <span>Đăng bán nông sản của bạn</span>
                </li>
                <li className="flex items-start gap-1">
                  <span className="text-[hsl(122,48%,54%)] font-bold shrink-0 text-[11px]">✓</span>
                  <span>Tham gia cộng đồng nông nghiệp minh bạch</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>

      <AppFooter />
    </div>
  )
}
