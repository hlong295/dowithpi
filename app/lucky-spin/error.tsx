"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LuckySpinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      (window as any).__PITODO_LUCKY_SPIN_ERROR__ = {
        message: error?.message,
        digest: (error as any)?.digest,
        stack: error?.stack,
      };
    } catch {}
  }, [error]);

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-md mx-auto border rounded-xl p-4">
        <div className="font-semibold text-red-600">Lucky Spin crashed</div>
        <div className="text-sm mt-2 break-words">{error?.message || "Unknown error"}</div>
        {(error as any)?.digest ? (
          <div className="text-xs mt-2 opacity-70">digest: {(error as any).digest}</div>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button onClick={reset}>Thử lại</Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                window.location.reload();
              } catch {
                reset();
              }
            }}
          >
            Reload
          </Button>
        </div>
        <div className="text-xs mt-4 opacity-70">
          Nếu bạn đang ở Pi Browser và không có console log: hãy chụp màn hình trang này gửi lại.
        </div>
      </div>
    </div>
  );
}
