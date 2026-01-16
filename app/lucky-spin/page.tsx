"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { ROOT_ADMIN_USERNAME, useAuth } from "@/lib/auth-context";

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
  reward_currency?: "PI" | "PITD" | "BOTH" | string | null;
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

type EntryListItem = {
  user_id: string;
  chosen_number: number;
  created_at: string;
  user_display: string;
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

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Render in the viewer's local timezone (device/browser timezone).
  try {
    const fmt = new Intl.DateTimeFormat("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    // vi-VN outputs like: "16/01/2026 21:06" (some browsers insert comma)
    return fmt.format(d).replace(",", "");
  } catch {
    // Fallback to device local time
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }
}

function msToCountdown(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`;
}

export default function LuckySpinPage() {
  const { user, piUser, session } = useAuth();
  const isPiLogin = !!piUser?.uid;
  // auth-context User uses `uid` (not `id`). Checking a non-existent field
  // makes the UI incorrectly show “LOGIN_REQUIRED” even when the user is logged in.
  const [hasLocalLoginHint, setHasLocalLoginHint] = useState(false);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const v =
        localStorage.getItem("pitodo_pi_user_id") ||
        localStorage.getItem("pi_user_id") ||
        localStorage.getItem("pitodo_pi_user") ||
        localStorage.getItem("pi_user");
      setHasLocalLoginHint(!!v);
    } catch {
      // ignore
    }
  }, []);

  const isLoggedIn = !!(piUser?.uid || (user as any)?.uid || session?.user || hasLocalLoginHint);

  // Normalize Pi user identity fields across environments/patches.
  const piUsername = useMemo(() => {
    const p: any = piUser as any;
    const u: any = user as any;
    return (
      p?.username ||
      p?.pi_username ||
      p?.piUsername ||
      u?.username ||
      u?.pi_username ||
      u?.piUsername ||
      ""
    )
      ?.toString?.()
      ?.trim?.();
  }, [piUser, user]);

  const piUid = useMemo(() => {
    const p: any = piUser as any;
    const u: any = user as any;
    return (
      p?.uid ||
      p?.pi_uid ||
      p?.piUid ||
      u?.uid ||
      u?.pi_uid ||
      u?.piUid ||
      ""
    )
      ?.toString?.()
      ?.trim?.();
  }, [piUser, user]);

  const isAdminUI = useMemo(() => {
    const role = (user as any)?.role;
    const piU = piUsername;
    const userUsername = String((user as any)?.username || "");
    const root = String(ROOT_ADMIN_USERNAME || "hlong295");
    const isRootByName =
      piU.toLowerCase() === root.toLowerCase() ||
      userUsername.toLowerCase() === root.toLowerCase();
    return role === "admin" || role === "root_admin" || isRootByName;
  }, [user, piUsername]);

  const dbgEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("dbg") === "1";
  }, []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  // Countdown needs a re-render tick; relying on a plain `const now = Date.now()`
  // will not update over time.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
  const [adminEventDraft, setAdminEventDraft] = useState<LotteryEvent | null>(null);
  const [adminPrizesDraft, setAdminPrizesDraft] = useState<Prize[]>([]);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminCancelling, setAdminCancelling] = useState(false);
  const [adminSaveMsg, setAdminSaveMsg] = useState<string>("");

  // Admin-configurable number range + eligible login kinds
  const [adminNumberMin, setAdminNumberMin] = useState<number>(0);
  const [adminNumberMax, setAdminNumberMax] = useState<number>(9999);
  const [adminAuthAllow, setAdminAuthAllow] = useState<"pi" | "email" | "both">("both");

  // Entries list (view registrations)
  const [entriesOpen, setEntriesOpen] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entries, setEntries] = useState<EntryListItem[]>([]);

  const [suggestNumber, setSuggestNumber] = useState<number>(() => Math.floor(Math.random() * 10000));
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);

  const [rankWinners, setRankWinners] = useState<RankWinners[]>([]);
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  const authHeaders = useMemo(() => {
    // IMPORTANT (Pi Browser): server APIs cannot read localStorage, so we must pass an identifier via headers.
    // Our server-side resolver prefers x-pi-user-id first. Only set it when we are sure it is an INTERNAL UUID.
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const isUuid = (v: any) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

    const uid = piUid;
    const username = piUsername;

    // IMPORTANT: Pi Browser / Pi login can surface multiple ids that *look* like UUIDs (pi_uid vs internal uuid).
    // To avoid false positives (causing FORBIDDEN), always prefer resolving by username/email when possible.
    if (username) {
      headers["x-user-id"] = username;
      // Critical for Pi App Studio/Pi Browser where server-side cookies/env can be flaky:
      // provide the Pi username explicitly so admin checks can still succeed.
      headers["x-pi-username"] = username;
    } else if (isUuid(uid)) {
      // Fallback: if we truly don't have username, at least pass a UUID.
      headers["x-user-id"] = uid;
    }

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [piUid, piUsername, session?.access_token]);

  function toDateTimeLocalValue(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromDateTimeLocalValue(v: string) {
    // IMPORTANT:
    // Some mobile webviews (Pi Browser / Pi App Studio) have inconsistent parsing
    // for datetime-local strings. We parse it manually as LOCAL time.
    // Expected input: YYYY-MM-DDTHH:MM
    if (!v) return null;

    const m = /^\s*(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(v);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const hh = Number(m[4]);
      const mi = Number(m[5]);
      const local = new Date(y, mo - 1, d, hh, mi, 0, 0);
      if (!Number.isNaN(local.getTime())) return local.toISOString();
    }

    // Fallback: try native parsing
    const d2 = new Date(v);
    if (!Number.isNaN(d2.getTime())) return d2.toISOString();

    // Last-resort: if this webview emits a localized string we can't parse,
    // keep the raw value so the server can attempt stricter parsing & return debug.
    return v;
  }

  async function saveAdminConfig() {
    try {
      setAdminSaveMsg("");
      if (!adminEventDraft) {
        setAdminSaveMsg("ADMIN_NO_EVENT");
        return;
      }
      setAdminSaving(true);

      // Pi App Studio / Pi Browser can strip custom headers in some webviews.
      // We send both headers and query params so the server can still verify root admin.
      const qp = new URLSearchParams();
      if (piUsername) qp.set("pi_username", piUsername);
      if (piUid) qp.set("pi_user_id", piUid);

      const res = await fetch(`/api/lottery/admin/config?${qp.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          // ensure root username always reaches server for checks
          ...(piUsername ? { "x-pi-username": piUsername } : {}),
          ...(piUid ? { "x-pi-user-id": piUid } : {}),
        },
        body: JSON.stringify({
          event: {
            ...adminEventDraft,
            meta: {
              // Keep existing meta keys server-side; we only patch these keys.
              number_min: adminNumberMin,
              number_max: adminNumberMax,
              participant_auth: adminAuthAllow,
            },
          },
          prizes: adminPrizesDraft,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
	        const detail = json?.detail ? ` | ${json.detail}` : "";
	        const dbg = json?.debug ? ` | debug:${JSON.stringify(json.debug)}` : "";
	        setAdminSaveMsg(`ADMIN_SAVE_FAILED: ${json?.error || res.status}${detail}${dbg}`);
        return;
      }

      setAdminSaveMsg("ADMIN_SAVED_OK");
      // Refresh the public view immediately
      // Pi Browser can throw "Can't find variable: refresh" if an older bundle still references
      // a removed helper. Refresh by re-loading current data instead of relying on router.refresh.
      await loadAll();
    } catch (e: any) {
      setAdminSaveMsg(`ADMIN_SAVE_ERROR: ${e?.message || String(e)}`);
    } finally {
      setAdminSaving(false);
    }
  }

  async function cancelAdminEvent() {
    if (!adminEventDraft?.id) {
      setAdminStatus("ADMIN_CANCEL_ERROR: Missing event id");
      return;
    }
    if (!confirm("Hủy sự kiện hiện tại? (Không xóa dữ liệu, chỉ hủy để tạo chương trình mới)") ) {
      return;
    }
    try {
      setAdminCancelling(true);
      setAdminStatus("ADMIN_CANCELLING...");
      const res = await fetch("/api/admin/lottery/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ event_id: adminEventDraft.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setAdminStatus(`ADMIN_CANCEL_ERROR: ${json?.code || res.status} ${json?.message || ""}`.trim());
        return;
      }
      setAdminStatus("ADMIN_CANCELLED_OK");
      await loadAll();
    } catch (e: any) {
      setAdminStatus(`ADMIN_CANCEL_ERROR: ${e?.message || String(e)}`);
    } finally {
      setAdminCancelling(false);
    }
  }

  // Best-effort login hint for Pi Browser refresh cases.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const possibleKeys = ["pi_user_id", "pitodo_pi_user_id", "pitodo_pi_user", "pitodo_pi_username", "pi_username"];
      for (const k of possibleKeys) {
        const v = window.localStorage.getItem(k);
        if (v && String(v).length > 0) {
          setHasLocalLoginHint(true);
          return;
        }
      }
    } catch {
      // ignore
    }
  }, []);


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
      if (json?.my_entry?.chosen_number !== undefined && json?.my_entry?.chosen_number !== null) {
        // Lock displayed number to the registered one (members cannot change once registered).
        const n = Number(json.my_entry.chosen_number);
        if (Number.isFinite(n)) setSuggestNumber(n);
      }
      // If user has not registered yet, suggest a number within the configured range.
      if (!json?.my_entry && json?.event) {
        const meta: any = (json.event as any)?.meta || {};
        const minRaw = meta.number_min ?? meta.numberMin ?? 0;
        const maxRaw = meta.number_max ?? meta.numberMax ?? 9999;
        const min = Number(minRaw);
        const max = Number(maxRaw);
        const lo = Number.isFinite(min) ? min : 0;
        const hi = Number.isFinite(max) ? max : 9999;
        const a = Math.min(lo, hi);
        const b = Math.max(lo, hi);
        const span = Math.max(0, b - a);
        const suggested = a + Math.floor(Math.random() * (span + 1));
        setSuggestNumber(suggested);
      }
      setMyWin(json?.my_win || null);
      setMyPayoutRequest(json?.my_payout_request || null);
      setEligible(!!json?.eligible);
      setIneligibleReason(json?.ineligible_reason || "");

      // Prepare Admin drafts
      if (isAdminUI && json?.event) {
        const meta: any = (json.event as any)?.meta || {};
        const minRaw = meta.number_min ?? meta.numberMin ?? 0;
        const maxRaw = meta.number_max ?? meta.numberMax ?? 9999;
        const authRaw = (meta.participant_auth ?? meta.auth_allow ?? meta.authAllow ?? "both") as any;
        const min = Number(minRaw);
        const max = Number(maxRaw);
        setAdminNumberMin(Number.isFinite(min) ? min : 0);
        setAdminNumberMax(Number.isFinite(max) ? max : 9999);
        setAdminAuthAllow(authRaw === "pi" || authRaw === "email" || authRaw === "both" ? authRaw : "both");

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
          reward_currency: json.event.reward_currency ?? "PITD",
          status: json.event.status,
          meta: meta,
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

  const countdownMs = useMemo(() => {
    if (!event) return 0;
    const closeAt = new Date(event.close_at).getTime();
    return closeAt - Date.now();
  }, [event, tick]);

  const numberRange = useMemo(() => {
    const meta: any = (event as any)?.meta || {};
    const minRaw = meta.number_min ?? meta.numberMin ?? 0;
    const maxRaw = meta.number_max ?? meta.numberMax ?? 9999;
    const min = Number(minRaw);
    const max = Number(maxRaw);
    const lo = Number.isFinite(min) ? min : 0;
    const hi = Number.isFinite(max) ? max : 9999;
    return {
      min: Math.min(lo, hi),
      max: Math.max(lo, hi),
    };
  }, [event]);

  const participantAuthAllow = useMemo(() => {
    const meta: any = (event as any)?.meta || {};
    const v = (meta.participant_auth ?? meta.auth_allow ?? meta.authAllow ?? "both") as any;
    return v === "pi" || v === "email" || v === "both" ? v : "both";
  }, [event]);

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

  async function toggleEntries() {
    if (!event) return;
    const next = !entriesOpen;
    setEntriesOpen(next);
    if (!next) return;
    setEntriesLoading(true);
    try {
      const res = await fetch(`/api/lottery/entries?event_id=${encodeURIComponent(event.id)}`, {
        headers: authHeaders,
        cache: "no-store",
      });
      const parsed = await readJsonSafe(res);
      const json: any = parsed.json ?? {};
      if (!res.ok) {
        if (dbgEnabled) setDebug((prev: any) => ({ ...(prev || {}), entries_error: json }));
        setEntries([]);
        return;
      }
      setEntries(Array.isArray(json?.entries) ? json.entries : []);
    } catch (e: any) {
      if (dbgEnabled) setDebug((prev: any) => ({ ...(prev || {}), entries_error: String(e?.message || e) }));
      setEntries([]);
    } finally {
      setEntriesLoading(false);
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
            {myEntry ? (
              <div className="px-6 py-2 rounded-2xl bg-purple-100 text-purple-900 font-extrabold text-3xl tracking-wider">
                {String(suggestNumber).padStart(4, "0")}
              </div>
            ) : (
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                type="number"
                className="px-6 py-2 rounded-2xl bg-purple-100 text-purple-900 font-extrabold text-3xl tracking-wider text-center w-48"
                value={suggestNumber}
                min={numberRange.min}
                max={numberRange.max}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = Number(raw);
                  if (!Number.isFinite(n)) {
                    setSuggestNumber(numberRange.min);
                    return;
                  }
                  const clamped = Math.min(numberRange.max, Math.max(numberRange.min, Math.floor(n)));
                  setSuggestNumber(clamped);
                }}
              />
            )}
            <div className="mt-2 text-sm text-gray-700">
              Số của bạn: <b>{myEntry ? String(myEntry.chosen_number).padStart(4, "0") : "Chưa đăng ký"}</b>
            </div>
            {!myEntry && (
              <div className="mt-1 text-xs text-gray-500">
                Bạn lưu ý, bạn chỉ có thể chọn số được 1 lần cho 1 lần xổ số.
                <div className="mt-1">Phạm vi số: <b>{numberRange.min}</b> → <b>{numberRange.max}</b></div>
              </div>
            )}

            <div className="mt-4 w-full flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-2xl bg-white border border-purple-200 py-3 text-purple-900 font-bold"
                onClick={() => {
                  const a = numberRange.min;
                  const b = numberRange.max;
                  const span = Math.max(0, b - a);
                  setSuggestNumber(a + Math.floor(Math.random() * (span + 1)));
                }}
                disabled={!event || loading || !!myEntry}
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

            <button
              type="button"
              className="mt-3 text-sm font-bold text-purple-900/80"
              onClick={toggleEntries}
              disabled={!event || entriesLoading}
            >
              {entriesLoading ? "Đang tải danh sách…" : entriesOpen ? "Ẩn danh sách đã đăng ký" : "Xem danh sách đã đăng ký"}
            </button>

            {entriesOpen ? (
              <div className="mt-3 w-full rounded-2xl bg-white border border-purple-200 p-3">
                <div className="font-extrabold text-purple-900 mb-2">Danh sách đã đăng ký</div>
                {entries.length ? (
                  <div className="max-h-60 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-purple-900/80">
                          <th className="py-1 pr-2">Thành viên</th>
                          <th className="py-1 pr-2">Số</th>
                          <th className="py-1">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((it, idx) => (
                          <tr key={`${it.user_id}_${idx}`} className="border-t border-purple-100">
                            <td className="py-1 pr-2 font-semibold text-purple-900">{it.user_display}</td>
                            <td className="py-1 pr-2 font-extrabold text-purple-900">{String(it.chosen_number).padStart(4, "0")}</td>
                            <td className="py-1 text-xs text-gray-600">{fmtDateTime(it.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">Chưa có ai đăng ký.</div>
                )}
              </div>
            ) : null}

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

        {/* Admin configuration (root admin only) */}
        {isAdminUI && (
          <div className="mt-6 rounded-2xl bg-white/80 shadow p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-purple-900">Quản trị: Cấu hình xổ số</h3>
              <span className="text-xs font-bold text-purple-900/70">ROOT ADMIN</span>
            </div>

            {adminSaveMsg ? (
              <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${adminSaveMsg.startsWith("OK") ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
                {adminSaveMsg}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="block">
                <div className="text-xs font-bold text-purple-900/80 mb-1">Tiêu đề</div>
                <input
                  className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                  value={adminEventDraft?.title || ""}
                  onChange={(e) => setAdminEventDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                  placeholder="Xổ số May Mắn"
                />
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Mở đăng ký</div>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs"
                    value={toDateTimeLocalValue(adminEventDraft?.open_at)}
                    onChange={(e) => setAdminEventDraft((prev) => (prev ? { ...prev, open_at: fromDateTimeLocalValue(e.target.value) } : prev))}
                  />
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Đóng đăng ký</div>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs"
                    value={toDateTimeLocalValue(adminEventDraft?.close_at)}
                    onChange={(e) => setAdminEventDraft((prev) => (prev ? { ...prev, close_at: fromDateTimeLocalValue(e.target.value) } : prev))}
                  />
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Quay số</div>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-xs"
                    value={toDateTimeLocalValue(adminEventDraft?.draw_at)}
                    onChange={(e) => setAdminEventDraft((prev) => (prev ? { ...prev, draw_at: fromDateTimeLocalValue(e.target.value) } : prev))}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!adminEventDraft?.close_when_full}
                    onChange={(e) => setAdminEventDraft((prev) => (prev ? { ...prev, close_when_full: e.target.checked } : prev))}
                  />
                  <span className="text-sm font-bold text-purple-900/80">Đóng khi đủ lượt</span>
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Giới hạn lượt đăng ký</div>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    value={adminEventDraft?.max_participants ?? ""}
                    onChange={(e) =>
                      setAdminEventDraft((prev) => (prev ? { ...prev, max_participants: e.target.value ? Number(e.target.value) : null } : prev))
                    }
                    placeholder="500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Số nhỏ nhất (min)</div>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    value={adminNumberMin}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setAdminNumberMin(Number.isFinite(n) ? Math.floor(n) : 0);
                    }}
                  />
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Số lớn nhất (max)</div>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    value={adminNumberMax}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setAdminNumberMax(Number.isFinite(n) ? Math.floor(n) : 9999);
                    }}
                  />
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Cho phép tham gia</div>
                  <select
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    value={adminAuthAllow}
                    onChange={(e) => setAdminAuthAllow(e.target.value as any)}
                  >
                    <option value="pi">Chỉ Pi user</option>
                    <option value="email">Chỉ Email user</option>
                    <option value="both">Pi + Email</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Cơ cấu giải thưởng</div>
                  <select
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    value={adminEventDraft?.reward_currency || "PITD"}
                    onChange={(e) => {
                      const v = e.target.value as any;
                      setAdminEventDraft((prev) => {
                        if (!prev) return prev;
                        const requires = v === "PI" || v === "BOTH";
                        return { ...prev, reward_currency: v, requires_pioneer: requires };
                      });
                      // Auto-normalize prize types when switching mode
                      if (v === "PI" || v === "PITD") {
                        setAdminPrizesDraft((prev) => prev.map((x) => ({ ...x, prize_type: v })));
                      }
                    }}
                  >
                    <option value="PI">Chỉ trúng PI</option>
                    <option value="PITD">Chỉ trúng PITD</option>
                    <option value="BOTH">PI + PITD</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-bold text-purple-900/80 mb-1">Ghi chú (tuỳ chọn)</div>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    value={adminEventDraft?.description ?? ""}
                    onChange={(e) => setAdminEventDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                    placeholder="Ví dụ: Chương trình tuần này..."
                  />
                </label>
              </div>

              <div className="rounded-xl border border-purple-200 bg-white p-3">
                <div className="text-sm font-extrabold text-purple-900">Giải thưởng</div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {adminPrizesDraft.slice(0, 3).map((p, idx) => (
                    <div key={p.rank || idx} className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-xs font-bold text-purple-900/80">Hạng {p.rank}</div>
                      <input
                        type="number"
                        className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                        value={p.amount ?? ""}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setAdminPrizesDraft((prev) => prev.map((x) => (x.rank === p.rank ? { ...x, amount: val } : x)));
                        }}
                        placeholder="0"
                      />
                      <select
                        className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                        value={(adminEventDraft?.reward_currency && adminEventDraft.reward_currency !== "BOTH")
                          ? (adminEventDraft.reward_currency as any)
                          : (p.prize_type || "PITD")}
                        disabled={!!adminEventDraft?.reward_currency && adminEventDraft.reward_currency !== "BOTH"}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setAdminPrizesDraft((prev) => prev.map((x) => (x.rank === p.rank ? { ...x, prize_type: val } : x)));
                        }}
                      >
                        <option value="PITD">PITD</option>
                        <option value="PI">Pi</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded-2xl bg-purple-600 text-white font-extrabold py-3 disabled:opacity-60"
                onClick={saveAdminConfig}
                disabled={adminSaving || !adminEventDraft}
              >
                {adminSaving ? "Đang lưu…" : "Lưu cấu hình"}
              </button>

              <button
                type="button"
                className="w-full mt-2 rounded-2xl bg-white border border-red-200 text-red-700 font-extrabold py-3 disabled:opacity-60"
                onClick={cancelAdminEvent}
                disabled={adminCancelling || adminSaving || !adminEventDraft}
              >
                {adminCancelling ? "Đang hủy…" : "Hủy sự kiện hiện tại"}
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
