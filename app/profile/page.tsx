"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Camera, MapPin, MessageCircle, Pencil, Phone, Store, Clock, Home, Briefcase, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { useAuth } from "@/lib/auth-context";

type ProfileApi = {
  ok: boolean;
  profile?: any;
  wallet?: any;
  debug?: any;
  error?: string;
  detail?: string;
};

type SettingsProfile = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
};

type ProfileExtras = {
  user_id: string;
  intro?: string | null;
  activity_area?: string | null;
  service_field?: string | null;
  provider_contact?: string | null;
  provider_hours?: string | null;
  provider_address?: string | null;
  provider_business_name?: string | null;
  provider_business_description?: string | null;
};

function isRootAdminUsername(username?: string | null) {
  return (username || "").toLowerCase() === "hlong295";
}

function safeStr(v: any) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : "—";
}

function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();

  const isRootAdmin = useMemo(() => isRootAdminUsername(user?.username), [user?.username]);

  const targetUserId = searchParams.get("userId") || undefined;
  const targetPiUsername = searchParams.get("pi_username") || undefined;

  const [profileApi, setProfileApi] = useState<ProfileApi | null>(null);
  const [settingsProfile, setSettingsProfile] = useState<SettingsProfile | null>(null);
  const [extras, setExtras] = useState<ProfileExtras | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);

  const effectiveTargetQuery = useMemo(() => {
    if (!isRootAdmin) return "";
    if (targetUserId) return `?userId=${encodeURIComponent(targetUserId)}`;
    if (targetPiUsername) return `?pi_username=${encodeURIComponent(targetPiUsername)}`;
    return "";
  }, [isRootAdmin, targetUserId, targetPiUsername]);

  const effectiveUserIdForAdmin = useMemo(() => {
    // If root admin opened a target profile, we need an explicit userId for update calls
    if (!isRootAdmin) return undefined;
    if (targetUserId) return targetUserId;
    // If only pi_username is provided, we resolve after /api/profile loads
    return undefined;
  }, [isRootAdmin, targetUserId]);

  async function loadAll() {
    if (!user?.id) return;

    setLoading(true);
    setErrorMsg(null);
    setDebugMsg(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.id) headers["x-user-id"] = user.id;
      if (user?.pi_uid) headers["x-pi-user-id"] = user.pi_uid;
      if (user?.username) headers["x-pi-username"] = user.username;

      // 1) Load main profile (pi_users + wallet)
      const r1 = await fetch(`/api/profile${effectiveTargetQuery}`, { headers, cache: "no-store" });
      const j1 = (await r1.json()) as ProfileApi;
      setProfileApi(j1);

      if (!j1.ok) {
        setErrorMsg(`${j1.error || "PROFILE_LOAD_FAILED"}${j1.detail ? `: ${j1.detail}` : ""}`);
        return;
      }

      // Determine target userId after load (needed when root admin used pi_username)
      const resolvedTargetUserId = (j1 as any)?.debug?.targetUserId || (j1 as any)?.profile?.id || user.id;

      // 2) Load Settings profile (avatar_url + canonical full_name)
      const r2 = await fetch(`/api/settings/profile?userId=${encodeURIComponent(resolvedTargetUserId)}`, {
        headers,
        cache: "no-store",
      });
      const j2 = await r2.json();
      if (j2?.ok && j2?.data) setSettingsProfile(j2.data);

      // 3) Load profile_extras
      const r3 = await fetch(`/api/profile/extras?userId=${encodeURIComponent(resolvedTargetUserId)}`, {
        headers,
        cache: "no-store",
      });
      const j3 = await r3.json();
      if (j3?.ok && j3?.data) setExtras(j3.data);

      if (searchParams.get("debug") === "1") {
        setDebugMsg(JSON.stringify({ profile: j1?.debug, settings: j2?.debug, extras: j3?.debug }, null, 2));
      }
    } catch (e: any) {
      setErrorMsg(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user?.id) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user?.id, effectiveTargetQuery]);

  const profile = profileApi?.profile || null;

  const displayName =
    safeStr(settingsProfile?.full_name) !== "—" ? safeStr(settingsProfile?.full_name) : safeStr(profile?.full_name);
  const piUsername = safeStr(profile?.pi_username) !== "—" ? profile?.pi_username : user?.username;

  const isProvider = Boolean(profile?.provider_approved) || String(profile?.provider_status || "").toLowerCase() === "provider";
  const isTrusted = Boolean(profile?.provider_trusted) || String(profile?.provider_status || "").toLowerCase() === "trusted";
  const isVerified = Boolean(profile?.provider_verified) || String(profile?.verification_status || "").toLowerCase() === "verified";

  const wallet = profileApi?.wallet || null;
  const wBalance = num(wallet?.balance);
  const wLocked = num(wallet?.locked_balance);
  const wSpent = num(wallet?.total_spent);
  const wTotal = wBalance + wLocked;

  const canEdit = Boolean(user?.id) && (isRootAdmin || !effectiveTargetQuery);

  const resolvedTargetUserIdForEdits =
    effectiveUserIdForAdmin || (profileApi as any)?.debug?.targetUserId || (profile as any)?.id || user?.id;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-200/40 via-pink-100/30 to-white">
      <div className="mx-auto max-w-md px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <ProfileHeader
            avatarUrl={settingsProfile?.avatar_url || null}
            name={displayName}
            username={piUsername}
            isTrusted={isTrusted}
            isVerified={isVerified}
            isProvider={isProvider}
            canEdit={canEdit}
            onSaved={loadAll}
            targetUserId={resolvedTargetUserIdForEdits}
          />

          {errorMsg && (
            <Card className="mt-4 border-red-200 bg-red-50">
              <CardContent className="p-3 text-sm text-red-700">{errorMsg}</CardContent>
            </Card>
          )}

          {debugMsg && (
            <Card className="mt-4">
              <CardContent className="p-3">
                <pre className="whitespace-pre-wrap break-words text-xs">{debugMsg}</pre>
              </CardContent>
            </Card>
          )}

          {/* Wallet PITD */}
          <Card className="mt-4 shadow-lg">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-purple-600" />
                <div className="text-base font-semibold">Ví PITD</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Balance</div>
                  <div className="font-semibold">{wBalance.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Locked</div>
                  <div className="font-semibold">{wLocked.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Total</div>
                  <div className="font-semibold">{wTotal.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Total spent</div>
                  <div className="font-semibold">{wSpent.toLocaleString()}</div>
                </div>
              </div>

              <div className="mt-3 text-sm">
                <div className="text-gray-500">Address</div>
                <div className="break-all font-medium">{wallet?.address ? String(wallet.address) : "—"}</div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <AboutCard
            intro={extras?.intro || ""}
            activityArea={extras?.activity_area || ""}
            serviceField={extras?.service_field || ""}
            canEdit={canEdit}
            onSaved={loadAll}
            targetUserId={resolvedTargetUserIdForEdits}
          />

          {/* Provider block (only if provider) */}
          {isProvider && (
            <ProviderCard
              businessName={
                safeStr(profile?.provider_business_name) !== "—"
                  ? profile?.provider_business_name
                  : extras?.provider_business_name || ""
              }
              businessDesc={
                safeStr(profile?.provider_business_description) !== "—"
                  ? profile?.provider_business_description
                  : extras?.provider_business_description || ""
              }
              contact={extras?.provider_contact || `pi://${piUsername}`}
              hours={extras?.provider_hours || ""}
              address={extras?.provider_address || ""}
              canEdit={canEdit}
              onSaved={loadAll}
              targetUserId={resolvedTargetUserIdForEdits}
            />
          )}

          {/* Placeholder for tabs (posts/products/reviews) */}
          <div className="mt-6">
            <div className="flex items-center gap-6 border-b px-1 text-sm">
              <button className="border-b-2 border-purple-600 pb-2 font-semibold text-purple-700">Bài đăng</button>
              <button className="pb-2 text-gray-500">Sản phẩm/Dịch vụ</button>
              <button className="pb-2 text-gray-500">Đánh giá</button>
            </div>
            <div className="py-10 text-center text-sm text-gray-400">Chưa có nội dung</div>
          </div>
        </motion.div>

        <div className="mt-8 text-center text-xs text-gray-400">
          {loading ? "Đang tải…" : ""}
        </div>
      </div>
    </div>
  );
}

function ProfileHeader(props: {
  avatarUrl: string | null;
  name: string;
  username?: string | null;
  isTrusted: boolean;
  isVerified: boolean;
  isProvider: boolean;
  canEdit: boolean;
  onSaved: () => void;
  targetUserId?: string;
}) {
  const { user } = useAuth();

  return (
    <Card className="shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-pink-400">
            {props.avatarUrl ? (
              <Image
                src={props.avatarUrl}
                alt="avatar"
                fill
                className="object-cover"
                sizes="80px"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">π</div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-gray-900">{props.name}</div>
                <div className="text-sm text-gray-500">@{props.username || user?.username || ""}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge label="Thành viên" variant="member" />
                  {props.isProvider && <Badge label="Nhà cung cấp" variant="provider" />}
                  {props.isTrusted && <Badge label="Uy tín" variant="trusted" />}
                  {props.isVerified && <Badge label="Đã xác thực" variant="verified" />}
                </div>
              </div>

              {props.canEdit && (
                <EditHeaderDialog
                  targetUserId={props.targetUserId}
                  currentName={props.name}
                  onSaved={props.onSaved}
                />
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <Button className="flex-1" variant="default">
                <MessageCircle className="mr-2 h-4 w-4" /> Nhắn tin
              </Button>
              <Button className="flex-1" variant="outline">
                + Theo dõi
              </Button>
              <Button className="flex-1" variant="outline">
                👍 Đánh giá
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditHeaderDialog(props: { targetUserId?: string; currentName: string; onSaved: () => void }) {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.currentName === "—" ? "" : props.currentName);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    setMsg(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      headers["x-user-id"] = user.id;
      if (user?.pi_uid) headers["x-pi-user-id"] = user.pi_uid;
      if (user?.username) headers["x-pi-username"] = user.username;

      const targetUserId = props.targetUserId;

      // 1) Upload avatar if provided
      if (file) {
        const buf = await file.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const r = await fetch("/api/settings/avatar", {
          method: "POST",
          headers,
          body: JSON.stringify({
            fileBase64: b64,
            mimeType: file.type || "image/png",
            userId: targetUserId,
          }),
        });
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "AVATAR_UPLOAD_FAILED");
      }

      // 2) Update name if changed and non-empty
      const trimmed = (name || "").trim();
      if (trimmed.length) {
        const r = await fetch("/api/settings/profile", {
          method: "POST",
          headers,
          body: JSON.stringify({ full_name: trimmed, userId: targetUserId }),
        });
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "PROFILE_UPDATE_FAILED");
      }

      setOpen(false);
      props.onSaved();
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (open) {
      setName(props.currentName === "—" ? "" : props.currentName);
      setFile(null);
      setMsg(null);
    }
  }, [open, props.currentName]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-9 w-9">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium">Tên hiển thị</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên" />
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Ảnh đại diện</div>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm">
              <Camera className="h-4 w-4" />
              <span>{file ? file.name : "Chọn ảnh…"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {msg && <div className="text-sm text-red-600">{msg}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ label, variant }: { label: string; variant: "member" | "provider" | "trusted" | "verified" }) {
  const styles = {
    member: "bg-purple-100 text-purple-700",
    provider: "bg-orange-100 text-orange-700",
    trusted: "bg-green-100 text-green-700",
    verified: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[variant]}`}>{label}</span>
  );
}

function AboutCard(props: {
  intro: string;
  activityArea: string;
  serviceField: string;
  canEdit: boolean;
  onSaved: () => void;
  targetUserId?: string;
}) {
  return (
    <Card className="mt-4 shadow-lg">
      <CardContent className="relative p-4">
        {props.canEdit && (
          <EditSectionDialog
            title="Giới thiệu"
            initialValues={{ intro: props.intro, activity_area: props.activityArea, service_field: props.serviceField }}
            fields={[
              { key: "intro", label: "Giới thiệu", type: "textarea" },
              { key: "activity_area", label: "Khu vực hoạt động", type: "text" },
              { key: "service_field", label: "Lĩnh vực cung cấp", type: "text" },
            ]}
            onSave={async (values) => {
              await saveExtras({ userId: props.targetUserId, ...values });
              props.onSaved();
            }}
          />
        )}

        <div className="mb-4 text-lg font-semibold">Giới thiệu</div>

        <div className="space-y-3 text-sm">
          <div className="text-gray-700">{safeStr(props.intro)}</div>

          <div className="flex items-start gap-2 text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4" />
            <div>
              <div className="text-gray-500">Khu vực hoạt động</div>
              <div className="font-medium text-gray-800">{safeStr(props.activityArea)}</div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-gray-600">
            <Briefcase className="mt-0.5 h-4 w-4" />
            <div>
              <div className="text-gray-500">Lĩnh vực cung cấp</div>
              <div className="font-medium text-gray-800">{safeStr(props.serviceField)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderCard(props: {
  businessName: string;
  businessDesc: string;
  contact: string;
  hours: string;
  address: string;
  canEdit: boolean;
  onSaved: () => void;
  targetUserId?: string;
}) {
  return (
    <Card className="mt-4 shadow-lg">
      <CardContent className="relative p-4">
        {props.canEdit && (
          <EditSectionDialog
            title="Nhà cung cấp"
            initialValues={{
              provider_business_name: props.businessName,
              provider_business_description: props.businessDesc,
              provider_contact: props.contact,
              provider_hours: props.hours,
              provider_address: props.address,
            }}
            fields={[
              { key: "provider_business_name", label: "Tên nhà cung cấp", type: "text" },
              { key: "provider_business_description", label: "Mô tả", type: "textarea" },
              { key: "provider_contact", label: "Liên hệ", type: "text" },
              { key: "provider_hours", label: "Giờ hoạt động", type: "text" },
              { key: "provider_address", label: "Địa chỉ", type: "text" },
            ]}
            onSave={async (values) => {
              await saveExtras({ userId: props.targetUserId, ...values });
              props.onSaved();
            }}
          />
        )}

        <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Store className="h-5 w-5 text-orange-600" />
          <span>Nhà cung cấp</span>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="font-semibold text-gray-900">{safeStr(props.businessName)}</div>
            <div className="text-gray-600">{safeStr(props.businessDesc)}</div>
          </div>

          <div className="flex items-start gap-2 text-gray-600">
            <Phone className="mt-0.5 h-4 w-4" />
            <div>
              <div className="text-gray-500">Liên hệ</div>
              <div className="font-medium text-gray-800">{safeStr(props.contact)}</div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-gray-600">
            <Clock className="mt-0.5 h-4 w-4" />
            <div>
              <div className="text-gray-500">Giờ hoạt động</div>
              <div className="font-medium text-gray-800">{safeStr(props.hours)}</div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-gray-600">
            <Home className="mt-0.5 h-4 w-4" />
            <div>
              <div className="text-gray-500">Địa chỉ</div>
              <div className="font-medium text-gray-800">{safeStr(props.address)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditSectionDialog(props: {
  title: string;
  initialValues: Record<string, string>;
  fields: Array<{ key: string; label: string; type: "text" | "textarea" }>;
  onSave: (values: Record<string, string>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(props.initialValues);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(props.initialValues);
      setMsg(null);
    }
  }, [open, props.initialValues]);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await props.onSave(values);
      setOpen(false);
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 top-2 h-9 w-9 rounded-full border bg-white/70 shadow"
        >
          <span className="text-lg">≡</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {props.fields.map((f) => (
            <div key={f.key}>
              <div className="mb-1 text-sm font-medium">{f.label}</div>
              {f.type === "textarea" ? (
                <Textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder="—"
                />
              ) : (
                <Input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder="—"
                />
              )}
            </div>
          ))}

          {msg && <div className="text-sm text-red-600">{msg}</div>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function saveExtras(values: Record<string, string | undefined>) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // client auth headers are read server-side via cookies/headers; this endpoint uses getUserFromRequest
  const r = await fetch("/api/profile/extras", {
    method: "PUT",
    headers,
    body: JSON.stringify(values),
  });
  const j = await r.json();
  if (!j?.ok) throw new Error(j?.error || "EXTRAS_UPDATE_FAILED");
}
