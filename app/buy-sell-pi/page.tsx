"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, DollarSign, TrendingDown, TrendingUp, Clock, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type PiRates = {
  buy_price_vnd: number | null;
  sell_price_vnd: number | null;
  updated_at: string | null;
  reason?: string;
};

function formatVnd(n: number | null) {
  if (typeof n !== "number" || !isFinite(n)) return "…";
  try {
    return new Intl.NumberFormat("vi-VN").format(n);
  } catch {
    return String(n);
  }
}

function formatTime(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export default function BuySellPiPage() {
  const router = useRouter();
  const { user, isAdmin: authIsAdmin } = useAuth();

  const requesterId = useMemo(() => {
    const u: any = user as any;
    return u?.id || u?.uid || u?.user_id || "";
  }, [user]);

  const requesterUsername = useMemo(() => {
    const u: any = user as any;
    return u?.pi_username || u?.username || "";
  }, [user]);

  const isAdmin = !!authIsAdmin;

  const [rates, setRates] = useState<PiRates>({
    buy_price_vnd: null,
    sell_price_vnd: null,
    updated_at: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buyInput, setBuyInput] = useState<string>("");
  const [sellInput, setSellInput] = useState<string>("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function loadRates() {
    try {
      setError(null);
      const res = await fetch("/api/pi-exchange/rates", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(json?.message || json?.error || "LOAD_FAILED");
        return;
      }
      const next: PiRates = {
        buy_price_vnd:
          typeof json?.buy_price_vnd === "number" ? json.buy_price_vnd : json?.buy_price_vnd ? Number(json.buy_price_vnd) : null,
        sell_price_vnd:
          typeof json?.sell_price_vnd === "number" ? json.sell_price_vnd : json?.sell_price_vnd ? Number(json.sell_price_vnd) : null,
        updated_at: typeof json?.updated_at === "string" ? json.updated_at : null,
        reason: json?.reason,
      };
      setRates(next);

      // Pre-fill admin form inputs once we have data.
      setBuyInput(next.buy_price_vnd != null ? String(next.buy_price_vnd) : "");
      setSellInput(next.sell_price_vnd != null ? String(next.sell_price_vnd) : "");
    } catch (e: any) {
      setError(e?.message || "LOAD_FAILED");
    }
  }

  useEffect(() => {
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveRates() {
    if (!isAdmin) return;
    try {
      setLoading(true);
      setSaveMsg(null);
      setError(null);

      const buy = buyInput.trim();
      const sell = sellInput.trim();
      const buyPrice = buy ? Number(buy) : null;
      const sellPrice = sell ? Number(sell) : null;

      const res = await fetch("/api/admin/pi-exchange/rates", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(requesterId ? { "x-pi-user-id": requesterId } : {}),
          ...(requesterUsername ? { "x-pi-username": requesterUsername } : {}),
        },
        body: JSON.stringify({ buy_price_vnd: buyPrice, sell_price_vnd: sellPrice }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(json?.message || json?.error || "SAVE_FAILED");
        return;
      }
      setSaveMsg("Đã cập nhật giá.");
      await loadRates();
    } catch (e: any) {
      setError(e?.message || "SAVE_FAILED");
    } finally {
      setLoading(false);
    }
  }

  const updatedLabel = rates?.updated_at ? formatTime(rates.updated_at) : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-24">
      <Header />

      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Button
          variant="ghost"
          className="mb-6 text-emerald-700 hover:text-emerald-800"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại
        </Button>

        <Card className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <DollarSign className="h-10 w-10 md:h-12 md:w-12 text-white" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold text-emerald-800">Mua - Bán Pi</h1>
            <div className="w-20 h-1 bg-emerald-500 mx-auto rounded-full" />
          </div>

          <div className="space-y-2 max-w-2xl mx-auto">
            <p className="text-base md:text-lg text-gray-700">
              Bảng giá tham khảo – cập nhật nhanh, rõ ràng.
            </p>
            <p className="text-sm md:text-base text-gray-600">
              Giá mua Pi: <span className="font-semibold text-emerald-700">{formatVnd(rates.buy_price_vnd)} VND</span> · Giá bán Pi:{" "}
              <span className="font-semibold text-emerald-700">{formatVnd(rates.sell_price_vnd)} VND</span>
            </p>
          </div>

          <div className="pt-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 max-w-2xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-emerald-800 font-semibold">Giá mua Pi</p>
                    <p className="text-xl font-bold text-emerald-900">{formatVnd(rates.buy_price_vnd)} VND</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-emerald-800 font-semibold">Giá bán Pi</p>
                    <p className="text-xl font-bold text-emerald-900">{formatVnd(rates.sell_price_vnd)} VND</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-700">
                <Clock className="h-4 w-4" />
                <span>{updatedLabel ? `Cập nhật: ${updatedLabel}` : "Chưa có thời gian cập nhật"}</span>
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="pt-2">
              <div className="bg-white border border-emerald-200 rounded-2xl p-5 max-w-2xl mx-auto text-left shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-9 w-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Quản trị cập nhật giá</p>
                    <p className="text-xs text-gray-600">Chỉ admin mới thấy khối này.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600">Giá mua Pi (VND)</label>
                    <Input
                      value={buyInput}
                      onChange={(e) => setBuyInput(e.target.value)}
                      inputMode="decimal"
                      placeholder="VD: 30000"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600">Giá bán Pi (VND)</label>
                    <Input
                      value={sellInput}
                      onChange={(e) => setSellInput(e.target.value)}
                      inputMode="decimal"
                      placeholder="VD: 32000"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    onClick={saveRates}
                    disabled={loading}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  >
                    {loading ? "Đang lưu…" : "Cập nhật giá"}
                  </Button>

                  <div className="flex-1 text-xs">
                    {saveMsg ? <p className="text-emerald-700">{saveMsg}</p> : null}
                    {error ? <p className="text-red-600">{error}</p> : null}
                    {/* Debug helper for Pi Browser (no console): keep tiny & non-invasive */}
                    {rates?.reason ? <p className="text-gray-500">debug: {rates.reason}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <BottomNav />
    </div>
  );
}
