"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { 
  User, 
  LogOut, 
  Calendar, 
  Shield, 
  Edit2,
  Check,
  X,
  Settings,
  Crown
} from "lucide-react"

export default function AccountPage() {
  const router = useRouter()
  const { isAuthenticated, piUser, emailUser, logout, updateDisplayName } = useAuth()
  const [isEditingName, setIsEditingName] = useState(false)
  const [newDisplayName, setNewDisplayName] = useState(piUser?.displayName || piUser?.username || "")

  const displayName = piUser?.displayName || piUser?.username || emailUser?.username || ""
  const isAdmin = (piUser?.role === "admin") || (emailUser?.role === "root_admin") || (emailUser?.role === "admin")
  const createdDate = (() => {
    const raw = piUser?.createdAt || emailUser?.createdAt
    if (!raw) return ""
    try {
      return new Date(raw).toLocaleDateString("vi-VN")
    } catch {
      return String(raw)
    }
  })()

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const handleSaveDisplayName = () => {
    if (newDisplayName.trim()) {
      updateDisplayName(newDisplayName.trim())
      setIsEditingName(false)
    }
  }

  const handleCancelEdit = () => {
    setNewDisplayName(piUser?.displayName || piUser?.username || "")
    setIsEditingName(false)
  }

  // Redirect to login if not authenticated
  
  useEffect(() => {
    if (!isAuthenticated || (!piUser && !emailUser)) {
      if (typeof window !== "undefined") {
        router.push("/tai-khoan")
      }
    }
  }, [isAuthenticated, piUser, emailUser, router])

  if (!isAuthenticated || (!piUser && !emailUser)) {
    return null
  }
  return (
    <div className="min-h-screen bg-white pb-20">
      <AppHeader />
      
      <main className="px-4 py-4 space-y-4 max-w-screen-sm mx-auto">
        {/* Profile Header */}
        <Card className="bg-white border-border">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <svg
                    className="h-8 w-8 text-amber-600"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  </svg>
                </div>
                {isAdmin && (
                  <div className="absolute -top-1 -right-1 h-6 w-6 bg-accent rounded-full flex items-center justify-center border-2 border-white">
                    <Crown className="h-3 w-3 text-foreground" />
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                {!isEditingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-bold text-foreground truncate">{displayName}</h2>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 bg-transparent"
                      onClick={() => {
                        setNewDisplayName(displayName)
                        setIsEditingName(true)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mb-1">
                    <Input
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="h-7 text-sm bg-white"
                      placeholder="Nhập tên hiển thị"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 bg-transparent text-primary"
                      onClick={handleSaveDisplayName}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 bg-transparent text-muted-foreground"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mb-1">@{piUser.username}</p>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
                    <Badge className="bg-accent text-foreground text-[9px] h-4 px-1.5">
                      <Crown className="mr-0.5 h-2 w-2" />
                      Admin
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] text-primary font-medium">Đã xác thực</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="bg-white border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Thông tin tài khoản
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Pi User ID</span>
              <span className="text-xs font-medium font-mono">{piUser.uid}</span>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Vai trò</span>
              <span className="text-xs font-medium">{isAdmin ? "Quản trị viên" : "Người dùng"}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Phương thức đăng nhập</span>
              <div className="flex items-center gap-1">
                <svg className="h-3 w-3 text-amber-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                </svg>
                <span className="text-xs font-medium">Pi Network</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-xs text-muted-foreground">Trạng thái tài khoản</span>
              <Badge className="bg-primary text-white text-[9px] h-4 px-1.5">
                Hoạt động
              </Badge>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Ngày tham gia
              </span>
              <span className="text-xs font-medium">{createdDate}</span>
            </div>
          </CardContent>
        </Card>

        {/* Admin Section */}
        {isAdmin && (
          <Card className="bg-accent/10 border-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                <span className="text-accent">Khu vực quản trị viên</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bạn có quyền truy cập các công cụ quản trị của TSBIO.
              </p>
              <Button 
                variant="outline" 
                className="w-full h-9 text-xs bg-transparent border-accent/30 hover:bg-accent/10"
                onClick={() => router.push("/admin")}
              >
                <Settings className="mr-2 h-3.5 w-3.5" />
                Vào trang quản trị
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full h-10 text-sm bg-transparent"
            onClick={() => router.push("/tai-khoan")}
          >
            <User className="mr-2 h-4 w-4" />
            Xem hồ sơ đầy đủ
          </Button>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full h-10 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 bg-transparent"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
