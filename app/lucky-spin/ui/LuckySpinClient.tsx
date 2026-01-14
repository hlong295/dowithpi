"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Reward = {
  id: string;
  title: string;
  reward_type: string;
  pitd_amount?: any;
  pi_amount?: any;
  voucher_label?: string;
  weight: any;
  is_active?: boolean;
  display_order?: number;
  meta?: any;
};

type SpinLog = any;

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function wantsDbg() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("dbg") === "1";
}

function fmtAmount(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  // keep up to 6 decimals without trailing noise
  return (Math.round(n * 1_000_000) / 1_000_000).toString();
}

function makeIdempotencyKey() {
  // simple client key: ts + random
  const rnd = Math.random().toString(16).slice(2);
  return `${Date.now()}_${rnd}`;
}

function shortType(t: string) {
  const x = String(t || "").toUpperCase();
  if (x === "PITD") return "PITD";
  if (x === "PI") return "Pi";
  if (x === "VOUCHER") return "Voucher";
  return "";
}

// ---- Wheel ---------------------------------------------------------------

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    cx,
    cy,
    "L",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    "Z",
  ].join(" ");
}

function WheelSvg({
  rewards,
  rotationDeg,
}: {
  rewards: Reward[];
  rotationDeg: number;
}) {
  const active = rewards.filter((r) => r && (r as any).is_active !== false);
  const n = Math.max(active.length, 1);
  const cx = 160;
  const cy = 160;
  const r = 140;
  const step = 360 / n;

  return (
    <div className="relative mx-auto w-[320px] h-[320px]">
      {/* pointer */}
      <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-20">
        <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[28px] border-b-yellow-400 drop-shadow" />
      </div>

      <div
        className="absolute inset-0 rounded-full shadow-[0_18px_50px_rgba(0,0,0,0.12)]"
        style={{
          transform: `rotate(${rotationDeg}deg)`,
          transition: "transform 4.2s cubic-bezier(0.18, 0.9, 0.16, 1)",
        }}
      >
        <svg viewBox="0 0 320 320" className="w-full h-full">
          {/* glowing rim */}
          <defs>
            <radialGradient id="rim" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.85" />
            </radialGradient>
          </defs>

          <circle cx={cx} cy={cy} r={150} fill="url(#rim)" />

          {active.map((rw, i) => {
            const start = i * step;
            const end = (i + 1) * step;
            const mid = start + step / 2;

            // soft pastel segment colors (no hard brand changes)
            const palette = [
              "#A78BFA",
              "#F9A8D4",
              "#FDBA74",
              "#93C5FD",
              "#6EE7B7",
              "#FDE68A",
              "#C4B5FD",
              "#FCA5A5",
            ];
            const fill = palette[i % palette.length];

            const label = String(rw.title || "").trim();
            const small = label.length > 10;

            // label position
            const lp = polarToCartesian(cx, cy, 92, mid);
            const rot = mid;

            return (
              <g key={rw.id || i}>
                <path d={describeArc(cx, cy, r, start, end)} fill={fill} stroke="#ffffff" strokeWidth={2} />
                <text
                  x={lp.x}
                  y={lp.y}
                  fill="#ffffff"
                  fontSize={small ? 14 : 16}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rot} ${lp.x} ${lp.y})`}
                  style={{ textShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* center button */}
          <circle cx={cx} cy={cy} r={58} fill="#F59E0B" />
          <circle cx={cx} cy={cy} r={52} fill="#FCD34D" />
          <text
            x={cx}
            y={cy - 6}
            fill="#7C2D12"
            fontSize={18}
            fontWeight={900}
            textAnchor="middle"
          >
            QUAY
          </text>
          <text
            x={cx}
            y={cy + 18}
            fill="#7C2D12"
            fontSize={18}
            fontWeight={900}
            textAnchor="middle"
          >
            NGAY
          </text>
        </svg>
      </div>

      {/* light dots around */}
      <div className="absolute inset-0 rounded-full ring-4 ring-yellow-300/40" />
    </div>
  );
}

// ---- Page ----------------------------------------------------------------

export default function LuckySpinClient() {
  const dbg = wantsDbg();

  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [config, setConfig] = useState<{ can_manage: boolean; max_spins_per_day: number; rewards: Reward[] } | null>(null);
  const [history, setHistory] = useState<SpinLog[]>([]);
  const [spinsUsed, setSpinsUsed] = useState<number | null>(null);

  const [rotation, setRotation] = useState(0);

  // claim form (for pending PI/voucher)
  const [claimForLog, setClaimForLog] = useState<SpinLog | null>(null);
  const [claimName, setClaimName] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimNote, setClaimNote] = useState("");
  const [claimSaving, setClaimSaving] = useState(false);

  // admin editor
  const [adminMaxSpins, setAdminMaxSpins] = useState(1);
  const [adminRewards, setAdminRewards] = useState<Reward[]>([]);
  const [adminSaving, setAdminSaving] = useState(false);

  const activeRewards = useMemo(() => {
    const rs = (config?.rewards || []).filter((r) => r && (r as any).is_active !== false);
    // at least 6 segments for nicer wheel; if too few, duplicate labels (visual only)
    if (rs.length >= 6) return rs;
    const out: Reward[] = [];
    while (out.length < 6) {
      for (const r of rs) {
        out.push(r);
        if (out.length >= 6) break;
      }
      if (rs.length === 0) break;
    }
    return out.length ? out : rs;
  }, [config?.rewards]);

  async function loadAll() {
    setErr(null);
    try {
      const cfgRes = await fetch(`/api/lucky-spin/config${dbg ? "?dbg=1" : ""}`, { cache: "no-store" });
      const cfg = await cfgRes.json();
      if (!cfgRes.ok || !cfg.ok) throw new Error(cfg.error || "CONFIG_ERROR");
      setConfig({ can_manage: Boolean(cfg.can_manage), max_spins_per_day: Number(cfg.max_spins_per_day || 1), rewards: cfg.rewards || [] });
      setAdminMaxSpins(Number(cfg.max_spins_per_day || 1));
      setAdminRewards((cfg.rewards || []).map((x: any) => ({ ...x })));

      const hisRes = await fetch(`/api/lucky-spin/history?limit=30${dbg ? "&dbg=1" : ""}`, { cache: "no-store" });
      const his = await hisRes.json();
      if (hisRes.ok && his.ok) setHistory(his.logs || []);
    } catch (e: any) {
      setErr(e?.message || "LOAD_ERROR");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickIndexFromLog(log: any) {
    // Try to land roughly on the selected reward.
    const rid = String(log?.reward_id || "");
    const idx = Math.max(0, activeRewards.findIndex((r) => String(r.id) === rid));
    return idx >= 0 ? idx : 0;
  }

  async function doSpin() {
    if (spinning) return;
    setErr(null);
    setSpinning(true);
    try {
      const idem = makeIdempotencyKey();
      const res = await fetch(`/api/lucky-spin/spin${dbg ? "?dbg=1" : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotency_key: idem, client_fingerprint: "web" }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out.error || "SPIN_ERROR");

      // Animate wheel to selected index
      const idx = pickIndexFromLog(out.log);
      const n = Math.max(activeRewards.length, 1);
      const step = 360 / n;
      const targetMid = idx * step + step / 2;
      // We want pointer at top (0deg). Make wheel rotate so that targetMid goes to 0.
      const base = 360 - targetMid;
      const extraTurns = 360 * (5 + Math.floor(Math.random() * 2));
      const next = rotation + extraTurns + base;
      setRotation(next);

      // Update history after animation settles
      setTimeout(() => {
        setHistory((prev) => [out.log, ...prev].slice(0, 30));
      }, 4300);

      if (out.spins_used != null) setSpinsUsed(Number(out.spins_used));

      // If pending_contact, open claim section for latest log
      if (String(out.log?.status) === "pending_contact") {
        setTimeout(() => setClaimForLog(out.log), 4500);
      }
    } catch (e: any) {
      setErr(e?.message || "SPIN_ERROR");
    } finally {
      setTimeout(() => setSpinning(false), 4300);
    }
  }

  async function saveClaim() {
    if (!claimForLog?.id) return;
    setClaimSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lucky-spin/claim${dbg ? "?dbg=1" : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          log_id: claimForLog.id,
          full_name: claimName,
          phone: claimPhone,
          note: claimNote,
        }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out.error || "CLAIM_ERROR");
      // Update history entry
      setHistory((prev) => prev.map((x) => (x.id === out.log?.id ? out.log : x)));
      setClaimForLog(out.log);
    } catch (e: any) {
      setErr(e?.message || "CLAIM_ERROR");
    } finally {
      setClaimSaving(false);
    }
  }

  async function saveAdminConfig() {
    if (!config?.can_manage) return;
    setAdminSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lucky-spin/config${dbg ? "?dbg=1" : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_spins_per_day: adminMaxSpins, rewards: adminRewards }),
      });
      const out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out.error || "SAVE_CONFIG_ERROR");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "SAVE_CONFIG_ERROR");
    } finally {
      setAdminSaving(false);
    }
  }

  const maxSpins = config?.max_spins_per_day ?? 1;

  const latestPending = useMemo(() => {
    return history.find((x) => String(x?.status) === "pending_contact") || null;
  }, [history]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8E7FF] via-white to-white">
      <div className="mx-auto w-full max-w-[520px] px-4 pb-20 pt-4">
        {/* Hero banner (like mockup) */}
        <div className="rounded-3xl bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="text-2xl">🎁</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-white text-xl font-extrabold leading-tight">Quay số trúng thưởng</div>
                <span className="ml-auto rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-red-600">FREE mỗi ngày</span>
              </div>
              <div className="text-white/90 text-sm font-semibold">Mỗi ngày 1 lượt - Có quà liền</div>
              <div className="text-white text-sm font-extrabold mt-1">🎁 Nhận Pi hoặc PITD</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-lg">➜</span>
            </div>
          </div>
        </div>

        {/* Errors / debug */}
        {err ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {err}
          </div>
        ) : null}

        {/* Wheel */}
        <div className="mt-5 flex justify-center">
          <div className="relative">
            {/* confetti dots */}
            <div className="absolute -top-6 left-6 h-3 w-3 rounded-full bg-yellow-300/70" />
            <div className="absolute -top-1 right-10 h-2 w-2 rounded-full bg-pink-300/70" />
            <div className="absolute -bottom-6 left-14 h-2 w-2 rounded-full bg-purple-300/70" />

            <WheelSvg rewards={activeRewards} rotationDeg={rotation} />
          </div>
        </div>

        {/* Spin card (like mockup bottom) */}
        <div className="mt-6 rounded-3xl border border-purple-200 bg-white/80 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-2xl">🎟️</div>
            <div className="flex-1">
              <div className="text-base font-extrabold text-purple-900">
                Bạn còn <span className="text-red-600">{Math.max((maxSpins || 1) - (spinsUsed ?? 0), 0)}</span> lượt quay hôm nay
              </div>
              <div className="text-sm font-semibold text-slate-600">Mỗi ngày Free {maxSpins || 1} lượt - Quay trúng quà hấp dẫn!</div>
            </div>
          </div>

          <button
            onClick={doSpin}
            disabled={loading || spinning}
            className={cn(
              "mt-4 w-full rounded-full py-4 text-lg font-extrabold shadow-md",
              "bg-gradient-to-r from-yellow-300 to-orange-400 text-orange-950",
              (loading || spinning) && "opacity-60",
            )}
          >
            {spinning ? "Đang quay..." : "QUAY NGAY"}
          </button>
        </div>

        {/* Pending claim */}
        {latestPending ? (
          <div className="mt-5 rounded-3xl border border-orange-200 bg-orange-50 p-4">
            <div className="text-base font-extrabold text-orange-900">Nhận thưởng</div>
            <div className="mt-1 text-sm font-semibold text-orange-800">
              Bạn vừa trúng: <span className="font-extrabold">{String(latestPending?.reward_snapshot?.title || latestPending?.title || "")}</span>
              {latestPending?.reward_snapshot?.reward_type ? (
                <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs font-extrabold text-orange-700">
                  {shortType(String(latestPending.reward_snapshot.reward_type))}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm font-semibold text-orange-800">
              Nếu là <b>Pi thật</b>: vui lòng để lại thông tin, admin sẽ liên hệ để payout.
            </div>

            <div className="mt-3 grid gap-2">
              <input
                className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold"
                placeholder="Họ và tên"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
              />
              <input
                className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold"
                placeholder="Số điện thoại liên hệ"
                value={claimPhone}
                onChange={(e) => setClaimPhone(e.target.value)}
              />
              <textarea
                className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-sm font-semibold"
                placeholder="Ghi chú (tuỳ chọn)"
                rows={3}
                value={claimNote}
                onChange={(e) => setClaimNote(e.target.value)}
              />
              <button
                onClick={saveClaim}
                disabled={claimSaving}
                className={cn(
                  "w-full rounded-2xl bg-orange-600 px-4 py-3 text-sm font-extrabold text-white",
                  claimSaving && "opacity-60",
                )}
              >
                {claimSaving ? "Đang lưu..." : "GỬI THÔNG TIN NHẬN THƯỞNG"}
              </button>
            </div>
          </div>
        ) : null}

        {/* History */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4">
          <div className="flex items-center">
            <div className="text-base font-extrabold text-slate-900">Lịch sử quay</div>
            <button
              onClick={loadAll}
              className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-extrabold text-slate-700"
            >
              Làm mới
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {history.length === 0 ? (
              <div className="text-sm font-semibold text-slate-500">Chưa có lượt quay nào.</div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-extrabold text-slate-900">
                      {String(h?.reward_snapshot?.title || h?.title || "") || "(không rõ)"}
                    </div>
                    <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-extrabold text-slate-700">
                      {String(h?.status || "")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {h?.created_at ? new Date(h.created_at).toLocaleString() : ""}
                  </div>
                  {String(h?.reward_snapshot?.reward_type || "").toUpperCase() === "PITD" ? (
                    <div className="mt-1 text-sm font-extrabold text-purple-900">
                      +{fmtAmount(h?.pitd_amount || h?.reward_snapshot?.pitd_amount)} PITD
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Admin config (inside page) */}
        {config?.can_manage ? (
          <div className="mt-6 rounded-3xl border border-purple-200 bg-white p-4">
            <div className="text-base font-extrabold text-purple-900">Quản trị: Giải thưởng & tỉ lệ</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">
              Chỉnh giải thưởng, loại thưởng, số lượng PITD/Pi, và trọng số (weight).
            </div>

            <div className="mt-3">
              <label className="text-sm font-extrabold text-slate-700">Số lượt FREE mỗi ngày</label>
              <input
                type="number"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold"
                value={adminMaxSpins}
                onChange={(e) => setAdminMaxSpins(Number(e.target.value || 1))}
                min={1}
                max={100}
              />
            </div>

            <div className="mt-4 space-y-3">
              {adminRewards.map((r, idx) => (
                <div key={r.id || idx} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      value={String(r.title || "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdminRewards((prev) => prev.map((x, i) => (i === idx ? { ...x, title: v } : x)));
                      }}
                      placeholder="Tên giải (vd: 10 PITD / Voucher 0.1π / ...)"
                    />
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      value={String(r.reward_type || "PITD")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdminRewards((prev) => prev.map((x, i) => (i === idx ? { ...x, reward_type: v } : x)));
                      }}
                    >
                      <option value="PITD">PITD</option>
                      <option value="PI">PI</option>
                      <option value="VOUCHER">VOUCHER</option>
                      <option value="NONE">NONE</option>
                    </select>
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      value={String(r.weight ?? "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdminRewards((prev) => prev.map((x, i) => (i === idx ? { ...x, weight: v } : x)));
                      }}
                      placeholder="weight"
                    />
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      value={String(r.pitd_amount ?? "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdminRewards((prev) => prev.map((x, i) => (i === idx ? { ...x, pitd_amount: v } : x)));
                      }}
                      placeholder="PITD"
                    />
                    <input
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      value={String(r.pi_amount ?? "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdminRewards((prev) => prev.map((x, i) => (i === idx ? { ...x, pi_amount: v } : x)));
                      }}
                      placeholder="Pi"
                    />
                    <input
                      className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                      value={String((r as any).voucher_label ?? "")}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAdminRewards((prev) => prev.map((x, i) => (i === idx ? { ...x, voucher_label: v } : x)));
                      }}
                      placeholder="Voucher label (vd: Voucher 0.1π)"
                    />
                    <label className="col-span-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                      <input
                        type="checkbox"
                        checked={r.is_active !== false}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setAdminRewards((prev) => prev.map((x, i) => (i === idx ? { ...x, is_active: v } : x)));
                        }}
                      />
                      Kích hoạt
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveAdminConfig}
              disabled={adminSaving}
              className={cn(
                "mt-4 w-full rounded-2xl bg-purple-700 px-4 py-3 text-sm font-extrabold text-white",
                adminSaving && "opacity-60",
              )}
            >
              {adminSaving ? "Đang lưu..." : "LƯU CẤU HÌNH"}
            </button>
          </div>
        ) : null}

        {/* Debug block */}
        {dbg ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap">
            {JSON.stringify({ config, spinsUsed, historyCount: history.length, rotation }, null, 2)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
