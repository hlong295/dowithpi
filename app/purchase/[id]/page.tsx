"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, Ticket, X } from "lucide-react";
import BottomNav from "@/components/bottom-nav";

type ApiState = {
  ok?: boolean;
  message?: string;
  purchase?: any;
  itemType?: string;
  voucher?: any;
  digital?: any;
  canAccessDigital?: boolean;
  canConfirmUsed?: boolean;
};

function formatDate(d: any) {
  try {
    if (!d) return "";
    return new Date(d).toLocaleString("vi-VN");
  } catch {
    return String(d || "");
  }
}

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const purchaseId = params?.id;
  const searchParams = useSearchParams();
  const dbg = searchParams.get("dbg") === "1";

  const [state, setState] = useState<ApiState>({});
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState(false);
  const [useErr, setUseErr] = useState<string | null>(null);
  const [dlErr, setDlErr] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setUseErr(null);
      try {
        const res = await fetch(`/api/purchases/${purchaseId}`, { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setState(json);
      } catch (e: any) {
        if (!mounted) return;
        setState({ message: e?.message || "LOAD_FAILED" });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (purchaseId) load();
    return () => {
      mounted = false;
    };
  }, [purchaseId]);

  const product = state?.purchase?.product || null;
  const productName = product?.name || product?.title || "Sản phẩm";
  const productImage = useMemo(() => {
    const media = product?.media;
    if (Array.isArray(media) && media.length > 0) {
      const primary = media.find((m: any) => m?.thumbnail_url) || media.find((m: any) => m?.url);
      return primary?.thumbnail_url || primary?.url || null;
    }
    return product?.image_url || null;
  }, [product]);

  async function markUsed() {
    try {
      setUsing(true);
      setUseErr(null);
      const res = await fetch(`/api/fulfillment/voucher/${purchaseId}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) {
        setUseErr(json?.message || "USE_FAILED");
        return;
      }
      // Reload
      const r2 = await fetch(`/api/purchases/${purchaseId}`, { cache: "no-store" });
      const j2 = await r2.json();
      setState(j2);
    } catch (e: any) {
      setUseErr(e?.message || "USE_FAILED");
    } finally {
      setUsing(false);
    }
  }

  async function openDigital() {
    try {
      setOpening(true);
      setDlErr(null);
      const res = await fetch(`/api/fulfillment/digital/${purchaseId}/access`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setDlErr(json?.message || "DIGITAL_ACCESS_FAILED");
        return;
      }
      const url = json?.url;
      if (!url) {
        setDlErr("DIGITAL_NOT_READY");
        return;
      }
      // Open in new tab/window (Pi Browser friendly)
      window.open(url, "_blank");
    } catch (e: any) {
      setDlErr(e?.message || "DIGITAL_ACCESS_FAILED");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f7fb] pb-24">
      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-orange-500" />
              <h1 className="text-lg font-semibold text-gray-900">Chi tiết đơn đổi</h1>
            </div>
            <p className="text-xs text-gray-500 mt-1">ID: {purchaseId}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : !state?.ok ? (
            <div className="p-4">
              <div className="flex items-start gap-2 text-sm text-red-600">
                <X className="h-4 w-4 mt-0.5" />
                <div>
                  <div className="font-semibold">Không tải được đơn</div>
                  <div className="mt-1 break-words">{state?.message || "UNKNOWN_ERROR"}</div>
                </div>
              </div>
              {dbg && (
                <pre className="mt-3 text-[10px] leading-snug bg-gray-50 border rounded-lg p-2 overflow-auto">
                  {JSON.stringify(state, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex gap-3">
                <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                  <Image src={productImage || "/placeholder.svg"} alt={productName} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{productName}</div>
                  <div className="text-xs text-gray-500 mt-1">Ngày đổi: {formatDate(state.purchase?.created_at)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Trạng thái: <span className="font-medium text-gray-800">{state.purchase?.status}</span>
                  </div>
                </div>
              </div>

              {state.itemType === "voucher" && (
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                  <div className="text-sm font-semibold text-orange-800">Mã đổi dịch vụ</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xl font-mono font-bold tracking-wider text-orange-900 break-all">
                      {state.voucher?.redeem_code || "(chưa có mã)"}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-orange-700">
                    Trạng thái mã: {state.voucher?.status || "N/A"}
                    {state.voucher?.used_at ? ` • Used: ${formatDate(state.voucher.used_at)}` : ""}
                  </div>

                  {state.canConfirmUsed && state.voucher?.status !== "USED" && (
                    <button
                      onClick={markUsed}
                      disabled={using}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 text-white py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {using ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Xác nhận đã sử dụng
                    </button>
                  )}

                  {useErr && <div className="mt-2 text-xs text-red-600">{useErr}</div>}
                </div>
              )}

              {state.itemType === "digital" && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <div className="text-sm font-semibold text-blue-800">Nội dung số (giao ngay)</div>
                  <div className="mt-2 text-xs text-blue-700">
                    Trạng thái: {state.digital?.status || "PENDING"}
                    {state.digital?.code_hint ? ` • Code: ${state.digital.code_hint}` : ""}
                  </div>

                  {state.canAccessDigital && (
                    <button
                      onClick={openDigital}
                      disabled={opening}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Mở link tải
                    </button>
                  )}

                  {dlErr && <div className="mt-2 text-xs text-red-600">{dlErr}</div>}
                </div>
              )}

              {dbg && (
                <pre className="text-[10px] leading-snug bg-gray-50 border rounded-lg p-2 overflow-auto">
                  {JSON.stringify(state, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
