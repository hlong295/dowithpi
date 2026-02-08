"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { usePiNetworkAuthentication } from "@/hooks/use-pi-network-authentication"

interface PiAuthenticationCardProps {
  onSuccess?: () => void
}

export function PiAuthenticationCard({ onSuccess }: PiAuthenticationCardProps) {
  const {
    sdkReady,
    sdkStatus,
    sdkError,
    isAuthenticating,
    authError,
    authenticateWithPi,
    resetAuthErrors,
    mode,
  } = usePiNetworkAuthentication()

  const [hasAttempted, setHasAttempted] = useState(false)
  const errorMsg = authError || sdkError

  useEffect(() => {
    if (hasAttempted && !isAuthenticating && !errorMsg) {
      onSuccess?.()
    }
  }, [hasAttempted, isAuthenticating, errorMsg, onSuccess])

  const connected = sdkReady || sdkStatus === "connected"

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Đăng nhập bằng Pi Network</CardTitle>
        <CardDescription>Đang xác thực tài khoản Pi Network của bạn</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm rounded-md bg-green-50 border border-green-100 px-3 py-2">
          <span>Pi SDK:</span>
          <span className={connected ? "text-green-600 font-medium" : "text-gray-500"}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          disabled={!connected || isAuthenticating}
          onClick={async () => {
            setHasAttempted(true)
            await authenticateWithPi()
          }}
        >
          {isAuthenticating ? "Đang đăng nhập..." : "Đăng nhập bằng Pi"}
        </Button>

        {/* Nút thử lại khi có lỗi */}
        {errorMsg && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              resetAuthErrors()
            }}
          >
            Thử lại{mode ? ` (${mode})` : ""}
          </Button>
        )}

        <div className="text-xs text-muted-foreground">
          Lưu ý: Tính năng này hoạt động khi bạn mở ứng dụng trong Pi Browser.
        </div>
      </CardContent>
    </Card>
  )
}
