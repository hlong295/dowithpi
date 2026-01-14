"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { useAuth } from "@/lib/auth-context";

type LotteryEvent = {
  id: string;
  title: string;
  description: string | null;
  open_at: string;
  close_at: string;
  draw_at: string;
  max_participants: number | null;
  close_when_full: boolean;
  status: "draft" | "open" | "closed" | "drawing" | "completed" | "cancelled" | string;
  requires_pioneer: boolean;
  meta: any;
};

type Prize = {
  id: string;
  rank: number;
  prize_type: "PI" | "PITD" | "VOUCHER" | string;
  amount: number | null;
  label: string | null;
};

type MyEntry = {
  id: string;
  chosen_number: number;
  created_at: string;
};

type RankWinners = {
  rank: number;
  label: string;
  prize_type: "PI" | "PITD" | "VOUCHER" | string;
  amount: number | null;
  numbers: string[];
};

function padNumber(v: number) {
  // Spec is 0-9999 but UI mockup shows 5 digits
  return String(v).padStart(5, "0");
}

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function msToCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`;
}

export default function LuckySpinPage() {
  const { user, piUser, session } = useAuth();
  const isPiLogin = !!piUser?.uid;
  const isLoggedIn = !!(piUser?.uid || user?.id);

  const isAdminUI = useMemo(() => {
    const role = (user as any)?.role;
    const piUsername = (piUser as any)?.username;
    return role === "admin" || role === "root_admin" || piUsername === "hlong295";
  }, [user, piUser]);

  const dbgEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("dbg") === "1";
  }, []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  const [event, setEvent] = useState<LotteryEvent | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [stats, setStats] = useState<{ participants: number; max_participants: number | null } | null>(null);
  const [myEntry, setMyEntry] = useState<MyEntry | null>(null);
  const [myWin, setMyWin] = useState<any>(null);
  const [myPayoutRequest, setMyPayoutRequest] = useState<any>(null);
  const [eligible, setEligible] = useState<boolean>(true);
  const [ineligibleReason, setIneligibleReason] = useState<string | null>(null);

  // Admin draft controls (only rendered for admin/root admin)
  const [adminTitle, setAdminTitle] = useState<string>("...");

  const [suggestNumber, setSuggestNumber] = useState<number>(() => Math.floor(Math.random() * 10000));
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);

  const [rankWinners, setRankWinners] = useState<RankWinners[]>([]);
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (piUser?.uid) {
      headers["x-pi-user-id"] = String(piUser.uid);
      if (piUser?.username) headers["x-pi-username"] = String(piUser.username);
    } else if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [piUser?.uid, piUser?.username, session?.access_token]);


  async function readJsonSafe(res: Response) {
    const text = await res.text();
    try {
      return { json: JSON.parse(text), raw: text };
    } catch {
      return { json: null, raw: text };
    }
  }

  async function loadAll() {
    setLoading(true);
    setErrorMsg(null);
    setRegisterMsg(null);
    try {
      const res = await fetch("/api/lottery/event", { headers: authHeaders, cache: "no-store" });
      const parsed = await readJsonSafe(res);
      const json: any = parsed.json ?? {};
      if (!res.ok) {
        setErrorMsg(json?.message || json?.error || (parsed.raw ? String(parsed.raw).slice(0, 160) : "Failed to load event"));
        if (dbgEnabled) setDebug(json);
        setLoading(false);
        return;
      }

      setEvent(json?.event || null);
      setPrizes(Array.isArray(json?.prizes) ? json.prizes : []);
      setStats(json?.stats || null);
      setMyEntry(json?.my_entry || null);
      setMyWin(json?.my_win || null);
      setMyPayoutRequest(json?.my_payout_request || null);
      setEligible(!!json?.eligible);
      setIneligibleReason(json?.ineligible_reason || "");

      // Prepare Admin drafts
      if (isAdminUI && json?.event) {
        setAdminEventDraft({
          id: json.event.id,
          title: json.event.title || "",
          description: json.event.description || "",
          open_at: json.event.open_at,
          close_at: json.event.close_at,
          draw_at: json.event.draw_at,
          max_participants: json.event.max_participants ?? 500,
          close_when_full: !!json.event.close_when_full,
          requires_pioneer: !!json.event.requires_pioneer,
          status: json.event.status,
        });
        setAdminPrizesDraft(Array.isArray(json?.prizes) ? json.prizes : []);
      }
      if (dbgEnabled) setDebug(json?.debug || json);

      // History (winners)
      if (json?.event?.id) {
        const hr = await fetch(`/api/lottery/history?event_id=${encodeURIComponent(json.event.id)}`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const parsedH = await readJsonSafe(hr);
      const hj: any = parsedH.json ?? {};
        if (hr.ok) setRankWinners(Array.isArray(hj?.ranks) ? hj.ranks : []);
        else if (dbgEnabled) setDebug((prev: any) => ({ ...(prev || {}), history_error: hj }));
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Unexpected error");
      if (dbgEnabled) setDebug({ error: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piUser?.uid, user?.id, session?.access_token]);

  const now = Date.now();
  const countdownMs = useMemo(() => {
    if (!event) return 0;
    const closeAt = new Date(event.close_at).getTime();
    return closeAt - Date.now();
  }, [event, now]);

  const statusText = useMemo(() => {
    if (!event) return "";
    const s = (event.status || "").toLowerCase();
    if (s === "open") return "ĐANG ĐĂNG KÝ";
    if (s === "closed") return "ĐÃ ĐÓNG";
    if (s === "drawing") return "ĐANG QUAY";
    if (s === "completed") return "ĐÃ CÓ KẾT QUẢ";
    if (s === "draft") return "NHÁP";
    if (s === "cancelled") return "ĐÃ HUỶ";
    return String(event.status || "").toUpperCase();
  }, [event]);

  const prizeSummary = useMemo(() => {
    if (!prizes?.length) return "";
    const top = prizes
      .slice()
      .sort((a, b) => (a.rank || 0) - (b.rank || 0))
      .slice(0, 3)
      .map((p) => {
        const amt = p.amount == null ? "" : String(p.amount);
        return `${amt} ${p.prize_type}`.trim();
      });
    // If mixed prize types, show generic.
    const types = Array.from(new Set(prizes.map((p) => (p.prize_type || "").toUpperCase()))).filter(Boolean);
    if (types.length > 1) return `Giải thưởng: ${types.join(" + ")}`;
    if (types[0] === "PI") return "Giải thưởng là Pi (Pi Network)";
    if (types[0] === "PITD") return "Giải thưởng là PITD";
    return `Giải thưởng: ${top.join(" | ")}`;
  }, [prizes]);

  async function onRegister() {
    if (!event) return;
    setRegistering(true);
    setRegisterMsg(null);
    try {
      const idem = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
      const res = await fetch("/api/lottery/register", {
        method: "POST",
        headers: { ...authHeaders, "x-idempotency-key": idem },
        body: JSON.stringify({ event_id: event.id, chosen_number: suggestNumber }),
      });
      const parsed = await readJsonSafe(res);
      const json: any = parsed.json ?? {};
      if (!res.ok) {
        setRegisterMsg(json?.message || json?.error || "Đăng ký thất bại");
        if (dbgEnabled) setDebug((prev: any) => ({ ...(prev || {}), register_error: json }));
        return;
      }
      setRegisterMsg("✅ Đăng ký số thành công!");
      setMyEntry(json?.entry || null);
      setStats(json?.stats || null);
    } catch (e: any) {
      setRegisterMsg(e?.message || "Đăng ký thất bại");
    } finally {
      setRegistering(false);
    }
  }

  async function refreshHistory() {
    if (!event) return;
    setRefreshingHistory(true);
    try {
      const hr = await fetch(`/api/lottery/history?event_id=${encodeURIComponent(event.id)}`, {
        headers: authHeaders,
        cache: "no-store",
      });
      const parsedH = await readJsonSafe(hr);
      const hj: any = parsedH.json ?? {};
      if (hr.ok) setRankWinners(Array.isArray(hj?.ranks) ? hj.ranks : []);
      else if (dbgEnabled) setDebug((prev: any) => ({ ...(prev || {}), history_error: hj }));
    } finally {
      setRefreshingHistory(false);
    }
  }

  const canRegister = useMemo(() => {
    if (!event) return false;
    const s = (event.status || "").toLowerCase();
    if (s !== "open") return false;
    if (!isLoggedIn) return false;
    if (!eligible) return false;
    if (myEntry) return false;
    return true;
  }, [event, isLoggedIn, eligible, myEntry]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-200 via-pink-100 to-white">
      <Header />

      <main className="max-w-md mx-auto px-4 pt-4 pb-24">
        {/* Top banner (mockup-style) */}
        <div className="rounded-2xl overflow-hidden shadow-lg">
          <div className="relative p-4 rounded-2xl bg-gradient-to-r from-orange-400 via-red-400 to-pink-500">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <span className="text-2xl">🎁</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h1 className="text-white font-extrabold text-lg leading-tight">{event?.title || "Xổ Số May Mắn"}</h1>
                  <span className="px-3 py-1 rounded-full bg-white/85 text-red-700 text-xs font-bold">
                    {statusText || "—"}
                  </span>
                </div>
                {event ? (
                  <p className="text-white/90 text-xs mt-1">
                    Từ {fmtDateTime(event.open_at)} đến {fmtDateTime(event.close_at)}
                    <br />
                    🎁 Quay số lúc {fmtDateTime(event.draw_at)}
                  </p>
                ) : (
                  <p className="text-white/90 text-xs mt-1">Đang tải thông tin event…</p>
                )}
              </div>
              <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center">
                <span className="text-white text-xl">→</span>
              </div>
            </div>

            {/* Progress bar + countdown */}
            <div className="mt-3">
              <div className="h-2 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-white/85"
                  style={{
                    width: (() => {
                      if (!event) return "0%";
                      const open = new Date(event.open_at).getTime();
                      const close = new Date(event.close_at).getTime();
                      const t = Date.now();
                      if (t <= open) return "0%";
                      if (t >= close) return "100%";
                      const pct = ((t - open) / Math.max(1, close - open)) * 100;
                      return `${Math.min(100, Math.max(0, pct)).toFixed(0)}%`;
                    })(),
                  }}
                />
              </div>
              <div className="text-center text-white/95 text-sm font-semibold mt-2">
                {event && (event.status || "").toLowerCase() === "open" ? (
                  <>Còn {msToCountdown(countdownMs)} để đăng ký</>
                ) : (
                  <>{prizeSummary || ""}</>
                )}
              </div>
              {stats ? (
                <div className="text-center text-white/90 text-xs mt-1">
                  Đã đăng ký: <b>{stats.participants}</b>
                  {stats.max_participants ? (
                    <> / {stats.max_participants}</>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Error / debug */}
        {errorMsg ? (
          <div className="mt-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {/* Eligibility warning */}
        {!eligible && ineligibleReason ? (
          <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-4">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">⚠️</div>
              <div>
                <div className="font-bold text-orange-900">{prizeSummary || "Chương trình có giải thưởng"}</div>
                <div className="text-sm text-orange-900 mt-1 whitespace-pre-line">{ineligibleReason}</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Pick number card */}
        <h2 className="mt-6 text-2xl font-extrabold text-purple-900">Chọn số dự thưởng của bạn!</h2>

        <div className="mt-3 rounded-3xl bg-white/80 shadow p-5">
          <div className="flex flex-col items-center">
            <div className="px-6 py-2 rounded-2xl bg-purple-100 text-purple-900 font-extrabold text-3xl tracking-wider">
              {String(suggestNumber).padStart(4, "0")}
            </div>
            <div className="mt-2 text-sm text-gray-700">
              Số của bạn: <b>{myEntry ? String(myEntry.chosen_number).padStart(4, "0") : "Chưa đăng ký"}</b>
            </div>

            <div className="mt-4 w-full flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-2xl bg-white border border-purple-200 py-3 text-purple-900 font-bold"
                onClick={() => setSuggestNumber(Math.floor(Math.random() * 10000))}
                disabled={!event || loading}
              >
                Đổi số
              </button>
              <button
                type="button"
                className={`flex-1 rounded-2xl py-3 font-extrabold shadow ${
                  canRegister
                    ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
                onClick={onRegister}
                disabled={!canRegister || registering}
              >
                {registering ? "Đang đăng ký…" : "ĐĂNG KÝ SỐ"}
              </button>
            </div>

            {registerMsg ? <div className="mt-3 text-sm font-semibold text-purple-900">{registerMsg}</div> : null}

            {!isLoggedIn ? (
              <div className="mt-3 text-xs text-gray-600 text-center">
                Bạn cần đăng nhập để đăng ký số.
              </div>
            ) : null}

            {event && (event.status || "").toLowerCase() !== "open" ? (
              <div className="mt-3 text-xs text-gray-600 text-center">
                Event hiện không ở trạng thái mở đăng ký.
              </div>
            ) : null}

            {isLoggedIn && eligible && myEntry ? (
              <div className="mt-3 text-xs text-gray-600 text-center">Bạn đã đăng ký, chờ đến giờ quay nhé.</div>
            ) : null}

            {/* show auth kind */}
            {dbgEnabled ? (
              <div className="mt-4 w-full rounded-2xl bg-black/90 text-white text-xs p-3 overflow-auto">
                <div className="font-bold mb-1">DEBUG</div>
                <div>isPiLogin: {String(isPiLogin)}</div>
                <div>userId: {String(user?.id || "")}</div>
                <div>piUid: {String(piUser?.uid || "")}</div>
                <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(debug, null, 2)}</pre>
              </div>
            ) : null}
          </div>
        </div>

        {/* Winners / history */}
        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-purple-900">Lịch sử xổ số</h3>
          <button
            type="button"
            className="text-sm font-bold text-purple-900/80"
            onClick={refreshHistory}
            disabled={refreshingHistory || !event}
          >
            {refreshingHistory ? "Đang tải…" : "Làm mới"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {(rankWinners.length ? rankWinners : [{ rank: 1, prize_label: "Hạng 1", prize_type: "—", amount: null, numbers: [] }, { rank: 2, prize_label: "Hạng 2", prize_type: "—", amount: null, numbers: [] }, { rank: 3, prize_label: "Hạng 3", prize_type: "—", amount: null, numbers: [] }]).map(
            (r) => (
              <div key={r.rank} className="rounded-2xl bg-white/80 shadow p-3">
                <div className="flex items-center gap-2">
                  <div className="text-lg">{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}</div>
                  <div className="font-extrabold text-purple-900">Hạng {r.rank}</div>
                </div>
                <div className="mt-1 text-center font-extrabold text-lg text-purple-900">
                  {r.amount != null ? `${r.amount} ${r.prize_type}` : "—"}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 justify-center">
                  {(r.numbers || []).slice(0, 4).map((n) => (
                    <span
                      key={String(n)}
                      className="px-3 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-sm font-bold"
                    >
                      {String(n).padStart(4, "0")}
                    </span>
                  ))}
                  {(!r.numbers || r.numbers.length === 0) && (
                    <span className="text-xs text-gray-500">Chưa có</span>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
