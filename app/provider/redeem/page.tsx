"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ProviderRedeemPage() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRedeem() {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/fulfillment/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redeem_code: code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "REDEEM_FAILED");
        setResult(json);
        return;
      }
      setResult(json);
    } catch (e: any) {
      setError(e?.message || "NETWORK_ERROR");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold text-purple-900">Xác nhận voucher</h1>
      <Card className="p-4 space-y-3">
        <div className="text-sm text-gray-600">
          Nhập mã redeem_code do khách cung cấp để xác nhận đã sử dụng.
        </div>
        <Input
          placeholder="Nhập redeem_code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
        />
        <Button
          onClick={onRedeem}
          disabled={isLoading || !code.trim()}
          className="w-full"
        >
          {isLoading ? "Đang xác nhận..." : "Xác nhận đã sử dụng"}
        </Button>
      </Card>

      {error && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-red-700">{error}</div>
          {result ? (
            <pre className="text-xs mt-2 whitespace-pre-wrap break-words">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </Card>
      )}

      {!error && result && (
        <Card className="p-4">
          <div className="text-sm font-semibold text-green-700">OK</div>
          <pre className="text-xs mt-2 whitespace-pre-wrap break-words">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
