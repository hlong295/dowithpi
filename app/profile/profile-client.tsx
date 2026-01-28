"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Check, X, Camera, Loader2 } from "lucide-react";

import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";

type PitdWallet = {
  id?: string;
  user_id?: string;
  balance?: number;
  locked_balance?: number;
  total_spent?: number;
  address?: string;
};

type SettingsProfile = {
  id?: string;
  display_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  avatar_url?: string | null;
  user_role?: string | null;
  created_at?: string | null;
};

type PiUserProfile = {
  id?: string;
  pi_username?: string | null;
  full_name?: string | null;
  user_role?: string | null;
  verification_status?: string | null;
  provider_approved?: boolean | null;
  provider_business_name?: string | null;
  provider_business_description?: string | null;
  created_at?: string | null;
};

type ProfileExtras = {
  user_id?: string;
  intro?: string | null;
  activity_area?: string | null;
  service_field?: string | null;
  provider_contact?: string | null;
  provider_hours?: string | null;
  provider_address?: string | null;
};

function formatNumber(v?: number | null) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function isoToDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

export default function ProfilePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Admin can edit another user via ?userId=... (same behavior as fix20).
  const requestedUserId = searchParams.get("userId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const debugRef = useRef<HTMLDivElement | null>(null);

  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [piProfile, setPiProfile] = useState<PiUserProfile | null>(null);
  const [extras, setExtras] = useState<ProfileExtras | null>(null);
  const [wallet, setWallet] = useState<PitdWallet | null>(null);

  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const pushDebug = (m: string) => {
    setDebug((prev) => {
      const next = [...prev, `[${new Date().toISOString()}] ${m}`].slice(-50);
      return next;
    });
    setTimeout(() => debugRef.current?.scrollTo({ top: debugRef.current.scrollHeight }), 0);
  };

  const effectiveTargetUserId = useMemo(() => {
    if (isRootAdmin && requestedUserId) return requestedUserId;
    return targetUserId;
  }, [isRootAdmin, requestedUserId, targetUserId]);

  const isProvider = useMemo(() => {
    // Provider status: prefer pi_users.provider_approved or role.
    if (piProfile?.provider_approved) return true;
    const r = (piProfile?.user_role || profile?.user_role || "").toLowerCase();
    return r.includes("provider") || r.includes("merchant");
  }, [piProfile?.provider_approved, piProfile?.user_role, profile?.user_role]);

  const avatarUrl = useMemo(() => {
    // If user has uploaded avatar: use it. Else fallback to app logo.
    return profile?.avatar_url || "/pitodo-logo.png";
  }, [profile?.avatar_url]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Root admin detection via /api/admin/me (existing in baseline).
        const adminRes = await fetch("/api/admin/me", { cache: "no-store" });
        const adminJson = await adminRes.json().catch(() => ({}));
        const root = !!adminJson?.isRootAdmin;
        setIsRootAdmin(root);
        pushDebug(`isRootAdmin=${root}`);

        // Determine target user id
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const meJson = await meRes.json().catch(() => ({}));
        const meId = meJson?.user?.id || meJson?.id || user?.id || null;
        setTargetUserId(meId);
        pushDebug(`meId=${meId}`);
      } catch (e: any) {
        setError(e?.message || "LOAD_FAILED");
        pushDebug(`error: ${e?.message || String(e)}`);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!effectiveTargetUserId) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Profile (users) + avatar
        const pRes = await fetch(`/api/settings/profile?userId=${encodeURIComponent(effectiveTargetUserId)}`, {
          cache: "no-store",
        });
        const pJson = await pRes.json();
        if (!pRes.ok) throw new Error(pJson?.error || "PROFILE_LOAD_FAILED");
        setProfile(pJson?.profile || null);
        pushDebug("loaded settings profile");

        // Pi profile (pi_users) + business_name/description
        const piRes = await fetch(`/api/profile/pi?userId=${encodeURIComponent(effectiveTargetUserId)}`, {
          cache: "no-store",
        });
        const piJson = await piRes.json();
        if (!piRes.ok) throw new Error(piJson?.error || "PI_PROFILE_LOAD_FAILED");
        setPiProfile(piJson?.pi_user || null);
        pushDebug("loaded pi profile");

        // Extras (profile_extras)
        const exRes = await fetch(`/api/profile/extras?userId=${encodeURIComponent(effectiveTargetUserId)}`, {
          cache: "no-store",
        });
        const exJson = await exRes.json();
        if (!exRes.ok) throw new Error(exJson?.error || "EXTRAS_LOAD_FAILED");
        setExtras(exJson?.extras || null);
        pushDebug("loaded profile extras");

        // Wallet (PITD) via server API only
        const wRes = await fetch(`/api/pitd/wallet?userId=${encodeURIComponent(effectiveTargetUserId)}`, {
          cache: "no-store",
        });
        const wJson = await wRes.json().catch(() => ({}));
        if (wRes.ok) {
          setWallet(wJson?.wallet || null);
          pushDebug("loaded pitd wallet");
        } else {
          // Not fatal (e.g., permission denied / wallet not found)
          pushDebug(`wallet load failed: ${wJson?.error || "WALLET_LOAD_FAILED"}`);
          setWallet(null);
        }
      } catch (e: any) {
        setError(e?.message || "LOAD_FAILED");
        pushDebug(`error: ${e?.message || String(e)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveTargetUserId]);

  const startEdit = (key: string, currentValue?: string | null) => {
    setEditKey(key);
    setDraft((prev) => ({ ...prev, [key]: (currentValue ?? "").toString() }));
  };

  const cancelEdit = () => {
    setEditKey(null);
  };

  const saveField = async (key: string) => {
    if (!effectiveTargetUserId) return;
    const value = (draft[key] ?? "").toString();
    setSaving(key);
    setError(null);
    try {
      // Route split: core profile fields => /api/settings/profile, extras => /api/profile/extras
      if (["full_name", "phone", "address"].includes(key)) {
        const body: any = { [key]: value, userId: effectiveTargetUserId };
        const res = await fetch("/api/settings/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "SAVE_FAILED");
        setProfile((prev) => ({ ...(prev || {}), [key]: value }));
        pushDebug(`saved profile.${key}`);
      } else {
        const body: any = { [key]: value, userId: effectiveTargetUserId };
        const res = await fetch("/api/profile/extras", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "SAVE_FAILED");
        setExtras((prev) => ({ ...(prev || {}), [key]: value }));
        pushDebug(`saved extras.${key}`);
      }
      setEditKey(null);
    } catch (e: any) {
      setError(e?.message || "SAVE_FAILED");
      pushDebug(`save error: ${e?.message || String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!effectiveTargetUserId) return;
    setSaving("avatar");
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("READ_FILE_FAILED"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/settings/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, userId: effectiveTargetUserId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "AVATAR_UPLOAD_FAILED");
      const url = json?.avatar_url;
      setProfile((prev) => ({ ...(prev || {}), avatar_url: url }));
      pushDebug("avatar uploaded");
    } catch (e: any) {
      setError(e?.message || "AVATAR_UPLOAD_FAILED");
      pushDebug(`avatar error: ${e?.message || String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const roleLabel = useMemo(() => {
    const role = (piProfile?.user_role || profile?.user_role || "member").toLowerCase();
    if (role.includes("admin")) return "Admin";
    if (role.includes("provider") || role.includes("merchant")) return "Provider";
    return "Member";
  }, [piProfile?.user_role, profile?.user_role]);

  const displayName = useMemo(() => {
    return (
      profile?.full_name ||
      piProfile?.full_name ||
      profile?.display_name ||
      piProfile?.pi_username ||
      ""
    );
  }, [profile?.display_name, profile?.full_name, piProfile?.full_name, piProfile?.pi_username]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {/* Debug (Pi Browser has no console) */}
        {debug.length > 0 && (
          <div className="mb-4 bg-white rounded-lg border p-3">
            <div className="text-xs text-gray-500 mb-2">Debug</div>
            <div ref={debugRef} className="text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap">
              {debug.join("\n")}
            </div>
          </div>
        )}

        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

        {/* Profile Header (UI from fix18, data from DB) */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-purple-100 flex items-center justify-center">
                <Image
                  src={avatarUrl}
                  alt="Avatar"
                  width={96}
                  height={96}
                  className="w-24 h-24 object-cover"
                />
              </div>

              {/* Upload button */}
              <button
                type="button"
                className="absolute -bottom-1 -right-1 bg-white border rounded-full p-2 shadow-sm hover:bg-gray-50"
                onClick={() => fileInputRef.current?.click()}
                title="Đổi avatar"
              >
                {saving === "avatar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                {editKey === "full_name" ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      className="text-2xl font-bold text-gray-900 border rounded px-2 py-1 w-full"
                      value={draft.full_name ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, full_name: e.target.value }))}
                    />
                    <button
                      className="p-2 rounded border hover:bg-gray-50"
                      onClick={() => saveField("full_name")}
                      disabled={saving === "full_name"}
                      title="Lưu"
                    >
                      {saving === "full_name" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button className="p-2 rounded border hover:bg-gray-50" onClick={cancelEdit} title="Hủy">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-gray-900">{displayName || ""}</h1>
                    <button
                      className="p-2 rounded border hover:bg-gray-50"
                      onClick={() => startEdit("full_name", profile?.full_name || piProfile?.full_name)}
                      title="Sửa tên"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                  @{piProfile?.pi_username || ""}
                </span>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">{roleLabel}</span>
                {piProfile?.verification_status && (
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                    {piProfile.verification_status}
                  </span>
                )}
              </div>

              <div className="text-gray-600 mt-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>{t("profile.joined")}: {isoToDate(piProfile?.created_at || profile?.created_at) || ""}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info Card (phone/address) */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t("profile.personalInfo")}</h2>
          <div className="space-y-4">
            {/* Phone */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">{t("profile.phone")}</div>
                {editKey === "phone" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="border rounded px-2 py-1"
                      value={draft.phone ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                    />
                    <button className="p-2 rounded border hover:bg-gray-50" onClick={() => saveField("phone")}>
                      {saving === "phone" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button className="p-2 rounded border hover:bg-gray-50" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="font-medium">{profile?.phone || ""}</div>
                )}
              </div>
              {editKey !== "phone" && (
                <button className="p-2 rounded border hover:bg-gray-50" onClick={() => startEdit("phone", profile?.phone)}>
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Address */}
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <div className="text-sm text-gray-500">{t("profile.address")}</div>
                {editKey === "address" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={draft.address ?? ""}
                      onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                    />
                    <button className="p-2 rounded border hover:bg-gray-50" onClick={() => saveField("address")}>
                      {saving === "address" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button className="p-2 rounded border hover:bg-gray-50" onClick={cancelEdit}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="font-medium">{profile?.address || ""}</div>
                )}
              </div>
              {editKey !== "address" && (
                <button className="p-2 rounded border hover:bg-gray-50" onClick={() => startEdit("address", profile?.address)}>
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Intro Card (profile_extras) */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t("profile.about")}</h2>
          <div className="space-y-4">
            {(
              [
                { key: "intro", label: t("profile.bio"), type: "textarea" as const, value: extras?.intro },
                { key: "activity_area", label: t("profile.location"), type: "input" as const, value: extras?.activity_area },
                { key: "service_field", label: t("profile.skills"), type: "textarea" as const, value: extras?.service_field },
              ]
            ).map((row) => (
              <div key={row.key} className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm text-gray-500">{row.label}</div>
                  {editKey === row.key ? (
                    <div className="flex items-start gap-2 mt-1">
                      {row.type === "textarea" ? (
                        <textarea
                          className="border rounded px-2 py-1 w-full min-h-[72px]"
                          value={draft[row.key] ?? ""}
                          onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
                        />
                      ) : (
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={draft[row.key] ?? ""}
                          onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
                        />
                      )}
                      <button className="p-2 rounded border hover:bg-gray-50" onClick={() => saveField(row.key)}>
                        {saving === row.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button className="p-2 rounded border hover:bg-gray-50" onClick={cancelEdit}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="font-medium whitespace-pre-wrap">{row.value || ""}</div>
                  )}
                </div>
                {editKey !== row.key && (
                  <button className="p-2 rounded border hover:bg-gray-50" onClick={() => startEdit(row.key, row.value || "")}>
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Provider Card (only if provider) */}
        {isProvider && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t("profile.providerInfo")}</h2>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">{t("profile.businessName")}</div>
                <div className="font-medium">{piProfile?.provider_business_name || ""}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">{t("profile.businessDesc")}</div>
                <div className="font-medium whitespace-pre-wrap">{piProfile?.provider_business_description || ""}</div>
              </div>

              {(
                [
                  { key: "provider_contact", label: t("profile.providerContact"), type: "textarea" as const, value: extras?.provider_contact },
                  { key: "provider_hours", label: t("profile.providerHours"), type: "input" as const, value: extras?.provider_hours },
                  { key: "provider_address", label: t("profile.providerAddress"), type: "input" as const, value: extras?.provider_address },
                ]
              ).map((row) => (
                <div key={row.key} className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">{row.label}</div>
                    {editKey === row.key ? (
                      <div className="flex items-start gap-2 mt-1">
                        {row.type === "textarea" ? (
                          <textarea
                            className="border rounded px-2 py-1 w-full min-h-[72px]"
                            value={draft[row.key] ?? ""}
                            onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
                          />
                        ) : (
                          <input
                            className="border rounded px-2 py-1 w-full"
                            value={draft[row.key] ?? ""}
                            onChange={(e) => setDraft((p) => ({ ...p, [row.key]: e.target.value }))}
                          />
                        )}
                        <button className="p-2 rounded border hover:bg-gray-50" onClick={() => saveField(row.key)}>
                          {saving === row.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button className="p-2 rounded border hover:bg-gray-50" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="font-medium whitespace-pre-wrap">{row.value || ""}</div>
                    )}
                  </div>
                  {editKey !== row.key && (
                    <button className="p-2 rounded border hover:bg-gray-50" onClick={() => startEdit(row.key, row.value || "")}>
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PITD Wallet Block */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ví PITD</h2>
          {wallet ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Balance</div>
                <div className="text-lg font-bold">{formatNumber(wallet.balance)}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Locked</div>
                <div className="text-lg font-bold">{formatNumber(wallet.locked_balance)}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-500">Total Spent</div>
                <div className="text-lg font-bold">{formatNumber(wallet.total_spent)}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg break-all">
                <div className="text-sm text-gray-500">Address</div>
                <div className="text-sm font-mono">{wallet.address || ""}</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-600">{loading ? "Đang tải…" : "Chưa có dữ liệu ví PITD hoặc không có quyền truy cập."}</div>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6 text-gray-600">Đang tải dữ liệu…</div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
