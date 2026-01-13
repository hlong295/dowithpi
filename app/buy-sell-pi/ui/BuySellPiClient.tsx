"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, DollarSign, TrendingDown, TrendingUp, Clock, Shield, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type PiRates = {
  buy_price_vnd: number | null;
  sell_price_vnd: number | null;
  updated_at: string | null;
  can_edit_prices?: boolean;
  can_manage_editors?: boolean;
  reason?: string;
};

function formatVnd(n: number | null) {
  if (typeof n !== "number" || !isFinite(n)) return "…";
  try {
    return new Intl.NumberFormat("vi-VN").format(n);
  } catch {
    try {
      return n.toLocaleString();
    } catch {
      return String(n);
    }
  }
}

function formatTime(ts: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    try {
      return d.toLocaleString();
    } catch {
      return "";
    }
  }
}

type PageErrorBoundaryProps = { children: React.ReactNode };
type PageErrorBoundaryState = { hasError: boolean; message?: string };

class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: error?.message || String(error) };
  }
  componentDidCatch() {
    // Pi Browser has no console; we intentionally do nothing here.
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-24">
        <Header />
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <Card className="bg-white rounded-3xl shadow-2xl p-6 md:p-10 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-3xl bg-amber-50 flex items-center justify-center shadow-sm">
                <AlertTriangle className="h-10 w-10 text-amber-600" />
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-emerald-800">Mua - Bán Pi</h1>
            <p className="text-sm md:text-base text-gray-700">
              Trang gặp lỗi khi tải trên môi trường hiện tại.
            </p>
            <div className="text-xs text-gray-600 bg-gray-50 border rounded-2xl p-4 text-left">
              <p className="font-semibold text-gray-700 mb-1">debug:</p>
              <p className="break-words">{this.state.message || "CLIENT_EXCEPTION"}</p>
            </div>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }
}

function BuySellPiInner() {
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

  

function authHeaders(contentType?: boolean) {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = "application/json";
  if (requesterId) headers["x-pi-user-id"] = requesterId;
  if (requesterUsername) headers["x-pi-username"] = requesterUsername;

  // Email login: forward access token so server can verify supabase user
  const u: any = user as any;
  const token = (u?.accessToken || u?.access_token || "").trim();
  if (token) headers["authorization"] = `Bearer ${token}`;

  return headers;
}

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

  // Root-only: manage who can update Pi rates (editor allowlist)
  const [editors, setEditors] = useState<Array<{ user_id: string; label: string }>>([]);
  const [editorQuery, setEditorQuery] = useState<string>("");
  const [editorResults, setEditorResults] = useState<Array<{ id: string; label: string; email?: string | null; pi_username?: string | null }>>([]);
  const [editorMsg, setEditorMsg] = useState<string | null>(null);
  const [loadingEditors, setLoadingEditors] = useState<boolean>(false);

  async function loadRates() {
    try {
      setError(null);
      const res = await fetch("/api/pi-exchange/rates", { cache: "no-store", credentials: "include", headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setError(json?.message || json?.error || "LOAD_FAILED");
        return;
      }
      const next: PiRates = {
        buy_price_vnd:
          typeof json?.buy_price_vnd === "number"
            ? json.buy_price_vnd
            : json?.buy_price_vnd
              ? Number(json.buy_price_vnd)
              : null,
        sell_price_vnd:
          typeof json?.sell_price_vnd === "number"
            ? json.sell_price_vnd
            : json?.sell_price_vnd
              ? Number(json.sell_price_vnd)
              : null,
        updated_at: typeof json?.updated_at === "string" ? json.updated_at : null,
        can_edit_prices: !!json?.can_edit_prices,
        can_manage_editors: !!json?.can_manage_editors,
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

  async function loadEditors() {
    if (!canManageEditors) return;
    try {
      setLoadingEditors(true);
      setEditorMsg(null);
      const res = await fetch("/api/admin/pi-exchange/editors", { cache: "no-store", credentials: "include", headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setEditorMsg(json?.message || json?.error || "LOAD_EDITORS_FAILED");
        return;
      }
      setEditors(Array.isArray(json?.editors) ? json.editors : []);
      if (json?.reason) setEditorMsg(json?.message || String(json.reason));
    } catch (e: any) {
      setEditorMsg(String(e?.message || e));
    } finally {
      setLoadingEditors(false);
    }
  }

  async function searchUsers(q: string) {
    if (!canManageEditors) return;
    const qq = q.trim();
    if (!qq) {
      setEditorResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/pi-exchange/user-search?q=${encodeURIComponent(qq)}`, { cache: "no-store", credentials: "include", headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setEditorMsg(json?.message || json?.error || "SEARCH_FAILED");
        return;
      }
      setEditorResults(Array.isArray(json?.users) ? json.users : []);
    } catch (e: any) {
      setEditorMsg(String(e?.message || e));
    }
  }

  async function updateEditor(action: "add" | "remove", userId: string) {
    if (!canManageEditors) return;
    try {
      setLoadingEditors(true);
      setEditorMsg(null);
      const res = await fetch("/api/admin/pi-exchange/editors", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(true),
        body: JSON.stringify({ action, user_id: userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setEditorMsg(json?.message || json?.error || "UPDATE_EDITOR_FAILED");
        return;
      }
      await loadEditors();
      setEditorMsg(action === "add" ? "Đã cấp quyền cập nhật giá." : "Đã gỡ quyền cập nhật giá.");
    } catch (e: any) {
      setEditorMsg(String(e?.message || e));
    } finally {
      setLoadingEditors(false);
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

    const canEdit = !!rates?.can_edit_prices || isAdmin;
  const canManageEditors = !!rates?.can_manage_editors || ((user as any)?.piUsername || (user as any)?.username) === "hlong295";

const updatedLabel = rates?.updated_at ? formatTime(rates.updated_at) : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pb-24">
      <Header />

      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Button variant="ghost" className="mb-6 text-emerald-700 hover:text-emerald-800" onClick={() => router.back()}>
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
            <p className="text-base md:text-lg text-gray-700">Bảng giá tham khảo – cập nhật nhanh, rõ ràng.</p>
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

          {canEdit ? (
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
                    <Input value={buyInput} onChange={(e) => setBuyInput(e.target.value)} inputMode="decimal" placeholder="VD: 30000" className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600">Giá bán Pi (VND)</label>
                    <Input value={sellInput} onChange={(e) => setSellInput(e.target.value)} inputMode="decimal" placeholder="VD: 32000" className="rounded-xl" />
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button onClick={saveRates} disabled={loading} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
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


          {canManageEditors ? (
            <div className="pt-4">
              <div className="bg-white/90 rounded-3xl p-6 md:p-8 border border-emerald-100 max-w-3xl mx-auto text-left shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                    <Shield className="h-6 w-6 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-900">Phân quyền cập nhật giá</h3>
                    <p className="text-sm text-gray-600">Chỉ Root Admin mới thấy khối này.</p>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-semibold text-emerald-900 mb-2">Tìm thành viên</label>
                  <div className="flex gap-2">
                    <input
                      value={editorQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditorQuery(v);
                        searchUsers(v);
                      }}
                      placeholder="Nhập email hoặc Pi username..."
                      className="flex-1 rounded-2xl border border-emerald-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <button
                      type="button"
                      onClick={() => searchUsers(editorQuery)}
                      className="rounded-2xl bg-emerald-600 text-white px-4 py-3 font-semibold shadow-sm active:scale-[0.99]"
                    >
                      Tìm
                    </button>
                  </div>

                  {editorResults.length ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3">
                      <p className="text-xs text-gray-600 mb-2">Kết quả</p>
                      <div className="space-y-2">
                        {editorResults.map((u) => (
                          <div key={u.id} className="flex items-center justify-between gap-3 bg-white rounded-2xl p-3 border border-emerald-100">
                            <div className="min-w-0">
                              <p className="font-semibold text-emerald-900 truncate">{u.label}</p>
                              <p className="text-xs text-gray-600 truncate">{u.email || u.pi_username || u.id}</p>
                            </div>
                            <button
                              type="button"
                              disabled={loadingEditors}
                              onClick={() => updateEditor("add", u.id)}
                              className="shrink-0 rounded-2xl bg-emerald-600 text-white px-3 py-2 text-sm font-semibold shadow-sm disabled:opacity-60"
                            >
                              Cấp quyền
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <p className="text-sm font-semibold text-emerald-900 mb-2">Danh sách được phép cập nhật</p>
                    <div className="rounded-2xl border border-emerald-100 bg-white p-3">
                      {editors.length ? (
                        <div className="space-y-2">
                          {editors.map((e) => (
                            <div key={e.user_id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{e.label}</p>
                                <p className="text-xs text-gray-500 truncate">{e.user_id}</p>
                              </div>
                              <button
                                type="button"
                                disabled={loadingEditors}
                                onClick={() => updateEditor("remove", e.user_id)}
                                className="shrink-0 rounded-2xl bg-gray-100 text-gray-800 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                              >
                                Gỡ
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">Chưa có thành viên nào được cấp quyền.</p>
                      )}
                    </div>
                  </div>

                  {editorMsg ? <p className="mt-3 text-sm text-gray-600">debug: {editorMsg}</p> : null}
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

export default function BuySellPiClient() {
  return (
    <PageErrorBoundary>
      <BuySellPiInner />
    </PageErrorBoundary>
  );
}
